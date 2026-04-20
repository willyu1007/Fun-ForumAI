import type { LLMGateway } from '../llm/llm-gateway.js'
import type { PromptTemplateRef } from '../llm/gateway-contract.js'
import { PROMPT_TEMPLATE_REFS } from '../llm/prompt-template-refs.js'
import type { ContextBuilder } from './context-builder.js'
import type { ResponseParser } from './response-parser.js'
import type { DataPlaneWriter } from './data-plane-writer.js'
import type { AllocationResult, EventPayload } from '../allocator/types.js'
import type { AgentExecutionResult, ExecutionContext } from './types.js'
import type { LlmTokenUsage } from '../llm/types.js'
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
}

function normalizeForumNoWriteReason(reason: string):
  | 'decision_failed'
  | 'candidate_missing'
  | 'candidate_expired'
  | 'candidate_invalid'
  | 'target_invalid'
  | 'observe_only'
  | 'no_viable_candidates'
  | 'audience_scope_excluded' {
  if (
    reason === 'decision_failed'
    || reason === 'candidate_missing'
    || reason === 'candidate_expired'
    || reason === 'candidate_invalid'
    || reason === 'target_invalid'
    || reason === 'observe_only'
    || reason === 'no_viable_candidates'
    || reason === 'audience_scope_excluded'
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
      const shouldUseForumRoaming = this.shouldUseForumRoamingSelection(ctx)
      if (!shouldUseForumRoaming) {
        ctx = await this.prepareSurfaceMediaPlan(ctx, agent)
      }
      ctx = await this.deps.contextBuilder.enrichWithLayers(ctx)

      if (ctx.skip_reason) {
        return this.recordSceneSkip(agent.agent_id, event, ctx.skip_reason, ctx, start)
      }

      if (shouldUseForumRoaming) {
        return this.executeForumThreadWithRoaming({
          start,
          event,
          agent,
          ctx,
        })
      }

      return this.executeVisibleWrite({
        start,
        event,
        agent,
        ctx,
      })
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
  }): Promise<AgentExecutionResult> {
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
        return this.executeVisibleWrite({
          start: input.start,
          event: input.event,
          agent: input.agent,
          ctx: baselineCtx,
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

    const decisionRouting = await this.resolveVisibleRouting(input.agent.agent_id, 'lite', 'lite')
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
        allowFallbackWithinLine: false,
        allowCrossFamily: false,
        localOverrides: {
          executionPolicyId: 'visible-forum_reply-selection-lite',
        },
      })
    } catch (error) {
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
        return this.executeVisibleWrite({
          start: input.start,
          event: input.event,
          agent: input.agent,
          ctx: baselineCtx,
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

    if (!executionPlan.requires_generation) {
      return this.recordNoWriteDecision({
        agentId: input.agent.agent_id,
        event: input.event,
        start: input.start,
        ctx: input.ctx,
        usage: decisionResponse.usage,
        reason: executionPlan.validation_status,
      })
    }

    let retargetedCtx = await this.deps.contextBuilder.retargetForumThreadContext(
      input.ctx,
      executionPlan,
    )
    retargetedCtx.forum_roaming = input.ctx.forum_roaming
    retargetedCtx = await this.prepareSurfaceMediaPlan(retargetedCtx, input.agent)
    retargetedCtx = await this.deps.contextBuilder.enrichWithLayers(retargetedCtx)

    return this.executeVisibleWrite({
      start: input.start,
      event: input.event,
      agent: input.agent,
      ctx: retargetedCtx,
      extraUsage: decisionResponse.usage,
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

  private applyInstructionRuntimeMetadata(
    ctx: ExecutionContext,
    instruction: NonNullable<ReturnType<ResponseParser['parse']>>,
  ): void {
    if (ctx.event.governance_batch_id && ctx.event.generation_mode) {
      instruction.governance_context = {
        governance_batch_id: ctx.event.governance_batch_id,
        generation_mode: ctx.event.generation_mode,
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
