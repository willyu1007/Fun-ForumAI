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

  create(input: CreateAgentCommunityMembershipInput): AgentCommunityMembership {
    const now = new Date()
    const membership: AgentCommunityMembership = {
      id: randomUUID(),
      agent_id: input.agent_id,
      community_id: input.community_id,
      role: input.role ?? 'RESIDENT',
      source: input.source ?? 'MANUAL',
      joined_at: input.joined_at ?? now,
      left_at: input.left_at ?? null,
      created_by: input.created_by ?? null,
      created_at: now,
      updated_at: now,
    }

    this.cache.set(membership.id, membership)
    if (membership.left_at === null) {
      pushIndex(this.activeByAgent, membership.agent_id, membership.id)
      pushIndex(this.activeByCommunity, membership.community_id, membership.id)
    }

    this.prisma.agentCommunityMembership
      .create({
        data: {
          id: membership.id,
          agentId: membership.agent_id,
          communityId: membership.community_id,
          role: membership.role,
          source: membership.source,
          joinedAt: membership.joined_at,
          leftAt: membership.left_at,
          createdBy: membership.created_by,
          createdAt: membership.created_at,
          updatedAt: membership.updated_at,
        },
      })
      .catch((err) => {
        if (isUniqueViolation(err)) {
          const active = this.findActiveByAgent(membership.agent_id).find((item) => item.community_id === membership.community_id)
          if (active) {
            this.prisma.agentCommunityMembership
              .update({
                where: { id: active.id },
                data: {
                  role: membership.role,
                  source: membership.source,
                  leftAt: null,
                  updatedAt: new Date(),
                  createdBy: membership.created_by,
                },
              })
              .catch((updateErr) => console.error('[PgAgentCommunityMembershipRepo] create->update error:', updateErr))
            return
          }
        }
        console.error('[PgAgentCommunityMembershipRepo] create error:', err)
      })

    return membership
  }

  upsertActive(input: CreateAgentCommunityMembershipInput): AgentCommunityMembership {
    const existing = this.findActiveByAgent(input.agent_id).find((item) => item.community_id === input.community_id)
    if (!existing) {
      return this.create(input)
    }

    existing.role = input.role ?? existing.role
    existing.source = input.source ?? existing.source
    existing.left_at = null
    if (input.created_by !== undefined) {
      existing.created_by = input.created_by
    }
    existing.updated_at = new Date()

    this.prisma.agentCommunityMembership
      .update({
        where: { id: existing.id },
        data: {
          role: existing.role,
          source: existing.source,
          leftAt: null,
          createdBy: existing.created_by,
          updatedAt: existing.updated_at,
        },
      })
      .catch((err) => console.error('[PgAgentCommunityMembershipRepo] upsertActive error:', err))

    return existing
  }

  leave(agentId: string, communityId: string, leftAt = new Date()): AgentCommunityMembership | null {
    const existing = this.findActiveByAgent(agentId).find((item) => item.community_id === communityId)
    if (!existing) return null

    existing.left_at = leftAt
    existing.updated_at = leftAt
    removeIndex(this.activeByAgent, existing.agent_id, existing.id)
    removeIndex(this.activeByCommunity, existing.community_id, existing.id)

    this.prisma.agentCommunityMembership
      .update({
        where: { id: existing.id },
        data: {
          leftAt,
          updatedAt: leftAt,
        },
      })
      .catch((err) => console.error('[PgAgentCommunityMembershipRepo] leave error:', err))

    return existing
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
