import type { LLMGateway } from '../llm/llm-gateway.js'
import { buildPromptTemplateRef, PROMPT_TEMPLATE_REFS } from '../llm/prompt-template-refs.js'
import type { ForumReadService } from '../services/forum-read-service.js'
import type { AgentService } from '../services/agent-service.js'
import type { ResponseParser } from './response-parser.js'
import type { DataPlaneWriter } from './data-plane-writer.js'
import type { AgentPersona } from './types.js'
import {
  buildLocalIntentBlock,
  generateSceneId,
  type PublicSceneWritePayload,
} from '../services/public-scene-runtime.js'
import type { PromptOrchestrator } from './prompt-orchestrator.js'
import type { PersonaStateService } from '../services/persona-state-service.js'
import type { InferenceProfileService } from '../services/inference-profile-service.js'
import type { RenderTierDecisionResult } from './persona-runtime-types.js'
import type { EventRepository, AgentRunRepository } from '../repos/event-repository.js'
import type { AgentCommunityMembershipRepository } from '../repos/agent-community-membership-repository.js'
import type { RoleAssignmentRepository } from '../repos/role-assignment-repository.js'
import type { PublicSceneSelectorService } from '../services/public-scene-selector-service.js'
import type { PromptComposeAudit } from './types.js'
import type { MediaProjectionService } from '../media/media-projection-service.js'
import type { VisualDirectiveService } from '../media/visual-directive-service.js'
import type { ImagePlannerService } from '../media/image-planner-service.js'
import type { MediaGenerationService } from '../media/media-generation-service.js'
import type { MediaRolloutControllerService } from '../media/media-rollout-controller-service.js'
import type { MediaObservabilityService } from '../media/media-observability-service.js'
import type { AgentStageTierService } from '../services/agent-stage-tier-service.js'
import { config } from '../lib/config.js'
import { resolveAgentIdentity } from '../identity/agent-identity.js'
import { buildPromptBudgetSummary } from './prompt-budget-summary.js'
import {
  resolveStageSpecFromRules,
  STAGE_TIER_ORDER,
  tierMeets,
  type AgentStageTier,
} from '../stage/index.js'
import {
  attachPersonaObservation,
  buildPersonaObservation,
  recordPersonaObservation,
} from './persona-observation.js'
import type { WarmupProbeContextInput } from '../../shared/warmup-verifier.js'

export interface PostSchedulerConfig {
  postIntervalMs: number
  postMaxPerDay: number
}

export interface PostSchedulerDeps {
  llmGateway: LLMGateway
  forumReadService: ForumReadService
  agentService: AgentService
  responseParser: ResponseParser
  dataplaneWriter: DataPlaneWriter
  eventRepo: EventRepository
  agentRunRepo: AgentRunRepository
  membershipRepo?: Pick<AgentCommunityMembershipRepository, 'listActiveCommunityIdsByAgent' | 'findCurrent'>
  roleAssignmentRepo?: Pick<RoleAssignmentRepository, 'findPrimaryForAgent'>
  stageTierService?: Pick<AgentStageTierService, 'getSnapshot'> | null
  promptOrchestrator?: PromptOrchestrator | null
  mediaProjectionService?: MediaProjectionService | null
  visualDirectiveService?: VisualDirectiveService | null
  imagePlannerService?: ImagePlannerService | null
  mediaGenerationService?: MediaGenerationService | null
  mediaRolloutControllerService?: MediaRolloutControllerService | null
  mediaObservabilityService?: Pick<MediaObservabilityService, 'record' | 'recordCriticalPrivateLeak'> | null
  personaStateService?: PersonaStateService | null
  inferenceProfileService?: InferenceProfileService | null
  publicSceneSelectorService?: PublicSceneSelectorService | null
}

export interface PostSchedulerResult {
  triggered: boolean
  agent_id?: string
  community_id?: string
  post_id?: string
  error?: string
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
  latency_ms?: number
}

const WARMUP_RUNTIME_REQUESTED_TIER = 'lite'

const DEFAULT_PERSONA: AgentPersona = {
  name: '匿名智能体',
  style: '中立客观，简洁明了',
  interests: ['通用话题'],
  language: 'zh-CN',
}

interface CommunityCandidate {
  id: string
  slug: string
  name: string
  description: string
  rules: string
  rules_json: Record<string, unknown> | null
}

interface SelectedAgent {
  id: string
  display_name: string
}

interface ScheduledPostVisualPlan {
  directive_id: string
  image_plan_id: string
  runtime_card_ids: string[]
  current_context_source?: {
    kind: 'public_media_card'
    text: string
    priority: 'high'
    source_id: string
  }
  display_attachment_refs: Array<{
    asset_id: string
    slot: number
    display_variant: 'original' | 'generated_derivative'
  }>
  planning_audit: Record<string, unknown>
}

/**
 * Schedules autonomous post creation by agents.
 * Each tick checks if enough time has elapsed and daily quota allows,
 * then picks an active agent + target community and generates a new post via LLM.
 */
export class PostScheduler {
  private lastPostAt = 0
  private lastSkipAt = 0
  private postsToday = 0
  private todayDate = ''

  constructor(
    private readonly deps: PostSchedulerDeps,
    private readonly cfg: PostSchedulerConfig,
  ) {}

  get stats() {
    return {
      lastPostAt: this.lastPostAt,
      lastSkipAt: this.lastSkipAt,
      postsToday: this.postsToday,
      postMaxPerDay: this.cfg.postMaxPerDay,
      postIntervalMs: this.cfg.postIntervalMs,
    }
  }

  shouldPost(): boolean {
    this.rolloverDay()
    if (this.postsToday >= this.cfg.postMaxPerDay) return false
    if (Date.now() - this.lastPostAt < this.cfg.postIntervalMs) return false
    if (Date.now() - this.lastSkipAt < this.cfg.postIntervalMs) return false
    return true
  }

  async createPost(input?: {
    governance_context?: import('../services/forum-write-service/types.js').GovernanceWriteContextInput
    probe_context?: WarmupProbeContextInput
  }): Promise<PostSchedulerResult> {
    if (!this.shouldPost()) {
      return { triggered: false }
    }

    const start = Date.now()

    try {
      const communities = await this.listCommunities()
      if (communities.length === 0) {
        this.recordSkip()
        return { triggered: false, error: 'No communities' }
      }
      const candidate = await this.pickRunnableAgentCandidate(communities)
      if (!candidate) {
        this.recordSkip()
        return { triggered: false, error: 'No stage-eligible posting candidates' }
      }
      const { selected, writableCommunities } = candidate
      const routing = input?.governance_context
        ? this.resolveWarmupVisibleRouting(selected.id)
        : await this.resolveVisibleRouting(selected.id, 'base')
      const fallbackCommunity = this.pickRandomCommunity(writableCommunities)
      if (!fallbackCommunity) return { triggered: false, error: 'No communities' }
      const sceneSelection = this.deps.publicSceneSelectorService
        ? await this.deps.publicSceneSelectorService.selectScheduledPost({
            agent: selected,
            eligible_communities: writableCommunities,
          })
        : { kind: 'skip' as const, reason: 'scene_selector_unavailable' }
      const targetCommunity = sceneSelection.kind === 'scene'
        ? sceneSelection.community
        : fallbackCommunity
      const selectorScenePayload = sceneSelection.kind === 'scene'
        ? sceneSelection.payload
        : null
      const scheduledFallbackReason = sceneSelection.kind === 'skip'
        ? sceneSelection.reason
        : null
      let effectiveScenePayload = selectorScenePayload
        ?? this.buildFallbackScheduledScenePayload({
          community: targetCommunity,
          reason: scheduledFallbackReason,
        })
      if (scheduledFallbackReason) {
        console.warn(
          `[PostScheduler] Falling back to community scheduling for agent=${selected.id}: ${scheduledFallbackReason}`,
        )
      }
      const promptRef = selectorScenePayload
        ? PROMPT_TEMPLATE_REFS.agentCreatePostScene
        : buildPromptTemplateRef('agent-create-post', 4)

      const persona = this.loadPersona(selected.id)
      const recentPosts = await this.getRecentPostsSummary(targetCommunity.id)
      const communityCatalog = this.toCommunityCatalog(writableCommunities)
      let visualPlan: ScheduledPostVisualPlan | null = null
      if (effectiveScenePayload) {
        try {
          visualPlan = await this.prepareVisualPlan({
            agent_id: selected.id,
            community_id: targetCommunity.id,
            scenePayload: effectiveScenePayload,
          })
          if (visualPlan) {
            effectiveScenePayload = {
              ...effectiveScenePayload,
              planning_audit: {
                ...(effectiveScenePayload.planning_audit ?? {}),
                ...visualPlan.planning_audit,
              },
              visual_ref: {
                directive_id: visualPlan.directive_id,
                image_plan_id: visualPlan.image_plan_id,
                runtime_card_ids: visualPlan.runtime_card_ids,
              },
            }
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'visual_planning_failed'
          console.error(`[PostScheduler] visual planning failed for agent=${selected.id}: ${message}`)
          effectiveScenePayload = {
            ...effectiveScenePayload,
            planning_audit: {
              ...(effectiveScenePayload.planning_audit ?? {}),
              visual_planning_status: 'degraded',
              visual_planning_error: message,
            },
          }
        }
      }
      const observationIdentity = this.resolveObservationIdentity(selected.id)
      let promptAudit: PromptComposeAudit | null = null
      let composedBlocks: {
        hard_control_block: string
        compact_control_block: string
        current_context_block: string
        memory_block: string
        soft_expression_block: string
      } = {
        hard_control_block: '',
        compact_control_block: '',
        current_context_block: '',
        memory_block: '',
        soft_expression_block: '',
      }
      let renderDecision: RenderTierDecisionResult | null = null

      if (!this.deps.promptOrchestrator) {
        throw new Error('PromptOrchestrator unavailable for scene scheduled_post')
      }
      const composed = await this.deps.promptOrchestrator.compose({
        agentId: selected.id,
        scene: 'scheduled_post',
        conversationText: effectiveScenePayload
          ? `${recentPosts}\n${effectiveScenePayload.local_intent_block}`.trim()
          : `${recentPosts}\n${communityCatalog}`.trim(),
        communityId: targetCommunity.id,
        topicHints: [targetCommunity.name, ...persona.interests].slice(0, 10),
        currentContextSources: [
          {
            kind: 'scheduler_context',
            text: recentPosts || '（暂无近期帖子）',
            priority: 'high',
            source_id: `scheduled:${selected.id}:recent_posts`,
          },
          {
            kind: 'community_context',
            text: communityCatalog,
            priority: 'medium',
            source_id: `scheduled:${selected.id}:community_catalog`,
          },
          ...(effectiveScenePayload?.local_intent_block
            ? [{
                kind: 'local_intent' as const,
                text: effectiveScenePayload.local_intent_block,
                priority: 'high' as const,
                source_id:
                  effectiveScenePayload.scene_metadata.local_intent_id
                  ?? effectiveScenePayload.scene_metadata.selection_id,
              }]
            : []),
          ...(visualPlan?.current_context_source ? [visualPlan.current_context_source] : []),
        ],
        requestEnvelope: {
          static_system_tokens: 200,
          route_wrapper_tokens: 110,
          tool_tokens: 0,
          current_user_input_tokens: 0,
          output_reserve: 0,
          model_capability_ref: null,
        },
        communityHardRule: targetCommunity.rules,
        communitySoftCulture: targetCommunity.description,
        sceneRule: '你正在主动发起新的论坛帖子',
        shortTermState: `recent_posts_len=${recentPosts.length}`,
        shortTermStateUpdatedAt: new Date(),
      })
      persona.name = composed.persona.name
      persona.style = composed.persona.style
      persona.interests = composed.persona.interests
      persona.language = composed.persona.language
      renderDecision = composed.runtimeEnvelope?.renderTierDecision ?? null
      composedBlocks = {
        hard_control_block: composed.blocks.hard_control_block ?? '',
        compact_control_block: composed.blocks.compact_control_block ?? '',
        current_context_block: composed.blocks.current_context_block ?? '',
        memory_block: composed.blocks.memory_block ?? '',
        soft_expression_block: composed.blocks.soft_expression_block ?? '',
      }
      promptAudit = composed.audit

      const variables: Record<string, string> = {
        persona_name: persona.name,
        persona_style: persona.style,
        persona_interests: persona.interests.join('、'),
        persona_language: persona.language,
        persona_seed_code: observationIdentity?.persona_seed_code ?? 'scholar',
        community_name: targetCommunity.name,
        hard_control_block: composedBlocks.hard_control_block,
        compact_control_block: composedBlocks.compact_control_block,
        current_context_block: composedBlocks.current_context_block,
        memory_block: composedBlocks.memory_block,
        soft_expression_block: composedBlocks.soft_expression_block,
      }

      const triggerEvent = this.deps.eventRepo.create({
        event_type: 'SCHEDULED_POST_GENERATED',
        plane: 'RUNTIME',
        actor_type: 'agent',
        actor_id: selected.id,
        community_id: targetCommunity.id,
        correlation_id: `scheduled-post:${selected.id}:${Date.now()}`,
        payload_json: {
          agent_id: selected.id,
          fallback_community_id: fallbackCommunity.id,
          target_community_id: targetCommunity.id,
          ...(effectiveScenePayload
            ? {
                public_scene: {
                  episode_id: effectiveScenePayload.scene_metadata.episode_id,
                  selection_id: effectiveScenePayload.scene_metadata.selection_id,
                  episode_plan_id: effectiveScenePayload.scene_metadata.episode_plan_id,
                  local_intent_id: effectiveScenePayload.scene_metadata.local_intent_id,
                },
              }
            : {}),
          ...(scheduledFallbackReason
            ? {
                scene_selection: {
                  status: 'fallback',
                  reason: scheduledFallbackReason,
                },
              }
            : {}),
        },
      })

      const llmResponse = await this.deps.llmGateway.generateVisibleText({
        intent: 'scheduled_post',
        scene: 'scheduled_post',
        modality: 'text',
        responseMode: 'text',
        agentId: selected.id,
        homeVoiceLineId: routing.homeVoiceLineId,
        promptRef,
        variables,
        budgetClass: 'visible_standard',
        traceId: `scheduled-post:${selected.id}:${Date.now()}`,
        promptBudgetSummary: buildPromptBudgetSummary('scheduled_post', promptRef, promptAudit),
        requestedTier: routing.requestedTier,
        allowFallbackWithinLine: true,
        allowCrossFamily: false,
      })
      const latencyMs = Date.now() - start
      const observation = buildPersonaObservation({
        sourceCallsiteId: 'post-scheduler-create-post',
        scene: 'scheduled_post',
        intent: 'scheduled_post',
        visibility: 'visible',
        coverageStatus: observationIdentity?.persona_seed_code && observationIdentity?.home_voice_line_id
          ? 'visible_complete'
          : 'visible_partial',
        personaSeedCode: observationIdentity?.persona_seed_code,
        homeVoiceLineId: observationIdentity?.home_voice_line_id,
        promptRef,
        requestedTier: llmResponse.renderDecision.tier,
        resolvedTier: llmResponse.renderDecision.tier,
        renderDecision: llmResponse.renderDecision,
        usage: llmResponse.usage,
        latencyMs,
        parseSuccess: false,
        promptAudit,
        llmProviderId: llmResponse.renderDecision.providerId,
        llmModelId: llmResponse.renderDecision.modelId,
      })

      const instruction = this.deps.responseParser.parseAsScheduledPost({
        text: llmResponse.content,
        fallbackCommunityId: targetCommunity.id,
        communities: writableCommunities,
        lockedCommunityId: effectiveScenePayload ? targetCommunity.id : undefined,
      })

      if (!instruction) {
        const failedObservation = {
          ...observation,
          parse_success: false,
          error: 'Failed to parse LLM output as scheduled post',
        }
        this.deps.agentRunRepo.create({
          agent_id: selected.id,
          trigger_event_id: triggerEvent.id,
          input_digest: `scheduled_post_parse_failed|len:${llmResponse.content.length}`,
          output_json: attachPersonaObservation(
            {
              fallback_community_id: fallbackCommunity.id,
              target_community_id: targetCommunity.id,
              ...(scheduledFallbackReason
                ? {
                    scene_selection: {
                      status: 'fallback',
                      reason: scheduledFallbackReason,
                    },
                  }
                : {}),
              error: 'Failed to parse LLM output as post',
            },
            failedObservation,
          ),
          token_cost: llmResponse.usage.total_tokens,
          latency_ms: latencyMs,
        })
        recordPersonaObservation(failedObservation)
        console.warn('[PostScheduler] LLM output could not be parsed as scheduled post')
        return {
          triggered: true,
          agent_id: selected.id,
          community_id: targetCommunity.id,
          error: 'Failed to parse LLM output as post',
          usage: llmResponse.usage,
          latency_ms: latencyMs,
        }
      }

      if (effectiveScenePayload) {
        instruction.public_scene = effectiveScenePayload
      }
      if (input?.governance_context) {
        instruction.governance_context = input.governance_context
      }
      if (input?.probe_context && instruction.action === 'create_post') {
        instruction.title = this.applyProbeTitleSuffix(
          instruction.title ?? '',
          input.probe_context.probe_token,
        )
        instruction.tags = this.applyProbeTags(instruction.tags ?? [], input.probe_context.run_id)
        instruction.audit_metadata = {
          ...(instruction.audit_metadata ?? {}),
          warmup_probe: input.probe_context,
        }
      }
      if (scheduledFallbackReason) {
        instruction.audit_metadata = {
          ...(instruction.audit_metadata ?? {}),
          scheduled_post_scene_selection: 'fallback',
          scheduled_post_scene_reason: scheduledFallbackReason,
        }
      }
      if (visualPlan) {
        instruction.image_plan_id = visualPlan.image_plan_id
        instruction.display_attachment_refs = visualPlan.display_attachment_refs
        instruction.audit_metadata = {
          ...(instruction.audit_metadata ?? {}),
          visual_directive_id: visualPlan.directive_id,
          image_plan_id: visualPlan.image_plan_id,
          planner_status: visualPlan.planning_audit.planner_status,
          planner_decision: visualPlan.planning_audit.planner_decision,
        }
      }

      const writeResult = await this.deps.dataplaneWriter.write(
        instruction,
        selected.id,
        triggerEvent.id,
        llmResponse.usage,
        latencyMs,
        0,
        {
          ...observation,
          parse_success: true,
        },
      )

      if (!writeResult.success || !writeResult.content_id) {
        const writeError = writeResult.error ?? 'Failed to persist generated post'
        console.warn(`[PostScheduler] Generated post was not persisted: ${writeError}`)
        return {
          triggered: true,
          agent_id: selected.id,
          community_id: instruction.community_id,
          usage: llmResponse.usage,
          latency_ms: latencyMs,
          error: writeError,
        }
      }

      this.lastPostAt = Date.now()
      this.lastSkipAt = 0
      this.postsToday++

      if (renderDecision && this.deps.personaStateService) {
        await this.deps.personaStateService.recordVisibleRender({
          agentId: selected.id,
          scene: 'scheduled_post',
          renderDecision,
          outputText: instruction.body,
        }).catch((err) => {
          console.error('[PostScheduler] persona runtime render record failed:', err)
        })
      }

      const actualCommunity = writableCommunities.find((item) => item.id === instruction.community_id)
      console.log(
        `[PostScheduler] Agent "${persona.name}" posted in "${actualCommunity?.name ?? instruction.community_id}" (${latencyMs}ms, ${llmResponse.usage.total_tokens} tokens)`,
      )

      return {
        triggered: true,
        agent_id: selected.id,
        community_id: instruction.community_id,
        post_id: writeResult.content_id,
        usage: llmResponse.usage,
        latency_ms: latencyMs,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.error(`[PostScheduler] Failed: ${message}`)
      return { triggered: true, error: message, latency_ms: Date.now() - start }
    }
  }

  /** Force a post regardless of interval/quota (for dev endpoints). */
  async forcePost(input?: {
    governance_context?: import('../services/forum-write-service/types.js').GovernanceWriteContextInput
    probe_context?: WarmupProbeContextInput
  }): Promise<PostSchedulerResult> {
    const saved = { lastPostAt: this.lastPostAt, lastSkipAt: this.lastSkipAt, postsToday: this.postsToday }
    this.lastPostAt = 0
    this.lastSkipAt = 0
    this.postsToday = 0
    try {
      return await this.createPost(input)
    } finally {
      if (this.postsToday === 0) {
        this.lastPostAt = saved.lastPostAt
        this.lastSkipAt = saved.lastSkipAt
        this.postsToday = saved.postsToday
      }
    }
  }

  private applyProbeTitleSuffix(title: string, probeToken: string): string {
    const suffix = ` [probe:${probeToken}]`
    const trimmed = title.trim() || 'Warm-up probe'
    if (trimmed.endsWith(suffix)) return trimmed
    const maxTitleLength = 300
    if (trimmed.length + suffix.length <= maxTitleLength) {
      return `${trimmed}${suffix}`
    }
    return `${trimmed.slice(0, maxTitleLength - suffix.length).trimEnd()}${suffix}`
  }

  private applyProbeTags(existingTags: string[], runId: string): string[] {
    const next = new Set(existingTags.filter((tag) => tag.trim().length > 0))
    next.add('warmup-probe')
    next.add(`warmup-probe:${runId}`)
    return [...next]
  }

  private rolloverDay(): void {
    const today = new Date().toISOString().slice(0, 10)
    if (today !== this.todayDate) {
      this.todayDate = today
      this.postsToday = 0
    }
  }

  private recordSkip(): void {
    this.lastSkipAt = Date.now()
  }

  private async pickRunnableAgentCandidate(communities: CommunityCandidate[]): Promise<{
    selected: SelectedAgent
    writableCommunities: CommunityCandidate[]
  } | null> {
    const activeAgents = this.listEligibleAgents()
    if (activeAgents.length === 0) return null

    const candidates: Array<{
      selected: SelectedAgent
      writableCommunities: CommunityCandidate[]
    }> = []

    for (const agent of activeAgents) {
      const eligibleCommunities = this.resolveEligibleCommunities(agent.id, communities)
      if (eligibleCommunities.length === 0) {
        continue
      }
      const writableCommunities = await this.resolveStageEligibleCommunities(
        agent.id,
        eligibleCommunities,
      )
      if (writableCommunities.length === 0) {
        continue
      }
      candidates.push({
        selected: {
          id: agent.id,
          display_name: agent.display_name,
        },
        writableCommunities,
      })
    }

    if (candidates.length === 0) {
      return null
    }

    if (config.launch.capabilities.multimodalAgentMediaV1 && this.deps.imagePlannerService?.listAgentIdsWithOwnerPrivatePoolCandidates) {
      const prioritizedAgentIds = await this.deps.imagePlannerService.listAgentIdsWithOwnerPrivatePoolCandidates(100)
      const activeById = new Map(candidates.map((candidate) => [candidate.selected.id, candidate]))
      for (const agentId of prioritizedAgentIds) {
        const selected = activeById.get(agentId)
        if (selected) {
          return selected
        }
      }
    }

    return candidates[Math.floor(Math.random() * candidates.length)] ?? null
  }

  private listEligibleAgents(): Array<{ id: string; display_name: string }> {
    const activeAgents = this.deps.agentService.listActiveAgents({ limit: 100 }).items
    if (!this.requiresMembershipScopedPosting() || !this.deps.membershipRepo) {
      return activeAgents
    }

    return activeAgents.filter((agent) =>
      this.deps.membershipRepo!.listActiveCommunityIdsByAgent(agent.id).length > 0,
    )
  }

  private async listCommunities(): Promise<CommunityCandidate[]> {
    const result = await this.deps.forumReadService.getCommunities({ limit: 100 })
    return result.items.map((item) => ({
      id: item.id,
      slug: item.slug,
      name: item.name,
      description: item.description || '',
      rules: item.rules_json ? JSON.stringify(item.rules_json) : '',
      rules_json: item.rules_json && typeof item.rules_json === 'object'
        ? item.rules_json as Record<string, unknown>
        : null,
    }))
  }

  private resolveEligibleCommunities(
    agentId: string,
    communities: CommunityCandidate[],
  ): CommunityCandidate[] {
    if (!this.requiresMembershipScopedPosting() || !this.deps.membershipRepo) {
      return communities
    }

    const activeCommunityIds = new Set(this.deps.membershipRepo.listActiveCommunityIdsByAgent(agentId))
    return communities.filter((item) => activeCommunityIds.has(item.id))
  }

  private async resolveStageEligibleCommunities(
    agentId: string,
    communities: CommunityCandidate[],
  ): Promise<CommunityCandidate[]> {
    if (!config.launch.capabilities.stageRoleRuntimeV1) {
      return communities
    }

    const agentTier = await this.resolveAgentTier(agentId)
    return communities.filter((community) =>
      this.isStageEligibleCommunity({
        agentId,
        agentTier,
        community,
      }))
  }

  private isStageEligibleCommunity(input: {
    agentId: string
    agentTier: AgentStageTier
    community: CommunityCandidate
  }): boolean {
    const stageResolved = resolveStageSpecFromRules(input.community.rules_json ?? null, {
      community_id: input.community.id,
    })
    if (
      config.launch.capabilities.riskControlV1
      && config.launch.market === 'mainland'
      && stageResolved.used_fallback
    ) {
      return false
    }

    const membership = this.deps.membershipRepo?.findCurrent(input.agentId, input.community.id) ?? null
    if (
      (config.launch.capabilities.membershipsV1
        || config.launch.capabilities.membershipStatusV1
        || config.launch.capabilities.stageRoleRuntimeV1)
      && !membership
    ) {
      return false
    }
    if (membership?.left_at) {
      return false
    }
    if (config.launch.capabilities.membershipStatusV1 && membership && membership.status !== 'ACTIVE') {
      return false
    }

    let roleKey = membership?.role === 'GUEST' ? 'guest' : 'resident'
    if (config.launch.capabilities.roleAssignmentV1 && this.deps.roleAssignmentRepo) {
      const assignment = this.deps.roleAssignmentRepo.findPrimaryForAgent({
        agent_id: input.agentId,
        community_id: input.community.id,
        post_id: null,
      })
      if (assignment && assignment.role.trim().length > 0) {
        const assignedRole = assignment.role.trim()
        if (Object.prototype.hasOwnProperty.call(stageResolved.stage_spec.roles, assignedRole)) {
          roleKey = assignedRole
        }
      }
    }

    const roleSpec = stageResolved.stage_spec.roles[roleKey]
    if (!roleSpec) {
      return false
    }
    if (!roleSpec.runtime_gate) {
      return true
    }

    let requiredTier = roleSpec.min_tier
    if (roleKey === 'resident') {
      requiredTier = maxTier(requiredTier, stageResolved.stage_spec.tier_gate.resident_min_tier)
    }
    if (roleKey === 'core') {
      requiredTier = maxTier(requiredTier, stageResolved.stage_spec.tier_gate.core_min_tier)
    }
    return tierMeets(requiredTier, input.agentTier)
  }

  private pickRandomCommunity(communities: CommunityCandidate[]): CommunityCandidate | null {
    if (communities.length === 0) return null
    return communities[Math.floor(Math.random() * communities.length)] ?? null
  }

  private toCommunityCatalog(communities: CommunityCandidate[]): string {
    if (communities.length === 0) return '（无候选社区）'
    return communities
      .map((community) =>
        [community.id, community.slug, community.name, community.description]
          .map((part) => part.trim() || '（空）')
          .join(' | '))
      .join('\n')
  }

  private requiresMembershipScopedPosting(): boolean {
    return config.launch.capabilities.membershipsV1 || config.launch.capabilities.membershipStatusV1 || config.launch.capabilities.stageRoleRuntimeV1
  }

  private async resolveAgentTier(agentId: string): Promise<AgentStageTier> {
    if (config.launch.capabilities.stageTierV1 && this.deps.stageTierService) {
      const snapshot = await this.deps.stageTierService.getSnapshot(agentId, {
        recomputeIfMissing: true,
      })
      return snapshot.tier
    }
    return 'T1'
  }

  private loadPersona(agentId: string): AgentPersona {
    try {
      const agent = this.deps.agentService.getAgent(agentId)
      const latestConfig = this.deps.agentService.getLatestConfig(agentId)
      return resolveAgentIdentity(agent, latestConfig).visiblePersona
    } catch {
      return DEFAULT_PERSONA
    }
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

  private resolveWarmupVisibleRouting(agentId: string): {
    homeVoiceLineId: import('../../shared/agent-persona-catalog.js').VoiceLineId
    requestedTier: import('../../shared/agent-persona-catalog.js').RenderTier
  } {
    const agent = this.deps.agentService.getAgent(agentId)
    const latestConfig = this.deps.agentService.getLatestConfig(agentId)
    const resolved = resolveAgentIdentity(agent, latestConfig)
    return {
      homeVoiceLineId: resolved.summary.home_voice_line_id,
      requestedTier: WARMUP_RUNTIME_REQUESTED_TIER,
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

  private async getRecentPostsSummary(communityId: string): Promise<string> {
    try {
      const feed = await this.deps.forumReadService.getFeed({
        communityId,
        limit: 5,
      })
      if (feed.items.length === 0) return '（这个社区还没有帖子，你将是第一个发帖的！）'

      return '## 社区近期帖子（避免重复话题）\n' +
        feed.items.map((p) => `- **${p.title}**`).join('\n')
    } catch {
      return ''
    }
  }

  private buildFallbackScheduledScenePayload(input: {
    community: Pick<CommunityCandidate, 'id' | 'slug' | 'name'>
    reason: string | null
  }): PublicSceneWritePayload {
    const now = new Date()
    const selectionId = generateSceneId('fallback_scene_sel')
    const episodeId = generateSceneId('fallback_episode')
    const episodePlanId = generateSceneId('fallback_episode_plan')
    const localIntentId = generateSceneId('fallback_local_intent')
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
    const viewerGoal = `在 ${input.community.name} 发起新的公共讨论`
    const growthGoal = '保持社区供给并继续驱动视觉规划'
    const localIntent: PublicSceneWritePayload['local_intent'] = {
      intent_id: localIntentId,
      delivery_surface: 'forum_post',
      initiative: 'open_topic',
      opinion_policy: 'free_opinion',
      relation_focus: 'none',
      tone_hint: 'neutral',
      privacy_mode: 'public_only',
      memory_scope: 'public_contextual',
      reference_scope: 'seed_only',
      prohibited_reference_types: ['owner_private_speech', 'private_memory', 'hidden_director_goal'],
      target_ref: { kind: 'none' },
      hard_constraints: [
        '不得改写目标社区',
        `围绕 ${input.community.name} 的公共语境发起讨论`,
      ],
      soft_constraints: [
        `让 ${input.community.name} 首页首屏立即可消费`,
        '保持适合公共展示与视觉规划的开场语境',
      ],
    }

    const episodeBrief: PublicSceneWritePayload['episode_brief'] = {
      episode_id: episodeId,
      director_surface: 'scheduled_post',
      actor_surface: 'forum_post',
      template_id: 'scheduled-post-fallback',
      template_version: 'v1',
      binding_id: `scheduled-post-fallback:${input.community.slug}`,
      phase: 'opening',
      scene_goal: {
        viewer_goal: viewerGoal,
        growth_goal: growthGoal,
      },
      casting_directive: {
        must_have_roles: [],
        avoid_pairs: [],
        core_quota: 1,
        contrast_quota: 1,
        wildcard_quota: 0,
      },
      open_loops: [],
      must_hit_points: ['给出可继续接招的话题入口'],
      avoid_repeat: [],
      close_condition: {
        ttl_hours: 24,
        message_threshold: 12,
        objective: viewerGoal,
      },
      expires_at: expiresAt,
    }

    return {
      scene_metadata: {
        director_surface: 'scheduled_post',
        actor_surface: 'forum_post',
        scene_template_id: 'scheduled-post-fallback',
        scene_template_version: 'v1',
        scene_binding_id: `scheduled-post-fallback:${input.community.slug}`,
        overlay_id: null,
        episode_id: episodeId,
        beat_id: null,
        phase: 'opening',
        selection_mode: 'pool_guided',
        selection_id: selectionId,
        episode_plan_id: episodePlanId,
        local_intent_id: localIntentId,
        started_at: now.toISOString(),
        expires_at: expiresAt,
      },
      episode_brief: episodeBrief,
      local_intent: localIntent,
      local_intent_block: buildLocalIntentBlock(localIntent, episodeBrief),
      selection_audit: {
        community_id: input.community.id,
        fallback: true,
      },
      planning_audit: {
        scene_selection_status: 'fallback',
        ...(input.reason ? { scene_selection_reason: input.reason } : {}),
      },
    }
  }

  private async prepareVisualPlan(input: {
    agent_id: string
    community_id: string
    scenePayload: PublicSceneWritePayload
  }): Promise<ScheduledPostVisualPlan | null> {
    if (!this.deps.visualDirectiveService || !this.deps.imagePlannerService || !this.deps.mediaProjectionService) {
      return null
    }

    const directive = await this.deps.visualDirectiveService.createScheduledPostDirective({
      community_id: input.community_id,
      payload: input.scenePayload,
    })
    const rolloutAdjusted = this.deps.mediaRolloutControllerService
      ? await this.deps.mediaRolloutControllerService.applyToScheduledPostDirective(directive)
      : null
    const effectiveDirective = rolloutAdjusted?.directive ?? directive
    const controllerProfile = rolloutAdjusted?.profile ?? null
    await this.deps.mediaObservabilityService?.record({
      event_type: 'root_post_visual_attempted',
      surface: 'root_post',
      agent_id: input.agent_id,
      community_id: input.community_id,
      payload_json: {
        visual_directive_id: directive.id,
        controller_profile: controllerProfile?.profile ?? null,
        controller_mode: controllerProfile?.mode ?? null,
      },
    })
    const initialPlan = await this.deps.imagePlannerService.planScheduledPost({
      agent_id: input.agent_id,
      directive: effectiveDirective,
    })
    const plan = initialPlan.status === 'pending_generation' && this.deps.mediaGenerationService
      ? await this.deps.mediaGenerationService.ensurePlanReadyWithinBudget({
          agent_id: input.agent_id,
          plan: initialPlan,
          wait_budget_ms: effectiveDirective.budget.sync_generation_ms_budget,
        })
      : initialPlan
    const firstCard = plan.runtime.cards[0] ?? null
    const serialized = firstCard
      ? this.deps.mediaProjectionService.serializePublicCardForPrompt({
          card: firstCard,
          max_chars: 1_200,
          audit_context: {
            surface: 'public_runtime',
            sensitive_terms: [],
            policy_mode: 'strict',
            visibility_scope: 'public',
            actor_role: 'agent',
          },
          enforcement: controllerProfile
            ? {
                semantic_v3_enforced: controllerProfile.effective.semantic_v3_enforced,
                strict_audit_enforced: controllerProfile.effective.strict_audit_enforced,
                lineage_required: controllerProfile.effective.lineage_required,
              }
            : undefined,
        })
      : null
    const promptAudit = serialized?.audit ?? null
    const promptSafe = serialized
      ? serialized.decision.decision !== 'block'
        && !serialized.audit.contains_url
        && !serialized.audit.contains_asset_id
        && !serialized.audit.contains_owner_note
        && !serialized.audit.contains_private_text
      : false
    const selectedSource = plan.selected_sources.find((item) => !item.rejection_reason)
    if (selectedSource?.source_kind) {
      await this.deps.mediaObservabilityService?.record({
        event_type: `source_selected:${selectedSource.source_kind}`,
        surface: 'root_post',
        agent_id: input.agent_id,
        community_id: input.community_id,
        image_plan_id: plan.id,
        asset_id: selectedSource.asset_id ?? null,
        source_kind: selectedSource.source_kind,
      })
    }
    if (firstCard && promptSafe) {
      await this.deps.mediaObservabilityService?.record({
        event_type: 'root_post_runtime_injected',
        surface: 'root_post',
        agent_id: input.agent_id,
        community_id: input.community_id,
        image_plan_id: plan.id,
        asset_id: firstCard.asset_ref.asset_id,
        source_kind: firstCard.source.kind,
      })
    }
    if (firstCard && !promptSafe) {
      const blockedFields = [
        serialized?.audit.contains_owner_note ? 'owner_note' : null,
        serialized?.audit.contains_private_text ? 'private_text' : null,
        serialized?.audit.contains_url ? 'url' : null,
        serialized?.audit.contains_asset_id ? 'asset_id' : null,
      ].filter((item): item is string => Boolean(item))
      await this.deps.mediaObservabilityService?.record({
        event_type: 'public_prompt_audit_blocked',
        surface: 'root_post',
        severity: 'warn',
        agent_id: input.agent_id,
        community_id: input.community_id,
        image_plan_id: plan.id,
        asset_id: firstCard.asset_ref.asset_id,
        source_kind: firstCard.source.kind,
        payload_json: {
          blocked_fields: blockedFields,
          derived_from_private: firstCard.source.derived_from_private,
          reason_codes: serialized?.decision.reason_codes ?? [],
        },
      })
      if (firstCard.source.derived_from_private && blockedFields.length > 0) {
        await this.deps.mediaObservabilityService?.recordCriticalPrivateLeak({
          surface: 'root_post',
          agent_id: input.agent_id,
          community_id: input.community_id,
          image_plan_id: plan.id,
          asset_id: firstCard.asset_ref.asset_id,
          source_kind: firstCard.source.kind,
          blocked_fields: blockedFields,
          reason: 'root_post_prompt_audit_blocked',
        })
      }
    }
    if (plan.runtime.cards.length > 0 && plan.display.attachments.length === 0) {
      await this.deps.mediaObservabilityService?.record({
        event_type: 'root_post_runtime_only',
        surface: 'root_post',
        agent_id: input.agent_id,
        community_id: input.community_id,
        image_plan_id: plan.id,
        payload_json: {
          planner_status: plan.status,
          planner_decision: plan.decision,
        },
      })
    }
    if (plan.runtime.cards.length === 0 && plan.display.attachments.length === 0) {
      await this.deps.mediaObservabilityService?.record({
        event_type: 'root_post_text_only',
        surface: 'root_post',
        agent_id: input.agent_id,
        community_id: input.community_id,
        image_plan_id: plan.id,
        payload_json: {
          planner_status: plan.status,
          planner_decision: plan.decision,
        },
      })
    }

    return {
      directive_id: directive.id,
      image_plan_id: plan.id,
      runtime_card_ids: plan.runtime.cards.map((card) => card.card_id),
      ...(firstCard && serialized && promptSafe
        ? {
            current_context_source: {
              kind: 'public_media_card' as const,
              text: serialized.text,
              priority: 'high' as const,
              source_id: firstCard.card_id,
            },
          }
        : {}),
      display_attachment_refs: plan.display.attachments.map((attachment) => ({
        asset_id: attachment.asset_id,
        slot: attachment.slot,
        display_variant: attachment.display_variant,
      })),
      planning_audit: {
        visual_directive_id: directive.id,
        image_plan_id: plan.id,
        planner_status: plan.status,
        planner_decision: plan.decision,
        planner_reason: plan.reason,
        rollout_controller_profile: controllerProfile?.profile ?? null,
        rollout_controller_mode: controllerProfile?.mode ?? null,
        generation_status: plan.generation.status,
        generation_job_id: plan.generation.job_id ?? null,
        runtime_card_ids: plan.runtime.cards.map((card) => card.card_id),
        public_media_prompt_audit: promptAudit,
        public_media_prompt_injection_status: firstCard
          ? (promptSafe ? 'accepted' : 'blocked_by_audit')
          : 'not_requested',
      },
    }
  }
}

function maxTier(a: AgentStageTier, b: AgentStageTier): AgentStageTier {
  return STAGE_TIER_ORDER[a] >= STAGE_TIER_ORDER[b] ? a : b
}
