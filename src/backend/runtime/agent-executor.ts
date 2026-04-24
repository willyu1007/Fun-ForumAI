import type { LLMGateway } from '../llm/llm-gateway.js'
import type { PromptTemplateRef } from '../llm/gateway-contract.js'
import { PROMPT_TEMPLATE_REFS } from '../llm/prompt-template-refs.js'
import type { ContextBuilder } from './context-builder.js'
import type { ResponseParser } from './response-parser.js'
import type { DataPlaneWriter } from './data-plane-writer.js'
import type { AllocationResult, EventPayload } from '../allocator/types.js'
import type { AgentExecutionResult, ExecutionContext, WriteInstruction } from './types.js'
import type { LlmTokenUsage } from '../llm/types.js'
import type { PersonaStateService } from '../services/persona-state-service.js'
import type { AgentRunRepository } from '../repos/event-repository.js'
import type { AgentService } from '../services/agent-service.js'
import type { InferenceProfileService } from '../services/inference-profile-service.js'
import type { SurfaceMediaPlanningService } from '../media/surface-media-planning-service.js'
import type { StatsService } from '../services/stats-service.js'
import type { VoteRepository } from '../repos/vote-repository.js'
import { config } from '../lib/config.js'
import { resolveAgentIdentity } from '../identity/agent-identity.js'
import { buildPromptBudgetSummary } from './prompt-budget-summary.js'
import { runtimeFeatureMetrics } from './runtime-feature-metrics.js'
import {
  isBlankModelOutputText,
  normalizeModelOutputText,
} from './model-output-normalization.js'
import {
  buildForumActionOptionsPayload,
  parseForumActionPlan,
} from './forum-action-plan-parser.js'
import { buildForumActionOptions, resolveForumActionPlanToInstructions } from './forum-target-ref-resolver.js'
import { evaluateVoteGuardrails } from './vote-guardrails.js'
import {
  attachPersonaObservation,
  buildPersonaObservation,
  recordPersonaObservation,
} from './persona-observation.js'
import {
  buildForumRoamingPreparation,
  parseRoamingDecision,
  resolveForumExecutionPlan,
} from './forum-roaming.js'

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
  statsService?: StatsService | null
  voteRepo: VoteRepository
}

interface ExecuteOneResult extends AgentExecutionResult {
  reply_budget_consumed?: boolean
}

interface VisibleRoutingDecision {
  homeVoiceLineId: import('../../shared/agent-persona-catalog.js').VoiceLineId
  requestedTier: import('../../shared/agent-persona-catalog.js').RenderTier
}

function normalizeForumNoWriteReason(reason: string):
  | 'decision_failed'
  | 'invalid_plan'
  | 'candidate_missing'
  | 'candidate_expired'
  | 'candidate_invalid'
  | 'target_invalid'
  | 'observe_only'
  | 'no_write'
  | 'no_viable_candidates'
  | 'audience_scope_excluded'
  | 'reply_budget_exceeded'
  | 'route_unavailable' {
  if (
    reason === 'decision_failed'
    || reason === 'invalid_plan'
    || reason === 'candidate_missing'
    || reason === 'candidate_expired'
    || reason === 'candidate_invalid'
    || reason === 'target_invalid'
    || reason === 'observe_only'
    || reason === 'no_write'
    || reason === 'no_viable_candidates'
    || reason === 'audience_scope_excluded'
    || reason === 'reply_budget_exceeded'
    || reason === 'route_unavailable'
  ) {
    return reason
  }
  return 'decision_failed'
}

export class AgentExecutor {
  constructor(private readonly deps: AgentExecutorDeps) {}

  async execute(
    event: EventPayload,
    allocation: AllocationResult,
  ): Promise<AgentExecutionResult[]> {
    const results: AgentExecutionResult[] = []
    const agents = isForumRuntimeEvent(event)
      ? [...allocation.agents].sort((left, right) =>
        right.priority - left.priority || right.score - left.score)
      : allocation.agents
    let replyBudgetRemaining = isForumRuntimeEvent(event)
      ? this.getForumTextReplyBudget(event.event_type)
      : null

    for (const agent of agents) {
      const result = await this.executeOne(event, agent, replyBudgetRemaining)
      results.push(result)
      if (typeof replyBudgetRemaining === 'number' && result.reply_budget_consumed) {
        replyBudgetRemaining = Math.max(0, replyBudgetRemaining - 1)
      }
    }

    return results
  }

  private async executeOne(
    event: EventPayload,
    agent: { agent_id: string; score: number; priority: number },
    replyBudgetRemaining: number | null,
  ): Promise<ExecuteOneResult> {
    const start = Date.now()
    let ctx: ExecutionContext | null = null

    try {
      ctx = await this.deps.contextBuilder.build(event, agent)
      const shouldUseForumRoaming = this.shouldUseForumRoamingSelection(ctx)
      if (!shouldUseForumRoaming) {
        ctx = await this.prepareSurfaceMediaPlan(ctx, agent)
      }
      ctx = await this.deps.contextBuilder.enrichWithLayers(ctx)
      if (ctx.skip_reason) {
        const result = this.recordSceneSkip(agent.agent_id, event, ctx.skip_reason, ctx, start)
        return result
      }

      if (isForumRuntimeEvent(event) && !shouldUseForumRoaming) {
        const result = await this.executeForumActionPlan({
          start,
          event,
          agent,
          ctx,
          replyBudgetRemaining,
        })
        return result
      }

      if (shouldUseForumRoaming) {
        const result = await this.executeForumThreadWithRoaming({
          start,
          event,
          agent,
          ctx,
          replyBudgetRemaining,
        })
        return result
      }

      const result = await this.executeVisibleWrite({
        start,
        event,
        agent,
        ctx,
      })
      return result
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

  private recordSceneSkip(
    agentId: string,
    event: EventPayload,
    reason: string,
    ctx: ExecutionContext,
    start: number,
  ): AgentExecutionResult {
    this.deps.agentRunRepo.create({
      agent_id: agentId,
      trigger_event_id: event.event_id,
      input_digest: `scene_skip|event:${event.event_type}`,
      output_json: {
        skipped: true,
        reason,
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
      agent_id: agentId,
      event_id: event.event_id,
      success: false,
      latency_ms: Date.now() - start,
      error: reason,
    }
  }

  private shouldUseForumRoamingSelection(ctx: ExecutionContext): boolean {
    return (
      (ctx.event.event_type === 'ThreadOpened' || ctx.event.event_type === 'ThreadTurnAdded')
      && config.launch.capabilities.forumOrchestrationSelectionCutover
      && Boolean(ctx.forum_orchestration_policy?.cutover.selection_enabled)
    )
  }

  private shouldFallbackToBaseline(ctx: ExecutionContext): boolean {
    return ctx.forum_orchestration_policy?.cutover.fallback_to_baseline ?? true
  }

  private async prepareSurfaceMediaPlan(
    ctx: ExecutionContext,
    agent: { agent_id: string },
  ): Promise<ExecutionContext> {
    if (
      config.launch.capabilities.mediaForumThreadTurnSurfaceV1
      && (ctx.event.event_type === 'ThreadOpened' || ctx.event.event_type === 'ThreadTurnAdded')
      && ctx.public_scene
      && this.deps.surfaceMediaPlanningService
    ) {
      try {
        const forumPlanningFocus = this.resolveForumPlanningFocusEntry(ctx)
        const postId = ctx.post?.id ?? forumPlanningFocus?.post_id ?? ctx.event.post_id ?? null
        const threadId = ctx.forum_targeting?.reply_thread_id
          ?? (forumPlanningFocus?.entry_kind === 'THREAD'
            ? forumPlanningFocus.id
            : forumPlanningFocus?.thread_id ?? null)
          ?? ctx.event.thread_id
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
      config.launch.capabilities.mediaChatRoomSurfaceV1
      && ctx.event.event_type === 'NewMessageCreated'
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
          room_id: ctx.event.room_id ?? '',
          room_name: ctx.chatContext.room_name,
          room_description: ctx.chatContext.room_description ?? '',
          community_id: ctx.community.id,
          parent_message_id: ctx.event.target_type === 'MESSAGE' ? ctx.event.target_id ?? null : null,
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

    return ctx
  }

  private async executeForumThreadWithRoaming(input: {
    start: number
    event: EventPayload
    agent: { agent_id: string; score: number; priority: number }
    ctx: ExecutionContext
    replyBudgetRemaining: number | null
  }): Promise<ExecuteOneResult> {
    const fallbackToBaseline = this.shouldFallbackToBaseline(input.ctx)
    const decisionIdentity = this.resolveDecisionIdentity(input.agent.agent_id)
    const preparation = buildForumRoamingPreparation({
      ctx: input.ctx,
      identity: decisionIdentity ?? {
        agent_id: input.agent.agent_id,
        display_name: input.ctx.persona.name,
        persona_seed_code: this.resolveObservationIdentity(input.agent.agent_id)?.persona_seed_code ?? 'scholar',
        owner_style_pins: null,
      },
    })

    input.ctx.forum_roaming = {
      arrival_candidates: preparation.arrival_candidates,
      decision_hint: preparation.decision_hint,
      decision_prompt_input: preparation.decision_prompt_input,
      decision_result: null,
      resolved_execution_plan: null,
    }

    if (preparation.skip_reason) {
      if (preparation.skip_reason === 'audience_scope_excluded' && fallbackToBaseline) {
        runtimeFeatureMetrics.recordForumBaselineFallback({
          stage: 'executor',
          selection_path: 'selection_fallback_baseline',
          fallback_reason: 'audience_scope_excluded_baseline_fallback',
          event_type: input.event.event_type,
          post_id: input.event.post_id ?? null,
          thread_id: input.event.thread_id ?? null,
          agent_id: input.agent.agent_id,
          opportunity_id: input.ctx.agent.forum_attention_hint?.opportunity_id ?? null,
        })
        let baselineCtx = await this.prepareSurfaceMediaPlan(input.ctx, input.agent)
        baselineCtx = await this.deps.contextBuilder.enrichWithLayers(baselineCtx)
        return this.executeForumActionPlan({
          start: input.start,
          event: input.event,
          agent: input.agent,
          ctx: baselineCtx,
          replyBudgetRemaining: input.replyBudgetRemaining,
        })
      }
      return this.recordNoWriteDecision({
        agentId: input.agent.agent_id,
        event: input.event,
        start: input.start,
        ctx: input.ctx,
        usage: null,
        reason: preparation.skip_reason,
      })
    }

    if (this.isDeterministicObserveOnlyRoaming(preparation.arrival_candidates)) {
      const shortCircuitDecision = {
        status: 'selected' as const,
        candidate_id: preparation.arrival_candidates[0]?.candidate_id ?? null,
        action: 'observe_only' as const,
        raw_output: '[short_circuit:observe_only_candidates]',
      }
      const executionPlan = resolveForumExecutionPlan({
        post_id: input.ctx.post?.id ?? input.event.post_id ?? 'unknown-post',
        candidates: preparation.arrival_candidates,
        decision_result: shortCircuitDecision,
      })
      input.ctx.forum_roaming = {
        ...(input.ctx.forum_roaming ?? {
          arrival_candidates: preparation.arrival_candidates,
          decision_hint: preparation.decision_hint,
          decision_prompt_input: preparation.decision_prompt_input,
        }),
        decision_result: shortCircuitDecision,
        resolved_execution_plan: executionPlan,
      }
      return this.recordNoWriteDecision({
        agentId: input.agent.agent_id,
        event: input.event,
        start: input.start,
        ctx: input.ctx,
        usage: null,
        reason: 'observe_only',
      })
    }

    if ((input.replyBudgetRemaining ?? 0) <= 0) {
      return this.executeForumActionPlan({
        start: input.start,
        event: input.event,
        agent: input.agent,
        ctx: input.ctx,
        replyBudgetRemaining: input.replyBudgetRemaining,
      })
    }

    const decisionRequestedTier = this.getForumDecisionRequestedTier('forum_thread')
    const decisionRouting = await this.resolveVisibleRouting(
      input.agent.agent_id,
      decisionRequestedTier,
      decisionRequestedTier,
    )
    let decisionResponse: Awaited<ReturnType<LLMGateway['generateVisibleText']>>
    try {
      decisionResponse = await this.deps.llmGateway.generateVisibleText({
        intent: 'forum_reply',
        scene: 'forum_thread',
        modality: 'text',
        responseMode: 'json_object',
        agentId: input.agent.agent_id,
        homeVoiceLineId: decisionRouting.homeVoiceLineId,
        promptRef: PROMPT_TEMPLATE_REFS.agentSelectForumArrival,
        variables: this.buildForumRoamingDecisionVariables(preparation.decision_prompt_input),
        budgetClass: 'visible_standard',
        traceId: `runtime:${input.event.event_id}:${input.agent.agent_id}:arrival_selection`,
        promptBudgetSummary: buildPromptBudgetSummary(
          'forum_thread',
          PROMPT_TEMPLATE_REFS.agentSelectForumArrival,
          undefined,
        ),
        requestedTier: decisionRouting.requestedTier,
        allowFallbackWithinLine: true,
        allowCrossFamily: false,
        localOverrides: {
          executionPolicyId: 'visible-forum_reply-selection-lite',
        },
      })
    } catch (error) {
      if (this.isRouteUnavailableLlmError(error) && !fallbackToBaseline) {
        return this.recordNoWriteDecision({
          agentId: input.agent.agent_id,
          event: input.event,
          start: input.start,
          ctx: input.ctx,
          usage: null,
          reason: 'route_unavailable',
        })
      }
      if (fallbackToBaseline) {
        runtimeFeatureMetrics.recordForumBaselineFallback({
          stage: 'executor',
          selection_path: 'selection_fallback_baseline',
          fallback_reason: 'executor_call1_infra_fallback',
          event_type: input.event.event_type,
          post_id: input.event.post_id ?? null,
          thread_id: input.event.thread_id ?? null,
          agent_id: input.agent.agent_id,
          opportunity_id: input.ctx.agent.forum_attention_hint?.opportunity_id ?? null,
        })
        let baselineCtx = await this.prepareSurfaceMediaPlan(input.ctx, input.agent)
        baselineCtx = await this.deps.contextBuilder.enrichWithLayers(baselineCtx)
        return this.executeForumActionPlan({
          start: input.start,
          event: input.event,
          agent: input.agent,
          ctx: baselineCtx,
          replyBudgetRemaining: input.replyBudgetRemaining,
        })
      }
      throw error
    }
    const decisionResult = parseRoamingDecision(
      decisionResponse.content,
      preparation.arrival_candidates,
    )
    const executionPlan = resolveForumExecutionPlan({
      post_id: input.ctx.post?.id ?? input.event.post_id ?? 'unknown-post',
      candidates: preparation.arrival_candidates,
      decision_result: decisionResult,
    })
    input.ctx.forum_roaming = {
      ...(input.ctx.forum_roaming ?? {
        arrival_candidates: preparation.arrival_candidates,
        decision_hint: preparation.decision_hint,
        decision_prompt_input: preparation.decision_prompt_input,
      }),
      decision_result: decisionResult,
      resolved_execution_plan: executionPlan,
    }
    if (!executionPlan.requires_generation && executionPlan.validation_status !== 'observe_only') {
      return this.recordNoWriteDecision({
        agentId: input.agent.agent_id,
        event: input.event,
        start: input.start,
        ctx: input.ctx,
        usage: decisionResponse.usage,
        reason: executionPlan.validation_status,
      })
    }

    if (!executionPlan.requires_generation) {
      return this.executeForumActionPlan({
        start: input.start,
        event: input.event,
        agent: input.agent,
        ctx: input.ctx,
        replyBudgetRemaining: input.replyBudgetRemaining,
        extraUsage: decisionResponse.usage,
        preResolvedRouting: decisionRouting,
      })
    }

    let retargetedCtx = await this.deps.contextBuilder.retargetForumThreadContext(
      input.ctx,
      executionPlan,
    )
    retargetedCtx.forum_roaming = input.ctx.forum_roaming
    retargetedCtx = await this.prepareSurfaceMediaPlan(retargetedCtx, input.agent)
    retargetedCtx = await this.deps.contextBuilder.enrichWithLayers(retargetedCtx)

    return this.executeForumActionPlan({
      start: input.start,
      event: input.event,
      agent: input.agent,
      ctx: retargetedCtx,
      replyBudgetRemaining: input.replyBudgetRemaining,
      extraUsage: decisionResponse.usage,
      preResolvedRouting: decisionRouting,
    })
  }

  private async executeVisibleWrite(input: {
    start: number
    event: EventPayload
    agent: { agent_id: string; score: number; priority: number }
    ctx: ExecutionContext
    extraUsage?: LlmTokenUsage | null
  }): Promise<AgentExecutionResult> {
    const promptScene = this.pickScene(input.event, input.ctx)
    const promptIntent = promptScene === 'chat_room' ? 'chat_reply' : 'forum_reply'
    const templateId = this.pickTemplate(input.event, input.ctx)
    const routing = await this.resolveVisibleRouting(
      input.agent.agent_id,
      promptIntent === 'chat_reply' ? 'lite' : 'base',
      promptIntent === 'chat_reply' ? 'lite' : undefined,
    )
    const identity = this.resolveObservationIdentity(input.agent.agent_id)
    const llmResponse = await this.deps.llmGateway.generateVisibleText({
      intent: promptIntent,
      scene: promptScene,
      modality: 'text',
      responseMode: 'text',
      agentId: input.agent.agent_id,
      homeVoiceLineId: routing.homeVoiceLineId,
      promptRef: templateId,
      variables: this.buildVariables(input.ctx, identity?.persona_seed_code ?? 'scholar', promptScene),
      budgetClass: 'visible_standard',
      traceId: `runtime:${input.event.event_id}:${input.agent.agent_id}`,
      promptBudgetSummary: buildPromptBudgetSummary(promptScene, templateId, input.ctx.prompt_audit),
      requestedTier: routing.requestedTier,
      allowFallbackWithinLine: false,
      allowCrossFamily: false,
    })
    const latencyMs = Date.now() - input.start
    const totalUsage = this.combineUsage(input.extraUsage ?? null, llmResponse.usage)
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
      promptAudit: input.ctx.prompt_audit ?? null,
      llmProviderId: llmResponse.renderDecision.providerId,
      llmModelId: llmResponse.renderDecision.modelId,
    })

    const instruction = this.deps.responseParser.parse(llmResponse.content, input.ctx)

    if (!instruction) {
      const failedObservation = {
        ...observation,
        parse_success: false,
        error: 'LLM output could not be parsed into a valid action',
      }
      this.deps.agentRunRepo.create({
        agent_id: input.agent.agent_id,
        trigger_event_id: input.event.event_id,
        input_digest: `parse_failed|template:${templateId.id}@${templateId.version}|len:${llmResponse.content.length}`,
        output_json: attachPersonaObservation(
          {
            error: 'LLM output could not be parsed into a valid action',
            prompt_template_id: templateId.id,
            prompt_version: templateId.version,
            audit_metadata: {
              forum_roaming: this.buildForumRoamingAuditMetadata(input.ctx),
            },
          },
          failedObservation,
        ),
        token_cost: totalUsage.total_tokens,
        latency_ms: latencyMs,
      })
      recordPersonaObservation(failedObservation)
      console.warn(`[AgentExecutor] No valid instruction from LLM for agent ${input.agent.agent_id}`)
      return {
        agent_id: input.agent.agent_id,
        event_id: input.event.event_id,
        success: false,
        usage: totalUsage,
        latency_ms: latencyMs,
        error: 'LLM output could not be parsed into a valid action',
      }
    }

    this.applyInstructionRuntimeMetadata(input.ctx, instruction)

    const writeResult = await this.deps.dataplaneWriter.write(
      instruction,
      input.agent.agent_id,
      input.event.event_id,
      totalUsage,
      latencyMs,
      input.event.chain_depth,
      {
        ...observation,
        parse_success: true,
      },
    )

    if (
      writeResult.success &&
      input.ctx.promptScene &&
      input.ctx.runtimeEnvelope?.renderTierDecision &&
      this.deps.personaStateService
    ) {
      await this.deps.personaStateService.recordVisibleRender({
        agentId: input.agent.agent_id,
        scene: input.ctx.promptScene,
        renderDecision: input.ctx.runtimeEnvelope.renderTierDecision,
        outputText: instruction.body,
      }).catch((err) => {
        console.error('[AgentExecutor] persona runtime render record failed:', err)
      })
    }

    return {
      agent_id: input.agent.agent_id,
      event_id: input.event.event_id,
      success: writeResult.success,
      write_instruction: instruction,
      usage: totalUsage,
      latency_ms: latencyMs,
      error: writeResult.error,
    }
  }
  private async executeForumActionPlan(input: {
    start: number
    event: EventPayload
    agent: { agent_id: string; score: number; priority: number }
    ctx: ExecutionContext
    replyBudgetRemaining: number | null
    extraUsage?: LlmTokenUsage | null
    preResolvedRouting?: VisibleRoutingDecision | null
  }): Promise<ExecuteOneResult> {
    const promptScene = this.pickScene(input.event, input.ctx)
    const actionPlanRequestedTier = this.getForumDecisionRequestedTier(promptScene)
    const routing = input.preResolvedRouting
      && promptScene === 'forum_thread'
      && input.preResolvedRouting.requestedTier === actionPlanRequestedTier
      ? input.preResolvedRouting
      : await this.resolveVisibleRouting(
          input.agent.agent_id,
          actionPlanRequestedTier,
          actionPlanRequestedTier,
        )
    const identity = this.resolveObservationIdentity(input.agent.agent_id)
    if (!this.canServeVisibleForumRoute({
      agentId: input.agent.agent_id,
      traceId: `runtime:${input.event.event_id}:${input.agent.agent_id}:action_plan:capability`,
      scene: promptScene,
      promptRef: PROMPT_TEMPLATE_REFS.agentPlanForumActions,
      homeVoiceLineId: routing.homeVoiceLineId,
      requestedTier: routing.requestedTier,
      responseMode: 'json_object',
        localOverrides: {
          executionPolicyId: 'visible-forum_reply-action-plan-lite',
        },
    })) {
      return this.recordNoWriteDecision({
        agentId: input.agent.agent_id,
        event: input.event,
        start: input.start,
        ctx: input.ctx,
        usage: input.extraUsage ?? null,
        reason: 'route_unavailable',
      })
    }
    let planResponse: Awaited<ReturnType<LLMGateway['generateVisibleText']>>
    try {
      planResponse = await this.deps.llmGateway.generateVisibleText({
        intent: 'forum_reply',
        scene: promptScene,
        modality: 'text',
        responseMode: 'json_object',
        agentId: input.agent.agent_id,
        homeVoiceLineId: routing.homeVoiceLineId,
        promptRef: PROMPT_TEMPLATE_REFS.agentPlanForumActions,
        variables: this.buildForumActionPlanVariables(
          input.ctx,
          identity?.persona_seed_code ?? 'scholar',
          promptScene,
        ),
        budgetClass: 'visible_standard',
        traceId: `runtime:${input.event.event_id}:${input.agent.agent_id}:action_plan`,
        promptBudgetSummary: buildPromptBudgetSummary(
          promptScene,
          PROMPT_TEMPLATE_REFS.agentPlanForumActions,
          input.ctx.prompt_audit,
        ),
        requestedTier: routing.requestedTier,
        allowFallbackWithinLine: true,
        allowCrossFamily: false,
        localOverrides: {
          executionPolicyId: 'visible-forum_reply-action-plan-lite',
        },
      })
    } catch (error) {
      if (this.isRouteUnavailableLlmError(error)) {
        return this.recordNoWriteDecision({
          agentId: input.agent.agent_id,
          event: input.event,
          start: input.start,
          ctx: input.ctx,
          usage: input.extraUsage ?? null,
          reason: 'route_unavailable',
        })
      }
      throw error
    }
    const normalizedPlanContent = normalizeModelOutputText(planResponse.content)
    if (isBlankModelOutputText(normalizedPlanContent)) {
      return this.recordNoWriteDecision({
        agentId: input.agent.agent_id,
        event: input.event,
        start: input.start,
        ctx: input.ctx,
        usage: this.combineUsage(input.extraUsage ?? null, planResponse.usage),
        reason: 'decision_failed',
        auditMetadata: {
          planner_failure: 'empty_plan',
        },
      })
    }
    const parsedPlan = parseForumActionPlan(normalizedPlanContent)
    if (parsedPlan.status !== 'ok') {
      return this.recordNoWriteDecision({
        agentId: input.agent.agent_id,
        event: input.event,
        start: input.start,
        ctx: input.ctx,
        usage: this.combineUsage(input.extraUsage ?? null, planResponse.usage),
        reason: 'invalid_plan',
      })
    }
    const resolved = resolveForumActionPlanToInstructions(input.ctx, parsedPlan.plan)
    let instructions = resolved.resolved_instructions

    if (instructions.length === 0) {
      this.debugLogConservativeOutcome({
        event: input.event,
        agentId: input.agent.agent_id,
        reason: 'no_write',
        ctx: input.ctx,
        replyBudgetRemaining: input.replyBudgetRemaining,
        validationStatus: 'all_actions_dropped',
      })
      return this.recordNoWriteDecision({
        agentId: input.agent.agent_id,
        event: input.event,
        start: input.start,
        ctx: input.ctx,
        usage: this.combineUsage(input.extraUsage ?? null, planResponse.usage),
        reason: resolved.dropped_actions.length > 0 ? 'target_invalid' : 'no_write',
      })
    }

    const voteInstruction = instructions.find((item) => item.action === 'vote') ?? null
    const textInstruction = instructions.find(
      (item) => item.action === 'open_thread' || item.action === 'add_thread_turn',
    ) ?? null
    let survivingVote: Extract<WriteInstruction, { action: 'vote' }> | null =
      voteInstruction && voteInstruction.action === 'vote' ? voteInstruction : null
    let survivingText: Extract<WriteInstruction, { action: 'open_thread' | 'add_thread_turn' }> | null =
      textInstruction && (textInstruction.action === 'open_thread' || textInstruction.action === 'add_thread_turn')
        ? textInstruction
        : null
    let voteDroppedByGuardrail = false
    let textDroppedBy: 'empty_body' | 'reply_budget' | 'route_unavailable' | null = null

    if (survivingVote) {
      const decision = evaluateVoteGuardrails({
        instruction: survivingVote,
        agent_id: input.agent.agent_id,
        voteRepo: this.deps.voteRepo,
        agentRunRepo: this.deps.agentRunRepo,
        statsService: this.deps.statsService ?? null,
      })
      if (decision.outcome === 'allow') {
        survivingVote.idempotency_key = this.buildVoteIdempotencyKey({
          sourceEventId: input.event.event_id,
          agentId: input.agent.agent_id,
          targetType: survivingVote.target_type,
          targetId: survivingVote.target_id,
          transition: decision.normalized_transition,
        })
        survivingVote.audit_metadata = {
          ...(survivingVote.audit_metadata ?? {}),
          vote_guardrail: {
            outcome: decision.outcome,
            normalized_transition: decision.normalized_transition,
            existing_vote_direction: decision.existing_vote_direction ?? null,
          },
        }
      } else {
        voteDroppedByGuardrail = true
        survivingVote = null
      }
    }

    if (survivingText && (input.replyBudgetRemaining ?? 0) <= 0) {
      if (survivingVote) {
        survivingVote.audit_metadata = {
          ...(survivingVote.audit_metadata ?? {}),
          reply_budget_degradation: 'reply_dropped_vote_retained',
        }
        textDroppedBy = 'reply_budget'
        survivingText = null
      } else {
        return this.recordNoWriteDecision({
          agentId: input.agent.agent_id,
          event: input.event,
          start: input.start,
          ctx: input.ctx,
          usage: this.combineUsage(input.extraUsage ?? null, planResponse.usage),
          reason: 'reply_budget_exceeded',
        })
      }
    }

    let textUsage: LlmTokenUsage | null = null
    let observation: PersonaObservationV1 | null = null

    if (survivingText) {
      const templateId = this.pickTemplate(input.event, input.ctx)
      const bodyRequestedTier = promptScene === 'chat_room' ? 'lite' : 'base'
      const canServeBodyRoute = promptScene === 'forum_thread'
        ? this.canServeVisibleForumRoute({
            agentId: input.agent.agent_id,
            traceId: `runtime:${input.event.event_id}:${input.agent.agent_id}:body:capability`,
            scene: promptScene,
            promptRef: templateId,
            homeVoiceLineId: routing.homeVoiceLineId,
            requestedTier: bodyRequestedTier,
            responseMode: 'text',
            localOverrides: {
              executionPolicyId: 'visible-forum_reply-thread-base',
            },
          })
        : promptScene === 'forum_post'
          ? this.canServeVisibleForumRoute({
              agentId: input.agent.agent_id,
              traceId: `runtime:${input.event.event_id}:${input.agent.agent_id}:body:capability`,
              scene: promptScene,
              promptRef: templateId,
              homeVoiceLineId: routing.homeVoiceLineId,
              requestedTier: bodyRequestedTier,
              responseMode: 'text',
              localOverrides: {
                executionPolicyId: 'visible-forum_reply-post-base',
              },
            })
        : this.canServeVisibleForumRoute({
            agentId: input.agent.agent_id,
            traceId: `runtime:${input.event.event_id}:${input.agent.agent_id}:body:capability`,
            scene: promptScene,
            promptRef: templateId,
            homeVoiceLineId: routing.homeVoiceLineId,
            requestedTier: bodyRequestedTier,
            responseMode: 'text',
          })
      if (!canServeBodyRoute) {
        if (!survivingVote) {
          return this.recordNoWriteDecision({
            agentId: input.agent.agent_id,
            event: input.event,
            start: input.start,
            ctx: input.ctx,
            usage: this.combineUsage(input.extraUsage ?? null, planResponse.usage),
            reason: 'route_unavailable',
          })
        }
        survivingVote.audit_metadata = {
          ...(survivingVote.audit_metadata ?? {}),
          body_generation_degradation: 'route_unavailable_vote_retained',
        }
        textDroppedBy = 'route_unavailable'
        survivingText = null
      }
    }

    if (survivingText) {
      const templateId = this.pickTemplate(input.event, input.ctx)
      let bodyResponse: Awaited<ReturnType<LLMGateway['generateVisibleText']>>
      try {
        bodyResponse = promptScene === 'forum_thread'
          ? await this.deps.llmGateway.generateVisibleText({
              intent: 'forum_reply',
              scene: promptScene,
              modality: 'text',
              responseMode: 'text',
              agentId: input.agent.agent_id,
              homeVoiceLineId: routing.homeVoiceLineId,
              promptRef: templateId,
              variables: this.buildVariables(input.ctx, identity?.persona_seed_code ?? 'scholar', promptScene),
              budgetClass: 'visible_standard',
              traceId: `runtime:${input.event.event_id}:${input.agent.agent_id}:body`,
              promptBudgetSummary: buildPromptBudgetSummary(promptScene, templateId, input.ctx.prompt_audit),
              requestedTier: promptScene === 'chat_room' ? 'lite' : 'base',
              allowFallbackWithinLine: true,
              allowCrossFamily: false,
              localOverrides: {
                executionPolicyId: 'visible-forum_reply-thread-base',
              },
            })
          : promptScene === 'forum_post'
            ? await this.deps.llmGateway.generateVisibleText({
                intent: 'forum_reply',
                scene: promptScene,
                modality: 'text',
                responseMode: 'text',
                agentId: input.agent.agent_id,
                homeVoiceLineId: routing.homeVoiceLineId,
                promptRef: templateId,
                variables: this.buildVariables(input.ctx, identity?.persona_seed_code ?? 'scholar', promptScene),
                budgetClass: 'visible_standard',
                traceId: `runtime:${input.event.event_id}:${input.agent.agent_id}:body`,
                promptBudgetSummary: buildPromptBudgetSummary(promptScene, templateId, input.ctx.prompt_audit),
                requestedTier: promptScene === 'chat_room' ? 'lite' : 'base',
                allowFallbackWithinLine: true,
                allowCrossFamily: false,
                localOverrides: {
                  executionPolicyId: 'visible-forum_reply-post-base',
                },
              })
          : await this.deps.llmGateway.generateVisibleText({
              intent: 'forum_reply',
              scene: promptScene,
              modality: 'text',
              responseMode: 'text',
              agentId: input.agent.agent_id,
              homeVoiceLineId: routing.homeVoiceLineId,
              promptRef: templateId,
              variables: this.buildVariables(input.ctx, identity?.persona_seed_code ?? 'scholar', promptScene),
              budgetClass: 'visible_standard',
              traceId: `runtime:${input.event.event_id}:${input.agent.agent_id}:body`,
              promptBudgetSummary: buildPromptBudgetSummary(promptScene, templateId, input.ctx.prompt_audit),
              requestedTier: promptScene === 'chat_room' ? 'lite' : 'base',
              allowFallbackWithinLine: true,
              allowCrossFamily: false,
            })
      } catch (error) {
        if (!this.isRouteUnavailableLlmError(error)) {
          throw error
        }
        if (!survivingVote) {
          return this.recordNoWriteDecision({
            agentId: input.agent.agent_id,
            event: input.event,
            start: input.start,
            ctx: input.ctx,
            usage: this.combineUsage(input.extraUsage ?? null, planResponse.usage),
            reason: 'route_unavailable',
          })
        }
        survivingVote.audit_metadata = {
          ...(survivingVote.audit_metadata ?? {}),
          body_generation_degradation: 'route_unavailable_vote_retained',
        }
        textDroppedBy = 'route_unavailable'
        survivingText = null
        bodyResponse = null as never
      }
      if (!survivingText) {
        // Route-unavailable degradation retained a surviving vote-only action.
      } else {
      const normalizedBody = normalizeModelOutputText(bodyResponse.content)
      if (isBlankModelOutputText(normalizedBody)) {
        if (!survivingVote) {
          return this.recordNoWriteDecision({
            agentId: input.agent.agent_id,
            event: input.event,
            start: input.start,
            ctx: input.ctx,
            usage: this.combineUsage(this.combineUsage(input.extraUsage ?? null, planResponse.usage), bodyResponse.usage),
            reason: 'decision_failed',
            auditMetadata: {
              planner_failure: 'empty_body',
            },
          })
        }
        textDroppedBy = 'empty_body'
        survivingText = null
      } else {
        survivingText.body = normalizedBody.trim()
        const latencyMs = Date.now() - input.start
        textUsage = bodyResponse.usage
        observation = buildPersonaObservation({
          sourceCallsiteId: promptScene === 'forum_thread'
            ? 'agent-executor-forum-thread'
            : 'agent-executor-forum-post',
          scene: promptScene,
          intent: 'forum_reply',
          visibility: 'visible',
          coverageStatus: 'visible_complete',
          personaSeedCode: identity?.persona_seed_code,
          homeVoiceLineId: identity?.home_voice_line_id,
          promptRef: templateId,
          requestedTier: bodyResponse.renderDecision.tier,
          resolvedTier: bodyResponse.renderDecision.tier,
          renderDecision: bodyResponse.renderDecision,
          usage: bodyResponse.usage,
          latencyMs,
          parseSuccess: true,
          promptAudit: input.ctx.prompt_audit ?? null,
          llmProviderId: bodyResponse.renderDecision.providerId,
          llmModelId: bodyResponse.renderDecision.modelId,
        })
      }
      }
    }

    instructions = [
      ...(survivingVote ? [survivingVote] : []),
      ...(survivingText ? [survivingText] : []),
    ]

    if (instructions.length === 0) {
      return this.recordNoWriteDecision({
        agentId: input.agent.agent_id,
        event: input.event,
        start: input.start,
        ctx: input.ctx,
        usage: this.combineUsage(input.extraUsage ?? null, planResponse.usage),
        reason: 'no_write',
        auditMetadata: {
          execution_degradation: 'all_actions_dropped',
          vote_dropped_by_guardrail: voteDroppedByGuardrail,
          text_dropped_by: textDroppedBy,
        },
      })
    }

    for (const instruction of instructions) {
      this.applyInstructionRuntimeMetadata(input.ctx, instruction)
    }

    const totalUsage = this.combineUsage(
      this.combineUsage(input.extraUsage ?? null, planResponse.usage),
      textUsage,
    )
    const zeroUsage: LlmTokenUsage = {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    }
    const writeResults = []
    for (const instruction of instructions) {
      const usageForWrite = instruction.action === 'vote' && survivingText
        ? zeroUsage
        : totalUsage
      const writeObservation = instruction.action === 'vote' ? null : observation
      const writeResult = await this.deps.dataplaneWriter.write(
        instruction,
        input.agent.agent_id,
        input.event.event_id,
        usageForWrite,
        Date.now() - input.start,
        input.event.chain_depth,
        writeObservation,
      )
      writeResults.push(writeResult)
    }
    if (
      survivingText
      && writeResults.some((result) => result.success)
      && input.ctx.promptScene
      && input.ctx.runtimeEnvelope?.renderTierDecision
      && this.deps.personaStateService
    ) {
      await this.deps.personaStateService.recordVisibleRender({
        agentId: input.agent.agent_id,
        scene: input.ctx.promptScene,
        renderDecision: input.ctx.runtimeEnvelope.renderTierDecision,
        outputText: survivingText.body,
      }).catch((err) => {
        console.error('[AgentExecutor] persona runtime render record failed:', err)
      })
    }

    const successfulWrites = writeResults.filter((result) => result.success)
    const failedWrites = writeResults.filter((result) => !result.success)
    return {
      agent_id: input.agent.agent_id,
      event_id: input.event.event_id,
      success: failedWrites.length === 0 || successfulWrites.length > 0,
      ...(instructions.length === 1 ? { write_instruction: instructions[0] } : {}),
      write_instructions: instructions,
      usage: totalUsage,
      latency_ms: Date.now() - input.start,
      ...(failedWrites.length > 0
        ? {
            error: failedWrites
              .map((result) => result.error)
              .filter((value): value is string => typeof value === 'string' && value.length > 0)
              .join('; '),
          }
        : {}),
      reply_budget_consumed: Boolean(survivingText),
    }
  }

  private applyInstructionRuntimeMetadata(
    ctx: ExecutionContext,
    instruction: WriteInstruction,
  ): void {
    if (ctx.event.governance_batch_id && ctx.event.generation_mode) {
      instruction.governance_context = {
        governance_batch_id: ctx.event.governance_batch_id,
        generation_mode: ctx.event.generation_mode,
      }
    }
    if (ctx.public_scene && instruction.action !== 'vote') {
      instruction.public_scene = ctx.public_scene
    }
    if (
      ctx.surface_media_plan
      && instruction.action !== 'vote'
    ) {
      instruction.audit_metadata = {
        ...(instruction.audit_metadata ?? {}),
        surface_media: ctx.surface_media_plan.planning_audit,
      }
      if (!(instruction.action === 'create_message' && instruction.message_kind === 'skip_feedback')) {
        instruction.image_plan_id = ctx.surface_media_plan.image_plan_id
        instruction.display_attachment_refs = ctx.surface_media_plan.display_attachment_refs
      }
    }
    if (ctx.forum_targeting && (instruction.action === 'add_thread_turn' || instruction.action === 'open_thread')) {
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
      if (instruction.action === 'add_thread_turn') {
        runtimeFeatureMetrics.recordForumAnchorResolution({
          selected_anchor_turn_id: ctx.forum_targeting.selected_anchor_turn_id,
          actual_anchor_turn_id: ctx.forum_targeting.actual_anchor_turn_id,
          final_write_anchor_turn_id: ctx.forum_targeting.final_write_anchor_turn_id,
          written_anchor_turn_id: instruction.anchor_turn_id ?? null,
        })
      }
    }
    if (ctx.forum_targeting && instruction.action === 'vote') {
      instruction.audit_metadata = {
        ...(instruction.audit_metadata ?? {}),
        forum_targeting: {
          event_target_entry_id: ctx.forum_targeting.event_target_entry_id,
          event_target_thread_id: ctx.forum_targeting.event_target_thread_id,
          focus_turn_id: ctx.forum_targeting.focus_turn_id,
          reply_thread_id: ctx.forum_targeting.reply_thread_id,
          browse_reason: ctx.forum_targeting.browse_reason,
          allowed_actions: ctx.forum_targeting.allowed_actions,
        },
      }
    }
    if (ctx.forum_roaming || ctx.agent.forum_attention_hint) {
      instruction.audit_metadata = {
        ...(instruction.audit_metadata ?? {}),
        forum_roaming: this.buildForumRoamingAuditMetadata(ctx),
      }
    }
  }

  private buildForumRoamingAuditMetadata(ctx: ExecutionContext): Record<string, unknown> | null {
    if (!ctx.forum_roaming && !ctx.agent.forum_attention_hint) {
      return null
    }

    return {
      attention_hint: ctx.agent.forum_attention_hint
        ? {
            opportunity_id: ctx.agent.forum_attention_hint.opportunity_id,
            browse_reason: ctx.agent.forum_attention_hint.browse_reason,
            selected_anchor_turn_id: ctx.agent.forum_attention_hint.selected_anchor_turn_id,
            target_thread_id: ctx.agent.forum_attention_hint.target_thread_id,
            target_agent_ids: ctx.agent.forum_attention_hint.target_agent_ids,
            priority_agent_ids: ctx.agent.forum_attention_hint.priority_agent_ids,
            evidence_turn_ids: ctx.agent.forum_attention_hint.evidence_turn_ids,
            reason_codes: ctx.agent.forum_attention_hint.reason_codes,
            selection_path: ctx.agent.forum_attention_hint.selection_path,
            fallback_reason: ctx.agent.forum_attention_hint.fallback_reason,
          }
        : null,
      decision_hint: ctx.forum_roaming?.decision_hint
        ? {
            text: ctx.forum_roaming.decision_hint.text,
            source_provenance: ctx.forum_roaming.decision_hint.source_provenance,
          }
        : null,
      decision_result: ctx.forum_roaming?.decision_result ?? null,
      resolved_execution_plan: ctx.forum_roaming?.resolved_execution_plan ?? null,
      arrival_candidates: (ctx.forum_roaming?.arrival_candidates ?? []).map((candidate) => ({
        candidate_id: candidate.candidate_id,
        candidate_kind: candidate.candidate_kind,
        thread_id: candidate.thread_id,
        focus_turn_id: candidate.focus_turn_id,
        ranking_reasons: candidate.ranking_reasons,
        reason_codes: candidate.reason_codes,
        allowed_actions: candidate.allowed_actions,
      })),
    }
  }

  private recordNoWriteDecision(input: {
    agentId: string
    event: EventPayload
    start: number
    ctx: ExecutionContext
    usage: LlmTokenUsage | null
    reason: string
    auditMetadata?: Record<string, unknown>
  }): AgentExecutionResult {
    runtimeFeatureMetrics.recordForumRoamingNoWrite({
      reason: normalizeForumNoWriteReason(input.reason),
      event_type: input.event.event_type,
      post_id: input.event.post_id ?? null,
      thread_id: input.event.thread_id ?? null,
      agent_id: input.agentId,
      opportunity_id: input.ctx.agent.forum_attention_hint?.opportunity_id ?? null,
    })
    this.deps.agentRunRepo.create({
      agent_id: input.agentId,
      trigger_event_id: input.event.event_id,
      input_digest: `no_write|event:${input.event.event_type}|reason:${input.reason}`,
      output_json: {
        no_write: true,
        reason: input.reason,
        audit_metadata: {
          forum_roaming: this.buildForumRoamingAuditMetadata(input.ctx),
          ...(input.auditMetadata ?? {}),
        },
      },
      token_cost: input.usage?.total_tokens ?? 0,
      latency_ms: Date.now() - input.start,
    })
    return {
      agent_id: input.agentId,
      event_id: input.event.event_id,
      success: true,
      usage: input.usage ?? undefined,
      latency_ms: Date.now() - input.start,
    }
  }

  private resolveDecisionIdentity(agentId: string): {
    agent_id: string
    display_name: string
    persona_seed_code: import('../../shared/agent-persona-catalog.js').PersonaSeedCode
    owner_style_pins: ReturnType<typeof resolveAgentIdentity>['contract']['ownerStylePins']
  } | null {
    try {
      const agent = this.deps.agentService.getAgent(agentId)
      const latestConfig = this.deps.agentService.getLatestConfig(agentId)
      const resolved = resolveAgentIdentity(agent, latestConfig)
      return {
        agent_id: agentId,
        display_name: agent.display_name,
        persona_seed_code: resolved.summary.persona_seed_code,
        owner_style_pins: resolved.contract.ownerStylePins,
      }
    } catch {
      return null
    }
  }

  private buildForumRoamingDecisionVariables(input: {
    persona_decision_hint: string
    decision_control_block: string
    decision_context_block: string
    arrival_candidates_json: string
  }): Record<string, string> {
    return {
      persona_decision_hint: input.persona_decision_hint,
      decision_control_block: input.decision_control_block,
      decision_context_block: input.decision_context_block,
      arrival_candidates_json: input.arrival_candidates_json,
    }
  }
  private buildForumActionPlanVariables(
    ctx: ExecutionContext,
    personaSeedCode: import('../../shared/agent-persona-catalog.js').PersonaSeedCode,
    scene: 'forum_post' | 'forum_thread',
  ): Record<string, string> {
    return {
      ...this.buildVariables(ctx, personaSeedCode, scene),
      forum_action_options_json: buildForumActionOptionsPayload({
        event_type: ctx.event.event_type,
        options: buildForumActionOptions(ctx),
      }),
    }
  }

  private buildVoteIdempotencyKey(input: {
    sourceEventId: string
    agentId: string
    targetType: string
    targetId: string
    transition: 'CAST_UP' | 'CAST_DOWN' | 'CLEAR_UP' | 'CLEAR_DOWN'
  }): string {
    return [
      'runtime-vote',
      input.sourceEventId,
      input.agentId,
      input.targetType,
      input.targetId,
      input.transition,
    ].join(':')
  }

  private combineUsage(
    left: LlmTokenUsage | null | undefined,
    right: LlmTokenUsage | null | undefined,
  ): LlmTokenUsage {
    return {
      prompt_tokens: (left?.prompt_tokens ?? 0) + (right?.prompt_tokens ?? 0),
      completion_tokens: (left?.completion_tokens ?? 0) + (right?.completion_tokens ?? 0),
      total_tokens: (left?.total_tokens ?? 0) + (right?.total_tokens ?? 0),
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

  private getForumTextReplyBudget(
    eventType: 'NewPostCreated' | 'ThreadOpened' | 'ThreadTurnAdded',
  ): number {
    switch (eventType) {
      case 'NewPostCreated':
        return 2
      case 'ThreadOpened':
      case 'ThreadTurnAdded':
        return 1
    }
  }

  private resolveForumPlanningFocusEntry(ctx: ExecutionContext): ExecutionContext['focusThreadTurn'] {
    return ctx.focusThreadTurn
  }

  private getForumDecisionRequestedTier(
    scene: 'forum_post' | 'forum_thread' | 'chat_room',
  ): import('../../shared/agent-persona-catalog.js').RenderTier {
    return 'lite'
  }

  private isDeterministicObserveOnlyRoaming(
    candidates: ExecutionContext['forum_roaming']['arrival_candidates'],
  ): boolean {
    return candidates.length > 0
      && candidates.every(
        (candidate) => candidate.allowed_actions.length === 1 && candidate.allowed_actions[0] === 'observe_only',
      )
  }

  private async resolveVisibleRouting(
    agentId: string,
    requestedTier: import('../../shared/agent-persona-catalog.js').RenderTier,
    requestedTierCeiling?: import('../../shared/agent-persona-catalog.js').RenderTier,
  ): Promise<VisibleRoutingDecision> {
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

  private canServeVisibleForumRoute(input: {
    agentId: string
    traceId: string
    scene: 'forum_post' | 'forum_thread' | 'chat_room'
    promptRef: PromptTemplateRef
    homeVoiceLineId: import('../../shared/agent-persona-catalog.js').VoiceLineId
    requestedTier: import('../../shared/agent-persona-catalog.js').RenderTier
    responseMode: 'json_object' | 'text'
    localOverrides?: { executionPolicyId: string }
  }): boolean {
    if (typeof this.deps.llmGateway.canServeRoute !== 'function') {
      return true
    }

    return this.deps.llmGateway.canServeRoute({
      agentId: input.agentId,
      traceId: input.traceId,
      intent: 'forum_reply',
      visibility: 'visible',
      scene: input.scene,
      promptRef: input.promptRef,
      homeVoiceLineId: input.homeVoiceLineId,
      requestedTier: input.requestedTier,
      modality: 'text',
      responseMode: input.responseMode,
      budgetClass: 'visible_standard',
      allowFallbackWithinLine: true,
      allowCrossFamily: false,
      ...(input.localOverrides ? { localOverrides: input.localOverrides } : {}),
    })
  }

  private isRouteUnavailableLlmError(error: unknown): boolean {
    if (
      typeof error === 'object'
      && error !== null
      && 'code' in error
      && (
        (error as { code?: unknown }).code === 'AuthError'
        || (error as { code?: unknown }).code === 'RateLimitError'
        || (error as { code?: unknown }).code === 'TimeoutError'
        || (error as { code?: unknown }).code === 'TransientError'
      )
    ) {
      return true
    }

    if (!(error instanceof Error)) {
      return false
    }

    const message = error.message.toLowerCase()
    return (
      message.includes('failed to resolve any credential')
      || message.includes('failed to resolve credential')
      || message.includes('no credential pool available')
      || message.includes('all credential pools are saturated')
      || message.includes('credential resolution error')
      || message.includes('rate limit')
      || message.includes('timeout')
      || message.includes('fetch failed')
      || message.includes('econnreset')
      || message.includes('etimedout')
    )
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

function isForumRuntimeEvent(
  event: EventPayload,
): event is EventPayload & { event_type: 'NewPostCreated' | 'ThreadOpened' | 'ThreadTurnAdded' } {
  return (
    event.event_type === 'NewPostCreated'
    || event.event_type === 'ThreadOpened'
    || event.event_type === 'ThreadTurnAdded'
  )
}
