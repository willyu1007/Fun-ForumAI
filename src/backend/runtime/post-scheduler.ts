import type { LLMGateway } from '../llm/llm-gateway.js'
import { buildPromptTemplateRef, PROMPT_TEMPLATE_REFS } from '../llm/prompt-template-refs.js'
import type { ForumReadService } from '../services/forum-read-service.js'
import type { AgentService } from '../services/agent-service.js'
import type { ResponseParser } from './response-parser.js'
import type { DataPlaneWriter } from './data-plane-writer.js'
import type { AgentPersona } from './types.js'
import type { AgentInclinationAsset } from '../repos/types.js'
import type { InclinationAssetService } from '../services/inclination-asset-service.js'
import type { PromptOrchestrator } from './prompt-orchestrator.js'
import type { PersonaStateService } from '../services/persona-state-service.js'
import type { InferenceProfileService } from '../services/inference-profile-service.js'
import type { RenderTierDecisionResult } from './persona-runtime-types.js'
import type { EventRepository, AgentRunRepository } from '../repos/event-repository.js'
import type { AgentCommunityMembershipRepository } from '../repos/agent-community-membership-repository.js'
import type { PublicSceneSelectorService } from '../services/public-scene-selector-service.js'
import type { PromptComposeAudit } from './types.js'
import { config } from '../lib/config.js'
import { resolveAgentIdentity } from '../identity/agent-identity.js'
import { resolvePreferredVisibleModelId } from '../llm/model-preference.js'
import { buildPromptBudgetSummary } from './prompt-budget-summary.js'
import {
  attachPersonaObservation,
  buildPersonaObservation,
  recordPersonaObservation,
} from './persona-observation.js'

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
  membershipRepo?: Pick<AgentCommunityMembershipRepository, 'listActiveCommunityIdsByAgent'>
  inclinationAssetService?: Pick<InclinationAssetService, 'listPendingAgentIds' | 'getPendingForAgent'>
  promptOrchestrator?: PromptOrchestrator | null
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
}

interface SelectedAgent {
  id: string
  display_name: string
  pending_asset: AgentInclinationAsset | null
}

/**
 * Schedules autonomous post creation by agents.
 * Each tick checks if enough time has elapsed and daily quota allows,
 * then picks an active agent + target community and generates a new post via LLM.
 */
export class PostScheduler {
  private lastPostAt = 0
  private postsToday = 0
  private todayDate = ''

  constructor(
    private readonly deps: PostSchedulerDeps,
    private readonly cfg: PostSchedulerConfig,
  ) {}

  get stats() {
    return {
      lastPostAt: this.lastPostAt,
      postsToday: this.postsToday,
      postMaxPerDay: this.cfg.postMaxPerDay,
      postIntervalMs: this.cfg.postIntervalMs,
    }
  }

  shouldPost(): boolean {
    this.rolloverDay()
    if (this.postsToday >= this.cfg.postMaxPerDay) return false
    if (Date.now() - this.lastPostAt < this.cfg.postIntervalMs) return false
    return true
  }

  async createPost(): Promise<PostSchedulerResult> {
    if (!this.shouldPost()) {
      return { triggered: false }
    }

    const start = Date.now()

    try {
      const selected = this.pickAgent()
      if (!selected) return { triggered: false, error: 'No active agents' }
      const routing = await this.resolveVisibleRouting(selected.id, 'base')

      const communities = await this.listCommunities()
      if (communities.length === 0) return { triggered: false, error: 'No communities' }
      const eligibleCommunities = this.resolveEligibleCommunities(selected.id, communities)
      if (eligibleCommunities.length === 0) {
        return {
          triggered: true,
          agent_id: selected.id,
          error: 'Selected agent has no writable communities',
        }
      }
      const fallbackCommunity = this.pickRandomCommunity(eligibleCommunities)
      if (!fallbackCommunity) return { triggered: false, error: 'No communities' }
      const sceneSelection = this.deps.publicSceneSelectorService
        ? await this.deps.publicSceneSelectorService.selectScheduledPost({
            agent: selected,
            eligible_communities: eligibleCommunities,
          })
        : { kind: 'skip' as const, reason: 'scene_selector_unavailable' }
      const targetCommunity = sceneSelection.kind === 'scene'
        ? sceneSelection.community
        : fallbackCommunity
      const scenePayload = sceneSelection.kind === 'scene'
        ? sceneSelection.payload
        : null
      const scheduledFallbackReason = sceneSelection.kind === 'skip'
        ? sceneSelection.reason
        : null
      if (scheduledFallbackReason) {
        console.warn(
          `[PostScheduler] Falling back to community scheduling for agent=${selected.id}: ${scheduledFallbackReason}`,
        )
      }
      const promptRef = scenePayload
        ? PROMPT_TEMPLATE_REFS.agentCreatePostScene
        : buildPromptTemplateRef('agent-create-post', 3)

      const persona = this.loadPersona(selected.id)
      const recentPosts = await this.getRecentPostsSummary(targetCommunity.id)
      const communityCatalog = this.toCommunityCatalog(eligibleCommunities)
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
        conversationText: scenePayload
          ? `${recentPosts}\n${scenePayload.local_intent_block}`.trim()
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
          ...(scenePayload?.local_intent_block
            ? [{
                kind: 'local_intent' as const,
                text: scenePayload.local_intent_block,
                priority: 'high' as const,
                source_id:
                  scenePayload.scene_metadata.local_intent_id
                  ?? scenePayload.scene_metadata.selection_id,
              }]
            : []),
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
          ...(scenePayload
            ? {
                public_scene: {
                  episode_id: scenePayload.scene_metadata.episode_id,
                  selection_id: scenePayload.scene_metadata.selection_id,
                  episode_plan_id: scenePayload.scene_metadata.episode_plan_id,
                  local_intent_id: scenePayload.scene_metadata.local_intent_id,
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
        agentId: selected.id,
        homeVoiceLineId: routing.homeVoiceLineId,
        preferredModelId: routing.preferredModelId,
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
        communities: eligibleCommunities,
        lockedCommunityId: scenePayload ? targetCommunity.id : undefined,
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

      if (scenePayload) {
        instruction.public_scene = scenePayload
      }
      if (scheduledFallbackReason) {
        instruction.audit_metadata = {
          ...(instruction.audit_metadata ?? {}),
          scheduled_post_scene_selection: 'fallback',
          scheduled_post_scene_reason: scheduledFallbackReason,
        }
      }

      if (selected.pending_asset && config.features.multimodalAgentInclinationV1) {
        instruction.media_asset_id = selected.pending_asset.id
        instruction.media_url = selected.pending_asset.media_url
        instruction.media_mime_type = selected.pending_asset.mime_type
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

      const actualCommunity = eligibleCommunities.find((item) => item.id === instruction.community_id)
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
  async forcePost(): Promise<PostSchedulerResult> {
    const saved = { lastPostAt: this.lastPostAt, postsToday: this.postsToday }
    this.lastPostAt = 0
    this.postsToday = 0
    try {
      return await this.createPost()
    } finally {
      if (this.postsToday === 0) {
        this.lastPostAt = saved.lastPostAt
        this.postsToday = saved.postsToday
      }
    }
  }

  private rolloverDay(): void {
    const today = new Date().toISOString().slice(0, 10)
    if (today !== this.todayDate) {
      this.todayDate = today
      this.postsToday = 0
    }
  }

  private pickAgent(): SelectedAgent | null {
    const activeAgents = this.listEligibleAgents()
    if (activeAgents.length === 0) return null

    if (config.features.multimodalAgentInclinationV1 && this.deps.inclinationAssetService) {
      const pendingAgentIds = this.deps.inclinationAssetService.listPendingAgentIds(100)
      const activeById = new Map(activeAgents.map((agent) => [agent.id, agent]))
      const prioritized = pendingAgentIds
        .map((id) => activeById.get(id))
        .filter((item): item is NonNullable<typeof item> => item != null)

      if (prioritized.length > 0) {
        const selected = prioritized[Math.floor(Math.random() * prioritized.length)]!
        return {
          id: selected.id,
          display_name: selected.display_name,
          pending_asset: this.deps.inclinationAssetService.getPendingForAgent(selected.id),
        }
      }
    }

    const selected = activeAgents[Math.floor(Math.random() * activeAgents.length)]
    return {
      id: selected.id,
      display_name: selected.display_name,
      pending_asset: null,
    }
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
    return config.features.membershipsV1 || config.features.membershipStatusV1 || config.features.stageRoleRuntimeV1
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
}
