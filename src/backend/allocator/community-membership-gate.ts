import type {
  AgentCommunityMembership,
  AgentCommunityMembershipRepository,
} from '../repos/index.js'

export function buildCommunityMembershipSnapshot(input: {
  memberships_enabled: boolean
  membership_status_enabled: boolean
  community_id: string
  membership_repo: AgentCommunityMembershipRepository
}): {
  explicit_member_ids: Set<string> | null
  membership_by_agent: Map<string, AgentCommunityMembership>
} {
  if (!input.memberships_enabled && !input.membership_status_enabled) {
    return {
      explicit_member_ids: null,
      membership_by_agent: new Map(),
    }
  }

  const currentMemberships = input.membership_repo.findCurrentByCommunity(input.community_id)
  const membershipByAgent = new Map<string, AgentCommunityMembership>()
  for (const row of currentMemberships) {
    if (!membershipByAgent.has(row.agent_id)) {
      membershipByAgent.set(row.agent_id, row)
    }
  }

  return {
    explicit_member_ids: input.memberships_enabled ? new Set(membershipByAgent.keys()) : null,
    membership_by_agent: membershipByAgent,
  }
}

export function passesMembershipGate(input: {
  agent_id: string
  explicit_member_ids: Set<string> | null
  membership_status_enabled: boolean
  membership: AgentCommunityMembership | null
}): boolean {
  if (input.explicit_member_ids && !input.explicit_member_ids.has(input.agent_id)) {
    return false
  }

  if (!input.membership_status_enabled) {
    return true
  }

  return Boolean(input.membership && input.membership.status === 'ACTIVE')
}
