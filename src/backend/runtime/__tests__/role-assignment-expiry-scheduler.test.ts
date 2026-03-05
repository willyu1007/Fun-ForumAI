import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RoleAssignmentExpiryScheduler } from '../role-assignment-expiry-scheduler.js'
import { RoleAssignmentService } from '../../services/role-assignment-service.js'
import { InMemoryRoleAssignmentRepository } from '../../repos/role-assignment-repository.js'
import { InMemoryCommunityRepository } from '../../repos/community-repository.js'
import { InMemoryPostRepository } from '../../repos/post-repository.js'
import { InMemoryAgentRepository } from '../../repos/agent-repository.js'
import { InMemoryEventRepository } from '../../repos/event-repository.js'
import { InMemoryAgentCommunityMembershipRepository } from '../../repos/agent-community-membership-repository.js'

describe('RoleAssignmentExpiryScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('expires due assignments once and emits a single ROLE_EXPIRED event', async () => {
    const roleAssignmentRepo = new InMemoryRoleAssignmentRepository()
    const communityRepo = new InMemoryCommunityRepository()
    const postRepo = new InMemoryPostRepository()
    const agentRepo = new InMemoryAgentRepository()
    const membershipRepo = new InMemoryAgentCommunityMembershipRepository()
    const eventRepo = new InMemoryEventRepository()

    const community = communityRepo.create({
      name: 'Expiry Community',
      slug: 'expiry-community',
    })
    const agent = agentRepo.create({
      display_name: 'Expiry Agent',
      owner_id: 'user-1',
    })
    await membershipRepo.upsertActive({
      agent_id: agent.id,
      community_id: community.id,
    })

    const service = new RoleAssignmentService({
      roleAssignmentRepo,
      communityRepo,
      postRepo,
      agentRepo,
      membershipRepo,
      eventRepo,
    })

    const createSpy = vi.spyOn(eventRepo, 'create')

    const assignment = await service.assign({
      community_id: community.id,
      scope: 'COMMUNITY',
      scope_id: community.id,
      role: 'host',
      agent_id: agent.id,
      actor_user_id: 'admin-1',
      expires_at: new Date(Date.now() - 1000),
    })
    expect(assignment.status).toBe('ACTIVE')

    const scheduler = new RoleAssignmentExpiryScheduler(
      { service },
      {
        startupDelayMs: 1000,
        intervalMs: 2000,
        batchLimit: 10,
      },
    )

    scheduler.start()
    await vi.advanceTimersByTimeAsync(1000)
    await vi.advanceTimersByTimeAsync(2000)
    scheduler.stop()

    const updated = roleAssignmentRepo.findById(assignment.id)
    expect(updated?.status).toBe('EXPIRED')

    const expiredEvents = createSpy.mock.calls
      .map((call) => call[0])
      .filter((event) => event.event_type === 'ROLE_EXPIRED')
    expect(expiredEvents).toHaveLength(1)
    expect(expiredEvents[0]?.actor_type).toBe('system')
    expect(expiredEvents[0]?.actor_id).toBe('role-expiry-scheduler')
  })

  it('emits another ROLE_EXPIRED event when assignment is re-activated and expires again', async () => {
    const roleAssignmentRepo = new InMemoryRoleAssignmentRepository()
    const communityRepo = new InMemoryCommunityRepository()
    const postRepo = new InMemoryPostRepository()
    const agentRepo = new InMemoryAgentRepository()
    const membershipRepo = new InMemoryAgentCommunityMembershipRepository()
    const eventRepo = new InMemoryEventRepository()

    const community = communityRepo.create({
      name: 'Expiry Community Reactivation',
      slug: 'expiry-community-reactivation',
    })
    const agent = agentRepo.create({
      display_name: 'Expiry Agent Reactivation',
      owner_id: 'user-2',
    })
    await membershipRepo.upsertActive({
      agent_id: agent.id,
      community_id: community.id,
    })

    const service = new RoleAssignmentService({
      roleAssignmentRepo,
      communityRepo,
      postRepo,
      agentRepo,
      membershipRepo,
      eventRepo,
    })

    const createSpy = vi.spyOn(eventRepo, 'create')

    const assignment = await service.assign({
      community_id: community.id,
      scope: 'COMMUNITY',
      scope_id: community.id,
      role: 'host',
      agent_id: agent.id,
      actor_user_id: 'admin-2',
      expires_at: new Date(Date.now() - 1000),
    })
    expect(assignment.status).toBe('ACTIVE')

    const scheduler = new RoleAssignmentExpiryScheduler(
      { service },
      {
        startupDelayMs: 1000,
        intervalMs: 2000,
        batchLimit: 10,
      },
    )

    scheduler.start()
    await vi.advanceTimersByTimeAsync(1000)

    await service.update({
      assignment_id: assignment.id,
      status: 'ACTIVE',
      actor_user_id: 'admin-2',
      reason: 'manual re-activate',
    })

    await vi.advanceTimersByTimeAsync(2000)
    scheduler.stop()

    const expiredEvents = createSpy.mock.calls
      .map((call) => call[0])
      .filter((event) => event.event_type === 'ROLE_EXPIRED' && event.correlation_id === assignment.id)
    expect(expiredEvents).toHaveLength(2)
    expect(expiredEvents[0]?.idempotency_key).not.toBe(expiredEvents[1]?.idempotency_key)
  })
})
