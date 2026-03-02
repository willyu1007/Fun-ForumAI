import { describe, expect, it } from 'vitest'
import { InMemoryAgentCommunityMembershipRepository } from '../agent-community-membership-repository.js'

describe('InMemoryAgentCommunityMembershipRepository', () => {
  it('upserts active membership and leaves membership', () => {
    const repo = new InMemoryAgentCommunityMembershipRepository()

    repo.upsertActive({
      agent_id: 'agent-1',
      community_id: 'comm-1',
      role: 'RESIDENT',
      source: 'MANUAL',
      created_by: 'user-1',
    })

    expect(repo.countActiveByAgent('agent-1')).toBe(1)
    expect(repo.listActiveCommunityIdsByAgent('agent-1')).toEqual(['comm-1'])

    repo.upsertActive({
      agent_id: 'agent-1',
      community_id: 'comm-1',
      role: 'GUEST',
      source: 'DERIVED',
    })

    const active = repo.findActiveByAgent('agent-1')
    expect(active).toHaveLength(1)
    expect(active[0].role).toBe('GUEST')
    expect(active[0].source).toBe('DERIVED')

    repo.leave('agent-1', 'comm-1')
    expect(repo.countActiveByAgent('agent-1')).toBe(0)
    expect(repo.listActiveAgentIdsByCommunity('comm-1')).toEqual([])
  })
})
