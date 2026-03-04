import type {
  AgentCommunityMembership,
  AgentCommunityMembershipStatus,
  CreateAgentCommunityMembershipInput,
} from './types.js'

export interface AgentCommunityMembershipRepository {
  create(input: CreateAgentCommunityMembershipInput): Promise<AgentCommunityMembership>
  upsertActive(input: CreateAgentCommunityMembershipInput): Promise<AgentCommunityMembership>
  leave(agentId: string, communityId: string, leftAt?: Date): Promise<AgentCommunityMembership | null>
  updateStatus(input: {
    agent_id: string
    community_id: string
    status: AgentCommunityMembershipStatus
    reason?: string | null
    set_by?: string | null
    set_at?: Date
  }): Promise<AgentCommunityMembership | null>
  findCurrent(agentId: string, communityId: string): AgentCommunityMembership | null
  findCurrentByCommunity(communityId: string): AgentCommunityMembership[]
  findActiveByAgent(agentId: string): AgentCommunityMembership[]
  findActiveByCommunity(communityId: string): AgentCommunityMembership[]
  listActiveCommunityIdsByAgent(agentId: string): string[]
  listActiveAgentIdsByCommunity(communityId: string): string[]
  listCurrentAgentIdsByCommunity(communityId: string): string[]
  countActiveByAgent(agentId: string): number
  countActiveTotal(): number
}

let counter = 0
function cuid(): string {
  return `mem_${Date.now()}_${++counter}`
}

export class InMemoryAgentCommunityMembershipRepository implements AgentCommunityMembershipRepository {
  private readonly store = new Map<string, AgentCommunityMembership>()

  async create(input: CreateAgentCommunityMembershipInput): Promise<AgentCommunityMembership> {
    const now = new Date()
    const membership: AgentCommunityMembership = {
      id: cuid(),
      agent_id: input.agent_id,
      community_id: input.community_id,
      role: input.role ?? 'RESIDENT',
      source: input.source ?? 'MANUAL',
      status: input.status ?? 'ACTIVE',
      status_reason: input.status_reason ?? null,
      status_set_by: input.status_set_by ?? null,
      status_set_at: input.status_set_at ?? null,
      joined_at: input.joined_at ?? now,
      left_at: input.left_at ?? null,
      created_by: input.created_by ?? null,
      created_at: now,
      updated_at: now,
    }
    this.store.set(membership.id, membership)
    return membership
  }

  async upsertActive(input: CreateAgentCommunityMembershipInput): Promise<AgentCommunityMembership> {
    const existing = this.findCurrent(input.agent_id, input.community_id)
    if (!existing) {
      return this.create(input)
    }

    existing.role = input.role ?? existing.role
    existing.source = input.source ?? existing.source
    if (input.status !== undefined) {
      existing.status = input.status
      existing.status_reason = input.status_reason ?? null
      existing.status_set_by = input.status_set_by ?? null
      existing.status_set_at = input.status_set_at ?? new Date()
    }
    existing.left_at = null
    existing.updated_at = new Date()
    if (input.created_by !== undefined) {
      existing.created_by = input.created_by
    }
    return existing
  }

  async leave(agentId: string, communityId: string, leftAt = new Date()): Promise<AgentCommunityMembership | null> {
    const existing = this.findCurrent(agentId, communityId)
    if (!existing) return null
    existing.left_at = leftAt
    existing.updated_at = leftAt
    return existing
  }

  async updateStatus(input: {
    agent_id: string
    community_id: string
    status: AgentCommunityMembershipStatus
    reason?: string | null
    set_by?: string | null
    set_at?: Date
  }): Promise<AgentCommunityMembership | null> {
    const existing = this.findCurrent(input.agent_id, input.community_id)
    if (!existing) return null
    existing.status = input.status
    existing.status_reason = input.reason ?? null
    existing.status_set_by = input.set_by ?? null
    existing.status_set_at = input.set_at ?? new Date()
    existing.updated_at = new Date()
    return existing
  }

  findCurrent(agentId: string, communityId: string): AgentCommunityMembership | null {
    const memberships = Array.from(this.store.values())
      .filter((item) => item.agent_id === agentId && item.community_id === communityId && item.left_at === null)
      .sort((a, b) => b.joined_at.getTime() - a.joined_at.getTime())
    return memberships[0] ?? null
  }

  findCurrentByCommunity(communityId: string): AgentCommunityMembership[] {
    return Array.from(this.store.values())
      .filter((item) => item.community_id === communityId && item.left_at === null)
      .sort((a, b) => b.joined_at.getTime() - a.joined_at.getTime())
  }

  findActiveByAgent(agentId: string): AgentCommunityMembership[] {
    return Array.from(this.store.values())
      .filter((item) => item.agent_id === agentId && item.left_at === null && item.status === 'ACTIVE')
      .sort((a, b) => b.joined_at.getTime() - a.joined_at.getTime())
  }

  findActiveByCommunity(communityId: string): AgentCommunityMembership[] {
    return Array.from(this.store.values())
      .filter((item) => item.community_id === communityId && item.left_at === null && item.status === 'ACTIVE')
      .sort((a, b) => b.joined_at.getTime() - a.joined_at.getTime())
  }

  listActiveCommunityIdsByAgent(agentId: string): string[] {
    return this.findActiveByAgent(agentId).map((item) => item.community_id)
  }

  listActiveAgentIdsByCommunity(communityId: string): string[] {
    return this.findActiveByCommunity(communityId).map((item) => item.agent_id)
  }

  listCurrentAgentIdsByCommunity(communityId: string): string[] {
    return Array.from(new Set(this.findCurrentByCommunity(communityId).map((item) => item.agent_id)))
  }

  countActiveByAgent(agentId: string): number {
    return this.findActiveByAgent(agentId).length
  }

  countActiveTotal(): number {
    let total = 0
    for (const membership of this.store.values()) {
      if (membership.left_at === null && membership.status === 'ACTIVE') total += 1
    }
    return total
  }
}
