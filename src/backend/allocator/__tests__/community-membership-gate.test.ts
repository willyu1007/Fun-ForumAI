import { describe, expect, it, vi } from 'vitest'
import type { AgentCommunityMembershipRepository } from '../../repos/index.js'
import {
  buildCommunityMembershipSnapshot,
  passesMembershipGate,
} from '../community-membership-gate.js'

function makeMembershipRepoStub(): AgentCommunityMembershipRepository {
  const noopAsync = async () => {
    throw new Error('not implemented in test stub')
  }
  return {
    create: noopAsync,
    upsertActive: noopAsync,
    leave: noopAsync,
    updateStatus: noopAsync,
    findCurrent: () => null,
    findCurrentByCommunity: () => [],
    findActiveByAgent: () => [],
    findActiveByCommunity: () => [],
    listActiveCommunityIdsByAgent: () => [],
    listActiveAgentIdsByCommunity: () => [],
    listCurrentAgentIdsByCommunity: () => [],
    countActiveByAgent: () => 0,
    countActiveTotal: () => 0,
  }
}

describe('community membership gate', () => {
  it('builds explicit ids and membership map from current memberships in one query', () => {
    const repo = makeMembershipRepoStub()
    const currentSpy = vi.spyOn(repo, 'findCurrentByCommunity').mockReturnValue([
      {
        id: 'm1',
        agent_id: 'agent-1',
        community_id: 'c1',
        role: 'RESIDENT',
        source: 'MANUAL',
        status: 'ACTIVE',
        status_reason: null,
        status_set_by: null,
        status_set_at: null,
        joined_at: new Date(),
        left_at: null,
        created_by: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 'm2',
        agent_id: 'agent-2',
        community_id: 'c1',
        role: 'RESIDENT',
        source: 'MANUAL',
        status: 'MUTED',
        status_reason: 'policy',
        status_set_by: 'admin',
        status_set_at: new Date(),
        joined_at: new Date(),
        left_at: null,
        created_by: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ])
    const listCurrentIdsSpy = vi.spyOn(repo, 'listCurrentAgentIdsByCommunity')

    const snapshot = buildCommunityMembershipSnapshot({
      memberships_enabled: true,
      membership_status_enabled: true,
      community_id: 'c-1',
      membership_repo: repo,
    })

    expect(Array.from(snapshot.explicit_member_ids ?? [])).toEqual(['agent-1', 'agent-2'])
    expect(snapshot.membership_by_agent.get('agent-2')?.status).toBe('MUTED')
    expect(currentSpy).toHaveBeenCalledTimes(1)
    expect(listCurrentIdsSpy).not.toHaveBeenCalled()
  })

  it('does not implicitly filter MUTED/BANNED when membershipStatus gate is disabled', () => {
    const mutedAllowed = passesMembershipGate({
      agent_id: 'agent-1',
      explicit_member_ids: new Set(['agent-1']),
      membership_status_enabled: false,
      membership: {
        id: 'm1',
        agent_id: 'agent-1',
        community_id: 'c1',
        role: 'RESIDENT',
        source: 'MANUAL',
        status: 'MUTED',
        status_reason: 'test',
        status_set_by: 'admin',
        status_set_at: new Date(),
        joined_at: new Date(),
        left_at: null,
        created_by: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
    })

    expect(mutedAllowed).toBe(true)
  })

  it('enforces ACTIVE status only when membershipStatus gate is enabled', () => {
    const mutedBlocked = passesMembershipGate({
      agent_id: 'agent-1',
      explicit_member_ids: new Set(['agent-1']),
      membership_status_enabled: true,
      membership: {
        id: 'm1',
        agent_id: 'agent-1',
        community_id: 'c1',
        role: 'RESIDENT',
        source: 'MANUAL',
        status: 'MUTED',
        status_reason: 'test',
        status_set_by: 'admin',
        status_set_at: new Date(),
        joined_at: new Date(),
        left_at: null,
        created_by: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
    })

    const activeAllowed = passesMembershipGate({
      agent_id: 'agent-2',
      explicit_member_ids: new Set(['agent-2']),
      membership_status_enabled: true,
      membership: {
        id: 'm2',
        agent_id: 'agent-2',
        community_id: 'c1',
        role: 'RESIDENT',
        source: 'MANUAL',
        status: 'ACTIVE',
        status_reason: null,
        status_set_by: null,
        status_set_at: null,
        joined_at: new Date(),
        left_at: null,
        created_by: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
    })

    expect(mutedBlocked).toBe(false)
    expect(activeAllowed).toBe(true)
  })

  it('blocks BANNED agent when membershipStatus gate is enabled', () => {
    const bannedBlocked = passesMembershipGate({
      agent_id: 'agent-banned',
      explicit_member_ids: new Set(['agent-banned']),
      membership_status_enabled: true,
      membership: {
        id: 'm3',
        agent_id: 'agent-banned',
        community_id: 'c1',
        role: 'RESIDENT',
        source: 'MANUAL',
        status: 'BANNED',
        status_reason: 'violation',
        status_set_by: 'admin',
        status_set_at: new Date(),
        joined_at: new Date(),
        left_at: null,
        created_by: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
    })

    expect(bannedBlocked).toBe(false)
  })

  it('returns null explicit_member_ids and empty map when both flags are off', () => {
    const repo = makeMembershipRepoStub()
    const findSpy = vi.spyOn(repo, 'findCurrentByCommunity')

    const snapshot = buildCommunityMembershipSnapshot({
      memberships_enabled: false,
      membership_status_enabled: false,
      community_id: 'c-1',
      membership_repo: repo,
    })

    expect(snapshot.explicit_member_ids).toBeNull()
    expect(snapshot.membership_by_agent.size).toBe(0)
    expect(findSpy).not.toHaveBeenCalled()
  })

  it('allows any agent when explicit_member_ids is null (memberships disabled)', () => {
    const allowed = passesMembershipGate({
      agent_id: 'random-agent',
      explicit_member_ids: null,
      membership_status_enabled: false,
      membership: null,
    })

    expect(allowed).toBe(true)
  })
})
