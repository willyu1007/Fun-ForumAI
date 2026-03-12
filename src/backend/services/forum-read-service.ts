import type {
  PostRepository,
  CommentRepository,
  VoteRepository,
  HumanVoteRepository,
  PostMediaRepository,
  CommunityRepository,
  AgentRepository,
  Post,
  Comment,
  Community,
  PaginatedResult,
} from '../repos/index.js'
import { NotFoundError } from '../lib/errors.js'
import { config } from '../lib/config.js'
import type { AchievementChronicleService } from './achievement-chronicle-service.js'

export interface ForumReadServiceDeps {
  postRepo: PostRepository
  commentRepo: CommentRepository
  voteRepo: VoteRepository
  humanVoteRepo: HumanVoteRepository
  postMediaRepo: PostMediaRepository
  communityRepo: CommunityRepository
  agentRepo: AgentRepository
  achievementChronicleService?: AchievementChronicleService
}

export interface PostMediaSummary {
  asset_id: string
  media_url: string
  mime_type: string
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
}

export type FeedSort = 'new' | 'hot' | 'top'
import { HUMAN_VOTE_WEIGHT } from '../lib/constants.js'

export class ForumReadService {
  constructor(private readonly deps: ForumReadServiceDeps) {}

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
    const commentCount = await this.deps.commentRepo.countByPost(post.id)
    const activityAt = lastReplyAt ?? post.created_at

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
    const limit = Math.min(opts.limit ?? 20, 100)
    const rankedSort = opts.sort === 'hot' || opts.sort === 'top'
    const result = await this.deps.postRepo.findPublic({
      cursor: rankedSort ? undefined : opts.cursor,
      limit: rankedSort ? 500 : limit,
      communityId: opts.communityId,
      authorAgentIds: opts.authorAgentIds,
    })
    const nowMs = Date.now()

    const mediaByPost = this.deps.postMediaRepo.findByPostIds(result.items.map((post) => post.id))
    const items: PostWithMeta[] = await Promise.all(
      result.items.map((post) => this.toPostWithMeta(
        post,
        nowMs,
        opts.viewerUserId,
        (mediaByPost[post.id] ?? []).map((item) => ({
          asset_id: item.asset_id,
          media_url: item.media_url,
          mime_type: item.mime_type,
        })),
      )),
    )

    if (opts.sort === 'hot') {
      items.sort((a, b) => {
        const byHeat = b.heat_score - a.heat_score
        if (byHeat !== 0) return byHeat
        const activityA = (a.last_reply_at ?? a.created_at).getTime()
        const activityB = (b.last_reply_at ?? b.created_at).getTime()
        return activityB - activityA
      })
      return this.paginateRanked(items, {
        cursor: opts.cursor,
        limit,
      })
    } else if (opts.sort === 'top') {
      items.sort((a, b) => b.vote_score - a.vote_score || b.created_at.getTime() - a.created_at.getTime())
      return this.paginateRanked(items, {
        cursor: opts.cursor,
        limit,
      })
    }
    return { items, next_cursor: result.next_cursor }
  }

  async getPost(postId: string, viewerUserId?: string): Promise<PostWithMeta> {
    const post = await this.deps.postRepo.findById(postId)
    if (!post) throw new NotFoundError('Post', postId)

    const media = this.deps.postMediaRepo.findByPostId(post.id).map((item) => ({
      asset_id: item.asset_id,
      media_url: item.media_url,
      mime_type: item.mime_type,
    }))

    return this.toPostWithMeta(post, Date.now(), viewerUserId, media)
  }

  async getComments(
    postId: string,
    opts: { cursor?: string; limit?: number },
    viewerUserId?: string,
  ): Promise<PaginatedResult<CommentWithAuthor>> {
    const post = await this.deps.postRepo.findById(postId)
    if (!post) throw new NotFoundError('Post', postId)

    const limit = Math.min(opts.limit ?? 20, 100)
    const result = await this.deps.commentRepo.findByPost(postId, {
      cursor: opts.cursor,
      limit,
    })

    const items: CommentWithAuthor[] = await Promise.all(result.items.map(async (c) => {
      const votes = this.getDetailedVoteSummary('COMMENT', c.id, viewerUserId)
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
      }
    }))

    return { items, next_cursor: result.next_cursor }
  }

  async getComment(commentId: string, viewerUserId?: string): Promise<CommentWithAuthor> {
    const comment = await this.deps.commentRepo.findById(commentId)
    if (!comment) throw new NotFoundError('Comment', commentId)

    const votes = this.getDetailedVoteSummary('COMMENT', comment.id, viewerUserId)
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
    }
  }

  async getCommunities(opts: {
    cursor?: string
    limit?: number
  }): Promise<PaginatedResult<Community>> {
    const limit = Math.min(opts.limit ?? 20, 100)
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
}
