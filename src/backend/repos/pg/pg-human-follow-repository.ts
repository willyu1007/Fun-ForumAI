import { randomUUID } from 'node:crypto'
import type { 
  HumanAgentFollow as PrismaHumanAgentFollow, 
  HumanCommunityFollow as PrismaHumanCommunityFollow,
  HumanThreadFollow as PrismaHumanThreadFollow,
  PrismaClient 
} from '@prisma/client'
import type { 
  FollowAgentInput, 
  HumanAgentFollow,
  FollowCommunityInput,
  HumanCommunityFollow,
  FollowThreadInput,
  HumanThreadFollow
} from '../types.js'
import type { HumanFollowRepository } from '../human-follow-repository.js'

export class PgHumanFollowRepository implements HumanFollowRepository {
  // Agent
  private cache = new Map<string, HumanAgentFollow>()
  private byUserAndAgent = new Map<string, string>()

  // Community
  private communityCache = new Map<string, HumanCommunityFollow>()
  private byUserAndCommunity = new Map<string, string>()

  // Thread
  private threadCache = new Map<string, HumanThreadFollow>()
  private byUserAndThread = new Map<string, string>()

  constructor(private readonly prisma: PrismaClient) {}

  async hydrate(): Promise<void> {
    const [agentRows, communityRows, threadRows] = await Promise.all([
      this.prisma.humanAgentFollow.findMany(),
      this.prisma.humanCommunityFollow.findMany(),
      this.prisma.humanThreadFollow.findMany(),
    ])

    for (const row of agentRows) {
      const follow = this.toAgentDomain(row)
      this.cache.set(follow.id, follow)
      this.byUserAndAgent.set(this.compositeKey(follow.user_id, follow.agent_id), follow.id)
    }

    for (const row of communityRows) {
      const follow = this.toCommunityDomain(row)
      this.communityCache.set(follow.id, follow)
      this.byUserAndCommunity.set(this.compositeKey(follow.user_id, follow.community_id), follow.id)
    }

    for (const row of threadRows) {
      const follow = this.toThreadDomain(row)
      this.threadCache.set(follow.id, follow)
      this.byUserAndThread.set(this.compositeKey(follow.user_id, follow.thread_id), follow.id)
    }
  }

  // --- Agent ---
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
          const follow = this.toAgentDomain(existing)
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

    await this.prisma.humanAgentFollow.deleteMany({ where: { id: existingId } })

    return true
  }

  async removeAllByAgent(agentId: string): Promise<number> {
    const follows = Array.from(this.cache.values()).filter((follow) => follow.agent_id === agentId)

    for (const follow of follows) {
      this.cache.delete(follow.id)
      this.byUserAndAgent.delete(this.compositeKey(follow.user_id, follow.agent_id))
    }

    const result = await this.prisma.humanAgentFollow.deleteMany({
      where: { agentId },
    })

    return Math.max(result.count, follows.length)
  }

  isFollowing(userId: string, agentId: string): boolean {
    return this.byUserAndAgent.has(this.compositeKey(userId, agentId))
  }

  findFollow(userId: string, agentId: string): HumanAgentFollow | null {
    const followId = this.byUserAndAgent.get(this.compositeKey(userId, agentId))
    return followId ? this.cache.get(followId) ?? null : null
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

  // --- Community ---
  async followCommunity(input: FollowCommunityInput): Promise<HumanCommunityFollow> {
    const key = this.compositeKey(input.user_id, input.community_id)
    const existingId = this.byUserAndCommunity.get(key)

    if (existingId) {
      return this.communityCache.get(existingId)!
    }

    const id = randomUUID()
    const now = new Date()

    try {
      await this.prisma.humanCommunityFollow.create({
        data: {
          id,
          userId: input.user_id,
          communityId: input.community_id,
          createdAt: now,
        },
      })
    } catch (err: unknown) {
      const prismaErr = err as { code?: string }
      if (prismaErr.code === 'P2002') {
        const existing = await this.prisma.humanCommunityFollow.findFirst({
          where: { userId: input.user_id, communityId: input.community_id },
        })
        if (existing) {
          const follow = this.toCommunityDomain(existing)
          this.communityCache.set(follow.id, follow)
          this.byUserAndCommunity.set(key, follow.id)
          return follow
        }
      }
      throw err
    }

    const follow: HumanCommunityFollow = {
      id,
      user_id: input.user_id,
      community_id: input.community_id,
      created_at: now,
    }

    this.communityCache.set(id, follow)
    this.byUserAndCommunity.set(key, id)
    return follow
  }

  async unfollowCommunity(userId: string, communityId: string): Promise<boolean> {
    const key = this.compositeKey(userId, communityId)
    const existingId = this.byUserAndCommunity.get(key)
    if (!existingId) return false

    this.byUserAndCommunity.delete(key)
    this.communityCache.delete(existingId)

    await this.prisma.humanCommunityFollow.deleteMany({ where: { id: existingId } })

    return true
  }

  isFollowingCommunity(userId: string, communityId: string): boolean {
    return this.byUserAndCommunity.has(this.compositeKey(userId, communityId))
  }

  listFollowingCommunityIds(userId: string): string[] {
    return Array.from(this.communityCache.values())
      .filter((item) => item.user_id === userId)
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
      .map((item) => item.community_id)
  }

  // --- Thread ---
  async followThread(input: FollowThreadInput): Promise<HumanThreadFollow> {
    const key = this.compositeKey(input.user_id, input.thread_id)
    const existingId = this.byUserAndThread.get(key)

    if (existingId) {
      return this.threadCache.get(existingId)!
    }

    const id = randomUUID()
    const now = new Date()

    try {
      await this.prisma.humanThreadFollow.create({
        data: {
          id,
          userId: input.user_id,
          threadId: input.thread_id,
          createdAt: now,
        },
      })
    } catch (err: unknown) {
      const prismaErr = err as { code?: string }
      if (prismaErr.code === 'P2002') {
        const existing = await this.prisma.humanThreadFollow.findFirst({
          where: { userId: input.user_id, threadId: input.thread_id },
        })
        if (existing) {
          const follow = this.toThreadDomain(existing)
          this.threadCache.set(follow.id, follow)
          this.byUserAndThread.set(key, follow.id)
          return follow
        }
      }
      throw err
    }

    const follow: HumanThreadFollow = {
      id,
      user_id: input.user_id,
      thread_id: input.thread_id,
      created_at: now,
    }

    this.threadCache.set(id, follow)
    this.byUserAndThread.set(key, id)
    return follow
  }

  async unfollowThread(userId: string, threadId: string): Promise<boolean> {
    const key = this.compositeKey(userId, threadId)
    const existingId = this.byUserAndThread.get(key)
    if (!existingId) return false

    this.byUserAndThread.delete(key)
    this.threadCache.delete(existingId)

    await this.prisma.humanThreadFollow.deleteMany({ where: { id: existingId } })

    return true
  }

  isFollowingThread(userId: string, threadId: string): boolean {
    return this.byUserAndThread.has(this.compositeKey(userId, threadId))
  }

  listFollowingThreadIds(userId: string): string[] {
    return Array.from(this.threadCache.values())
      .filter((item) => item.user_id === userId)
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
      .map((item) => item.thread_id)
  }

  private compositeKey(userId: string, targetId: string): string {
    return `${userId}:${targetId}`
  }

  private toAgentDomain(row: PrismaHumanAgentFollow): HumanAgentFollow {
    return {
      id: row.id,
      user_id: row.userId,
      agent_id: row.agentId,
      created_at: row.createdAt,
    }
  }

  private toCommunityDomain(row: PrismaHumanCommunityFollow): HumanCommunityFollow {
    return {
      id: row.id,
      user_id: row.userId,
      community_id: row.communityId,
      created_at: row.createdAt,
    }
  }

  private toThreadDomain(row: PrismaHumanThreadFollow): HumanThreadFollow {
    return {
      id: row.id,
      user_id: row.userId,
      thread_id: row.threadId,
      created_at: row.createdAt,
    }
  }
}
