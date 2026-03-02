import { randomUUID } from 'node:crypto'
import { Prisma, type PrismaClient, type AgentCommunityMembership as PrismaAgentCommunityMembership } from '@prisma/client'
import type {
  AgentCommunityMembership,
  CreateAgentCommunityMembershipInput,
} from '../types.js'
import type { AgentCommunityMembershipRepository } from '../agent-community-membership-repository.js'

function pushIndex(index: Map<string, Set<string>>, key: string, id: string): void {
  const set = index.get(key) ?? new Set<string>()
  set.add(id)
  index.set(key, set)
}

function removeIndex(index: Map<string, Set<string>>, key: string, id: string): void {
  const set = index.get(key)
  if (!set) return
  set.delete(id)
  if (set.size === 0) {
    index.delete(key)
  }
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
}

export class PgAgentCommunityMembershipRepository implements AgentCommunityMembershipRepository {
  private readonly cache = new Map<string, AgentCommunityMembership>()
  private readonly activeByAgent = new Map<string, Set<string>>()
  private readonly activeByCommunity = new Map<string, Set<string>>()

  constructor(private readonly prisma: PrismaClient) {}

  async hydrate(): Promise<void> {
    const rows = await this.prisma.agentCommunityMembership.findMany({
      orderBy: [{ joinedAt: 'desc' }, { id: 'desc' }],
    })
    this.cache.clear()
    this.activeByAgent.clear()
    this.activeByCommunity.clear()

    for (const row of rows) {
      const membership = this.toDomain(row)
      this.cache.set(membership.id, membership)
      if (membership.left_at === null) {
        pushIndex(this.activeByAgent, membership.agent_id, membership.id)
        pushIndex(this.activeByCommunity, membership.community_id, membership.id)
      }
    }
  }

  async create(input: CreateAgentCommunityMembershipInput): Promise<AgentCommunityMembership> {
    const now = new Date()
    const row = await this.prisma.agentCommunityMembership.create({
      data: {
        id: randomUUID(),
        agentId: input.agent_id,
        communityId: input.community_id,
        role: input.role ?? 'RESIDENT',
        source: input.source ?? 'MANUAL',
        joinedAt: input.joined_at ?? now,
        leftAt: input.left_at ?? null,
        createdBy: input.created_by ?? null,
        createdAt: now,
        updatedAt: now,
      },
    })
    const membership = this.toDomain(row)
    this.putCache(membership)
    return membership
  }

  async upsertActive(input: CreateAgentCommunityMembershipInput): Promise<AgentCommunityMembership> {
    const now = new Date()
    const active = await this.prisma.agentCommunityMembership.findFirst({
      where: {
        agentId: input.agent_id,
        communityId: input.community_id,
        leftAt: null,
      },
      orderBy: [{ joinedAt: 'desc' }, { id: 'desc' }],
    })

    if (active) {
      const updated = await this.prisma.agentCommunityMembership.update({
        where: { id: active.id },
        data: {
          role: input.role ?? active.role,
          source: input.source ?? active.source,
          leftAt: null,
          createdBy: input.created_by ?? active.createdBy,
          updatedAt: now,
        },
      })
      const membership = this.toDomain(updated)
      this.putCache(membership)
      return membership
    }

    try {
      return await this.create(input)
    } catch (error) {
      if (!isUniqueViolation(error)) throw error

      const winner = await this.prisma.agentCommunityMembership.findFirst({
        where: {
          agentId: input.agent_id,
          communityId: input.community_id,
          leftAt: null,
        },
        orderBy: [{ joinedAt: 'desc' }, { id: 'desc' }],
      })
      if (!winner) throw error

      const updated = await this.prisma.agentCommunityMembership.update({
        where: { id: winner.id },
        data: {
          role: input.role ?? winner.role,
          source: input.source ?? winner.source,
          leftAt: null,
          createdBy: input.created_by ?? winner.createdBy,
          updatedAt: now,
        },
      })
      const membership = this.toDomain(updated)
      this.putCache(membership)
      return membership
    }
  }

  async leave(agentId: string, communityId: string, leftAt = new Date()): Promise<AgentCommunityMembership | null> {
    const active = await this.prisma.agentCommunityMembership.findFirst({
      where: {
        agentId,
        communityId,
        leftAt: null,
      },
      orderBy: [{ joinedAt: 'desc' }, { id: 'desc' }],
    })
    if (!active) return null

    const updated = await this.prisma.agentCommunityMembership.update({
      where: { id: active.id },
      data: {
        leftAt,
        updatedAt: leftAt,
      },
    })
    const membership = this.toDomain(updated)
    this.putCache(membership)
    return membership
  }

  findActiveByAgent(agentId: string): AgentCommunityMembership[] {
    const ids = this.activeByAgent.get(agentId)
    if (!ids || ids.size === 0) return []

    return Array.from(ids)
      .map((id) => this.cache.get(id))
      .filter((item): item is AgentCommunityMembership => Boolean(item))
      .sort((a, b) => b.joined_at.getTime() - a.joined_at.getTime())
  }

  findActiveByCommunity(communityId: string): AgentCommunityMembership[] {
    const ids = this.activeByCommunity.get(communityId)
    if (!ids || ids.size === 0) return []

    return Array.from(ids)
      .map((id) => this.cache.get(id))
      .filter((item): item is AgentCommunityMembership => Boolean(item))
      .sort((a, b) => b.joined_at.getTime() - a.joined_at.getTime())
  }

  listActiveCommunityIdsByAgent(agentId: string): string[] {
    return this.findActiveByAgent(agentId).map((item) => item.community_id)
  }

  listActiveAgentIdsByCommunity(communityId: string): string[] {
    return this.findActiveByCommunity(communityId).map((item) => item.agent_id)
  }

  countActiveByAgent(agentId: string): number {
    const ids = this.activeByAgent.get(agentId)
    return ids ? ids.size : 0
  }

  countActiveTotal(): number {
    let total = 0
    for (const ids of this.activeByAgent.values()) {
      total += ids.size
    }
    return total
  }

  private putCache(next: AgentCommunityMembership): void {
    const prev = this.cache.get(next.id)
    if (prev?.left_at === null) {
      removeIndex(this.activeByAgent, prev.agent_id, prev.id)
      removeIndex(this.activeByCommunity, prev.community_id, prev.id)
    }

    this.cache.set(next.id, next)
    if (next.left_at === null) {
      pushIndex(this.activeByAgent, next.agent_id, next.id)
      pushIndex(this.activeByCommunity, next.community_id, next.id)
    }
  }

  private toDomain(row: PrismaAgentCommunityMembership): AgentCommunityMembership {
    return {
      id: row.id,
      agent_id: row.agentId,
      community_id: row.communityId,
      role: row.role,
      source: row.source,
      joined_at: row.joinedAt,
      left_at: row.leftAt,
      created_by: row.createdBy,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }
  }
}
