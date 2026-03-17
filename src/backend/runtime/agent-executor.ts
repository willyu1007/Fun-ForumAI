import type { LLMGateway } from '../llm/llm-gateway.js'
import type { PromptTemplateRef } from '../llm/gateway-contract.js'
import { PROMPT_TEMPLATE_REFS } from '../llm/prompt-template-refs.js'
import type { ContextBuilder } from './context-builder.js'
import type { ResponseParser } from './response-parser.js'
import type { DataPlaneWriter } from './data-plane-writer.js'
import type { AllocationResult, EventPayload } from '../allocator/types.js'
import type { AgentExecutionResult, ExecutionContext } from './types.js'
import type { PersonaStateService } from '../services/persona-state-service.js'
import type { AgentRunRepository } from '../repos/event-repository.js'
import type { AgentService } from '../services/agent-service.js'
import type { InferenceProfileService } from '../services/inference-profile-service.js'
import { resolveAgentIdentity } from '../identity/agent-identity.js'
import { resolvePreferredVisibleModelId } from '../llm/model-preference.js'
import { buildPromptBudgetSummary } from './prompt-budget-summary.js'
import {
  attachPersonaObservation,
  buildPersonaObservation,
  recordPersonaObservation,
} from './persona-observation.js'

export interface AgentExecutorDeps {
  llmGateway: LLMGateway
  contextBuilder: ContextBuilder
  responseParser: ResponseParser
  dataplaneWriter: DataPlaneWriter
  agentRunRepo: AgentRunRepository
  agentService: AgentService
  personaStateService?: PersonaStateService | null
  inferenceProfileService?: InferenceProfileService | null
}

export class AgentExecutor {
  constructor(private readonly deps: AgentExecutorDeps) {}

  async execute(
    event: EventPayload,
    allocation: AllocationResult,
  ): Promise<AgentExecutionResult[]> {
    const results: AgentExecutionResult[] = []

    for (const agent of allocation.agents) {
      const result = await this.executeOne(event, agent)
      results.push(result)
    }

    return results
  }

  private async executeOne(
    event: EventPayload,
    agent: { agent_id: string; score: number; priority: number },
  ): Promise<AgentExecutionResult> {
    const start = Date.now()

    try {
      let ctx = await this.deps.contextBuilder.build(event, agent)
      ctx = await this.deps.contextBuilder.enrichWithLayers(ctx)

      if (ctx.skip_reason) {
        this.deps.agentRunRepo.create({
          agent_id: agent.agent_id,
          trigger_event_id: event.event_id,
          input_digest: `scene_skip|event:${event.event_type}`,
          output_json: {
            skipped: true,
            reason: ctx.skip_reason,
            ...(ctx.public_scene
              ? {
                  public_scene: {
                    episode_id: ctx.public_scene.scene_metadata.episode_id,
                    selection_id: ctx.public_scene.scene_metadata.selection_id,
                    episode_plan_id: ctx.public_scene.scene_metadata.episode_plan_id,
                    local_intent_id: ctx.public_scene.scene_metadata.local_intent_id,
                  },
                }
              : {}),
          },
          token_cost: 0,
          latency_ms: Date.now() - start,
        })
        return {
          agent_id: agent.agent_id,
          event_id: event.event_id,
          success: false,
          latency_ms: Date.now() - start,
          error: ctx.skip_reason,
        }
      }

      const templateId = this.pickTemplate(event, ctx)
      const routing = await this.resolveVisibleRouting(agent.agent_id, 'base')
      const identity = this.resolveObservationIdentity(agent.agent_id)
      const llmResponse = await this.deps.llmGateway.generateVisibleText({
        intent: 'forum_reply',
        scene: this.pickScene(event),
        agentId: agent.agent_id,
        homeVoiceLineId: routing.homeVoiceLineId,
        preferredModelId: routing.preferredModelId,
        promptRef: templateId,
        variables: this.buildVariables(ctx, identity?.persona_seed_code ?? 'scholar'),
        budgetClass: 'visible_standard',
        traceId: `runtime:${event.event_id}:${agent.agent_id}`,
        promptBudgetSummary: buildPromptBudgetSummary(this.pickScene(event), templateId, ctx.prompt_audit),
        requestedTier: routing.requestedTier,
        allowFallbackWithinLine: false,
        allowCrossFamily: false,
      })
      const latencyMs = Date.now() - start
      const observation = buildPersonaObservation({
        sourceCallsiteId: event.event_type === 'NewCommentCreated'
          ? 'agent-executor-forum-comment'
          : 'agent-executor-forum-post',
        scene: event.event_type === 'NewCommentCreated' ? 'forum_comment' : 'forum_post',
        intent: 'forum_reply',
        visibility: 'visible',
        coverageStatus: 'visible_complete',
        personaSeedCode: identity?.persona_seed_code,
        homeVoiceLineId: identity?.home_voice_line_id,
        promptRef: templateId,
        requestedTier: llmResponse.renderDecision.tier,
        resolvedTier: llmResponse.renderDecision.tier,
        renderDecision: llmResponse.renderDecision,
        usage: llmResponse.usage,
        latencyMs,
        parseSuccess: false,
        promptAudit: ctx.prompt_audit ?? null,
        llmProviderId: llmResponse.renderDecision.providerId,
        llmModelId: llmResponse.renderDecision.modelId,
      })

      const instruction = this.deps.responseParser.parse(llmResponse.content, ctx)

      if (!instruction) {
        const failedObservation = {
          ...observation,
          parse_success: false,
          error: 'LLM output could not be parsed into a valid action',
        }
        this.deps.agentRunRepo.create({
          agent_id: agent.agent_id,
          trigger_event_id: event.event_id,
          input_digest: `parse_failed|template:${templateId.id}@${templateId.version}|len:${llmResponse.content.length}`,
          output_json: attachPersonaObservation(
            {
              error: 'LLM output could not be parsed into a valid action',
              prompt_template_id: templateId.id,
              prompt_version: templateId.version,
            },
            failedObservation,
          ),
          token_cost: llmResponse.usage.total_tokens,
          latency_ms: latencyMs,
        })
        recordPersonaObservation(failedObservation)
        console.warn(`[AgentExecutor] No valid instruction from LLM for agent ${agent.agent_id}`)
        return {
          agent_id: agent.agent_id,
          event_id: event.event_id,
          success: false,
          usage: llmResponse.usage,
          latency_ms: latencyMs,
          error: 'LLM output could not be parsed into a valid action',
        }
      }

      if (ctx.public_scene) {
        instruction.public_scene = ctx.public_scene
      }

      const writeResult = await this.deps.dataplaneWriter.write(
        instruction,
        agent.agent_id,
        event.event_id,
        llmResponse.usage,
        latencyMs,
        event.chain_depth,
        {
          ...observation,
          parse_success: true,
        },
      )

      if (
        writeResult.success &&
        ctx.promptScene &&
        ctx.runtimeEnvelope?.renderTierDecision &&
        this.deps.personaStateService
      ) {
        await this.deps.personaStateService.recordVisibleRender({
          agentId: agent.agent_id,
          scene: ctx.promptScene,
          renderDecision: ctx.runtimeEnvelope.renderTierDecision,
          outputText: instruction.body,
        }).catch((err) => {
          console.error('[AgentExecutor] persona runtime render record failed:', err)
        })
      }

      return {
        agent_id: agent.agent_id,
        event_id: event.event_id,
        success: writeResult.success,
        write_instruction: instruction,
        usage: llmResponse.usage,
        latency_ms: latencyMs,
        error: writeResult.error,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.error(`[AgentExecutor] Failed for agent ${agent.agent_id}: ${message}`)
      return {
        agent_id: agent.agent_id,
        event_id: event.event_id,
        success: false,
        latency_ms: Date.now() - start,
        error: message,
      }
    }
  }

  private pickTemplate(event: EventPayload, ctx: ExecutionContext): PromptTemplateRef {
    if (ctx.public_scene) {
      return event.event_type === 'NewCommentCreated'
        ? PROMPT_TEMPLATE_REFS.agentReplyToCommentScene
        : PROMPT_TEMPLATE_REFS.agentReplyToPostScene
    }

    switch (event.event_type) {
      case 'NewPostCreated':
        return PROMPT_TEMPLATE_REFS.agentReplyToPost
      case 'NewCommentCreated':
        return PROMPT_TEMPLATE_REFS.agentReplyToComment
      default:
        return PROMPT_TEMPLATE_REFS.agentReplyToPost
    }
  }

  private pickScene(event: EventPayload): 'forum_post' | 'forum_comment' {
    return event.event_type === 'NewCommentCreated' ? 'forum_comment' : 'forum_post'
  }

  private buildVariables(
    ctx: ExecutionContext,
    personaSeedCode: import('../../shared/agent-persona-catalog.js').PersonaSeedCode,
  ): Record<string, string> {
    const vars: Record<string, string> = {
      persona_name: ctx.persona.name,
      persona_style: ctx.persona.style,
      persona_interests: ctx.persona.interests.join('、'),
      persona_language: ctx.persona.language,
      persona_seed_code: personaSeedCode,
      community_name: ctx.community.name,
      community_description: ctx.community.description,
      community_rules: ctx.community.rules
        ? `## 社区规则\n${ctx.community.rules}`
        : '',
      local_intent_block: ctx.public_scene?.local_intent_block ?? '',
      layer_traits: ctx.layers?.layer1_traits ?? '',
      layer_style: ctx.layers?.layer2_style ?? '',
      layer_instructions: ctx.layers?.layer3_instructions ?? '',
      layer_community: ctx.layers?.layer_community ?? '',
      layer_relationship: ctx.layers?.layer_relationship ?? '',
      layer_showrunner: ctx.layers?.layer_showrunner ?? '',
      layer_overrides: ctx.layers?.layer4_overrides ?? '',
      layer_memory: ctx.layers?.layer5_memory ?? '',
      layer_privacy: ctx.layers?.layer6_privacy ?? '',
      hard_control_block: ctx.layers?.hard_control_block ?? '',
      compact_control_block: ctx.layers?.compact_control_block ?? '',
      current_context_block: ctx.layers?.current_context_block ?? '',
      memory_block: ctx.layers?.memory_block ?? ctx.layers?.layer5_memory ?? '',
      soft_expression_block: ctx.layers?.soft_expression_block ?? '',
    }

    if (ctx.post) {
      vars.post_title = ctx.post.title
      vars.post_body = ctx.post.body
      vars.post_author = ctx.post.author_name
    }

    if (ctx.comments?.length) {
      vars.existing_comments = '## 已有评论\n' + ctx.comments
        .map((c) => `**${c.author_name}**：${c.body}`)
        .join('\n\n')
      vars.thread_context = ctx.comments
        .map((c) => `**${c.author_name}**：${c.body}`)
        .join('\n\n')
    } else {
      vars.existing_comments = ''
      vars.thread_context = ''
    }

    if (ctx.targetComment) {
      vars.target_comment_author = ctx.targetComment.author_name
      vars.target_comment_body = ctx.targetComment.body
    }

    return vars
  }

  private async resolveVisibleRouting(agentId: string, requestedTier: import('../../shared/agent-persona-catalog.js').RenderTier): Promise<{
    homeVoiceLineId: import('../../shared/agent-persona-catalog.js').VoiceLineId
    preferredModelId?: string
    requestedTier: import('../../shared/agent-persona-catalog.js').RenderTier
  }> {
    if (this.deps.inferenceProfileService) {
      return this.deps.inferenceProfileService.resolveVisibleRoute({ agentId, requestedTier })
    }
    const agent = this.deps.agentService.getAgent(agentId)
    const latestConfig = this.deps.agentService.getLatestConfig(agentId)
    const resolved = resolveAgentIdentity(agent, latestConfig)
    const homeVoiceLineId = resolved.summary.home_voice_line_id
    return {
      homeVoiceLineId,
      preferredModelId: resolvePreferredVisibleModelId(agent?.model, homeVoiceLineId),
      requestedTier,
    }
  }

  private resolveObservationIdentity(agentId: string): {
    persona_seed_code: import('../../shared/agent-persona-catalog.js').PersonaSeedCode
    home_voice_line_id: import('../../shared/agent-persona-catalog.js').VoiceLineId
  } | null {
    try {
      const agent = this.deps.agentService.getAgent(agentId)
      const latestConfig = this.deps.agentService.getLatestConfig(agentId)
      const resolved = resolveAgentIdentity(agent, latestConfig)
      return {
        persona_seed_code: resolved.summary.persona_seed_code,
        home_voice_line_id: resolved.summary.home_voice_line_id,
      }
    } catch {
      return null
    }
  }
}
