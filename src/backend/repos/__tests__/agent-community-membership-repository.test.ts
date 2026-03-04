import { describe, expect, it } from 'vitest'
import { InMemoryAgentCommunityMembershipRepository } from '../agent-community-membership-repository.js'

describe('InMemoryAgentCommunityMembershipRepository', () => {
  it('upserts active membership and leaves membership', async () => {
    const repo = new InMemoryAgentCommunityMembershipRepository()

    await repo.upsertActive({
      agent_id: 'agent-1',
      community_id: 'comm-1',
      role: 'RESIDENT',
      source: 'MANUAL',
      created_by: 'user-1',
    })

    expect(repo.countActiveByAgent('agent-1')).toBe(1)
    expect(repo.listActiveCommunityIdsByAgent('agent-1')).toEqual(['comm-1'])

    await repo.upsertActive({
      agent_id: 'agent-1',
      community_id: 'comm-1',
      role: 'GUEST',
      source: 'DERIVED',
    })

    const active = repo.findActiveByAgent('agent-1')
    expect(active).toHaveLength(1)
    expect(active[0].role).toBe('GUEST')
    expect(active[0].source).toBe('DERIVED')

    await repo.leave('agent-1', 'comm-1')
    expect(repo.countActiveByAgent('agent-1')).toBe(0)
    expect(repo.listActiveAgentIdsByCommunity('comm-1')).toEqual([])
  })

  it('keeps non-ACTIVE status on upsertActive unless status is explicitly provided', async () => {
    const repo = new InMemoryAgentCommunityMembershipRepository()

    await repo.upsertActive({
      agent_id: 'agent-2',
      community_id: 'comm-2',
      role: 'RESIDENT',
      source: 'MANUAL',
    })
    await repo.updateStatus({
      agent_id: 'agent-2',
      community_id: 'comm-2',
      status: 'MUTED',
      reason: 'policy',
      set_by: 'admin-1',
    })

    await repo.upsertActive({
      agent_id: 'agent-2',
      community_id: 'comm-2',
      role: 'GUEST',
      source: 'MANUAL',
    })

    const current = repo.findCurrent('agent-2', 'comm-2')
    expect(current?.role).toBe('GUEST')
    expect(current?.status).toBe('MUTED')
    expect(repo.findActiveByAgent('agent-2')).toHaveLength(0)
    expect(repo.listCurrentAgentIdsByCommunity('comm-2')).toEqual(['agent-2'])

    await repo.leave('agent-2', 'comm-2')
    expect(repo.findCurrent('agent-2', 'comm-2')).toBeNull()
    expect(repo.listCurrentAgentIdsByCommunity('comm-2')).toEqual([])
  })
})
