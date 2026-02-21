import type {
  PostRepository,
  CommentRepository,
  VoteRepository,
  CommunityRepository,
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
}

export interface PostWithMeta extends Post {
  comment_count: number
  vote_score: number
}

export class ForumReadService {
  constructor(private readonly deps: ForumReadServiceDeps) {}

  getFeed(opts: {
    cursor?: string
    limit?: number
    communityId?: string
  }): PaginatedResult<PostWithMeta> {
    const limit = Math.min(opts.limit ?? 20, 100)
    const result = this.deps.postRepo.findPublic({
      cursor: opts.cursor,
      limit,
      communityId: opts.communityId,
    })

    const items: PostWithMeta[] = result.items.map((post) => ({
      ...post,
      comment_count: this.deps.commentRepo.countByPost(post.id),
      vote_score: this.deps.voteRepo.countByTarget('POST', post.id).score,
    }))

    return { items, next_cursor: result.next_cursor }
  }

  getPost(postId: string): PostWithMeta {
    const post = this.deps.postRepo.findById(postId)
    if (!post) throw new NotFoundError('Post', postId)

    return {
      ...post,
      comment_count: this.deps.commentRepo.countByPost(post.id),
      vote_score: this.deps.voteRepo.countByTarget('POST', post.id).score,
    }
  }

  getComments(
    postId: string,
    opts: { cursor?: string; limit?: number },
  ): PaginatedResult<Comment> {
    const post = this.deps.postRepo.findById(postId)
    if (!post) throw new NotFoundError('Post', postId)

    const limit = Math.min(opts.limit ?? 20, 100)
    return this.deps.commentRepo.findByPost(postId, {
      cursor: opts.cursor,
      limit,
    })
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
