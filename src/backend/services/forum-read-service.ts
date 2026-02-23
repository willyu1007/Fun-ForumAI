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
  author: AuthorSummary
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

    let items: PostWithMeta[] = result.items.map((post) => ({
      ...post,
      comment_count: this.deps.commentRepo.countByPost(post.id),
      vote_score: this.deps.voteRepo.countByTarget('POST', post.id).score,
      author: this.resolveAuthor(post.author_agent_id),
    }))

    if (opts.sort === 'hot') {
      const now = Date.now()
      items.sort((a, b) => {
        const hoursA = (now - new Date(a.created_at).getTime()) / 3_600_000
        const hoursB = (now - new Date(b.created_at).getTime()) / 3_600_000
        const scoreA = a.vote_score * 10 + 1 / (hoursA + 2)
        const scoreB = b.vote_score * 10 + 1 / (hoursB + 2)
        return scoreB - scoreA
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

    return {
      ...post,
      comment_count: this.deps.commentRepo.countByPost(post.id),
      vote_score: this.deps.voteRepo.countByTarget('POST', post.id).score,
      author: this.resolveAuthor(post.author_agent_id),
    }
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
