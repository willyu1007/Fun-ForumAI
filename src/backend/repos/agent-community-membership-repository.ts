import type {
  AgentCommunityMembership,
  CreateAgentCommunityMembershipInput,
} from './types.js'

export interface AgentCommunityMembershipRepository {
  create(input: CreateAgentCommunityMembershipInput): AgentCommunityMembership
  upsertActive(input: CreateAgentCommunityMembershipInput): AgentCommunityMembership
  leave(agentId: string, communityId: string, leftAt?: Date): AgentCommunityMembership | null
  findActiveByAgent(agentId: string): AgentCommunityMembership[]
  findActiveByCommunity(communityId: string): AgentCommunityMembership[]
  listActiveCommunityIdsByAgent(agentId: string): string[]
  listActiveAgentIdsByCommunity(communityId: string): string[]
  countActiveByAgent(agentId: string): number
  countActiveTotal(): number
}

let counter = 0
function cuid(): string {
  return `mem_${Date.now()}_${++counter}`
}

export class InMemoryAgentCommunityMembershipRepository implements AgentCommunityMembershipRepository {
  private readonly store = new Map<string, AgentCommunityMembership>()

  create(input: CreateAgentCommunityMembershipInput): AgentCommunityMembership {
    const now = new Date()
    const membership: AgentCommunityMembership = {
      id: cuid(),
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
    this.store.set(membership.id, membership)
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
    existing.updated_at = new Date()
    if (input.created_by !== undefined) {
      existing.created_by = input.created_by
    }
    return existing
  }

  leave(agentId: string, communityId: string, leftAt = new Date()): AgentCommunityMembership | null {
    const existing = this.findActiveByAgent(agentId).find((item) => item.community_id === communityId)
    if (!existing) return null
    existing.left_at = leftAt
    existing.updated_at = leftAt
    return existing
  }

  findActiveByAgent(agentId: string): AgentCommunityMembership[] {
    return Array.from(this.store.values())
      .filter((item) => item.agent_id === agentId && item.left_at === null)
      .sort((a, b) => b.joined_at.getTime() - a.joined_at.getTime())
  }

  findActiveByCommunity(communityId: string): AgentCommunityMembership[] {
    return Array.from(this.store.values())
      .filter((item) => item.community_id === communityId && item.left_at === null)
      .sort((a, b) => b.joined_at.getTime() - a.joined_at.getTime())
  }

  listActiveCommunityIdsByAgent(agentId: string): string[] {
    return this.findActiveByAgent(agentId).map((item) => item.community_id)
  }

  listActiveAgentIdsByCommunity(communityId: string): string[] {
    return this.findActiveByCommunity(communityId).map((item) => item.agent_id)
  }

  countActiveByAgent(agentId: string): number {
    return this.findActiveByAgent(agentId).length
  }

  countActiveTotal(): number {
    let total = 0
    for (const membership of this.store.values()) {
      if (membership.left_at === null) total += 1
    }
    return total
  }
}
