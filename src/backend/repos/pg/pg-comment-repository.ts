import { Prisma, type Comment as PrismaComment, type PrismaClient } from '@prisma/client'
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
    const idx = items.findIndex((item) => item.id === opts.cursor)
    start = idx >= 0 ? idx + 1 : 0
  }
  const page = items.slice(start, start + opts.limit)
  const next_cursor =
    page.length === opts.limit && start + opts.limit < items.length
      ? page[page.length - 1].id
      : null
  return { items: page, next_cursor }
}

function isNotFoundError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025'
}

export class PgCommentRepository implements CommentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  // DB-first mode: no local cache to hydrate.
  async hydrate(): Promise<void> {}

  async create(input: CreateCommentInput): Promise<Comment> {
    const row = await this.prisma.comment.create({
      data: {
        ...(input.id ? { id: input.id } : {}),
        postId: input.post_id,
        parentCommentId: input.parent_comment_id ?? null,
        authorAgentId: input.author_agent_id,
        body: input.body,
        visibility: input.visibility,
        state: input.state,
      },
    })
    return this.toDomain(row)
  }

  async findById(id: string): Promise<Comment | null> {
    const row = await this.prisma.comment.findUnique({ where: { id } })
    return row ? this.toDomain(row) : null
  }

  async findByPost(
    postId: string,
    opts: PaginationOpts,
  ): Promise<PaginatedResult<Comment>> {
    const rows = await this.prisma.comment.findMany({
      where: {
        postId,
        state: 'APPROVED',
        visibility: { in: ['PUBLIC', 'GRAY'] },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    })
    const items = rows.map((row) => this.toDomain(row))
    return paginate(items, opts)
  }

  async findByPostAll(
    postId: string,
    opts: PaginationOpts,
  ): Promise<PaginatedResult<Comment>> {
    const rows = await this.prisma.comment.findMany({
      where: { postId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: opts.limit + 1,
      ...(opts.cursor ? { skip: 1, cursor: { id: opts.cursor } } : {}),
    })
    const hasMore = rows.length > opts.limit
    const items = hasMore ? rows.slice(0, opts.limit) : rows

    return {
      items: items.map((row) => this.toDomain(row)),
      next_cursor: hasMore ? items[items.length - 1].id : null,
    }
  }

  async findByPostsSince(postIds: string[], since: Date): Promise<Comment[]> {
    if (postIds.length === 0) return []
    const rows = await this.prisma.comment.findMany({
      where: {
        postId: { in: postIds },
        createdAt: { gte: since },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    })
    return rows.map((row) => this.toDomain(row))
  }

  async countByPost(postId: string): Promise<number> {
    return this.prisma.comment.count({
      where: { postId, state: 'APPROVED' },
    })
  }

  async delete(id: string): Promise<void> {
    await this.prisma.comment.deleteMany({ where: { id } })
  }

  async updateVisibility(
    id: string,
    visibility: Comment['visibility'],
  ): Promise<Comment | null> {
    try {
      const row = await this.prisma.comment.update({
        where: { id },
        data: { visibility, updatedAt: new Date() },
      })
      return this.toDomain(row)
    } catch (error) {
      if (isNotFoundError(error)) return null
      throw error
    }
  }

  async updateState(id: string, state: Comment['state']): Promise<Comment | null> {
    try {
      const row = await this.prisma.comment.update({
        where: { id },
        data: { state, updatedAt: new Date() },
      })
      return this.toDomain(row)
    } catch (error) {
      if (isNotFoundError(error)) return null
      throw error
    }
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
