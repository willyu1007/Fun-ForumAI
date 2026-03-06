import { describe, expect, it } from 'vitest'
import { InMemoryAgentCommunityMembershipRepository } from '../../repos/agent-community-membership-repository.js'
import { InMemoryAgentRepository } from '../../repos/agent-repository.js'
import { InMemoryCommunityRepository } from '../../repos/community-repository.js'
import { InMemoryPostRepository } from '../../repos/post-repository.js'
import { InMemoryCommentRepository } from '../../repos/comment-repository.js'
import { InMemoryEventRepository } from '../../repos/event-repository.js'
import { AgentCommunityMembershipService } from '../agent-community-membership-service.js'

describe('AgentCommunityMembershipService', () => {
  it('patches add/remove memberships', async () => {
    const membershipRepo = new InMemoryAgentCommunityMembershipRepository()
    const agentRepo = new InMemoryAgentRepository()
    const communityRepo = new InMemoryCommunityRepository()
    const postRepo = new InMemoryPostRepository()
    const commentRepo = new InMemoryCommentRepository()

    const agent = agentRepo.create({ owner_id: 'owner-1', display_name: 'Agent One' })
    const commA = communityRepo.create({ name: 'A', slug: 'a' })
    const commB = communityRepo.create({ name: 'B', slug: 'b' })

    const service = new AgentCommunityMembershipService({
      membershipRepo,
      agentRepo,
      communityRepo,
      postRepo,
      commentRepo,
      eventRepo: new InMemoryEventRepository(),
    })

    const first = await service.patchMemberships({
      agent_id: agent.id,
      add: [commA.id, commB.id],
      remove: [],
      role: 'resident',
      actor_user_id: 'owner-1',
    })

    expect(first.updated.added.sort()).toEqual([commA.id, commB.id])
    expect(first.active_memberships).toHaveLength(2)

    const second = await service.patchMemberships({
      agent_id: agent.id,
      add: [],
      remove: [commA.id],
      role: 'guest',
      actor_user_id: 'owner-1',
    })

    expect(second.updated.removed).toEqual([commA.id])
    expect(second.active_memberships.map((item) => item.community_id)).toEqual([commB.id])
    expect(service.listActive(agent.id)).toHaveLength(1)
  })

  it('backfills derived memberships from 30-day activity', async () => {
    const membershipRepo = new InMemoryAgentCommunityMembershipRepository()
    const agentRepo = new InMemoryAgentRepository()
    const communityRepo = new InMemoryCommunityRepository()
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
      communityRepo,
      postRepo,
      commentRepo,
      eventRepo: new InMemoryEventRepository(),
    })

    const result = await service.runDerivedBackfill()
    expect(result.upserted_memberships).toBeGreaterThanOrEqual(2)

    const agentMemberships = membershipRepo.listActiveCommunityIdsByAgent(agent.id)
    expect(agentMemberships).toContain('comm-hot')

    const helperMemberships = membershipRepo.listActiveCommunityIdsByAgent(helper.id)
    expect(helperMemberships).toContain('comm-hot')
  })

  it('rejects unknown community ids', async () => {
    const membershipRepo = new InMemoryAgentCommunityMembershipRepository()
    const agentRepo = new InMemoryAgentRepository()
    const communityRepo = new InMemoryCommunityRepository()
    const postRepo = new InMemoryPostRepository()
    const commentRepo = new InMemoryCommentRepository()

    const agent = agentRepo.create({ owner_id: 'owner-1', display_name: 'Agent One' })

    const service = new AgentCommunityMembershipService({
      membershipRepo,
      agentRepo,
      communityRepo,
      postRepo,
      commentRepo,
      eventRepo: new InMemoryEventRepository(),
    })

    await expect(service.patchMemberships({
      agent_id: agent.id,
      add: ['unknown-community'],
      remove: [],
      actor_user_id: 'owner-1',
    })).rejects.toMatchObject({
      code: 'NOT_FOUND',
      statusCode: 404,
    })
  })

  it('does not allow recovering MUTED/BANNED memberships via patch add', async () => {
    const membershipRepo = new InMemoryAgentCommunityMembershipRepository()
    const agentRepo = new InMemoryAgentRepository()
    const communityRepo = new InMemoryCommunityRepository()
    const postRepo = new InMemoryPostRepository()
    const commentRepo = new InMemoryCommentRepository()

    const agent = agentRepo.create({ owner_id: 'owner-1', display_name: 'Agent One' })
    const community = communityRepo.create({ name: 'Muted Community', slug: 'muted-community' })

    await membershipRepo.upsertActive({
      agent_id: agent.id,
      community_id: community.id,
      role: 'RESIDENT',
      source: 'MANUAL',
    })
    await membershipRepo.updateStatus({
      agent_id: agent.id,
      community_id: community.id,
      status: 'MUTED',
      reason: 'governance',
      set_by: 'admin-1',
    })

    const service = new AgentCommunityMembershipService({
      membershipRepo,
      agentRepo,
      communityRepo,
      postRepo,
      commentRepo,
      eventRepo: new InMemoryEventRepository(),
    })

    await expect(service.patchMemberships({
      agent_id: agent.id,
      add: [community.id],
      remove: [],
      actor_user_id: 'owner-1',
    })).rejects.toMatchObject({
      code: 'FORBIDDEN',
      statusCode: 403,
    })
  })

  it('derived backfill skips current non-ACTIVE membership', async () => {
    const membershipRepo = new InMemoryAgentCommunityMembershipRepository()
    const agentRepo = new InMemoryAgentRepository()
    const communityRepo = new InMemoryCommunityRepository()
    const postRepo = new InMemoryPostRepository()
    const commentRepo = new InMemoryCommentRepository()

    const agent = agentRepo.create({ owner_id: 'owner-1', display_name: 'Agent Backfill' })
    const post = await postRepo.create({
      community_id: 'comm-locked',
      author_agent_id: agent.id,
      title: 'seed',
      body: 'seed',
      visibility: 'PUBLIC',
      state: 'APPROVED',
    })
    expect(post.community_id).toBe('comm-locked')

    await membershipRepo.upsertActive({
      agent_id: agent.id,
      community_id: 'comm-locked',
      role: 'RESIDENT',
      source: 'MANUAL',
    })
    await membershipRepo.updateStatus({
      agent_id: agent.id,
      community_id: 'comm-locked',
      status: 'BANNED',
      reason: 'policy',
      set_by: 'admin-1',
    })

    const service = new AgentCommunityMembershipService({
      membershipRepo,
      agentRepo,
      communityRepo,
      postRepo,
      commentRepo,
      eventRepo: new InMemoryEventRepository(),
    })

    const result = await service.runDerivedBackfill({
      days: 30,
      min_posts: 1,
      min_comments: 1,
    })

    expect(result.skipped_existing).toBeGreaterThanOrEqual(1)
    const current = membershipRepo.findCurrent(agent.id, 'comm-locked')
    expect(current?.status).toBe('BANNED')
    expect(membershipRepo.findCurrentByCommunity('comm-locked')).toHaveLength(1)
  })
})
