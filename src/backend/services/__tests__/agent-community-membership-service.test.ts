import { describe, expect, it } from 'vitest'
import { InMemoryAgentCommunityMembershipRepository } from '../../repos/agent-community-membership-repository.js'
import { InMemoryAgentRepository } from '../../repos/agent-repository.js'
import { InMemoryPostRepository } from '../../repos/post-repository.js'
import { InMemoryCommentRepository } from '../../repos/comment-repository.js'
import { AgentCommunityMembershipService } from '../agent-community-membership-service.js'

describe('AgentCommunityMembershipService', () => {
  it('patches add/remove memberships', async () => {
    const membershipRepo = new InMemoryAgentCommunityMembershipRepository()
    const agentRepo = new InMemoryAgentRepository()
    const postRepo = new InMemoryPostRepository()
    const commentRepo = new InMemoryCommentRepository()

    const agent = agentRepo.create({ owner_id: 'owner-1', display_name: 'Agent One' })

    const service = new AgentCommunityMembershipService({
      membershipRepo,
      agentRepo,
      postRepo,
      commentRepo,
    })

    const first = service.patchMemberships({
      agent_id: agent.id,
      add: ['comm-a', 'comm-b'],
      remove: [],
      role: 'resident',
      actor_user_id: 'owner-1',
    })

    expect(first.updated.added.sort()).toEqual(['comm-a', 'comm-b'])
    expect(first.active_memberships).toHaveLength(2)

    const second = service.patchMemberships({
      agent_id: agent.id,
      add: [],
      remove: ['comm-a'],
      role: 'guest',
      actor_user_id: 'owner-1',
    })

    expect(second.updated.removed).toEqual(['comm-a'])
    expect(second.active_memberships.map((item) => item.community_id)).toEqual(['comm-b'])
    expect(service.listActive(agent.id)).toHaveLength(1)
  })

  it('backfills derived memberships from 30-day activity', async () => {
    const membershipRepo = new InMemoryAgentCommunityMembershipRepository()
    const agentRepo = new InMemoryAgentRepository()
    const postRepo = new InMemoryPostRepository()
    const commentRepo = new InMemoryCommentRepository()

    const agent = agentRepo.create({ owner_id: 'owner-1', display_name: 'Agent Backfill' })
    const helper = agentRepo.create({ owner_id: 'owner-1', display_name: 'Helper' })

    const post1 = await postRepo.create({
      community_id: 'comm-hot',
      author_agent_id: agent.id,
      title: 'p1',
      body: 'b1',
      visibility: 'PUBLIC',
      state: 'APPROVED',
    })
    const post2 = await postRepo.create({
      community_id: 'comm-hot',
      author_agent_id: agent.id,
      title: 'p2',
      body: 'b2',
      visibility: 'PUBLIC',
      state: 'APPROVED',
    })

    for (let i = 0; i < 6; i += 1) {
      await commentRepo.create({
        post_id: i % 2 === 0 ? post1.id : post2.id,
        author_agent_id: helper.id,
        body: `c-${i}`,
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })
    }

    const service = new AgentCommunityMembershipService({
      membershipRepo,
      agentRepo,
      postRepo,
      commentRepo,
    })

    const result = await service.runDerivedBackfill()
    expect(result.upserted_memberships).toBeGreaterThanOrEqual(2)

    const agentMemberships = membershipRepo.listActiveCommunityIdsByAgent(agent.id)
    expect(agentMemberships).toContain('comm-hot')

    const helperMemberships = membershipRepo.listActiveCommunityIdsByAgent(helper.id)
    expect(helperMemberships).toContain('comm-hot')
  })
})
