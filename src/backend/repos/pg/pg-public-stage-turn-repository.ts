import { Prisma, type PrismaClient, type PublicStageTurn as PrismaPublicStageTurn } from '@prisma/client'
import type {
  CreatePublicStageTurnInput,
  PaginatedResult,
  PaginationOpts,
  PublicStageTurn,
} from '../types.js'
import type {
  PublicStageTurnRepository,
  PublicStageTurnWindowOpts,
  PublicStageTurnWindowResult,
} from '../public-stage-turn-repository.js'
import { buildCursorPaginationQuery, toCursorPaginatedResult } from './cursor-pagination.js'

function isNotFoundError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025'
}

function toPrismaActorType(actorType: CreatePublicStageTurnInput['author_actor_type']) {
  return actorType === 'human' ? 'HUMAN' : 'AGENT'
}

export class PgPublicStageTurnRepository implements PublicStageTurnRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async hydrate(): Promise<void> {}

  async create(input: CreatePublicStageTurnInput): Promise<PublicStageTurn> {
    const row = await this.prisma.publicStageTurn.create({
      data: {
        ...(input.id ? { id: input.id } : {}),
        threadId: input.thread_id,
        postId: input.post_id,
        authorActorType: toPrismaActorType(input.author_actor_type) as PrismaPublicStageTurn['authorActorType'],
        authorAgentId: input.author_agent_id ?? null,
        authorUserId: input.author_user_id ?? null,
        turnIndex: input.turn_index,
        anchorTurnId: input.anchor_turn_id ?? null,
        anchorIntent: input.anchor_intent ?? null,
        quotedExcerpt: input.quoted_excerpt ?? null,
        body: input.body,
        visibility: input.visibility,
        state: input.state,
      },
    })
    return this.toDomain(row)
  }

  async findById(id: string): Promise<PublicStageTurn | null> {
    const row = await this.prisma.publicStageTurn.findUnique({ where: { id } })
    return row ? this.toDomain(row) : null
  }

  async findByThread(threadId: string, opts: PaginationOpts): Promise<PaginatedResult<PublicStageTurn>> {
    const rows = await this.prisma.publicStageTurn.findMany({
      where: this.visibleThreadWhere(threadId),
      orderBy: [{ turnIndex: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      ...buildCursorPaginationQuery(opts),
    })
    return toCursorPaginatedResult(rows, opts, (row) => this.toDomain(row))
  }

  async findWindowByThread(threadId: string, opts: PublicStageTurnWindowOpts): Promise<PublicStageTurnWindowResult> {
    if (!opts.aroundTurnId) {
      const page = await this.findByThread(threadId, {
        cursor: opts.cursor ?? undefined,
        limit: opts.limit,
      })
      return {
        ...page,
        returned_mode: opts.cursor ? 'cursor' : 'full',
      }
    }

    const focus = await this.prisma.publicStageTurn.findFirst({
      where: {
        ...this.visibleThreadWhere(threadId),
        id: opts.aroundTurnId,
      },
    })
    if (!focus) {
      return { items: [], next_cursor: null, returned_mode: 'around' }
    }

    const halfWindow = Math.floor((opts.limit - 1) / 2)
    const beforeRowsDesc = opts.limit > 1
      ? await this.prisma.publicStageTurn.findMany({
          where: {
            ...this.visibleThreadWhere(threadId),
            OR: [
              { turnIndex: { lt: focus.turnIndex } },
              { turnIndex: focus.turnIndex, createdAt: { lt: focus.createdAt } },
              { turnIndex: focus.turnIndex, createdAt: focus.createdAt, id: { lt: focus.id } },
            ],
          },
          orderBy: [{ turnIndex: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
          take: opts.limit - 1,
        })
      : []
    const beforeRows = [...beforeRowsDesc].reverse()
    const afterRowsRaw = opts.limit > 0
      ? await this.prisma.publicStageTurn.findMany({
          where: {
            ...this.visibleThreadWhere(threadId),
            OR: [
              { turnIndex: { gt: focus.turnIndex } },
              { turnIndex: focus.turnIndex, createdAt: { gt: focus.createdAt } },
              { turnIndex: focus.turnIndex, createdAt: focus.createdAt, id: { gte: focus.id } },
            ],
          },
          orderBy: [{ turnIndex: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
          take: opts.limit + 1,
        })
      : []
    let beforeTake = Math.min(beforeRows.length, halfWindow)
    let afterTake = Math.min(afterRowsRaw.length, opts.limit - beforeTake)
    if (afterTake < opts.limit - beforeTake) {
      beforeTake = Math.min(beforeRows.length, opts.limit - afterTake)
      afterTake = Math.min(afterRowsRaw.length, opts.limit - beforeTake)
    }
    const selectedBeforeRows = beforeRows.slice(-beforeTake)
    const afterRows = afterRowsRaw.slice(0, afterTake)
    const rows = [...selectedBeforeRows, ...afterRows]
    const hasMore = afterRowsRaw.length > afterRows.length

    return {
      items: rows.map((row) => this.toDomain(row)),
      next_cursor: hasMore ? rows[rows.length - 1]?.id ?? null : null,
      returned_mode: 'around',
    }
  }

  async findRecentByThread(threadId: string, limit: number): Promise<PublicStageTurn[]> {
    if (limit <= 0) return []
    const rows = await this.prisma.publicStageTurn.findMany({
      where: this.visibleThreadWhere(threadId),
      orderBy: [{ turnIndex: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
    })
    return [...rows].reverse().map((row) => this.toDomain(row))
  }

  async findMatchingByThread(threadId: string, query: string, limit: number): Promise<PublicStageTurn[]> {
    const normalizedQuery = query.trim()
    if (!normalizedQuery || limit <= 0) return []
    const tokens = Array.from(new Set(normalizedQuery.split(/\s+/).filter(Boolean))).slice(0, 8)
    const rows = await this.prisma.publicStageTurn.findMany({
      where: {
        ...this.visibleThreadWhere(threadId),
        OR: [
          { body: { contains: normalizedQuery, mode: 'insensitive' } },
          ...tokens.map((token) => ({ body: { contains: token, mode: 'insensitive' as const } })),
        ],
      },
      orderBy: [{ turnIndex: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
    })
    return [...rows].reverse().map((row) => this.toDomain(row))
  }

  async findByThreads(threadIds: string[]): Promise<PublicStageTurn[]> {
    if (threadIds.length === 0) return []
    const rows = await this.prisma.publicStageTurn.findMany({
      where: { threadId: { in: threadIds } },
      orderBy: [{ turnIndex: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    })
    return rows.map((row) => this.toDomain(row))
  }

  async findPublicByAuthorAgent(agentId: string, opts: PaginationOpts): Promise<PaginatedResult<PublicStageTurn>> {
    const rows = await this.prisma.publicStageTurn.findMany({
      where: {
        authorActorType: 'AGENT',
        authorAgentId: agentId,
        state: 'APPROVED',
        visibility: { in: ['PUBLIC', 'GRAY'] },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      ...buildCursorPaginationQuery(opts),
    })
    return toCursorPaginatedResult(rows, opts, (row) => this.toDomain(row))
  }

  async countPublicByAuthorAgent(agentId: string): Promise<number> {
    return this.prisma.publicStageTurn.count({
      where: {
        authorAgentId: agentId,
        state: 'APPROVED',
        visibility: { in: ['PUBLIC', 'GRAY'] },
      },
    })
  }

  async findByPostsSince(postIds: string[], since: Date): Promise<PublicStageTurn[]> {
    if (postIds.length === 0) return []
    const rows = await this.prisma.publicStageTurn.findMany({
      where: {
        postId: { in: postIds },
        createdAt: { gte: since },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    })
    return rows.map((row) => this.toDomain(row))
  }

  async countByThread(threadId: string): Promise<number> {
    return this.prisma.publicStageTurn.count({
      where: {
        threadId,
        state: 'APPROVED',
        visibility: { in: ['PUBLIC', 'GRAY'] },
      },
    })
  }

  async delete(id: string): Promise<void> {
    await this.prisma.publicStageTurn.deleteMany({ where: { id } })
  }

  async deleteByThread(threadId: string): Promise<void> {
    await this.prisma.publicStageTurn.deleteMany({ where: { threadId } })
  }

  async updateVisibility(id: string, visibility: PublicStageTurn['visibility']): Promise<PublicStageTurn | null> {
    try {
      const row = await this.prisma.publicStageTurn.update({
        where: { id },
        data: { visibility, updatedAt: new Date() },
      })
      return this.toDomain(row)
    } catch (error) {
      if (isNotFoundError(error)) return null
      throw error
    }
  }

  async updateState(id: string, state: PublicStageTurn['state']): Promise<PublicStageTurn | null> {
    try {
      const row = await this.prisma.publicStageTurn.update({
        where: { id },
        data: { state, updatedAt: new Date() },
      })
      return this.toDomain(row)
    } catch (error) {
      if (isNotFoundError(error)) return null
      throw error
    }
  }

  private toDomain(row: PrismaPublicStageTurn): PublicStageTurn {
    return {
      id: row.id,
      thread_id: row.threadId,
      post_id: row.postId,
      author_actor_type: row.authorActorType === 'HUMAN' ? 'human' : 'agent',
      author_agent_id: row.authorAgentId,
      author_user_id: row.authorUserId,
      turn_index: row.turnIndex,
      anchor_turn_id: row.anchorTurnId,
      anchor_intent: row.anchorIntent,
      quoted_excerpt: row.quotedExcerpt,
      body: row.body,
      visibility: row.visibility,
      state: row.state,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }
  }

  private visibleThreadWhere(threadId: string): Prisma.PublicStageTurnWhereInput {
    return {
      threadId,
      state: 'APPROVED',
      visibility: { in: ['PUBLIC', 'GRAY'] },
    }
  }
}
