import { describe, expect, it } from 'vitest'
import { InMemoryIncubationRepository } from '../../repos/incubation-repository.js'
import { IncubationService } from '../incubation-service.js'

describe('IncubationService', () => {
  it('approve verdict keeps job pending and requires grant as next action', async () => {
    const repo = new InMemoryIncubationRepository()
    const service = new IncubationService({ incubationRepo: repo })

    const job = await repo.createJob({
      post_id: 'post-1',
      community_id: 'community-1',
      proposer_agent_id: 'agent-1',
    })

    const reviewed = await service.reviewJob({
      job_id: job.id,
      actor_user_id: 'admin-1',
      verdict: 'approve',
      reason: 'looks good',
    })

    expect(reviewed.next_action).toBe('grant_required')
    expect(reviewed.job.status).toBe('PENDING')

    const details = await service.getJob(job.id)
    expect(details.events.some((item) => item.event_type === 'review_approve')).toBe(true)
    expect(details.events.some((item) => item.actor_user_id === 'admin-1')).toBe(true)
    expect(details.grants).toHaveLength(0)
  })

  it('grant transitions pending job to granted', async () => {
    const repo = new InMemoryIncubationRepository()
    const service = new IncubationService({ incubationRepo: repo })

    const job = await repo.createJob({
      post_id: 'post-2',
      community_id: 'community-2',
      proposer_agent_id: 'agent-2',
    })

    const grant = await service.grantJob({
      job_id: job.id,
      actor_user_id: 'admin-2',
      reason: 'approved grant',
      ttl_hours: 24,
    })

    expect(grant.job_id).toBe(job.id)
    const details = await service.getJob(job.id)
    expect(details.job.status).toBe('GRANTED')
    expect(details.grants[0]?.reviewer_user_id).toBe('admin-2')
    expect(details.events.some((item) => item.event_type === 'grant_created' && item.actor_user_id === 'admin-2')).toBe(true)
    expect(details.grants).toHaveLength(1)
  })

  it('rejects grant for non-pending jobs', async () => {
    const repo = new InMemoryIncubationRepository()
    const service = new IncubationService({ incubationRepo: repo })

    const job = await repo.createJob({
      post_id: 'post-3',
      community_id: 'community-3',
      proposer_agent_id: 'agent-3',
      status: 'REJECTED',
    })

    await expect(
      service.grantJob({
        job_id: job.id,
        actor_user_id: 'admin-3',
        reason: 'should fail',
        ttl_hours: 24,
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'CONFLICT',
    })
  })

  it('rejects review for non-pending jobs', async () => {
    const repo = new InMemoryIncubationRepository()
    const service = new IncubationService({ incubationRepo: repo })

    const job = await repo.createJob({
      post_id: 'post-4',
      community_id: 'community-4',
      proposer_agent_id: 'agent-4',
      status: 'QUARANTINED',
    })

    await expect(
      service.reviewJob({
        job_id: job.id,
        actor_user_id: 'admin-4',
        verdict: 'approve',
        reason: 'should fail',
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'CONFLICT',
    })
  })
})
