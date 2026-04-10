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
import type { SurfaceMediaPlanningService } from '../media/surface-media-planning-service.js'
import { config } from '../lib/config.js'
import { resolveAgentIdentity } from '../identity/agent-identity.js'
import { buildPromptBudgetSummary } from './prompt-budget-summary.js'
import { runtimeFeatureMetrics } from './runtime-feature-metrics.js'
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
  surfaceMediaPlanningService?: SurfaceMediaPlanningService | null
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
      if (
        config.features.mediaForumThreadTurnSurfaceV1
        && (event.event_type === 'ThreadOpened' || event.event_type === 'ThreadTurnAdded')
        && ctx.public_scene
        && this.deps.surfaceMediaPlanningService
      ) {
        try {
          const forumPlanningFocus = this.resolveForumPlanningFocusEntry(ctx)
          const postId = ctx.post?.id ?? forumPlanningFocus?.post_id ?? event.post_id ?? null
          const threadId = ctx.forum_targeting?.reply_thread_id
            ?? (forumPlanningFocus?.entry_kind === 'THREAD'
              ? forumPlanningFocus.id
              : forumPlanningFocus?.thread_id ?? null)
            ?? event.thread_id
            ?? null
          const turnId = forumPlanningFocus?.entry_kind === 'TURN'
            ? forumPlanningFocus.id
            : null
          if (!postId) {
            throw new Error('forum_thread_media_plan_missing_post_id')
          }
          const plan = await this.deps.surfaceMediaPlanningService.prepareForumThreadPlan({
            agent_id: agent.agent_id,
            community_id: ctx.community.id,
            post_id: postId,
            thread_id: threadId,
            turn_id: turnId,
            surface: turnId ? 'forum_turn' : 'forum_thread',
            focus_hint: forumPlanningFocus?.body ?? ctx.public_scene.local_intent_block,
            payload: ctx.public_scene,
          })
          if (plan) {
            ctx.surface_media_plan = {
              image_plan_id: plan.image_plan_id,
              display_attachment_refs: plan.display_attachment_refs,
              planning_audit: plan.planning_audit,
              current_context_source: plan.current_context_source,
            }
          }
        } catch (error) {
          console.error(
            `[AgentExecutor] forum thread media planning failed for agent ${agent.agent_id}:`,
            error,
          )
        }
      }
      if (
        config.features.mediaChatRoomSurfaceV1
        && event.event_type === 'NewMessageCreated'
        && ctx.chatContext
        && this.deps.surfaceMediaPlanningService
      ) {
        try {
          const semanticHint = ctx.chat_prompt_variables?.local_intent_block
            || ctx.chat_prompt_variables?.room_public_context_summary
            || ctx.chatContext.recent_messages.at(-1)?.body
            || ctx.chatContext.room_description
            || ctx.chatContext.room_name
          const plan = await this.deps.surfaceMediaPlanningService.prepareChatRoomMessagePlan({
            agent_id: agent.agent_id,
            room_id: event.room_id ?? '',
            room_name: ctx.chatContext.room_name,
            room_description: ctx.chatContext.room_description ?? '',
            community_id: ctx.community.id,
            parent_message_id: event.target_type === 'MESSAGE' ? event.target_id ?? null : null,
            semantic_hint: semanticHint,
            message_kind: 'normal',
            live_hook: ctx.chat_prompt_variables?.live_hook || ctx.chatContext.program?.live_hook,
            unresolved_question:
              ctx.chat_prompt_variables?.unresolved_question || ctx.chatContext.program?.unresolved_question,
          })
          if (plan) {
            ctx.surface_media_plan = {
              image_plan_id: plan.image_plan_id,
              display_attachment_refs: plan.display_attachment_refs,
              planning_audit: plan.planning_audit,
              current_context_source: plan.current_context_source,
            }
          }
        } catch (error) {
          console.error(
            `[AgentExecutor] chat room media planning failed for agent ${agent.agent_id}:`,
            error,
          )
        }
      }
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

      const promptScene = this.pickScene(event, ctx)
      const promptIntent = promptScene === 'chat_room' ? 'chat_reply' : 'forum_reply'
      const templateId = this.pickTemplate(event, ctx)
      const routing = await this.resolveVisibleRouting(
        agent.agent_id,
        promptIntent === 'chat_reply' ? 'lite' : 'base',
        promptIntent === 'chat_reply' ? 'lite' : undefined,
      )
      const identity = this.resolveObservationIdentity(agent.agent_id)
      const llmResponse = await this.deps.llmGateway.generateVisibleText({
        intent: promptIntent,
        scene: promptScene,
        modality: 'text',
        responseMode: 'text',
        agentId: agent.agent_id,
        homeVoiceLineId: routing.homeVoiceLineId,
        promptRef: templateId,
        variables: this.buildVariables(ctx, identity?.persona_seed_code ?? 'scholar', promptScene),
        budgetClass: 'visible_standard',
        traceId: `runtime:${event.event_id}:${agent.agent_id}`,
        promptBudgetSummary: buildPromptBudgetSummary(promptScene, templateId, ctx.prompt_audit),
        requestedTier: routing.requestedTier,
        allowFallbackWithinLine: false,
        allowCrossFamily: false,
      })
      const latencyMs = Date.now() - start
      const observation = buildPersonaObservation({
        sourceCallsiteId: promptScene === 'chat_room'
          ? 'agent-executor-chat-room'
          : promptScene === 'forum_thread'
            ? 'agent-executor-forum-thread'
            : 'agent-executor-forum-post',
        scene: promptScene,
        intent: promptIntent,
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
      if (ctx.surface_media_plan) {
        instruction.audit_metadata = {
          ...(instruction.audit_metadata ?? {}),
          surface_media: ctx.surface_media_plan.planning_audit,
        }
        if (!(instruction.action === 'create_message' && instruction.message_kind === 'skip_feedback')) {
          instruction.image_plan_id = ctx.surface_media_plan.image_plan_id
          instruction.display_attachment_refs = ctx.surface_media_plan.display_attachment_refs
        }
      }
      if (ctx.forum_targeting && instruction.action === 'add_thread_turn') {
        const forumTargetingAudit = {
          event_target_entry_id: ctx.forum_targeting.event_target_entry_id,
          event_target_thread_id: ctx.forum_targeting.event_target_thread_id,
          focus_turn_id: ctx.forum_targeting.focus_turn_id,
          selected_anchor_turn_id: ctx.forum_targeting.selected_anchor_turn_id,
          actual_anchor_turn_id: ctx.forum_targeting.actual_anchor_turn_id,
          final_write_anchor_turn_id: ctx.forum_targeting.final_write_anchor_turn_id,
          reply_thread_id: ctx.forum_targeting.reply_thread_id,
          browse_reason: ctx.forum_targeting.browse_reason,
          allowed_actions: ctx.forum_targeting.allowed_actions,
          written_anchor_turn_id: instruction.anchor_turn_id ?? null,
        }
        instruction.audit_metadata = {
          ...(instruction.audit_metadata ?? {}),
          forum_targeting: forumTargetingAudit,
        }
        runtimeFeatureMetrics.recordForumAnchorResolution({
          selected_anchor_turn_id: ctx.forum_targeting.selected_anchor_turn_id,
          actual_anchor_turn_id: ctx.forum_targeting.actual_anchor_turn_id,
          final_write_anchor_turn_id: ctx.forum_targeting.final_write_anchor_turn_id,
          written_anchor_turn_id: instruction.anchor_turn_id ?? null,
        })
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
    if (event.event_type === 'NewMessageCreated' || ctx.chatContext) {
      return PROMPT_TEMPLATE_REFS.agentChatReplyScene
    }
    if (ctx.public_scene) {
      return event.event_type === 'ThreadOpened' || event.event_type === 'ThreadTurnAdded'
        ? PROMPT_TEMPLATE_REFS.agentReplyToThreadTurnScene
        : PROMPT_TEMPLATE_REFS.agentReplyToPostScene
    }

    switch (event.event_type) {
      case 'NewPostCreated':
        return PROMPT_TEMPLATE_REFS.agentReplyToPost
      case 'ThreadOpened':
      case 'ThreadTurnAdded':
        return PROMPT_TEMPLATE_REFS.agentReplyToThreadTurn
      default:
        return PROMPT_TEMPLATE_REFS.agentReplyToPost
    }
  }

  private pickScene(
    event: EventPayload,
    ctx: ExecutionContext,
  ): 'forum_post' | 'forum_thread' | 'chat_room' {
    if (event.event_type === 'NewMessageCreated' || ctx.chatContext) {
      return 'chat_room'
    }
    return event.event_type === 'ThreadOpened' || event.event_type === 'ThreadTurnAdded'
      ? 'forum_thread'
      : 'forum_post'
  }

  private buildVariables(
    ctx: ExecutionContext,
    personaSeedCode: import('../../shared/agent-persona-catalog.js').PersonaSeedCode,
    scene: 'forum_post' | 'forum_thread' | 'chat_room',
  ): Record<string, string> {
    return {
      persona_name: ctx.persona.name,
      persona_style: ctx.persona.style,
      persona_interests: ctx.persona.interests.join('、'),
      persona_language: ctx.persona.language,
      persona_seed_code: personaSeedCode,
      community_name: ctx.community.name,
      room_name: scene === 'chat_room' ? (ctx.chatContext?.room_name ?? '聊天室') : '',
      hard_control_block: ctx.blocks?.hard_control_block ?? '',
      compact_control_block: ctx.blocks?.compact_control_block ?? '',
      current_context_block: ctx.blocks?.current_context_block ?? '',
      memory_block: ctx.blocks?.memory_block ?? '',
      soft_expression_block: ctx.blocks?.soft_expression_block ?? '',
    }
  }

  private resolveForumPlanningFocusEntry(ctx: ExecutionContext): ExecutionContext['focusThreadTurn'] {
    return ctx.focusThreadTurn
  }

  private async resolveVisibleRouting(
    agentId: string,
    requestedTier: import('../../shared/agent-persona-catalog.js').RenderTier,
    requestedTierCeiling?: import('../../shared/agent-persona-catalog.js').RenderTier,
  ): Promise<{
    homeVoiceLineId: import('../../shared/agent-persona-catalog.js').VoiceLineId
    requestedTier: import('../../shared/agent-persona-catalog.js').RenderTier
  }> {
    if (this.deps.inferenceProfileService) {
      return this.deps.inferenceProfileService.resolveVisibleRoute({
        agentId,
        requestedTier,
        requestedTierCeiling,
      })
    }
    const agent = this.deps.agentService.getAgent(agentId)
    const latestConfig = this.deps.agentService.getLatestConfig(agentId)
    const resolved = resolveAgentIdentity(agent, latestConfig)
    const homeVoiceLineId = resolved.summary.home_voice_line_id
    return {
      homeVoiceLineId,
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
