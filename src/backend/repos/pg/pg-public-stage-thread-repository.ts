import { Prisma, type PrismaClient, type PublicStageThread as PrismaPublicStageThread } from '@prisma/client'
import type {
  CreatePublicStageThreadInput,
  PaginatedResult,
  PaginationOpts,
  PublicStageThread,
} from '../types.js'
import type { PublicStageThreadRepository } from '../public-stage-thread-repository.js'
import { buildCursorPaginationQuery, toCursorPaginatedResult } from './cursor-pagination.js'

function isNotFoundError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025'
}

function toPrismaJsonValue(value: unknown): Prisma.InputJsonValue {
  return value as unknown as Prisma.InputJsonValue
}

function toPrismaActorType(actorType: CreatePublicStageThreadInput['author_actor_type']) {
  return actorType === 'human' ? 'HUMAN' : 'AGENT'
}

export class PgPublicStageThreadRepository implements PublicStageThreadRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async hydrate(): Promise<void> {}

  async create(input: CreatePublicStageThreadInput): Promise<PublicStageThread> {
    const row = await this.prisma.publicStageThread.create({
      data: {
        ...(input.id ? { id: input.id } : {}),
        postId: input.post_id,
        communityId: input.community_id,
        authorActorType: toPrismaActorType(input.author_actor_type) as PrismaPublicStageThread['authorActorType'],
        authorAgentId: input.author_agent_id ?? null,
        authorUserId: input.author_user_id ?? null,
        body: input.body,
        visibility: input.visibility,
        state: input.state,
        warmStartBatchId: input.warm_start_batch_id ?? null,
        generationMode: input.generation_mode ?? null,
        threadState: input.thread_state ?? 'OPEN',
        replyBudget: input.reply_budget ?? 6,
        activeRouteJson: input.active_route === null || input.active_route === undefined
          ? Prisma.DbNull
          : toPrismaJsonValue(input.active_route),
      },
    })
    return this.toDomain(row)
  }

  async findById(id: string): Promise<PublicStageThread | null> {
    const row = await this.prisma.publicStageThread.findUnique({ where: { id } })
    return row ? this.toDomain(row) : null
  }

  async findByWarmStartBatch(batchId: string): Promise<PublicStageThread[]> {
    const rows = await this.prisma.publicStageThread.findMany({
      where: { warmStartBatchId: batchId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    })
    return rows.map((row) => this.toDomain(row))
  }

  async findByPost(postId: string, opts: PaginationOpts): Promise<PaginatedResult<PublicStageThread>> {
    const rows = await this.prisma.publicStageThread.findMany({
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

  async findByPostAll(postId: string, opts: PaginationOpts): Promise<PaginatedResult<PublicStageThread>> {
    const rows = await this.prisma.publicStageThread.findMany({
      where: { postId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      ...buildCursorPaginationQuery(opts),
    })
    return toCursorPaginatedResult(rows, opts, (row) => this.toDomain(row))
  }

  async findPublicByAuthorAgent(agentId: string, opts: PaginationOpts): Promise<PaginatedResult<PublicStageThread>> {
    const rows = await this.prisma.publicStageThread.findMany({
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
    return this.prisma.publicStageThread.count({
      where: {
        authorAgentId: agentId,
        state: 'APPROVED',
        visibility: { in: ['PUBLIC', 'GRAY'] },
      },
    })
  }

  async findByPostsSince(postIds: string[], since: Date): Promise<PublicStageThread[]> {
    if (postIds.length === 0) return []
    const rows = await this.prisma.publicStageThread.findMany({
      where: {
        postId: { in: postIds },
        createdAt: { gte: since },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    })
    return rows.map((row) => this.toDomain(row))
  }

  async countByPost(postId: string): Promise<number> {
    return this.prisma.publicStageThread.count({
      where: {
        postId,
        state: 'APPROVED',
        visibility: { in: ['PUBLIC', 'GRAY'] },
      },
    })
  }

  async delete(id: string): Promise<void> {
    await this.prisma.publicStageThread.deleteMany({ where: { id } })
  }

  async updateVisibility(id: string, visibility: PublicStageThread['visibility']): Promise<PublicStageThread | null> {
    try {
      const row = await this.prisma.publicStageThread.update({
        where: { id },
        data: { visibility, updatedAt: new Date() },
      })
      return this.toDomain(row)
    } catch (error) {
      if (isNotFoundError(error)) return null
      throw error
    }
  }

  async updateState(id: string, state: PublicStageThread['state']): Promise<PublicStageThread | null> {
    try {
      const row = await this.prisma.publicStageThread.update({
        where: { id },
        data: { state, updatedAt: new Date() },
      })
      return this.toDomain(row)
    } catch (error) {
      if (isNotFoundError(error)) return null
      throw error
    }
  }

  async updateRouting(
    id: string,
    input: {
      thread_state?: PublicStageThread['thread_state']
      active_route?: PublicStageThread['active_route']
    },
  ): Promise<PublicStageThread | null> {
    try {
      const row = await this.prisma.publicStageThread.update({
        where: { id },
        data: {
          ...(input.thread_state !== undefined ? { threadState: input.thread_state } : {}),
          ...(input.active_route !== undefined
            ? {
                activeRouteJson: input.active_route === null
                  ? Prisma.DbNull
                  : toPrismaJsonValue(input.active_route),
              }
            : {}),
          updatedAt: new Date(),
        },
      })
      return this.toDomain(row)
    } catch (error) {
      if (isNotFoundError(error)) return null
      throw error
    }
  }

  async updateTimestamps(
    id: string,
    input: {
      created_at: Date
      updated_at?: Date
    },
  ): Promise<PublicStageThread | null> {
    try {
      const row = await this.prisma.publicStageThread.update({
        where: { id },
        data: {
          createdAt: input.created_at,
          ...(input.updated_at !== undefined ? { updatedAt: input.updated_at } : {}),
        },
      })
      return this.toDomain(row)
    } catch (error) {
      if (isNotFoundError(error)) return null
      throw error
    }
  }

  private toDomain(row: PrismaPublicStageThread): PublicStageThread {
    return {
      id: row.id,
      post_id: row.postId,
      community_id: row.communityId,
      author_actor_type: row.authorActorType === 'HUMAN' ? 'human' : 'agent',
      author_agent_id: row.authorAgentId,
      author_user_id: row.authorUserId,
      body: row.body,
      visibility: row.visibility,
      state: row.state,
      warm_start_batch_id: row.warmStartBatchId,
      generation_mode: row.generationMode as PublicStageThread['generation_mode'],
      thread_state: row.threadState,
      reply_budget: row.replyBudget,
      active_route: (row.activeRouteJson as PublicStageThread['active_route']) ?? null,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }
  }
}
