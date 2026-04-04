import type {
  PostRepository,
  PublicStageThreadRepository,
  PublicStageTurnRepository,
  VoteRepository,
  HumanVoteRepository,
  PostMediaRepository,
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
  PublicStageAuthorRef,
  RouteHandoff,
  SurfaceMediaAttachmentView,
  ForumSceneMetadataRepository,
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
import type {
  LaunchT4CoverMode,
  LaunchT4TemplateId,
} from '../launch/t4-content-templates.js'
import { isCommunityVisibleInDirectory } from '../community/community-lifecycle.js'
import {
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
import type { MediaObservabilityService } from '../media/media-observability-service.js'
import type {
  MediaRolloutControllerProfile,
  MediaRolloutControllerService,
} from '../media/media-rollout-controller-service.js'
import {
  buildAgentPublicAuthorPresentation,
  buildHumanPublicAuthorPresentation,
} from '../identity/public-author-presentation.js'

export interface ForumReadServiceDeps {
  postRepo: PostRepository
  publicStageThreadRepo: PublicStageThreadRepository
  publicStageTurnRepo: PublicStageTurnRepository
  voteRepo: VoteRepository
  humanVoteRepo: HumanVoteRepository
  postMediaRepo: PostMediaRepository
  sceneMediaBindingRepo: SceneMediaBindingRepository
  mediaContextProjectionRepo: MediaContextProjectionRepository
  forumSceneMetadataRepo?: ForumSceneMetadataRepository | null
  communityRepo: CommunityRepository
  agentRepo: AgentRepository
  agentConfigRepo: AgentConfigRepository
  userRepo?: UserRepository | null
  achievementChronicleService?: AchievementChronicleService
  agentBioService?: Pick<AgentBioRefreshService, 'getProjection'> | null
  riskRepo?: RiskGovernanceRepository
  mediaObservabilityService?: Pick<MediaObservabilityService, 'record'> | null
  mediaRolloutControllerService?: Pick<MediaRolloutControllerService, 'getEffectiveProfile'> | null
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
  badges?: Array<{ code: string; name: string; tier: 1 | 2 | 3 }>
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
  display_badges?: string[]
  tagline?: string
  public_bio?: string | null
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
  editorial_shelf?: string
  is_t4?: boolean
  aftershow_export_bias?: number
  note_template_id?: LaunchT4TemplateId
  cover_mode?: LaunchT4CoverMode
}

export interface CommunityReadModel extends Community {
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

export type FeedSort = 'new' | 'hot' | 'top'
import { HUMAN_VOTE_WEIGHT } from '../lib/constants.js'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isPubliclyVisibleContent(
  value: Pick<Post, 'visibility' | 'state'> | Pick<PublicStageThreadTurn, 'visibility' | 'state'>,
): boolean {
  return value.state === 'APPROVED' && (value.visibility === 'PUBLIC' || value.visibility === 'GRAY')
}

export class ForumReadService {
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
  }): void {
    if (input.agentBioService !== undefined) {
      this.deps.agentBioService = input.agentBioService
    }
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
    const emptyIdentity: Awaited<ReturnType<AchievementChronicleService['getFeedAuthorIdentity']>> = {}
    const agent = this.deps.agentRepo.findById(agentId)
    if (!agent) {
      return buildAgentPublicAuthorPresentation({
        agent: {
          id: agentId,
          display_name: agentId,
          avatar_url: null,
        },
      })
    }

    const latestConfig = this.deps.agentConfigRepo.findLatest(agent.id)
    const [identity, bio] = await Promise.all([
      config.features.achievementPublicHighlights && this.deps.achievementChronicleService
        ? this.deps.achievementChronicleService.getFeedAuthorIdentity(agentId)
        : Promise.resolve(emptyIdentity),
      this.deps.agentBioService?.getProjection(agentId, {
        build_if_missing: true,
        allow_minor_refresh: false,
      }).catch(() => null) ?? Promise.resolve(null),
    ])

    return buildAgentPublicAuthorPresentation({
      agent,
      latest_config: latestConfig,
      tagline: identity.tagline ?? null,
      public_bio: bio?.public_bio ?? null,
      badges: identity.badges ?? [],
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
      display_badges: [],
      public_bio: null,
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

  private enrichCommunityReadModel(community: Community): CommunityReadModel {
    const communitySemantics = resolveLaunchCommunitySemanticContract(community.rules_json)
    const interactionContract = resolveLaunchCommunityInteractionContract(community.rules_json)
    return {
      ...community,
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
      surface: visualConfig.is_t4 ? 't4_root_card' : 'home_root_card',
      community_visual_policy: visualConfig.community_visual_policy,
      has_thumbnail: input.media.length > 0,
      rollout_profile: input.rolloutProfile
        ? {
            mode: input.rolloutProfile.mode,
            profile: input.rolloutProfile.profile,
          }
        : null,
      content_context: {
        is_t4: visualConfig.is_t4,
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

  private async resolveLegacyPostMediaAltText(postIds: string[]): Promise<Record<string, Record<string, string | null>>> {
    if (postIds.length === 0) return {}
    const bindings = await this.deps.sceneMediaBindingRepo.findByScenes('forum_post', postIds)
    if (bindings.length === 0) return {}
    const projections = await this.deps.mediaContextProjectionRepo.findByBindingIds(bindings.map((binding) => binding.id))
    const altByBindingId = new Map<string, string | null>()
    for (const projection of projections) {
      if (
        projection.projection_surface !== 'public_display'
        || projection.projection_kind !== 'display_attachment'
        || altByBindingId.has(projection.binding_id)
      ) {
        continue
      }
      const altText = projection.payload_json.alt_text
      altByBindingId.set(
        projection.binding_id,
        typeof altText === 'string' && altText.trim().length > 0 ? altText : null,
      )
    }

    const altByPostId: Record<string, Record<string, string | null>> = {}
    for (const binding of bindings) {
      if (!altByPostId[binding.scene_id]) altByPostId[binding.scene_id] = {}
      altByPostId[binding.scene_id]![binding.asset_id] = altByBindingId.get(binding.id) ?? null
    }
    return altByPostId
  }

  private async recordRootPostReadModelParity(input: {
    post_id: string
    attachment_media: PostMediaSummary[]
    legacy_media: PostMediaSummary[]
  }): Promise<void> {
    if (!this.deps.mediaObservabilityService) return
    const attachmentSignature = input.attachment_media.map((item) =>
      `${item.asset_id}|${item.media_url}|${item.mime_type}`,
    )
    const legacySignature = input.legacy_media.map((item) =>
      `${item.asset_id}|${item.media_url}|${item.mime_type}`,
    )
    if (attachmentSignature.join('||') === legacySignature.join('||')) {
      return
    }
    await this.deps.mediaObservabilityService.record({
      event_type: 'root_post_read_model_parity_mismatch',
      surface: 'root_post',
      severity: 'warn',
      payload_json: {
        post_id: input.post_id,
        attachment_asset_ids: input.attachment_media.map((item) => item.asset_id),
        legacy_asset_ids: input.legacy_media.map((item) => item.asset_id),
        attachment_count: input.attachment_media.length,
        legacy_count: input.legacy_media.length,
      },
    })
  }

  private recordRootPostReadModelParityAsync(input: {
    post_id: string
    attachment_media: PostMediaSummary[]
    legacy_media: PostMediaSummary[]
  }): void {
    void this.recordRootPostReadModelParity(input).catch(() => {})
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
    const shouldCompareLegacyReadModel = Boolean(this.deps.mediaObservabilityService)
    const legacyMediaByPost = shouldCompareLegacyReadModel
      ? this.deps.postMediaRepo.findByPostIds(postIds)
      : {}
    const legacyAltTextByPost = shouldCompareLegacyReadModel
      ? await this.resolveLegacyPostMediaAltText(postIds)
      : {}
    const mediaByPost: Record<string, PostMediaSummary[]> = {}

    for (const postId of postIds) {
      const attachmentMedia = (attachmentMap.get(postId) ?? []).map((item) => ({
        asset_id: item.asset_id,
        media_url: item.media_url,
        mime_type: item.mime_type,
        alt_text: item.alt_text,
      }))
      const legacyMedia = (legacyMediaByPost[postId] ?? []).map((item) => ({
        asset_id: item.asset_id,
        media_url: item.media_url,
        mime_type: item.mime_type,
        alt_text: legacyAltTextByPost[postId]?.[item.asset_id] ?? null,
      }))
      mediaByPost[postId] = attachmentMedia
      if (shouldCompareLegacyReadModel && (attachmentMedia.length > 0 || legacyMedia.length > 0)) {
        this.recordRootPostReadModelParityAsync({
          post_id: postId,
          attachment_media: attachmentMedia,
          legacy_media: legacyMedia,
        })
      }
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
    const rolloutProfile = config.features.mediaRolloutControllerV1
      ? await this.deps.mediaRolloutControllerService?.getEffectiveProfile()
        .catch(() => null) ?? null
      : null

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
    const rolloutProfile = config.features.mediaRolloutControllerV1
      ? await this.deps.mediaRolloutControllerService?.getEffectiveProfile()
        .catch(() => null) ?? null
      : null

    return this.toPostWithMeta(post, Date.now(), viewerUserId, media, rolloutProfile)
  }

  private async toPublicStageTurnWithAuthor(
    turn: PublicStageTurn,
    opts: {
      viewerUserId?: string
      authorCache: Map<string, Promise<AuthorSummary>>
      turnById: Map<string, PublicStageTurn>
      attachmentMap: Map<string, SurfaceMediaAttachmentView[]>
    },
  ): Promise<PublicStageTurnWithAuthor> {
    const votes = this.getDetailedVoteSummary('TURN', turn.id, opts.viewerUserId)
    const topicPresentation = await this.resolveThreadTurnTopicSignals(turn.id)
    const anchorTurn = turn.anchor_turn_id ? opts.turnById.get(turn.anchor_turn_id) ?? null : null
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
        : null,
    }
  }

  private async toPublicStageThreadWithAuthor(
    thread: PublicStageThread,
    turns: PublicStageTurn[],
    opts: {
      viewerUserId?: string
      authorCache: Map<string, Promise<AuthorSummary>>
      turnById: Map<string, PublicStageTurn>
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
    const turnById = new Map<string, PublicStageTurn>()
    for (const turn of turns) {
      if (!turnsByThreadId.has(turn.thread_id)) {
        turnsByThreadId.set(turn.thread_id, [])
      }
      turnsByThreadId.get(turn.thread_id)!.push(turn)
      turnById.set(turn.id, turn)
    }
    const authorCache = new Map<string, Promise<AuthorSummary>>()

    const items = await Promise.all(
      result.items.map((thread) =>
        this.toPublicStageThreadWithAuthor(thread, turnsByThreadId.get(thread.id) ?? [], {
          viewerUserId,
          authorCache,
          turnById,
          attachmentMap,
        })),
    )

    return { items, next_cursor: result.next_cursor }
  }

  async getThread(threadId: string, viewerUserId?: string): Promise<PublicStageThreadWithAuthor> {
    const thread = await this.deps.publicStageThreadRepo.findById(threadId)
    if (!thread) throw new NotFoundError('Thread', threadId)
    if (!isPubliclyVisibleContent(thread)) throw new NotFoundError('Thread', threadId)

    const post = await this.deps.postRepo.findById(thread.post_id)
    if (!post || !isPubliclyVisibleContent(post)) throw new NotFoundError('Thread', threadId)

    const turnsPage = await this.deps.publicStageTurnRepo.findByThread(thread.id, {
      cursor: undefined,
      limit: 500,
    })
    const turns = turnsPage.items
    const attachmentMap = await this.resolveThreadTurnAttachmentViews([
      { id: thread.id, entry_kind: 'THREAD' as const },
      ...turns.map((turn) => ({ id: turn.id, entry_kind: 'TURN' as const })),
    ])
    const turnById = new Map(turns.map((turn) => [turn.id, turn]))
    const authorCache = new Map<string, Promise<AuthorSummary>>()

    return this.toPublicStageThreadWithAuthor(thread, turns, {
      viewerUserId,
      authorCache,
      turnById,
      attachmentMap,
    })
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
