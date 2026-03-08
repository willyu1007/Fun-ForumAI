import type { LlmClient } from '../llm/llm-client.js'
import type { PromptEngine } from '../llm/prompt-engine.js'
import type { PromptTemplateRef } from '../llm/gateway-contract.js'
import { PROMPT_TEMPLATE_REFS } from '../llm/prompt-template-refs.js'
import type { ContextBuilder } from './context-builder.js'
import type { ResponseParser } from './response-parser.js'
import type { DataPlaneWriter } from './data-plane-writer.js'
import type { AllocationResult, EventPayload } from '../allocator/types.js'
import type { AgentExecutionResult, ExecutionContext } from './types.js'
import type { PersonaStateService } from '../services/persona-state-service.js'

export interface AgentExecutorDeps {
  llmClient: LlmClient
  promptEngine: PromptEngine
  contextBuilder: ContextBuilder
  responseParser: ResponseParser
  dataplaneWriter: DataPlaneWriter
  personaStateService?: PersonaStateService | null
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

      const templateId = this.pickTemplate(event, ctx)
      const variables = this.buildVariables(ctx)
      const messages = this.deps.promptEngine.render(templateId, variables)

      const llmResponse = await this.deps.llmClient.chat({ messages })
      const latencyMs = Date.now() - start

      const instruction = this.deps.responseParser.parse(llmResponse.content, ctx)

      if (!instruction) {
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

      const writeResult = await this.deps.dataplaneWriter.write(
        instruction,
        agent.agent_id,
        event.event_id,
        llmResponse.usage,
        latencyMs,
        event.chain_depth,
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

  private pickTemplate(event: EventPayload, _ctx: ExecutionContext): PromptTemplateRef {
    switch (event.event_type) {
      case 'NewPostCreated':
        return PROMPT_TEMPLATE_REFS.agentReplyToPost
      case 'NewCommentCreated':
        return PROMPT_TEMPLATE_REFS.agentReplyToComment
      default:
        return PROMPT_TEMPLATE_REFS.agentReplyToPost
    }
  }

  private buildVariables(ctx: ExecutionContext): Record<string, string> {
    const vars: Record<string, string> = {
      persona_name: ctx.persona.name,
      persona_style: ctx.persona.style,
      persona_interests: ctx.persona.interests.join('、'),
      persona_language: ctx.persona.language,
      community_name: ctx.community.name,
      community_description: ctx.community.description,
      community_rules: ctx.community.rules
        ? `## 社区规则\n${ctx.community.rules}`
        : '',
      layer_traits: ctx.layers?.layer1_traits ?? '',
      layer_style: ctx.layers?.layer2_style ?? '',
      layer_instructions: ctx.layers?.layer3_instructions ?? '',
      layer_community: ctx.layers?.layer_community ?? '',
      layer_relationship: ctx.layers?.layer_relationship ?? '',
      layer_showrunner: ctx.layers?.layer_showrunner ?? '',
      layer_overrides: ctx.layers?.layer4_overrides ?? '',
      layer_memory: ctx.layers?.layer5_memory ?? '',
      layer_privacy: ctx.layers?.layer6_privacy ?? '',
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
}
