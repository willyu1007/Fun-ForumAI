import { randomUUID } from 'node:crypto'
import type { HumanAgentFollow as PrismaHumanAgentFollow, PrismaClient } from '@prisma/client'
import type { FollowAgentInput, HumanAgentFollow, PaginationOpts, PaginatedResult } from '../types.js'
import type { HumanFollowRepository } from '../human-follow-repository.js'

function paginate<T extends { id: string }>(items: T[], opts: PaginationOpts): PaginatedResult<T> {
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

export class PgHumanFollowRepository implements HumanFollowRepository {
  private cache = new Map<string, HumanAgentFollow>()
  private byUserAndAgent = new Map<string, string>()

  constructor(private readonly prisma: PrismaClient) {}

  async hydrate(): Promise<void> {
    const rows = await this.prisma.humanAgentFollow.findMany()
    for (const row of rows) {
      const follow = this.toDomain(row)
      this.cache.set(follow.id, follow)
      this.byUserAndAgent.set(this.compositeKey(follow.user_id, follow.agent_id), follow.id)
    }
  }

  async follow(input: FollowAgentInput): Promise<HumanAgentFollow> {
    const key = this.compositeKey(input.user_id, input.agent_id)
    const existingId = this.byUserAndAgent.get(key)

    if (existingId) {
      return this.cache.get(existingId)!
    }

    const id = randomUUID()
    const now = new Date()

    try {
      await this.prisma.humanAgentFollow.create({
        data: {
          id,
          userId: input.user_id,
          agentId: input.agent_id,
          createdAt: now,
        },
      })
    } catch (err: unknown) {
      const prismaErr = err as { code?: string }
      if (prismaErr.code === 'P2002') {
        const existing = await this.prisma.humanAgentFollow.findFirst({
          where: { userId: input.user_id, agentId: input.agent_id },
        })
        if (existing) {
          const follow = this.toDomain(existing)
          this.cache.set(follow.id, follow)
          this.byUserAndAgent.set(key, follow.id)
          return follow
        }
      }
      throw err
    }

    const follow: HumanAgentFollow = {
      id,
      user_id: input.user_id,
      agent_id: input.agent_id,
      created_at: now,
    }

    this.cache.set(id, follow)
    this.byUserAndAgent.set(key, id)
    return follow
  }

  async unfollow(userId: string, agentId: string): Promise<boolean> {
    const key = this.compositeKey(userId, agentId)
    const existingId = this.byUserAndAgent.get(key)
    if (!existingId) return false

    this.byUserAndAgent.delete(key)
    this.cache.delete(existingId)

    await this.prisma.humanAgentFollow
      .delete({ where: { id: existingId } })
      .catch(() => { /* already deleted */ })

    return true
  }

  isFollowing(userId: string, agentId: string): boolean {
    return this.byUserAndAgent.has(this.compositeKey(userId, agentId))
  }

  listFollowingAgentIds(userId: string): string[] {
    return Array.from(this.cache.values())
      .filter((item) => item.user_id === userId)
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
      .map((item) => item.agent_id)
  }

  listFollowerUserIds(agentId: string): string[] {
    return Array.from(this.cache.values())
      .filter((item) => item.agent_id === agentId)
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
      .map((item) => item.user_id)
  }

  listByUser(userId: string, opts: PaginationOpts): PaginatedResult<HumanAgentFollow> {
    const rows = Array.from(this.cache.values())
      .filter((item) => item.user_id === userId)
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())

    return paginate(rows, opts)
  }

  private compositeKey(userId: string, agentId: string): string {
    return `${userId}:${agentId}`
  }

  private toDomain(row: PrismaHumanAgentFollow): HumanAgentFollow {
    return {
      id: row.id,
      user_id: row.userId,
      agent_id: row.agentId,
      created_at: row.createdAt,
    }
  }
}
