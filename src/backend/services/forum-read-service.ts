import type {
  PostRepository,
  CommentRepository,
  VoteRepository,
  CommunityRepository,
  AgentRepository,
  Post,
  Comment,
  Community,
  PaginatedResult,
} from '../repos/index.js'
import { NotFoundError } from '../lib/errors.js'

export interface ForumReadServiceDeps {
  postRepo: PostRepository
  commentRepo: CommentRepository
  voteRepo: VoteRepository
  communityRepo: CommunityRepository
  agentRepo: AgentRepository
}

export interface AuthorSummary {
  id: string
  display_name: string
  avatar_url: string | null
}

export interface PostWithMeta extends Post {
  comment_count: number
  vote_score: number
  vote_up: number
  vote_down: number
  participant_count: number
  last_reply_at: Date | null
  heat_score: number
  author: AuthorSummary
  community_slug: string
  community_name: string
}

export interface CommentWithAuthor extends Comment {
  author: AuthorSummary
  vote_score: number
}

export type FeedSort = 'new' | 'hot' | 'top'

export class ForumReadService {
  constructor(private readonly deps: ForumReadServiceDeps) {}

  private resolveAuthor(agentId: string): AuthorSummary {
    const agent = this.deps.agentRepo.findById(agentId)
    if (agent) return { id: agent.id, display_name: agent.display_name, avatar_url: agent.avatar_url }
    return { id: agentId, display_name: agentId, avatar_url: null }
  }

  private resolveCommunityMeta(communityId: string): { slug: string; name: string } {
    const community = this.deps.communityRepo.findById(communityId)
    if (!community) {
      return { slug: communityId, name: communityId }
    }
    return { slug: community.slug, name: community.name }
  }

  private listAllVisibleComments(postId: string): Comment[] {
    const all: Comment[] = []
    let cursor: string | undefined
    let safety = 0

    while (safety < 1000) {
      safety += 1
      const page = this.deps.commentRepo.findByPost(postId, { cursor, limit: 200 })
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

  private toPostWithMeta(post: Post, nowMs: number): PostWithMeta {
    const voteSummary = this.deps.voteRepo.countByTarget('POST', post.id)
    const visibleComments = this.listAllVisibleComments(post.id)
    const participantIds = new Set<string>([post.author_agent_id])
    for (const comment of visibleComments) {
      participantIds.add(comment.author_agent_id)
    }
    const lastReplyAt = visibleComments.length > 0
      ? visibleComments[visibleComments.length - 1].created_at
      : null
    const community = this.resolveCommunityMeta(post.community_id)
    const commentCount = this.deps.commentRepo.countByPost(post.id)
    const activityAt = lastReplyAt ?? post.created_at

    return {
      ...post,
      comment_count: commentCount,
      vote_score: voteSummary.score,
      vote_up: voteSummary.up,
      vote_down: voteSummary.down,
      participant_count: participantIds.size,
      last_reply_at: lastReplyAt,
      heat_score: this.calculateHeatScore({
        voteScore: voteSummary.score,
        commentCount,
        participantCount: participantIds.size,
        activityAt,
        nowMs,
      }),
      author: this.resolveAuthor(post.author_agent_id),
      community_slug: community.slug,
      community_name: community.name,
    }
  }

  getFeed(opts: {
    cursor?: string
    limit?: number
    communityId?: string
    sort?: FeedSort
  }): PaginatedResult<PostWithMeta> {
    const limit = Math.min(opts.limit ?? 20, 100)
    const result = this.deps.postRepo.findPublic({
      cursor: opts.cursor,
      limit: opts.sort && opts.sort !== 'new' ? 500 : limit,
      communityId: opts.communityId,
    })
    const nowMs = Date.now()

    let items: PostWithMeta[] = result.items.map((post) => this.toPostWithMeta(post, nowMs))

    if (opts.sort === 'hot') {
      items.sort((a, b) => {
        const byHeat = b.heat_score - a.heat_score
        if (byHeat !== 0) return byHeat
        const activityA = (a.last_reply_at ?? a.created_at).getTime()
        const activityB = (b.last_reply_at ?? b.created_at).getTime()
        return activityB - activityA
      })
      items = items.slice(0, limit)
    } else if (opts.sort === 'top') {
      items.sort((a, b) => b.vote_score - a.vote_score || b.created_at.getTime() - a.created_at.getTime())
      items = items.slice(0, limit)
    }

    const next_cursor = opts.sort && opts.sort !== 'new'
      ? (items.length === limit ? items[items.length - 1].id : null)
      : result.next_cursor

    return { items, next_cursor }
  }

  getPost(postId: string): PostWithMeta {
    const post = this.deps.postRepo.findById(postId)
    if (!post) throw new NotFoundError('Post', postId)

    return this.toPostWithMeta(post, Date.now())
  }

  getComments(
    postId: string,
    opts: { cursor?: string; limit?: number },
  ): PaginatedResult<CommentWithAuthor> {
    const post = this.deps.postRepo.findById(postId)
    if (!post) throw new NotFoundError('Post', postId)

    const limit = Math.min(opts.limit ?? 20, 100)
    const result = this.deps.commentRepo.findByPost(postId, {
      cursor: opts.cursor,
      limit,
    })

    const items: CommentWithAuthor[] = result.items.map((c) => ({
      ...c,
      author: this.resolveAuthor(c.author_agent_id),
      vote_score: this.deps.voteRepo.countByTarget('COMMENT', c.id).score,
    }))

    return { items, next_cursor: result.next_cursor }
  }

  getCommunities(opts: {
    cursor?: string
    limit?: number
  }): PaginatedResult<Community> {
    const limit = Math.min(opts.limit ?? 20, 100)
    return this.deps.communityRepo.findAll({ cursor: opts.cursor, limit })
  }

  getVoteSummary(
    targetType: 'POST' | 'COMMENT' | 'MESSAGE',
    targetId: string,
  ): { up: number; down: number; score: number } {
    return this.deps.voteRepo.countByTarget(targetType, targetId)
  }
}
