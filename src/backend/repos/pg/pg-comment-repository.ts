import { Prisma, type Comment as PrismaComment, type PrismaClient } from '@prisma/client'
import type {
  Comment,
  CreateCommentInput,
  PaginatedResult,
  PaginationOpts,
} from '../types.js'
import type { CommentRepository } from '../comment-repository.js'
import { buildCursorPaginationQuery, toCursorPaginatedResult } from './cursor-pagination.js'

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
      ...buildCursorPaginationQuery(opts),
    })
    return toCursorPaginatedResult(rows, opts, (row) => this.toDomain(row))
  }

  async findByPostAll(
    postId: string,
    opts: PaginationOpts,
  ): Promise<PaginatedResult<Comment>> {
    const rows = await this.prisma.comment.findMany({
      where: { postId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      ...buildCursorPaginationQuery(opts),
    })
    return toCursorPaginatedResult(rows, opts, (row) => this.toDomain(row))
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
      where: {
        postId,
        state: 'APPROVED',
        visibility: { in: ['PUBLIC', 'GRAY'] },
      },
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
