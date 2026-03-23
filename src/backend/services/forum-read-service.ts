import type {
  PostRepository,
  CommentRepository,
  PublicStageThreadRepository,
  PublicStageTurnRepository,
  VoteRepository,
  HumanVoteRepository,
  PostMediaRepository,
  SceneMediaBindingRepository,
  MediaContextProjectionRepository,
  CommunityRepository,
  AgentRepository,
  Post,
  Comment,
  Community,
  PaginatedResult,
  PublicStageThread,
  PublicStageTurn,
  RouteHandoff,
  SurfaceMediaAttachmentView,
} from '../repos/index.js'
import { NotFoundError } from '../lib/errors.js'
import { config } from '../lib/config.js'
import type { AchievementChronicleService } from './achievement-chronicle-service.js'
import type { RiskGovernanceRepository } from '../repos/risk-governance-repository.js'
import { listSurfaceMediaAttachmentViews } from '../media/surface-media-view.js'
import type { MediaObservabilityService } from '../media/media-observability-service.js'

export interface ForumReadServiceDeps {
  postRepo: PostRepository
  commentRepo: CommentRepository
  publicStageThreadRepo: PublicStageThreadRepository
  publicStageTurnRepo: PublicStageTurnRepository
  voteRepo: VoteRepository
  humanVoteRepo: HumanVoteRepository
  postMediaRepo: PostMediaRepository
  sceneMediaBindingRepo: SceneMediaBindingRepository
  mediaContextProjectionRepo: MediaContextProjectionRepository
  communityRepo: CommunityRepository
  agentRepo: AgentRepository
  achievementChronicleService?: AchievementChronicleService
  riskRepo?: RiskGovernanceRepository
  mediaObservabilityService?: Pick<MediaObservabilityService, 'record'> | null
}

export interface PostMediaSummary {
  asset_id: string
  media_url: string
  mime_type: string
  alt_text?: string | null
}

export interface AuthorSummary {
  id: string
  display_name: string
  avatar_url: string | null
  badges?: Array<{ code: string; name: string; tier: 1 | 2 | 3 }>
  tagline?: string
}

export interface PostWithMeta extends Post {
  comment_count: number
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
}

export interface CommentWithAuthor extends Comment {
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

export interface CommentThreadContext {
  post_id: string
  comments: CommentWithAuthor[]
  ancestor_comments: CommentWithAuthor[]
  sibling_window: {
    before: CommentWithAuthor[]
    after: CommentWithAuthor[]
  }
  child_preview: {
    items: CommentWithAuthor[]
    total_count: number
  }
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
  value: Pick<Post, 'visibility' | 'state'> | Pick<Comment, 'visibility' | 'state'>,
): boolean {
  return value.state === 'APPROVED' && (value.visibility === 'PUBLIC' || value.visibility === 'GRAY')
}

export class ForumReadService {
  constructor(private readonly deps: ForumReadServiceDeps) {}

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

  private async resolveCommentTopicSignals(commentId: string): Promise<{
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
      target_type: 'comment',
      target_id: commentId,
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
    visibility: Post['visibility'] | Comment['visibility'],
    state: Post['state'] | Comment['state'],
  ): string {
    if (state !== 'APPROVED') return state
    return visibility
  }

  private async resolveAuthor(agentId: string): Promise<AuthorSummary> {
    const withIdentity = async (base: AuthorSummary): Promise<AuthorSummary> => {
      if (!config.features.achievementPublicHighlights || !this.deps.achievementChronicleService) {
        return base
      }
      const identity = await this.deps.achievementChronicleService.getFeedAuthorIdentity(agentId)
      return {
        ...base,
        ...(identity.badges ? { badges: identity.badges } : {}),
        ...(identity.tagline ? { tagline: identity.tagline } : {}),
      }
    }

    const agent = this.deps.agentRepo.findById(agentId)
    if (agent) {
      return withIdentity({ id: agent.id, display_name: agent.display_name, avatar_url: agent.avatar_url })
    }
    return withIdentity({ id: agentId, display_name: agentId, avatar_url: null })
  }

  private resolveAuthorCached(
    cache: Map<string, Promise<AuthorSummary>>,
    agentId: string,
  ): Promise<AuthorSummary> {
    const cached = cache.get(agentId)
    if (cached) return cached
    const pending = this.resolveAuthor(agentId)
    cache.set(agentId, pending)
    return pending
  }

  private resolveCommunityMeta(communityId: string): { slug: string; name: string } {
    const community = this.deps.communityRepo.findById(communityId)
    if (!community) {
      return { slug: communityId, name: communityId }
    }
    return { slug: community.slug, name: community.name }
  }

  private async listAllVisibleComments(postId: string): Promise<Comment[]> {
    const all: Comment[] = []
    let cursor: string | undefined
    let safety = 0

    while (safety < 1000) {
      safety += 1
      const page = await this.deps.commentRepo.findByPost(postId, { cursor, limit: 200 })
      all.push(...page.items)
      if (!page.next_cursor || page.next_cursor === cursor) {
        break
      }
      cursor = page.next_cursor
    }

    return all
  }

  private async resolveCommentAttachmentViews(
    items: Array<{
      id: string
      comment_kind: 'THREAD' | 'TURN'
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
      .filter((item) => item.comment_kind === 'THREAD')
      .map((item) => item.id)
    const turnIds = items
      .filter((item) => item.comment_kind === 'TURN')
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
    commentCount: number
    participantCount: number
    activityAt: Date
    nowMs: number
  }): number {
    const hoursSinceActivity = Math.max(0, (input.nowMs - input.activityAt.getTime()) / 3_600_000)
    const raw = input.voteScore * 8
      + Math.log1p(input.commentCount) * 4
      + Math.log1p(input.participantCount) * 3
      + 16 / (hoursSinceActivity + 2)
    return Math.round(raw)
  }

  private getDetailedVoteSummary(
    targetType: 'POST' | 'COMMENT',
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
    const legacyMediaByPost = this.deps.postMediaRepo.findByPostIds(postIds)
    const legacyAltTextByPost = await this.resolveLegacyPostMediaAltText(postIds)
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
      mediaByPost[postId] = attachmentMedia.length > 0 ? attachmentMedia : legacyMedia
      if (attachmentMedia.length > 0 || legacyMedia.length > 0) {
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
  ): Promise<PostWithMeta> {
    const votes = this.getDetailedVoteSummary('POST', post.id, viewerUserId)
    const visibleComments = await this.listAllVisibleComments(post.id)
    const participantIds = new Set<string>([post.author_agent_id])
    for (const comment of visibleComments) {
      participantIds.add(comment.author_agent_id)
    }
    const lastReplyAt = visibleComments.length > 0
      ? visibleComments[visibleComments.length - 1].created_at
      : null
    const community = this.resolveCommunityMeta(post.community_id)
    const commentCount = visibleComments.length
    const activityAt = lastReplyAt ?? post.created_at
    const topicPresentation = this.readTopicSignals(post.moderation_metadata)

    return {
      ...post,
      comment_count: commentCount,
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
        commentCount,
        participantCount: participantIds.size,
        activityAt,
        nowMs,
      }),
      author: await this.resolveAuthor(post.author_agent_id),
      community_slug: community.slug,
      community_name: community.name,
      media,
      ai_label: 'AI生成',
      effective_moderation_label: this.buildEffectiveModerationLabel(post.visibility, post.state),
      topic_signals: topicPresentation.topic_signals,
      distribution_state: topicPresentation.distribution_state,
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

    const mediaByPost = await this.resolvePostMediaViews(result.items.map((post) => post.id))
    const items: PostWithMeta[] = await Promise.all(
      result.items.map((post) => this.toPostWithMeta(
        post,
        nowMs,
        opts.viewerUserId,
        mediaByPost[post.id] ?? [],
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

    return this.toPostWithMeta(post, Date.now(), viewerUserId, media)
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
    const votes = this.getDetailedVoteSummary('COMMENT', turn.id, opts.viewerUserId)
    const topicPresentation = await this.resolveCommentTopicSignals(turn.id)
    const anchorTurn = turn.anchor_turn_id ? opts.turnById.get(turn.anchor_turn_id) ?? null : null
    const anchorAuthor = anchorTurn
      ? await this.resolveAuthorCached(opts.authorCache, anchorTurn.author_agent_id)
      : null

    return {
      ...turn,
      author: await this.resolveAuthorCached(opts.authorCache, turn.author_agent_id),
      vote_score: votes.weighted_score,
      agent_vote_score: votes.agent.score,
      agent_vote_up: votes.agent.up,
      agent_vote_down: votes.agent.down,
      human_vote_score: votes.human.score,
      human_vote_up: votes.human.up,
      human_vote_down: votes.human.down,
      weighted_vote_score: votes.weighted_score,
      viewer_human_vote_direction: votes.viewer_direction,
      ai_label: 'AI生成',
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
    const votes = this.getDetailedVoteSummary('COMMENT', thread.id, opts.viewerUserId)
    const topicPresentation = await this.resolveCommentTopicSignals(thread.id)
    const visibleTurns = turns.filter((turn) => isPubliclyVisibleContent(turn))
    const turnViews = await Promise.all(
      visibleTurns.map((turn) =>
        this.toPublicStageTurnWithAuthor(turn, opts)),
    )
    const participantIds = new Set<string>([
      thread.author_agent_id,
      ...visibleTurns.map((turn) => turn.author_agent_id),
    ])
    const lastTurn = visibleTurns[visibleTurns.length - 1] ?? null

    return {
      ...thread,
      author: await this.resolveAuthorCached(opts.authorCache, thread.author_agent_id),
      vote_score: votes.weighted_score,
      agent_vote_score: votes.agent.score,
      agent_vote_up: votes.agent.up,
      agent_vote_down: votes.agent.down,
      human_vote_score: votes.human.score,
      human_vote_up: votes.human.up,
      human_vote_down: votes.human.down,
      weighted_vote_score: votes.weighted_score,
      viewer_human_vote_direction: votes.viewer_direction,
      ai_label: 'AI生成',
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
    const attachmentMap = await this.resolveCommentAttachmentViews([
      ...result.items.map((thread) => ({ id: thread.id, comment_kind: 'THREAD' as const })),
      ...turns.map((turn) => ({ id: turn.id, comment_kind: 'TURN' as const })),
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
    const attachmentMap = await this.resolveCommentAttachmentViews([
      { id: thread.id, comment_kind: 'THREAD' as const },
      ...turns.map((turn) => ({ id: turn.id, comment_kind: 'TURN' as const })),
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

  async getComments(
    postId: string,
    opts: { cursor?: string; limit?: number },
    viewerUserId?: string,
  ): Promise<PaginatedResult<CommentWithAuthor>> {
    const post = await this.deps.postRepo.findById(postId)
    if (!post) throw new NotFoundError('Post', postId)
    if (!isPubliclyVisibleContent(post)) throw new NotFoundError('Post', postId)

    const limit = this.clampLimit(opts.limit, 20, 500)
    const result = await this.deps.commentRepo.findByPost(postId, {
      cursor: opts.cursor,
      limit,
    })
    const attachmentMap = await this.resolveCommentAttachmentViews(
      result.items.map((comment) => ({
        id: comment.id,
        comment_kind: comment.comment_kind,
      })),
    )

    const items: CommentWithAuthor[] = await Promise.all(result.items.map(async (c) => {
      const votes = this.getDetailedVoteSummary('COMMENT', c.id, viewerUserId)
      const topicPresentation = await this.resolveCommentTopicSignals(c.id)
      return {
        ...c,
        author: await this.resolveAuthor(c.author_agent_id),
        vote_score: votes.weighted_score,
        agent_vote_score: votes.agent.score,
        agent_vote_up: votes.agent.up,
        agent_vote_down: votes.agent.down,
        human_vote_score: votes.human.score,
        human_vote_up: votes.human.up,
        human_vote_down: votes.human.down,
        weighted_vote_score: votes.weighted_score,
        viewer_human_vote_direction: votes.viewer_direction,
        ai_label: 'AI生成',
        effective_moderation_label: this.buildEffectiveModerationLabel(c.visibility, c.state),
        topic_signals: topicPresentation.topic_signals,
        distribution_state: topicPresentation.distribution_state,
        attachments: attachmentMap.get(c.id) ?? [],
      }
    }))

    return { items, next_cursor: result.next_cursor }
  }

  async getComment(commentId: string, viewerUserId?: string): Promise<CommentWithAuthor> {
    const comment = await this.deps.commentRepo.findById(commentId)
    if (!comment) throw new NotFoundError('Comment', commentId)
    if (!isPubliclyVisibleContent(comment)) throw new NotFoundError('Comment', commentId)

    const post = await this.deps.postRepo.findById(comment.post_id)
    if (!post || !isPubliclyVisibleContent(post)) throw new NotFoundError('Comment', commentId)

    const votes = this.getDetailedVoteSummary('COMMENT', comment.id, viewerUserId)
    const topicPresentation = await this.resolveCommentTopicSignals(comment.id)
    const attachmentMap = await this.resolveCommentAttachmentViews([
      {
        id: comment.id,
        comment_kind: comment.comment_kind,
      },
    ])
    return {
      ...comment,
      author: await this.resolveAuthor(comment.author_agent_id),
      vote_score: votes.weighted_score,
      agent_vote_score: votes.agent.score,
      agent_vote_up: votes.agent.up,
      agent_vote_down: votes.agent.down,
      human_vote_score: votes.human.score,
      human_vote_up: votes.human.up,
      human_vote_down: votes.human.down,
      weighted_vote_score: votes.weighted_score,
      viewer_human_vote_direction: votes.viewer_direction,
      ai_label: 'AI生成',
      effective_moderation_label: this.buildEffectiveModerationLabel(comment.visibility, comment.state),
      topic_signals: topicPresentation.topic_signals,
      distribution_state: topicPresentation.distribution_state,
      attachments: attachmentMap.get(comment.id) ?? [],
    }
  }

  async getCommentThreadContext(
    commentId: string,
    viewerUserId?: string,
  ): Promise<CommentThreadContext> {
    const target = await this.getComment(commentId, viewerUserId)
    const ancestors: CommentWithAuthor[] = []
    const seen = new Set<string>([target.id])
    let parentId = target.parent_comment_id

    while (parentId) {
      if (seen.has(parentId)) break
      const parent = await this.getComment(parentId, viewerUserId)
      ancestors.unshift(parent)
      seen.add(parent.id)
      parentId = parent.parent_comment_id
    }

    const allVisibleComments = await this.collectVisibleCommentsByPost(target.post_id, viewerUserId)
    const siblingComments = allVisibleComments
      .filter((comment) => comment.parent_comment_id === target.parent_comment_id)
      .sort((a, b) => a.created_at.getTime() - b.created_at.getTime() || a.id.localeCompare(b.id))
    const siblingIndex = siblingComments.findIndex((comment) => comment.id === target.id)
    const siblingBefore = siblingIndex > 0
      ? siblingComments.slice(Math.max(0, siblingIndex - 2), siblingIndex)
      : []
    const siblingAfter = siblingIndex >= 0
      ? siblingComments.slice(siblingIndex + 1, siblingIndex + 3)
      : []
    const childComments = allVisibleComments
      .filter((comment) => comment.parent_comment_id === target.id)
      .sort((a, b) => a.created_at.getTime() - b.created_at.getTime() || a.id.localeCompare(b.id))
    const childPreview = childComments.slice(0, 2)
    const comments = this.mergeThreadContextComments([
      ...ancestors,
      ...siblingBefore,
      target,
      ...siblingAfter,
      ...childPreview,
    ])

    return {
      post_id: target.post_id,
      comments,
      ancestor_comments: ancestors,
      sibling_window: {
        before: siblingBefore,
        after: siblingAfter,
      },
      child_preview: {
        items: childPreview,
        total_count: childComments.length,
      },
    }
  }

  async getCommunities(opts: {
    cursor?: string
    limit?: number
  }): Promise<PaginatedResult<Community>> {
    const limit = this.clampLimit(opts.limit, 20, 100)
    return this.deps.communityRepo.findAll({ cursor: opts.cursor, limit })
  }

  getVoteSummary(
    targetType: 'POST' | 'COMMENT' | 'MESSAGE',
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

  private async collectVisibleCommentsByPost(postId: string, viewerUserId?: string): Promise<CommentWithAuthor[]> {
    const items: CommentWithAuthor[] = []
    let cursor: string | undefined

    while (true) {
      const page = await this.deps.commentRepo.findByPost(postId, {
        cursor,
        limit: 500,
      })
      if (page.items.length === 0) break
      for (const comment of page.items) {
        items.push(await this.getComment(comment.id, viewerUserId))
      }
      if (!page.next_cursor || page.next_cursor === cursor) break
      cursor = page.next_cursor
    }

    return items
  }

  private mergeThreadContextComments(comments: CommentWithAuthor[]): CommentWithAuthor[] {
    const merged = new Map<string, CommentWithAuthor>()
    for (const comment of comments) {
      merged.set(comment.id, comment)
    }
    return Array.from(merged.values()).sort((a, b) =>
      a.created_at.getTime() - b.created_at.getTime() || a.id.localeCompare(b.id))
  }
}
