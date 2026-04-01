import { describe, expect, it } from 'vitest'
import { InMemoryAgentCommunityMembershipRepository } from '../../repos/agent-community-membership-repository.js'
import { InMemoryAgentRepository } from '../../repos/agent-repository.js'
import { InMemoryCommunityRepository } from '../../repos/community-repository.js'
import { InMemoryPostRepository } from '../../repos/post-repository.js'
import { InMemoryEventRepository } from '../../repos/event-repository.js'
import { InMemoryPublicStageThreadRepository } from '../../repos/public-stage-thread-repository.js'
import { InMemoryPublicStageTurnRepository } from '../../repos/public-stage-turn-repository.js'
import { AgentCommunityMembershipService } from '../agent-community-membership-service.js'
import { InMemoryPublicStageStore } from '../../test-support/public-stage-store.js'

function createStageStore(postRepo: InMemoryPostRepository) {
  const publicStageThreadRepo = new InMemoryPublicStageThreadRepository()
  const publicStageTurnRepo = new InMemoryPublicStageTurnRepository()
  const commentRepo = new InMemoryPublicStageStore({
    threadRepo: publicStageThreadRepo,
    turnRepo: publicStageTurnRepo,
    postRepo,
  })
  return { publicStageThreadRepo, publicStageTurnRepo, commentRepo }
}

describe('AgentCommunityMembershipService', () => {
  it('patches add/remove memberships', async () => {
    const membershipRepo = new InMemoryAgentCommunityMembershipRepository()
    const agentRepo = new InMemoryAgentRepository()
    const communityRepo = new InMemoryCommunityRepository()
    const postRepo = new InMemoryPostRepository()
    const { publicStageThreadRepo, publicStageTurnRepo } = createStageStore(postRepo)

    const agent = agentRepo.create({ owner_id: 'owner-1', display_name: 'Agent One' })
    const commA = communityRepo.create({ name: 'A', slug: 'a' })
    const commB = communityRepo.create({ name: 'B', slug: 'b' })

    const service = new AgentCommunityMembershipService({
      membershipRepo,
      agentRepo,
      communityRepo,
      postRepo,
      publicStageThreadRepo,
      publicStageTurnRepo,
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

  it('reconciles authoritative membership targets without reviving banned memberships', async () => {
    const membershipRepo = new InMemoryAgentCommunityMembershipRepository()
    const agentRepo = new InMemoryAgentRepository()
    const communityRepo = new InMemoryCommunityRepository()
    const postRepo = new InMemoryPostRepository()
    const { publicStageThreadRepo, publicStageTurnRepo } = createStageStore(postRepo)

    const agent = agentRepo.create({ owner_id: 'platform-system-owner', display_name: 'Launch System Agent' })
    const residentCommunity = communityRepo.create({ name: 'Resident', slug: 'resident' })
    const guestCommunity = communityRepo.create({ name: 'Guest', slug: 'guest' })
    const blockedCommunity = communityRepo.create({ name: 'Blocked', slug: 'blocked' })
    const staleCommunity = communityRepo.create({ name: 'Stale', slug: 'stale' })

    await membershipRepo.upsertActive({
      agent_id: agent.id,
      community_id: residentCommunity.id,
      role: 'RESIDENT',
      source: 'MANUAL',
    })
    await membershipRepo.upsertActive({
      agent_id: agent.id,
      community_id: blockedCommunity.id,
      role: 'RESIDENT',
      source: 'MANUAL',
    })
    await membershipRepo.updateStatus({
      agent_id: agent.id,
      community_id: blockedCommunity.id,
      status: 'BANNED',
      reason: 'policy',
      set_by: 'admin-1',
    })
    await membershipRepo.upsertActive({
      agent_id: agent.id,
      community_id: staleCommunity.id,
      role: 'GUEST',
      source: 'MANUAL',
    })

    const service = new AgentCommunityMembershipService({
      membershipRepo,
      agentRepo,
      communityRepo,
      postRepo,
      publicStageThreadRepo,
      publicStageTurnRepo,
      eventRepo: new InMemoryEventRepository(),
    })

    const result = await service.reconcileMemberships({
      agent_id: agent.id,
      targets: [
        { community_id: residentCommunity.id, role: 'guest' },
        { community_id: guestCommunity.id, role: 'resident' },
        { community_id: blockedCommunity.id, role: 'resident' },
      ],
      actor_id: 'launch-membership-bootstrap',
      actor_type: 'system',
      source: 'DERIVED',
      remove_missing: true,
      reason: 'launch_roster:sys_agent',
    })

    expect(result.updated.added).toEqual([guestCommunity.id])
    expect(result.updated.role_changed).toEqual([residentCommunity.id])
    expect(result.updated.removed).toEqual([staleCommunity.id])
    expect(result.updated.blocked).toEqual([blockedCommunity.id])
    expect(result.active_memberships.map((item) => ({
      community_id: item.community_id,
      role: item.role,
      source: item.source,
    }))).toEqual(expect.arrayContaining([
      {
        community_id: residentCommunity.id,
        role: 'GUEST',
        source: 'DERIVED',
      },
      {
        community_id: guestCommunity.id,
        role: 'RESIDENT',
        source: 'DERIVED',
      },
    ]))
    expect(result.active_memberships.some((item) => item.community_id === blockedCommunity.id)).toBe(false)
    expect(membershipRepo.findCurrent(agent.id, blockedCommunity.id)?.status).toBe('BANNED')
  })

  it('backfills derived memberships from 30-day activity', async () => {
    const membershipRepo = new InMemoryAgentCommunityMembershipRepository()
    const agentRepo = new InMemoryAgentRepository()
    const communityRepo = new InMemoryCommunityRepository()
    const postRepo = new InMemoryPostRepository()
    const { publicStageThreadRepo, publicStageTurnRepo, commentRepo } = createStageStore(postRepo)

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
      publicStageThreadRepo,
      publicStageTurnRepo,
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
    const { publicStageThreadRepo, publicStageTurnRepo } = createStageStore(postRepo)

    const agent = agentRepo.create({ owner_id: 'owner-1', display_name: 'Agent One' })

    const service = new AgentCommunityMembershipService({
      membershipRepo,
      agentRepo,
      communityRepo,
      postRepo,
      publicStageThreadRepo,
      publicStageTurnRepo,
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
    const { publicStageThreadRepo, publicStageTurnRepo } = createStageStore(postRepo)

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
      publicStageThreadRepo,
      publicStageTurnRepo,
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
    const { publicStageThreadRepo, publicStageTurnRepo } = createStageStore(postRepo)

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
      publicStageThreadRepo,
      publicStageTurnRepo,
      eventRepo: new InMemoryEventRepository(),
    })

    const result = await service.runDerivedBackfill({
      days: 30,
      min_posts: 1,
      min_thread_turn_count: 1,
    })

    expect(result.skipped_existing).toBeGreaterThanOrEqual(1)
    const current = membershipRepo.findCurrent(agent.id, 'comm-locked')
    expect(current?.status).toBe('BANNED')
    expect(membershipRepo.findCurrentByCommunity('comm-locked')).toHaveLength(1)
  })
})
