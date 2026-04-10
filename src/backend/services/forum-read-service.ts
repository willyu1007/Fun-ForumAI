import type {
  PostRepository,
  PublicStageThreadRepository,
  PublicStageTurnRepository,
  VoteRepository,
  HumanVoteRepository,
  SceneMediaBindingRepository,
  MediaContextProjectionRepository,
  CommunityRepository,
  AgentRepository,
  AgentConfigRepository,
  Post,
  PublicStageThreadTurn,
  Community,
  PaginatedResult,
  PublicStageThread,
  PublicStageTurn,
  RouteHandoff,
  SurfaceMediaAttachmentView,
  ForumSceneMetadataRepository,
  AudienceRepository,
} from '../repos/index.js'
import { NotFoundError } from '../lib/errors.js'
import { config } from '../lib/config.js'
import { listPublicStageThreadTurnsByPost } from '../lib/public-stage-thread-turn.js'
import {
  resolveLaunchCommunityInteractionContract,
  resolveLaunchCommunitySemanticContract,
} from '../launch/community-rules.js'
import {
  resolveLaunchCommunityVisualConfig,
  resolveLaunchVisualPackaging,
  type LaunchVisualPackagingMetadata,
} from '../launch/visual-rollout.js'
import type {
  LaunchContentKind,
  LaunchStorylineState,
} from '../launch/programming-projection.js'
import { buildLaunchProgrammingProjection } from '../launch/programming-projection.js'
import type { PublicStageAuthorRef } from '../repos/types/forum.js'
import type {
  LaunchCreatorNoteCoverMode,
  LaunchCreatorNoteTemplateId,
} from '../launch/creator-note-templates.js'
import { isCommunityVisibleInDirectory } from '../community/community-lifecycle.js'
import {
  mergeContentSemantics,
  normalizeLaunchSurfaceKindId,
  type AgentPublicIdentity,
  type AgentPublicProjection,
  type AgentPublicProof,
  type CommunityInteractionContract,
  type CommunitySemanticContract,
  type ContentSemanticProjection,
  type EditorialShelfId,
  type FormatKind,
  type LaunchSurfaceKindId,
  type ScenePhase,
} from '../../shared/semantic-taxonomy.js'
import type { AchievementChronicleService } from './achievement-chronicle-service.js'
import type { AgentBioRefreshService } from './agent-bio-refresh-service.js'
import type { RiskGovernanceRepository } from '../repos/risk-governance-repository.js'
import { listSurfaceMediaAttachmentViews } from '../media/surface-media-view.js'
import type { UserRepository } from '../repos/user-repository.js'
import type { AgentCommunityMembershipRepository } from '../repos/agent-community-membership-repository.js'
import type {
  MediaRolloutControllerProfile,
  MediaRolloutControllerService,
} from '../media/media-rollout-controller-service.js'
import {
  buildAgentPublicAuthorPresentation,
  buildHumanPublicAuthorPresentation,
  mergeAgentPublicProjection,
} from '../identity/public-author-presentation.js'
import type {
  AudienceSignalCapsule,
  DiscussionForestProjection,
  EffectiveOrchestrationPolicy,
  EffectiveParticipationContract,
  PerceivedContextSlice,
  PerceivedEvidenceEntry,
  ParticipationContract,
  PostSemanticCapsule,
  ReadingGuideProjection,
  RuntimeContextEnvelope,
  ThreadCapsule,
  ThreadLifecycleSnapshot,
  TurnDisplayProjection,
} from '../../shared/forum-orchestration.js'
import type { ThreadLifecycleService } from './thread-lifecycle-service.js'
import type { SemanticProjectionService } from './semantic-projection-service.js'
import type { DisplayProjectionService } from './display-projection-service.js'
import type { ParticipationContractService } from './participation-contract-service.js'
import type { ForumOrchestrationPolicyService } from './forum-orchestration-policy-service.js'
import type { AgentPerceptionService } from './agent-perception-service.js'
import type { RuntimeContextAssembler } from './runtime-context-assembler.js'

export interface ForumReadServiceDeps {
  postRepo: PostRepository
  publicStageThreadRepo: PublicStageThreadRepository
  publicStageTurnRepo: PublicStageTurnRepository
  voteRepo: VoteRepository
  humanVoteRepo: HumanVoteRepository
  sceneMediaBindingRepo: SceneMediaBindingRepository
  mediaContextProjectionRepo: MediaContextProjectionRepository
  forumSceneMetadataRepo?: ForumSceneMetadataRepository | null
  communityRepo: CommunityRepository
  membershipRepo?: Pick<AgentCommunityMembershipRepository, 'findActiveByCommunity'> | null
  agentRepo: AgentRepository
  agentConfigRepo: AgentConfigRepository
  audienceRepo?: AudienceRepository | null
  userRepo?: UserRepository | null
  achievementChronicleService?: AchievementChronicleService
  agentBioService?: Pick<AgentBioRefreshService, 'getProjection'> | null
  riskRepo?: RiskGovernanceRepository
  mediaRolloutControllerService?: Pick<MediaRolloutControllerService, 'getEffectiveProfile'> | null
  threadLifecycleService?: ThreadLifecycleService | null
  semanticProjectionService?: SemanticProjectionService | null
  displayProjectionService?: DisplayProjectionService | null
  participationContractService?: ParticipationContractService | null
  orchestrationPolicyService?: ForumOrchestrationPolicyService | null
  agentPerceptionService?: AgentPerceptionService | null
  runtimeContextAssembler?: RuntimeContextAssembler | null
}

export interface PostMediaSummary {
  asset_id: string
  media_url: string
  mime_type: string
  alt_text?: string | null
}

export interface AuthorSummary {
  id: string
  actor_type: 'agent' | 'human'
  display_name: string
  avatar_url: string | null
  agent_kind?: 'owner' | 'system'
  public_identity?: AgentPublicIdentity | null
  public_projection?: AgentPublicProjection | null
  public_proof?: AgentPublicProof | null
  system_identity?: {
    platform_managed: boolean
    identity_role_id?: string
    identity_visibility_role_id?: string
    program_role: string
    visibility_role: string
    display_mode: string
    home_community: string
    secondary_communities: string[]
    format_capabilities?: string[]
  } | null
  surface_access?: {
    owner_profile_visible: boolean
    private_chat_enabled: boolean
    follow_enabled: boolean
  } | null
}

export interface PostWithMeta extends Post {
  thread_turn_count: number
  vote_score: number
  vote_up: number
  vote_down: number
  agent_vote_score: number
  agent_vote_up: number
  agent_vote_down: number
  human_vote_score: number
  human_vote_up: number
  human_vote_down: number
  weighted_vote_score: number
  viewer_human_vote_direction: 'UP' | 'DOWN' | 'NEUTRAL' | null
  participant_count: number
  last_reply_at: Date | null
  heat_score: number
  author: AuthorSummary
  community_slug: string
  community_name: string
  media: PostMediaSummary[]
  ai_label: string
  effective_moderation_label: string
  topic_signals: Record<string, unknown> | null
  distribution_state: string
  community_semantics?: CommunitySemanticContract | null
  interaction_contract?: CommunityInteractionContract | null
  content_semantics?: ContentSemanticProjection | null
  scene_phase?: ScenePhase
  surface_kind?: LaunchVisualPackagingMetadata['surface_kind']
  surface_kind_id?: LaunchSurfaceKindId
  card_mode?: LaunchVisualPackagingMetadata['card_mode']
  thumbnail_policy?: LaunchVisualPackagingMetadata['thumbnail_policy']
  hero_eligible?: boolean
  storyline_id?: string
  storyline_title?: string
  storyline_state?: LaunchStorylineState
  storyline_hook?: string
  content_kind?: LaunchContentKind
  format_kind?: FormatKind
  editorial_shelf_id?: EditorialShelfId
  aftershow_export_bias?: number
  note_template_id?: LaunchCreatorNoteTemplateId
  cover_mode?: LaunchCreatorNoteCoverMode
}

export interface CommunityReadModel extends Community {
  active_member_count: number
  community_semantics?: CommunitySemanticContract | null
  interaction_contract?: CommunityInteractionContract | null
  community_family?: CommunitySemanticContract['community_family']
  community_shell_category?: CommunitySemanticContract['community_shell_category']
  publication_review_profile_id?: CommunitySemanticContract['publication_review_profile_id']
  public_participation_mode?: CommunityInteractionContract['public_participation_mode']
  audience_signal_ingestion?: CommunityInteractionContract['audience_signal_ingestion']
  agent_human_response_mode?: CommunityInteractionContract['agent_human_response_mode']
  launch_wave?: CommunitySemanticContract['launch_wave']
  default_editorial_shelf_ids?: CommunitySemanticContract['default_editorial_shelf_ids']
}

export interface RuntimeContextPreview {
  post_capsule: PostSemanticCapsule
  thread_capsule: ThreadCapsule | null
  reading_guide: ReadingGuideProjection
  forest: DiscussionForestProjection
  perceived_slice: PerceivedContextSlice | null
  runtime_context: RuntimeContextEnvelope | null
  evidence_window_turns: PerceivedEvidenceEntry[]
  orchestration_policy?: EffectiveOrchestrationPolicy | null
  debug_compare?: {
    compare_debug_enabled: boolean
    legacy_thread_excerpt: string | null
  } | null
}

export interface ForumOrchestrationReadBundle {
  post_capsule: PostSemanticCapsule
  thread_capsule: ThreadCapsule | null
  reading_guide: ReadingGuideProjection
  forest: DiscussionForestProjection
  participation_contract: EffectiveParticipationContract | null
  orchestration_policy: EffectiveOrchestrationPolicy | null
}

export interface PublicStageThreadTurnWithAuthor extends PublicStageThreadTurn {
  author: AuthorSummary
  vote_score: number
  agent_vote_score: number
  agent_vote_up: number
  agent_vote_down: number
  human_vote_score: number
  human_vote_up: number
  human_vote_down: number
  weighted_vote_score: number
  viewer_human_vote_direction: 'UP' | 'DOWN' | 'NEUTRAL' | null
  ai_label: string
  effective_moderation_label: string
  topic_signals: Record<string, unknown> | null
  distribution_state: string
  attachments: SurfaceMediaAttachmentView[]
}

export interface PublicStageTurnAnchorPreview {
  turn_id: string
  author_display_name: string
  body_excerpt: string
}

export interface PublicStageTurnWithAuthor extends PublicStageTurn {
  author: AuthorSummary
  vote_score: number
  agent_vote_score: number
  agent_vote_up: number
  agent_vote_down: number
  human_vote_score: number
  human_vote_up: number
  human_vote_down: number
  weighted_vote_score: number
  viewer_human_vote_direction: 'UP' | 'DOWN' | 'NEUTRAL' | null
  ai_label: string
  effective_moderation_label: string
  topic_signals: Record<string, unknown> | null
  distribution_state: string
  attachments: SurfaceMediaAttachmentView[]
  anchor_preview: PublicStageTurnAnchorPreview | null
}

export interface PublicStageThreadWithAuthor extends PublicStageThread {
  author: AuthorSummary
  vote_score: number
  agent_vote_score: number
  agent_vote_up: number
  agent_vote_down: number
  human_vote_score: number
  human_vote_up: number
  human_vote_down: number
  weighted_vote_score: number
  viewer_human_vote_direction: 'UP' | 'DOWN' | 'NEUTRAL' | null
  ai_label: string
  effective_moderation_label: string
  topic_signals: Record<string, unknown> | null
  distribution_state: string
  attachments: SurfaceMediaAttachmentView[]
  turn_count: number
  participant_count: number
  last_activity_at: Date
  turns: PublicStageTurnWithAuthor[]
  active_route: RouteHandoff | null
}

export interface PublicStageThreadSummaryWithAuthor extends Omit<PublicStageThreadWithAuthor, 'turns'> {
  starter_excerpt: string
  latest_turn_id: string | null
  latest_turn_excerpt: string | null
}

export interface PublicStageThreadDetailTurnsMeta {
  requested_cursor: string | null
  next_cursor: string | null
  limit: number
  around_turn_id: string | null
  returned_mode: 'full' | 'cursor' | 'around'
}

export interface PublicStageThreadDetailWithAuthor extends PublicStageThreadWithAuthor {
  turns_meta: PublicStageThreadDetailTurnsMeta
  display_projection: TurnDisplayProjection[] | null
  thread_capsule: ThreadCapsule | null
}

export type FeedSort = 'new' | 'hot' | 'top'
import { HUMAN_VOTE_WEIGHT } from '../lib/constants.js'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const READ_MEDIA_ROLLOUT_PROFILE_TIMEOUT_MS = 150
const READ_MEDIA_ROLLOUT_PROFILE_CACHE_TTL_MS = 30_000

function isPubliclyVisibleContent(
  value: Pick<Post, 'visibility' | 'state'> | Pick<PublicStageThreadTurn, 'visibility' | 'state'>,
): boolean {
  return value.state === 'APPROVED' && (value.visibility === 'PUBLIC' || value.visibility === 'GRAY')
}

export class ForumReadService {
  private mediaRolloutProfileCache:
    | { expires_at: number; value: MediaRolloutControllerProfile | null }
    | null = null
  private mediaRolloutProfilePending: Promise<MediaRolloutControllerProfile | null> | null = null

  constructor(private readonly deps: ForumReadServiceDeps) {}

  private buildAuthorCacheKey(input: {
    actor_type: 'agent' | 'human'
    id: string
  }): string {
    return `${input.actor_type}:${input.id}`
  }

  private buildPublicActorKey(author: Pick<PublicStageAuthorRef, 'author_actor_type' | 'author_agent_id' | 'author_user_id'>): string {
    if (author.author_actor_type === 'human' && author.author_user_id) {
      return this.buildAuthorCacheKey({ actor_type: 'human', id: author.author_user_id })
    }
    if (author.author_agent_id) {
      return this.buildAuthorCacheKey({ actor_type: 'agent', id: author.author_agent_id })
    }
    return this.buildAuthorCacheKey({
      actor_type: author.author_actor_type,
      id: author.author_user_id ?? author.author_agent_id ?? 'unknown',
    })
  }

  attachRuntimeDeps(input: {
    agentBioService?: Pick<AgentBioRefreshService, 'getProjection'> | null
    threadLifecycleService?: ThreadLifecycleService | null
    semanticProjectionService?: SemanticProjectionService | null
    displayProjectionService?: DisplayProjectionService | null
    participationContractService?: ParticipationContractService | null
    orchestrationPolicyService?: ForumOrchestrationPolicyService | null
    agentPerceptionService?: AgentPerceptionService | null
    runtimeContextAssembler?: RuntimeContextAssembler | null
  }): void {
    if (input.agentBioService !== undefined) {
      this.deps.agentBioService = input.agentBioService
    }
    if (input.threadLifecycleService !== undefined) {
      this.deps.threadLifecycleService = input.threadLifecycleService
    }
    if (input.semanticProjectionService !== undefined) {
      this.deps.semanticProjectionService = input.semanticProjectionService
    }
    if (input.displayProjectionService !== undefined) {
      this.deps.displayProjectionService = input.displayProjectionService
    }
    if (input.participationContractService !== undefined) {
      this.deps.participationContractService = input.participationContractService
    }
    if (input.orchestrationPolicyService !== undefined) {
      this.deps.orchestrationPolicyService = input.orchestrationPolicyService
    }
    if (input.agentPerceptionService !== undefined) {
      this.deps.agentPerceptionService = input.agentPerceptionService
    }
    if (input.runtimeContextAssembler !== undefined) {
      this.deps.runtimeContextAssembler = input.runtimeContextAssembler
    }
  }

  private async resolveReadMediaRolloutProfile(): Promise<MediaRolloutControllerProfile | null> {
    if (!config.features.mediaRolloutControllerV1 || !this.deps.mediaRolloutControllerService) {
      return null
    }

    const now = Date.now()
    if (this.mediaRolloutProfileCache && this.mediaRolloutProfileCache.expires_at > now) {
      return this.mediaRolloutProfileCache.value
    }

    if (!this.mediaRolloutProfilePending) {
      this.mediaRolloutProfilePending = this.deps.mediaRolloutControllerService.getEffectiveProfile()
        .then((profile) => {
          this.mediaRolloutProfileCache = {
            expires_at: Date.now() + READ_MEDIA_ROLLOUT_PROFILE_CACHE_TTL_MS,
            value: profile,
          }
          return profile
        })
        .catch(() => {
          this.mediaRolloutProfileCache = {
            expires_at: Date.now() + READ_MEDIA_ROLLOUT_PROFILE_CACHE_TTL_MS,
            value: null,
          }
          return null
        })
        .finally(() => {
          this.mediaRolloutProfilePending = null
        })
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve(this.mediaRolloutProfileCache?.value ?? null)
      }, READ_MEDIA_ROLLOUT_PROFILE_TIMEOUT_MS)

      void this.mediaRolloutProfilePending!.then((profile) => {
        clearTimeout(timeout)
        resolve(profile)
      })
    })
  }

  private clampLimit(limit: number | undefined, fallback: number, max: number): number {
    if (typeof limit !== 'number' || !Number.isFinite(limit)) {
      return fallback
    }
    return Math.min(Math.max(Math.trunc(limit), 1), max)
  }

  private readTopicSignals(record: Record<string, unknown> | null | undefined): {
    topic_signals: Record<string, unknown> | null
    distribution_state: string
  } {
    const topicSignals = record?.topic_signals
    const topicSignalsRecord = isRecord(topicSignals) ? topicSignals : null
    const distributionState = typeof record?.distribution_state === 'string'
      ? record.distribution_state
      : typeof topicSignalsRecord?.distribution_state === 'string'
        ? topicSignalsRecord.distribution_state
        : 'NORMAL'
    return {
      topic_signals: topicSignalsRecord,
      distribution_state: distributionState,
    }
  }

  private async resolveThreadTurnTopicSignals(entryId: string): Promise<{
    topic_signals: Record<string, unknown> | null
    distribution_state: string
  }> {
    if (!this.deps.riskRepo) {
      return {
        topic_signals: null,
        distribution_state: 'NORMAL',
      }
    }
    const events = await this.deps.riskRepo.listRiskEvents({
      target_type: 'thread_turn',
      target_id: entryId,
      limit: 1,
      cursor: undefined,
    })
    const payload = events.items[0]?.payload
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return {
        topic_signals: null,
        distribution_state: 'NORMAL',
      }
    }
    const topicSignals = isRecord(payload.topic_signals) ? payload.topic_signals : null
    const shadowed = payload.shadowed === true
      || topicSignals?.policy_shadowed === true
    if (shadowed) {
      return {
        topic_signals: null,
        distribution_state: 'NORMAL',
      }
    }
    return {
      topic_signals: topicSignals,
      distribution_state: typeof payload.distribution_state === 'string'
        ? payload.distribution_state
        : typeof topicSignals?.distribution_state === 'string'
          ? topicSignals.distribution_state
          : 'NORMAL',
    }
  }

  private buildEffectiveModerationLabel(
    visibility: Post['visibility'] | PublicStageThreadTurn['visibility'],
    state: Post['state'] | PublicStageThreadTurn['state'],
  ): string {
    if (state !== 'APPROVED') return state
    return visibility
  }

  private async resolveAgentAuthor(agentId: string): Promise<AuthorSummary> {
    const emptyPresentation: Awaited<ReturnType<AchievementChronicleService['getFeedAuthorPresentation']>> = {
      public_projection: null,
      public_proof: null,
    }
    const agent = this.deps.agentRepo.findById(agentId)
    if (!agent) {
      return buildAgentPublicAuthorPresentation({
        agent: {
          id: agentId,
          display_name: agentId,
          avatar_url: null,
          created_at: new Date(0),
        },
        public_projection: null,
        public_proof: null,
      })
    }

    const latestConfig = this.deps.agentConfigRepo.findLatest(agent.id)
    const [presentation, bio] = await Promise.all([
      config.features.achievementPublicHighlights && this.deps.achievementChronicleService
        ? this.deps.achievementChronicleService.getFeedAuthorPresentation(agentId)
        : Promise.resolve(emptyPresentation),
      this.deps.agentBioService?.getProjection(agentId, {
        // Public forum read paths must stay projection-only and never trigger
        // synchronous bio generation/refresh work.
        build_if_missing: false,
        allow_minor_refresh: false,
      }).catch(() => null) ?? Promise.resolve(null),
    ])

    return buildAgentPublicAuthorPresentation({
      agent,
      latest_config: latestConfig,
      public_projection: mergeAgentPublicProjection(
        presentation.public_projection,
        bio?.public_bio ? { public_bio: bio.public_bio } : null,
      ),
      public_proof: presentation.public_proof,
    })
  }

  private async resolveStageAuthor(author: PublicStageAuthorRef): Promise<AuthorSummary> {
    if (author.author_actor_type === 'human' && author.author_user_id) {
      const user = await this.deps.userRepo?.findById(author.author_user_id) ?? null
      return buildHumanPublicAuthorPresentation({
        user: user ?? {
          id: author.author_user_id,
          display_name: `用户 ${author.author_user_id.slice(0, 8)}`,
          avatar_url: null,
        },
      })
    }
    if (author.author_agent_id) {
      return this.resolveAgentAuthor(author.author_agent_id)
    }
    return {
      id: author.author_user_id ?? author.author_agent_id ?? 'unknown',
      actor_type: author.author_actor_type,
      display_name: author.author_user_id ?? author.author_agent_id ?? 'unknown',
      avatar_url: null,
      public_identity: null,
      public_projection: null,
      public_proof: null,
      system_identity: null,
      surface_access: null,
    }
  }

  private resolveAuthorCached(
    cache: Map<string, Promise<AuthorSummary>>,
    author: PublicStageAuthorRef,
  ): Promise<AuthorSummary> {
    const key = this.buildPublicActorKey(author)
    const cached = cache.get(key)
    if (cached) return cached
    const pending = this.resolveStageAuthor(author)
    cache.set(key, pending)
    return pending
  }

  private resolveCommunityMeta(communityId: string): { slug: string; name: string } {
    const community = this.deps.communityRepo.findById(communityId)
    if (!community) {
      return { slug: communityId, name: communityId }
    }
    return { slug: community.slug, name: community.name }
  }

  private getCommunityActiveMemberCount(communityId: string): number {
    return this.deps.membershipRepo?.findActiveByCommunity(communityId).length ?? 0
  }

  private enrichCommunityReadModel(community: Community): CommunityReadModel {
    const communitySemantics = resolveLaunchCommunitySemanticContract(community.rules_json)
    const interactionContract = resolveLaunchCommunityInteractionContract(community.rules_json)
    return {
      ...community,
      active_member_count: this.getCommunityActiveMemberCount(community.id),
      ...(communitySemantics ? {
        community_semantics: communitySemantics,
        community_family: communitySemantics.community_family,
        community_shell_category: communitySemantics.community_shell_category,
        publication_review_profile_id: communitySemantics.publication_review_profile_id,
        launch_wave: communitySemantics.launch_wave ?? null,
        default_editorial_shelf_ids: communitySemantics.default_editorial_shelf_ids,
      } : {}),
      ...(interactionContract ? {
        interaction_contract: interactionContract,
        public_participation_mode: interactionContract.public_participation_mode,
        audience_signal_ingestion: interactionContract.audience_signal_ingestion,
        agent_human_response_mode: interactionContract.agent_human_response_mode,
      } : {}),
    }
  }

  private resolveRootPostLaunchPackaging(input: {
    community_id: string
    community_slug: string
    media: PostMediaSummary[]
    rolloutProfile?: MediaRolloutControllerProfile | null
  }): LaunchVisualPackagingMetadata | null {
    const community = this.deps.communityRepo.findById(input.community_id)
    const visualConfig = resolveLaunchCommunityVisualConfig({
      community_rules_json: community?.rules_json ?? null,
      launch_community_slug: input.community_slug,
    })
    return resolveLaunchVisualPackaging({
      surface: visualConfig.is_creator_note ? 'note_root_card' : 'home_root_card',
      community_visual_policy: visualConfig.community_visual_policy,
      has_thumbnail: input.media.length > 0,
      rollout_profile: input.rolloutProfile
        ? {
            mode: input.rolloutProfile.mode,
            profile: input.rolloutProfile.profile,
          }
        : null,
      content_context: {
        is_creator_note: visualConfig.is_creator_note,
      },
    })
  }

  private async listAllVisibleThreadTurns(postId: string): Promise<PublicStageThreadTurn[]> {
    return listPublicStageThreadTurnsByPost(this.deps, postId)
  }

  private async resolveThreadTurnAttachmentViews(
    items: Array<{
      id: string
      entry_kind: 'THREAD' | 'TURN'
    }>,
  ): Promise<Map<string, SurfaceMediaAttachmentView[]>> {
    if (items.length === 0) {
      return new Map<string, SurfaceMediaAttachmentView[]>()
    }

    const deps = {
      sceneMediaBindingRepo: this.deps.sceneMediaBindingRepo,
      mediaContextProjectionRepo: this.deps.mediaContextProjectionRepo,
    }
    const threadIds = items
      .filter((item) => item.entry_kind === 'THREAD')
      .map((item) => item.id)
    const turnIds = items
      .filter((item) => item.entry_kind === 'TURN')
      .map((item) => item.id)

    const [threadAttachments, turnAttachments] = await Promise.all([
      threadIds.length > 0
        ? listSurfaceMediaAttachmentViews(deps, 'forum_thread', threadIds)
        : Promise.resolve(new Map<string, SurfaceMediaAttachmentView[]>()),
      turnIds.length > 0
        ? listSurfaceMediaAttachmentViews(deps, 'forum_turn', turnIds)
        : Promise.resolve(new Map<string, SurfaceMediaAttachmentView[]>()),
    ])

    const merged = new Map<string, SurfaceMediaAttachmentView[]>()
    for (const [id, attachments] of threadAttachments.entries()) {
      merged.set(id, attachments)
    }
    for (const [id, attachments] of turnAttachments.entries()) {
      merged.set(id, attachments)
    }
    return merged
  }

  private async buildAudienceSignalCapsule(postId: string): Promise<AudienceSignalCapsule | null> {
    if (!this.deps.audienceRepo || !this.deps.semanticProjectionService) {
      return null
    }
    const audienceThread = await this.deps.audienceRepo.findThreadByPost(postId)
    if (!audienceThread) {
      return this.deps.semanticProjectionService.buildAudienceSignalCapsule({ post_id: postId })
    }
    const [messages, latestSummary] = await Promise.all([
      this.deps.audienceRepo.listMessagesByThread(audienceThread.id),
      this.deps.audienceRepo.findLatestSummaryByThread(audienceThread.id),
    ])
    return this.deps.semanticProjectionService.buildAudienceSignalCapsule({
      post_id: postId,
      messages,
      highlights: [],
      aftershow_summary: latestSummary
        ? { published_at: latestSummary.created_at.toISOString() }
        : null,
    })
  }

  private requireProjectionServices(): {
    semanticProjectionService: SemanticProjectionService
    displayProjectionService: DisplayProjectionService
  } {
    if (!this.deps.semanticProjectionService || !this.deps.displayProjectionService) {
      throw new Error('Forum orchestration projection services are not attached')
    }
    return {
      semanticProjectionService: this.deps.semanticProjectionService,
      displayProjectionService: this.deps.displayProjectionService,
    }
  }

  private resolveFocusThreadId(
    threads: PublicStageThreadWithAuthor[],
    input?: {
      focus_thread_id?: string | null
      focus_turn_id?: string | null
    },
  ): string | null {
    if (input?.focus_thread_id) {
      return input.focus_thread_id
    }
    if (!input?.focus_turn_id) {
      return null
    }
    const matchedThread = threads.find((thread) =>
      thread.id === input.focus_turn_id
      || thread.turns.some((turn) => turn.id === input.focus_turn_id))
    return matchedThread?.id ?? null
  }

  private buildEvidenceWindowTurns(
    thread: PublicStageThreadWithAuthor | null,
    perceivedSlice: PerceivedContextSlice | null,
  ): PerceivedEvidenceEntry[] {
    if (!thread) {
      return []
    }

    const visibleTurns = thread.turns.filter((turn) => isPubliclyVisibleContent(turn))
    const turnsById = new Map(visibleTurns.map((turn) => [turn.id, turn] as const))
    const orderedTurnIds = [
      ...(perceivedSlice?.evidence_window_ids ?? []),
      ...(perceivedSlice?.visible_node_ids ?? []),
      thread.turns[thread.turns.length - 1]?.id ?? null,
    ].filter((value): value is string => typeof value === 'string' && value.length > 0)

    const seen = new Set<string>()
    const entries: PerceivedEvidenceEntry[] = []
    for (const turnId of orderedTurnIds) {
      if (seen.has(turnId)) {
        continue
      }
      seen.add(turnId)
      const turn = turnsById.get(turnId)
      if (!turn) {
        continue
      }
      entries.push({
        turn_id: turn.id,
        thread_id: turn.thread_id,
        body_excerpt: turn.body.slice(0, 240),
        actual_anchor_turn_id: turn.anchor_turn_id ?? null,
        author: {
          actor_type: turn.author.actor_type,
          actor_id: turn.author.id,
          display_name: turn.author.display_name,
        },
        created_at: turn.created_at instanceof Date ? turn.created_at.toISOString() : turn.created_at,
      })
      if (entries.length >= 6) {
        break
      }
    }

    return entries
  }

  private async buildProjectionBundle(
    postId: string,
    input?: {
      focus_thread_id?: string | null
      focus_turn_id?: string | null
    },
    viewerUserId?: string,
  ): Promise<{
    post: PostWithMeta
    threads: PublicStageThreadWithAuthor[]
    post_capsule: PostSemanticCapsule
    reading_guide: ReadingGuideProjection
    forest: DiscussionForestProjection
    thread_capsule: ThreadCapsule | null
    focus_thread_id: string | null
    selected_thread: PublicStageThreadWithAuthor | null
  }> {
    const { semanticProjectionService, displayProjectionService } = this.requireProjectionServices()
    const post = await this.getPost(postId, viewerUserId)
    const threads = (await this.getThreads(postId, { limit: 500 }, viewerUserId)).items
    if (input?.focus_thread_id && !threads.some((thread) => thread.id === input.focus_thread_id)) {
      throw new NotFoundError('Thread', input.focus_thread_id)
    }
    if (input?.focus_turn_id) {
      const focusTurnExists = threads.some((thread) =>
        thread.id === input.focus_turn_id
        || thread.turns.some((turn) => turn.id === input.focus_turn_id))
      if (!focusTurnExists) {
        throw new NotFoundError('Turn', input.focus_turn_id)
      }
    }
    const audienceSignals = await this.buildAudienceSignalCapsule(postId)
    const postCapsule = semanticProjectionService.buildPostSemanticCapsule(post, threads, audienceSignals)
    const resolvedFocusThreadId = this.resolveFocusThreadId(threads, input)
      ?? postCapsule.start_thread_ids[0]
      ?? postCapsule.thread_capsules[0]?.thread_id
      ?? null
    const readingGuide = semanticProjectionService.buildReadingGuide(post, postCapsule)
    const forest = displayProjectionService.buildDiscussionForest({
      post_id: postId,
      threads,
      reading_guide: readingGuide,
      focus_thread_id: resolvedFocusThreadId,
      focus_turn_id: input?.focus_turn_id ?? null,
    })
    const threadCapsule = resolvedFocusThreadId
      ? postCapsule.thread_capsules.find((item) => item.thread_id === resolvedFocusThreadId) ?? null
      : null
    const selectedThread = resolvedFocusThreadId
      ? threads.find((thread) => thread.id === resolvedFocusThreadId) ?? null
      : null

    return {
      post,
      threads,
      post_capsule: postCapsule,
      reading_guide: readingGuide,
      forest,
      thread_capsule: threadCapsule,
      focus_thread_id: resolvedFocusThreadId,
      selected_thread: selectedThread,
    }
  }

  private buildLegacyThreadExcerpt(thread: PublicStageThreadWithAuthor | null): string | null {
    if (!thread) {
      return null
    }

    return [
      `${thread.author.display_name}：${thread.body}`,
      ...thread.turns.slice(-5).map((turn) => `${turn.author.display_name}：${turn.body}`),
    ].join('\n')
  }

  private calculateHeatScore(input: {
    voteScore: number
    threadTurnCount: number
    participantCount: number
    activityAt: Date
    nowMs: number
  }): number {
    const hoursSinceActivity = Math.max(0, (input.nowMs - input.activityAt.getTime()) / 3_600_000)
    const raw = input.voteScore * 8
      + Math.log1p(input.threadTurnCount) * 4
      + Math.log1p(input.participantCount) * 3
      + 16 / (hoursSinceActivity + 2)
    return Math.round(raw)
  }

  private getDetailedVoteSummary(
    targetType: 'POST' | 'THREAD' | 'TURN',
    targetId: string,
    viewerUserId?: string,
  ): {
    agent: { up: number; down: number; score: number }
    human: { up: number; down: number; score: number }
    weighted_score: number
    viewer_direction: 'UP' | 'DOWN' | 'NEUTRAL' | null
  } {
    const agent = this.deps.voteRepo.countByTarget(targetType, targetId)
    const human = this.deps.humanVoteRepo.countByTarget(targetType, targetId)
    const weighted_score = Number((agent.score + human.score * HUMAN_VOTE_WEIGHT).toFixed(2))
    const viewer_direction = viewerUserId
      ? this.deps.humanVoteRepo.findByVoterAndTarget(viewerUserId, targetType, targetId)?.direction ?? null
      : null

    return { agent, human, weighted_score, viewer_direction }
  }

  private paginateRanked<T extends { id: string }>(
    items: T[],
    opts: { cursor?: string; limit: number },
  ): PaginatedResult<T> {
    let start = 0
    if (opts.cursor) {
      const idx = items.findIndex((item) => item.id === opts.cursor)
      start = idx >= 0 ? idx + 1 : 0
    }
    const page = items.slice(start, start + opts.limit)
    const next_cursor = page.length === opts.limit && start + opts.limit < items.length
      ? page[page.length - 1].id
      : null
    return { items: page, next_cursor }
  }

  private async resolvePostMediaViews(postIds: string[]): Promise<Record<string, PostMediaSummary[]>> {
    if (postIds.length === 0) return {}
    const attachmentMap = await listSurfaceMediaAttachmentViews(
      {
        sceneMediaBindingRepo: this.deps.sceneMediaBindingRepo,
        mediaContextProjectionRepo: this.deps.mediaContextProjectionRepo,
      },
      'forum_post',
      postIds,
    )
    const mediaByPost: Record<string, PostMediaSummary[]> = {}

    for (const postId of postIds) {
      mediaByPost[postId] = (attachmentMap.get(postId) ?? []).map((item) => ({
        asset_id: item.asset_id,
        media_url: item.media_url,
        mime_type: item.mime_type,
        alt_text: item.alt_text,
      }))
    }

    return mediaByPost
  }

  private async toPostWithMeta(
    post: Post,
    nowMs: number,
    viewerUserId?: string,
    media: PostMediaSummary[] = [],
    rolloutProfile?: MediaRolloutControllerProfile | null,
  ): Promise<PostWithMeta> {
    const votes = this.getDetailedVoteSummary('POST', post.id, viewerUserId)
    const visibleThreadTurns = await this.listAllVisibleThreadTurns(post.id)
    const participantIds = new Set<string>([
      this.buildAuthorCacheKey({ actor_type: 'agent', id: post.author_agent_id }),
    ])
    for (const entry of visibleThreadTurns) {
      participantIds.add(this.buildPublicActorKey(entry))
    }
    const lastReplyAt = visibleThreadTurns.length > 0
      ? visibleThreadTurns[visibleThreadTurns.length - 1].created_at
      : null
    const communityEntity = this.deps.communityRepo.findById(post.community_id)
    const community = communityEntity
      ? { slug: communityEntity.slug, name: communityEntity.name }
      : this.resolveCommunityMeta(post.community_id)
    const threadTurnCount = visibleThreadTurns.length
    const activityAt = lastReplyAt ?? post.created_at
    const topicPresentation = this.readTopicSignals(post.moderation_metadata)
    const launchPackaging = this.resolveRootPostLaunchPackaging({
      community_id: post.community_id,
      community_slug: community.slug,
      media,
      rolloutProfile,
    })
    const sceneMetadata = this.deps.forumSceneMetadataRepo
      ? await this.deps.forumSceneMetadataRepo.findByPostId(post.id)
      : null
    const launchProjection = buildLaunchProgrammingProjection({
      community_slug: community.slug,
      community_rules_json: communityEntity?.rules_json ?? null,
      scene_metadata: sceneMetadata,
      media_count: media.length,
    })
    const communitySemantics = resolveLaunchCommunitySemanticContract(communityEntity?.rules_json ?? null)
    const interactionContract = resolveLaunchCommunityInteractionContract(communityEntity?.rules_json ?? null)
    const surfaceKindId = launchPackaging?.surface_kind
      ? normalizeLaunchSurfaceKindId(launchPackaging.surface_kind)
      : null
    const contentSemantics = mergeContentSemantics(launchProjection.content_semantics, {
      distribution: {
        ...(typeof launchPackaging?.hero_eligible === 'boolean'
          ? { hero_eligible: launchPackaging.hero_eligible }
          : {}),
      },
      visual: {
        ...(surfaceKindId ? { surface_kind: surfaceKindId } : {}),
        ...(launchPackaging?.card_mode ? { card_mode: launchPackaging.card_mode } : {}),
        ...(launchPackaging?.thumbnail_policy ? { thumbnail_policy: launchPackaging.thumbnail_policy } : {}),
      },
    })

    return {
      ...post,
      thread_turn_count: threadTurnCount,
      vote_score: votes.weighted_score,
      vote_up: votes.agent.up,
      vote_down: votes.agent.down,
      agent_vote_score: votes.agent.score,
      agent_vote_up: votes.agent.up,
      agent_vote_down: votes.agent.down,
      human_vote_score: votes.human.score,
      human_vote_up: votes.human.up,
      human_vote_down: votes.human.down,
      weighted_vote_score: votes.weighted_score,
      viewer_human_vote_direction: votes.viewer_direction,
      participant_count: participantIds.size,
      last_reply_at: lastReplyAt,
      heat_score: this.calculateHeatScore({
        voteScore: votes.weighted_score,
        threadTurnCount: threadTurnCount,
        participantCount: participantIds.size,
        activityAt,
        nowMs,
      }),
      author: await this.resolveAgentAuthor(post.author_agent_id),
      community_slug: community.slug,
      community_name: community.name,
      media,
      ai_label: 'AI生成',
      effective_moderation_label: this.buildEffectiveModerationLabel(post.visibility, post.state),
      topic_signals: topicPresentation.topic_signals,
      distribution_state: topicPresentation.distribution_state,
      ...(communitySemantics ? { community_semantics: communitySemantics } : {}),
      ...(interactionContract ? { interaction_contract: interactionContract } : {}),
      ...(launchPackaging ?? {}),
      ...(surfaceKindId ? { surface_kind_id: surfaceKindId } : {}),
      ...launchProjection,
      content_semantics: contentSemantics,
    }
  }

  async getFeed(opts: {
    cursor?: string
    limit?: number
    communityId?: string
    sort?: FeedSort
    authorAgentIds?: string[]
    viewerUserId?: string
  }): Promise<PaginatedResult<PostWithMeta>> {
    const limit = this.clampLimit(opts.limit, 20, 500)
    const rankedSort = opts.sort === 'hot' || opts.sort === 'top'
    const result = await this.deps.postRepo.findPublic({
      cursor: rankedSort ? undefined : opts.cursor,
      limit: rankedSort ? 500 : limit,
      communityId: opts.communityId,
      authorAgentIds: opts.authorAgentIds,
    })
    const nowMs = Date.now()
    const rolloutProfile = await this.resolveReadMediaRolloutProfile()

    const mediaByPost = await this.resolvePostMediaViews(result.items.map((post) => post.id))
    const items: PostWithMeta[] = await Promise.all(
      result.items.map((post) => this.toPostWithMeta(
        post,
        nowMs,
        opts.viewerUserId,
        mediaByPost[post.id] ?? [],
        rolloutProfile,
      )),
    )
    const rankedItems = opts.sort === 'hot' || opts.sort === 'top'
      ? items.filter((item) => item.distribution_state !== 'NO_RECOMMEND')
      : items

    if (opts.sort === 'hot') {
      rankedItems.sort((a, b) => {
        const byHeat = b.heat_score - a.heat_score
        if (byHeat !== 0) return byHeat
        const activityA = (a.last_reply_at ?? a.created_at).getTime()
        const activityB = (b.last_reply_at ?? b.created_at).getTime()
        return activityB - activityA
      })
      return this.paginateRanked(rankedItems, {
        cursor: opts.cursor,
        limit,
      })
    } else if (opts.sort === 'top') {
      rankedItems.sort((a, b) => b.vote_score - a.vote_score || b.created_at.getTime() - a.created_at.getTime())
      return this.paginateRanked(rankedItems, {
        cursor: opts.cursor,
        limit,
      })
    }
    return { items, next_cursor: result.next_cursor }
  }

  async getPost(postId: string, viewerUserId?: string): Promise<PostWithMeta> {
    const post = await this.deps.postRepo.findById(postId)
    if (!post) throw new NotFoundError('Post', postId)
    if (!isPubliclyVisibleContent(post)) throw new NotFoundError('Post', postId)

    const media = (await this.resolvePostMediaViews([post.id]))[post.id] ?? []
    const rolloutProfile = await this.resolveReadMediaRolloutProfile()

    return this.toPostWithMeta(post, Date.now(), viewerUserId, media, rolloutProfile)
  }

  private async toPublicStageTurnWithAuthor(
    turn: PublicStageTurn,
    opts: {
      viewerUserId?: string
      authorCache: Map<string, Promise<AuthorSummary>>
      visibleTurnById: Map<string, PublicStageTurn>
      attachmentMap: Map<string, SurfaceMediaAttachmentView[]>
    },
  ): Promise<PublicStageTurnWithAuthor> {
    const votes = this.getDetailedVoteSummary('TURN', turn.id, opts.viewerUserId)
    const topicPresentation = await this.resolveThreadTurnTopicSignals(turn.id)
    const anchorTurn = turn.anchor_turn_id ? opts.visibleTurnById.get(turn.anchor_turn_id) ?? null : null
    const anchorAuthor = anchorTurn
      ? await this.resolveAuthorCached(opts.authorCache, anchorTurn)
      : null

    return {
      ...turn,
      author: await this.resolveAuthorCached(opts.authorCache, turn),
      vote_score: votes.weighted_score,
      agent_vote_score: votes.agent.score,
      agent_vote_up: votes.agent.up,
      agent_vote_down: votes.agent.down,
      human_vote_score: votes.human.score,
      human_vote_up: votes.human.up,
      human_vote_down: votes.human.down,
      weighted_vote_score: votes.weighted_score,
      viewer_human_vote_direction: votes.viewer_direction,
      ai_label: turn.author_actor_type === 'human' ? '用户' : 'AI生成',
      effective_moderation_label: this.buildEffectiveModerationLabel(turn.visibility, turn.state),
      topic_signals: topicPresentation.topic_signals,
      distribution_state: topicPresentation.distribution_state,
      attachments: opts.attachmentMap.get(turn.id) ?? [],
      anchor_preview: anchorTurn && anchorAuthor
        ? {
            turn_id: anchorTurn.id,
            author_display_name: anchorAuthor.display_name,
            body_excerpt: (turn.quoted_excerpt ?? anchorTurn.body).slice(0, 180),
          }
        : turn.anchor_turn_id && turn.quoted_excerpt
          ? {
              turn_id: turn.anchor_turn_id,
              author_display_name: 'Quoted context',
              body_excerpt: turn.quoted_excerpt.slice(0, 180),
            }
          : null,
    }
  }

  private async toPublicStageThreadWithAuthor(
    thread: PublicStageThread,
    turns: PublicStageTurn[],
    opts: {
      viewerUserId?: string
      authorCache: Map<string, Promise<AuthorSummary>>
      visibleTurnById: Map<string, PublicStageTurn>
      attachmentMap: Map<string, SurfaceMediaAttachmentView[]>
    },
  ): Promise<PublicStageThreadWithAuthor> {
    const votes = this.getDetailedVoteSummary('THREAD', thread.id, opts.viewerUserId)
    const topicPresentation = await this.resolveThreadTurnTopicSignals(thread.id)
    const visibleTurns = turns.filter((turn) => isPubliclyVisibleContent(turn))
    const turnViews = await Promise.all(
      visibleTurns.map((turn) =>
        this.toPublicStageTurnWithAuthor(turn, opts)),
    )
    const participantIds = new Set<string>([
      this.buildPublicActorKey(thread),
      ...visibleTurns.map((turn) => this.buildPublicActorKey(turn)),
    ])
    const lastTurn = visibleTurns[visibleTurns.length - 1] ?? null

    return {
      ...thread,
      author: await this.resolveAuthorCached(opts.authorCache, thread),
      vote_score: votes.weighted_score,
      agent_vote_score: votes.agent.score,
      agent_vote_up: votes.agent.up,
      agent_vote_down: votes.agent.down,
      human_vote_score: votes.human.score,
      human_vote_up: votes.human.up,
      human_vote_down: votes.human.down,
      weighted_vote_score: votes.weighted_score,
      viewer_human_vote_direction: votes.viewer_direction,
      ai_label: thread.author_actor_type === 'human' ? '用户' : 'AI生成',
      effective_moderation_label: this.buildEffectiveModerationLabel(thread.visibility, thread.state),
      topic_signals: topicPresentation.topic_signals,
      distribution_state: topicPresentation.distribution_state,
      attachments: opts.attachmentMap.get(thread.id) ?? [],
      turn_count: visibleTurns.length,
      participant_count: participantIds.size,
      last_activity_at: lastTurn?.created_at ?? thread.created_at,
      turns: turnViews,
      active_route: thread.active_route,
    }
  }

  private async toPublicStageThreadSummaryWithAuthor(
    thread: PublicStageThread,
    turns: PublicStageTurn[],
    opts: {
      viewerUserId?: string
      authorCache: Map<string, Promise<AuthorSummary>>
      attachmentMap: Map<string, SurfaceMediaAttachmentView[]>
    },
  ): Promise<PublicStageThreadSummaryWithAuthor> {
    const votes = this.getDetailedVoteSummary('THREAD', thread.id, opts.viewerUserId)
    const topicPresentation = await this.resolveThreadTurnTopicSignals(thread.id)
    const visibleTurns = turns.filter((turn) => isPubliclyVisibleContent(turn))
    const participantIds = new Set<string>([
      this.buildPublicActorKey(thread),
      ...visibleTurns.map((turn) => this.buildPublicActorKey(turn)),
    ])
    const lastTurn = visibleTurns[visibleTurns.length - 1] ?? null

    return {
      ...thread,
      author: await this.resolveAuthorCached(opts.authorCache, thread),
      vote_score: votes.weighted_score,
      agent_vote_score: votes.agent.score,
      agent_vote_up: votes.agent.up,
      agent_vote_down: votes.agent.down,
      human_vote_score: votes.human.score,
      human_vote_up: votes.human.up,
      human_vote_down: votes.human.down,
      weighted_vote_score: votes.weighted_score,
      viewer_human_vote_direction: votes.viewer_direction,
      ai_label: thread.author_actor_type === 'human' ? '用户' : 'AI生成',
      effective_moderation_label: this.buildEffectiveModerationLabel(thread.visibility, thread.state),
      topic_signals: topicPresentation.topic_signals,
      distribution_state: topicPresentation.distribution_state,
      attachments: opts.attachmentMap.get(thread.id) ?? [],
      turn_count: visibleTurns.length,
      participant_count: participantIds.size,
      last_activity_at: lastTurn?.created_at ?? thread.created_at,
      active_route: thread.active_route,
      starter_excerpt: thread.body.slice(0, 180),
      latest_turn_id: lastTurn?.id ?? null,
      latest_turn_excerpt: lastTurn?.body.slice(0, 180) ?? null,
    }
  }

  private async listAllVisibleTurnsByThread(threadId: string): Promise<PublicStageTurn[]> {
    const turns: PublicStageTurn[] = []
    let cursor: string | undefined

    while (true) {
      const page = await this.deps.publicStageTurnRepo.findByThread(threadId, {
        cursor,
        limit: 500,
      })
      if (page.items.length === 0) break
      turns.push(...page.items)
      if (!page.next_cursor || page.next_cursor === cursor) break
      cursor = page.next_cursor
    }

    return turns
  }

  private sliceThreadTurns(
    turns: PublicStageTurn[],
    input: {
      turn_cursor?: string | null
      turn_limit: number
      around_turn_id?: string | null
    },
  ): {
    items: PublicStageTurn[]
    next_cursor: string | null
    returned_mode: PublicStageThreadDetailTurnsMeta['returned_mode']
  } {
    if (input.around_turn_id) {
      const focusIndex = turns.findIndex((turn) => turn.id === input.around_turn_id)
      if (focusIndex < 0) {
        throw new NotFoundError('Turn', input.around_turn_id)
      }
      const halfWindow = Math.floor((input.turn_limit - 1) / 2)
      let start = Math.max(0, focusIndex - halfWindow)
      const end = Math.min(turns.length, start + input.turn_limit)
      if (end - start < input.turn_limit) {
        start = Math.max(0, end - input.turn_limit)
      }
      const items = turns.slice(start, end)
      return {
        items,
        next_cursor: end < turns.length ? items[items.length - 1]?.id ?? null : null,
        returned_mode: 'around',
      }
    }

    let start = 0
    if (input.turn_cursor) {
      const index = turns.findIndex((turn) => turn.id === input.turn_cursor)
      start = index >= 0 ? index + 1 : 0
    }
    const items = turns.slice(start, start + input.turn_limit)
    const next_cursor = items.length === input.turn_limit && start + input.turn_limit < turns.length
      ? items[items.length - 1]?.id ?? null
      : null
    return {
      items,
      next_cursor,
      returned_mode: input.turn_cursor ? 'cursor' : 'full',
    }
  }

  async getThreads(
    postId: string,
    opts: { cursor?: string; limit?: number },
    viewerUserId?: string,
  ): Promise<PaginatedResult<PublicStageThreadWithAuthor>> {
    const post = await this.deps.postRepo.findById(postId)
    if (!post) throw new NotFoundError('Post', postId)
    if (!isPubliclyVisibleContent(post)) throw new NotFoundError('Post', postId)

    const limit = this.clampLimit(opts.limit, 100, 500)
    const result = await this.deps.publicStageThreadRepo.findByPost(postId, {
      cursor: opts.cursor,
      limit,
    })
    const turns = await this.deps.publicStageTurnRepo.findByThreads(result.items.map((thread) => thread.id))
    const attachmentMap = await this.resolveThreadTurnAttachmentViews([
      ...result.items.map((thread) => ({ id: thread.id, entry_kind: 'THREAD' as const })),
      ...turns.map((turn) => ({ id: turn.id, entry_kind: 'TURN' as const })),
    ])
    const turnsByThreadId = new Map<string, PublicStageTurn[]>()
    for (const turn of turns) {
      if (!turnsByThreadId.has(turn.thread_id)) {
        turnsByThreadId.set(turn.thread_id, [])
      }
      turnsByThreadId.get(turn.thread_id)!.push(turn)
    }
    const authorCache = new Map<string, Promise<AuthorSummary>>()

    const items = await Promise.all(
      result.items.map((thread) =>
        this.toPublicStageThreadWithAuthor(thread, turnsByThreadId.get(thread.id) ?? [], {
          viewerUserId,
          authorCache,
          visibleTurnById: new Map(
            (turnsByThreadId.get(thread.id) ?? [])
              .filter((turn) => isPubliclyVisibleContent(turn))
              .map((turn) => [turn.id, turn] as const),
          ),
          attachmentMap,
        })),
    )

    return { items, next_cursor: result.next_cursor }
  }

  async getThreadSummaries(
    postId: string,
    opts?: { cursor?: string; limit?: number },
    viewerUserId?: string,
  ): Promise<PaginatedResult<PublicStageThreadSummaryWithAuthor>> {
    const post = await this.deps.postRepo.findById(postId)
    if (!post) throw new NotFoundError('Post', postId)
    if (!isPubliclyVisibleContent(post)) throw new NotFoundError('Post', postId)

    const limit = this.clampLimit(opts?.limit, 20, 200)
    const result = await this.deps.publicStageThreadRepo.findByPost(postId, {
      cursor: opts?.cursor,
      limit,
    })
    const turns = await this.deps.publicStageTurnRepo.findByThreads(result.items.map((thread) => thread.id))
    const attachmentMap = await this.resolveThreadTurnAttachmentViews(
      result.items.map((thread) => ({ id: thread.id, entry_kind: 'THREAD' as const })),
    )
    const turnsByThreadId = new Map<string, PublicStageTurn[]>()
    for (const turn of turns) {
      if (!turnsByThreadId.has(turn.thread_id)) {
        turnsByThreadId.set(turn.thread_id, [])
      }
      turnsByThreadId.get(turn.thread_id)!.push(turn)
    }
    const authorCache = new Map<string, Promise<AuthorSummary>>()

    const items = await Promise.all(
      result.items.map((thread) =>
        this.toPublicStageThreadSummaryWithAuthor(thread, turnsByThreadId.get(thread.id) ?? [], {
          viewerUserId,
          authorCache,
          attachmentMap,
        })),
    )

    return { items, next_cursor: result.next_cursor }
  }

  async getThread(
    threadId: string,
    optsOrViewerUserId?: {
      turn_cursor?: string | null
      turn_limit?: number
      around_turn_id?: string | null
      include_projection?: boolean
      include_capsule?: boolean
    } | string,
    maybeViewerUserId?: string,
  ): Promise<PublicStageThreadDetailWithAuthor> {
    const opts = typeof optsOrViewerUserId === 'string' || optsOrViewerUserId === undefined
      ? undefined
      : optsOrViewerUserId
    const viewerUserId = typeof optsOrViewerUserId === 'string'
      ? optsOrViewerUserId
      : maybeViewerUserId
    const thread = await this.deps.publicStageThreadRepo.findById(threadId)
    if (!thread) throw new NotFoundError('Thread', threadId)
    if (!isPubliclyVisibleContent(thread)) throw new NotFoundError('Thread', threadId)

    const post = await this.deps.postRepo.findById(thread.post_id)
    if (!post || !isPubliclyVisibleContent(post)) throw new NotFoundError('Thread', threadId)

    const allTurns = await this.listAllVisibleTurnsByThread(thread.id)
    const hasDetailQuery =
      Boolean(opts?.turn_cursor)
      || typeof opts?.turn_limit === 'number'
      || Boolean(opts?.around_turn_id)
      || opts?.include_projection === true
      || opts?.include_capsule === true
    const turnLimit = this.clampLimit(opts?.turn_limit, hasDetailQuery ? 50 : 500, 500)
    const turnsPage = this.sliceThreadTurns(allTurns, {
      turn_cursor: opts?.turn_cursor ?? null,
      turn_limit: turnLimit,
      around_turn_id: opts?.around_turn_id ?? null,
    })
    const turns = turnsPage.items
    const attachmentMap = await this.resolveThreadTurnAttachmentViews([
      { id: thread.id, entry_kind: 'THREAD' as const },
      ...turns.map((turn) => ({ id: turn.id, entry_kind: 'TURN' as const })),
    ])
    const visibleTurnById = new Map(
      allTurns
        .filter((turn) => isPubliclyVisibleContent(turn))
        .map((turn) => [turn.id, turn] as const),
    )
    const authorCache = new Map<string, Promise<AuthorSummary>>()
    const detail = await this.toPublicStageThreadWithAuthor(thread, turns, {
      viewerUserId,
      authorCache,
      visibleTurnById,
      attachmentMap,
    })

    let displayProjection: TurnDisplayProjection[] | null = null
    let threadCapsule: ThreadCapsule | null = null
    if (opts?.include_projection || opts?.include_capsule) {
      const bundle = await this.buildProjectionBundle(
        thread.post_id,
        {
          focus_thread_id: thread.id,
          focus_turn_id: opts?.around_turn_id ?? null,
        },
        viewerUserId,
      )
      if (opts.include_projection) {
        displayProjection = bundle.forest.nodes.filter((node) => node.thread_id === thread.id)
      }
      if (opts.include_capsule) {
        threadCapsule = bundle.thread_capsule
      }
    }

    return {
      ...detail,
      turns_meta: {
        requested_cursor: opts?.turn_cursor ?? null,
        next_cursor: turnsPage.next_cursor,
        limit: turnLimit,
        around_turn_id: opts?.around_turn_id ?? null,
        returned_mode: turnsPage.returned_mode,
      },
      display_projection: displayProjection,
      thread_capsule: threadCapsule,
    }
  }

  async getThreadLifecycle(threadId: string): Promise<ThreadLifecycleSnapshot> {
    const thread = await this.deps.publicStageThreadRepo.findById(threadId)
    if (!thread) throw new NotFoundError('Thread', threadId)
    const turnCount = await this.deps.publicStageTurnRepo.countByThread(threadId)
    if (!this.deps.threadLifecycleService) {
      throw new Error('ThreadLifecycleService is not attached')
    }
    return this.deps.threadLifecycleService.buildThreadLifecycle(thread, turnCount)
  }

  async getPostSemanticCapsule(postId: string, viewerUserId?: string): Promise<PostSemanticCapsule> {
    const bundle = await this.buildProjectionBundle(postId, undefined, viewerUserId)
    return bundle.post_capsule
  }

  async getThreadSemanticCapsule(threadId: string, viewerUserId?: string): Promise<ThreadCapsule> {
    const thread = await this.getThread(threadId, viewerUserId)
    const bundle = await this.buildProjectionBundle(
      thread.post_id,
      { focus_thread_id: threadId },
      viewerUserId,
    )
    if (!bundle.thread_capsule) {
      throw new NotFoundError('Thread capsule', threadId)
    }
    return bundle.thread_capsule
  }

  async getReadingGuide(postId: string, viewerUserId?: string): Promise<ReadingGuideProjection> {
    const bundle = await this.buildProjectionBundle(postId, undefined, viewerUserId)
    return bundle.reading_guide
  }

  async getDiscussionForest(
    postId: string,
    input?: {
      focus_thread_id?: string | null
      focus_turn_id?: string | null
    },
    viewerUserId?: string,
  ): Promise<DiscussionForestProjection> {
    const bundle = await this.buildProjectionBundle(postId, input, viewerUserId)
    return bundle.forest
  }

  async buildOrchestrationReadBundle(input: {
    post_id: string
    thread_id?: string | null
    focus_turn_id?: string | null
  }, viewerUserId?: string): Promise<ForumOrchestrationReadBundle> {
    const bundle = await this.buildProjectionBundle(
      input.post_id,
      {
        focus_thread_id: input.thread_id ?? null,
        focus_turn_id: input.focus_turn_id ?? null,
      },
      viewerUserId,
    )
    const participationContract = this.deps.participationContractService
      ? await this.deps.participationContractService.getPostContract(input.post_id)
      : null
    const orchestrationPolicy = this.deps.orchestrationPolicyService
      ? await this.deps.orchestrationPolicyService.getPostPolicy(input.post_id)
      : null

    return {
      post_capsule: bundle.post_capsule,
      thread_capsule: bundle.thread_capsule,
      reading_guide: bundle.reading_guide,
      forest: bundle.forest,
      participation_contract: participationContract,
      orchestration_policy: orchestrationPolicy,
    }
  }

  async buildRuntimeContextPreview(input: {
    post_id: string
    thread_id?: string | null
    focus_turn_id?: string | null
    agent_id?: string | null
    compare_debug?: boolean
  }, viewerUserId?: string): Promise<RuntimeContextPreview> {
    if (!this.deps.agentPerceptionService || !this.deps.runtimeContextAssembler) {
      throw new Error('Runtime preview services are not attached')
    }

    const readBundle = await this.buildOrchestrationReadBundle({
      post_id: input.post_id,
      thread_id: input.thread_id ?? null,
      focus_turn_id: input.focus_turn_id ?? null,
    }, viewerUserId)
    const envelopeEnabled =
      readBundle.orchestration_policy?.cutover.envelope_enabled
      ?? config.features.forumOrchestrationEnvelopeCutover
    const bundle = envelopeEnabled || input.compare_debug
      ? await this.buildProjectionBundle(
          input.post_id,
          {
            focus_thread_id: input.thread_id ?? null,
            focus_turn_id: input.focus_turn_id ?? null,
          },
          viewerUserId,
        )
      : null
    const legacyThreadExcerpt = input.compare_debug
      ? this.buildLegacyThreadExcerpt(bundle?.selected_thread ?? null)
      : null

    if (!envelopeEnabled) {
      return {
        post_capsule: readBundle.post_capsule,
        thread_capsule: readBundle.thread_capsule,
        reading_guide: readBundle.reading_guide,
        forest: readBundle.forest,
        perceived_slice: null,
        runtime_context: null,
        evidence_window_turns: [],
        orchestration_policy: readBundle.orchestration_policy,
        debug_compare: input.compare_debug
          ? {
              compare_debug_enabled: true,
              legacy_thread_excerpt: legacyThreadExcerpt,
            }
          : null,
      }
    }

    if (!bundle) {
      throw new Error('Projection bundle is required when orchestration envelope is enabled')
    }

    const perceivedSlice = this.deps.agentPerceptionService.buildSlice({
      agent_id: input.agent_id ?? 'preview-agent',
      post_capsule: readBundle.post_capsule,
      thread_capsule: readBundle.thread_capsule,
      forest: readBundle.forest,
      participation_contract: readBundle.participation_contract,
      focus_turn_id: input.focus_turn_id ?? null,
    })
    const evidenceWindowTurns = this.buildEvidenceWindowTurns(bundle.selected_thread, perceivedSlice)
    if (perceivedSlice) {
      perceivedSlice.evidence_window = evidenceWindowTurns
    }
    const runtimeContext = this.deps.runtimeContextAssembler.build({
      agent_id: input.agent_id ?? 'preview-agent',
      post_capsule: readBundle.post_capsule,
      thread_capsule: readBundle.thread_capsule,
      perceived_slice: perceivedSlice,
      post_title: bundle.post.title,
      post_body_excerpt: bundle.post.body.slice(0, 240),
      post_author: {
        actor_type: bundle.post.author.actor_type,
        actor_id: bundle.post.author.id,
        display_name: bundle.post.author.display_name,
      },
      community_id: bundle.post.community_id,
      participation_contract: readBundle.participation_contract,
      evidence_window_turns: evidenceWindowTurns,
    })

    return {
      post_capsule: readBundle.post_capsule,
      thread_capsule: readBundle.thread_capsule,
      reading_guide: readBundle.reading_guide,
      forest: readBundle.forest,
      perceived_slice: perceivedSlice,
      runtime_context: runtimeContext,
      evidence_window_turns: evidenceWindowTurns,
      orchestration_policy: readBundle.orchestration_policy,
      debug_compare: input.compare_debug
        ? {
            compare_debug_enabled: true,
            legacy_thread_excerpt: legacyThreadExcerpt,
          }
        : null,
    }
  }

  async getCommunityParticipationContract(communityId: string): Promise<ParticipationContract> {
    if (!this.deps.participationContractService) {
      throw new Error('ParticipationContractService is not attached')
    }
    return this.deps.participationContractService.getCommunityContract(communityId)
  }

  async getPostParticipationContract(postId: string): Promise<EffectiveParticipationContract> {
    if (!this.deps.participationContractService) {
      throw new Error('ParticipationContractService is not attached')
    }
    return this.deps.participationContractService.getPostContract(postId)
  }

  async getPostOrchestrationPolicy(postId: string): Promise<EffectiveOrchestrationPolicy> {
    if (!this.deps.orchestrationPolicyService) {
      throw new Error('ForumOrchestrationPolicyService is not attached')
    }
    return this.deps.orchestrationPolicyService.getPostPolicy(postId)
  }

  async getCommunities(opts: {
    cursor?: string
    limit?: number
    viewer_role?: 'admin' | 'user' | null
  }): Promise<PaginatedResult<CommunityReadModel>> {
    const limit = this.clampLimit(opts.limit, 20, 100)
    const page = this.deps.communityRepo.findAll({ limit: 200 })
    const visible = page.items.filter((community) =>
      isCommunityVisibleInDirectory(community, opts.viewer_role ?? null))
      .map((community) => this.enrichCommunityReadModel(community))
    let start = 0
    if (opts.cursor) {
      const idx = visible.findIndex((community) => community.id === opts.cursor)
      start = idx >= 0 ? idx + 1 : 0
    }
    const items = visible.slice(start, start + limit)
    const next_cursor = items.length === limit && start + limit < visible.length
      ? items[items.length - 1]?.id ?? null
      : null
    return { items, next_cursor }
  }

  getVoteSummary(
    targetType: 'POST' | 'THREAD' | 'TURN' | 'MESSAGE',
    targetId: string,
  ): { up: number; down: number; score: number; weighted_score: number; human_up: number; human_down: number; human_score: number } {
    if (targetType === 'MESSAGE') {
      const messageVotes = this.deps.voteRepo.countByTarget(targetType, targetId)
      return { ...messageVotes, weighted_score: messageVotes.score, human_up: 0, human_down: 0, human_score: 0 }
    }
    const agent = this.deps.voteRepo.countByTarget(targetType, targetId)
    const human = this.deps.humanVoteRepo.countByTarget(targetType, targetId)
    return {
      up: agent.up,
      down: agent.down,
      score: agent.score,
      weighted_score: Number((agent.score + human.score * HUMAN_VOTE_WEIGHT).toFixed(2)),
      human_up: human.up,
      human_down: human.down,
      human_score: human.score,
    }
  }

}
