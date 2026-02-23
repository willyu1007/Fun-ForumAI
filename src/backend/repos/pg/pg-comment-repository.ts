import { randomUUID } from 'node:crypto'
import type { PrismaClient, Comment as PrismaComment } from '@prisma/client'
import type {
  Comment,
  CreateCommentInput,
  PaginatedResult,
  PaginationOpts,
} from '../types.js'
import type { CommentRepository } from '../comment-repository.js'

function paginate<T extends { id: string }>(
  items: T[],
  opts: PaginationOpts,
): PaginatedResult<T> {
  let start = 0
  if (opts.cursor) {
    const idx = items.findIndex((i) => i.id === opts.cursor)
    start = idx >= 0 ? idx + 1 : 0
  }
  const page = items.slice(start, start + opts.limit)
  const next_cursor =
    page.length === opts.limit && start + opts.limit < items.length
      ? page[page.length - 1].id
      : null
  return { items: page, next_cursor }
}

export class PgCommentRepository implements CommentRepository {
  private cache = new Map<string, Comment>()

  constructor(private readonly prisma: PrismaClient) {}

  async hydrate(): Promise<void> {
    const rows = await this.prisma.comment.findMany()
    for (const row of rows) {
      this.cache.set(row.id, this.toDomain(row))
    }
  }

  create(input: CreateCommentInput): Comment {
    const id = randomUUID()
    const now = new Date()
    const comment: Comment = {
      id,
      post_id: input.post_id,
      parent_comment_id: input.parent_comment_id ?? null,
      author_agent_id: input.author_agent_id,
      body: input.body,
      visibility: input.visibility,
      state: input.state,
      created_at: now,
      updated_at: now,
    }
    this.cache.set(id, comment)
    this.prisma.comment
      .create({
        data: {
          id,
          postId: comment.post_id,
          parentCommentId: comment.parent_comment_id,
          authorAgentId: comment.author_agent_id,
          body: comment.body,
          visibility: comment.visibility,
          state: comment.state,
          createdAt: now,
          updatedAt: now,
        },
      })
      .catch((err) => console.error('[PgCommentRepo] create error:', err))
    return comment
  }

  findById(id: string): Comment | null {
    return this.cache.get(id) ?? null
  }

  findByPost(postId: string, opts: PaginationOpts): PaginatedResult<Comment> {
    const items = Array.from(this.cache.values())
      .filter((c) => c.post_id === postId && c.state === 'APPROVED')
      .filter((c) => c.visibility === 'PUBLIC' || c.visibility === 'GRAY')
      .sort((a, b) => a.created_at.getTime() - b.created_at.getTime())
    return paginate(items, opts)
  }

  countByPost(postId: string): number {
    return Array.from(this.cache.values()).filter(
      (c) => c.post_id === postId && c.state === 'APPROVED',
    ).length
  }

  updateVisibility(
    id: string,
    visibility: Comment['visibility'],
  ): Comment | null {
    const comment = this.cache.get(id)
    if (!comment) return null
    comment.visibility = visibility
    comment.updated_at = new Date()
    this.prisma.comment
      .update({
        where: { id },
        data: { visibility, updatedAt: comment.updated_at },
      })
      .catch((err) =>
        console.error('[PgCommentRepo] updateVisibility error:', err),
      )
    return comment
  }

  updateState(id: string, state: Comment['state']): Comment | null {
    const comment = this.cache.get(id)
    if (!comment) return null
    comment.state = state
    comment.updated_at = new Date()
    this.prisma.comment
      .update({
        where: { id },
        data: { state, updatedAt: comment.updated_at },
      })
      .catch((err) =>
        console.error('[PgCommentRepo] updateState error:', err),
      )
    return comment
  }

  private toDomain(row: PrismaComment): Comment {
    return {
      id: row.id,
      post_id: row.postId,
      parent_comment_id: row.parentCommentId,
      author_agent_id: row.authorAgentId,
      body: row.body,
      visibility: row.visibility,
      state: row.state,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }
  }
}
