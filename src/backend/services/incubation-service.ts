import type {
  IncubationJob,
  IncubationGrant,
  IncubationSourceBundle,
  IncubationEvent,
} from '../repos/index.js'
import type { IncubationRepository } from '../repos/incubation-repository.js'
import { AppError, NotFoundError, ValidationError } from '../lib/errors.js'

export interface IncubationServiceDeps {
  incubationRepo: IncubationRepository
}

export class IncubationService {
  constructor(private readonly deps: IncubationServiceDeps) {}

  async getJob(jobId: string): Promise<{
    job: IncubationJob
    grants: IncubationGrant[]
    source_bundles: IncubationSourceBundle[]
    events: IncubationEvent[]
  }> {
    const job = await this.deps.incubationRepo.findJobById(jobId)
    if (!job) throw new NotFoundError('IncubationJob', jobId)

    const [grants, sourceBundles, events] = await Promise.all([
      this.deps.incubationRepo.listGrantsByJob(jobId),
      this.deps.incubationRepo.listSourceBundlesByJob(jobId),
      this.deps.incubationRepo.listEventsByJob(jobId),
    ])

    return {
      job,
      grants,
      source_bundles: sourceBundles,
      events,
    }
  }

  async grantJob(input: {
    job_id: string
    actor_user_id: string
    reason: string
    ttl_hours: number
  }) {
    const job = await this.deps.incubationRepo.findJobById(input.job_id)
    if (!job) throw new NotFoundError('IncubationJob', input.job_id)
    if (job.status !== 'PENDING') {
      throw new AppError(
        409,
        `Incubation job ${input.job_id} is ${job.status}; only PENDING jobs can be granted`,
        'CONFLICT',
      )
    }

    if (!input.reason.trim()) {
      throw new ValidationError('reason is required')
    }

    const now = new Date()
    const expiresAt = new Date(now.getTime() + input.ttl_hours * 60 * 60 * 1000)
    const grant = await this.deps.incubationRepo.createGrant({
      job_id: input.job_id,
      reviewer_user_id: input.actor_user_id,
      reason: input.reason.trim(),
      ttl_hours: input.ttl_hours,
      expires_at: expiresAt,
    })

    await this.deps.incubationRepo.updateJob(input.job_id, {
      status: 'GRANTED',
      expires_at: expiresAt,
    })

    await this.deps.incubationRepo.createEvent({
      job_id: input.job_id,
      event_type: 'grant_created',
      actor_user_id: input.actor_user_id,
      payload: {
        reason: input.reason.trim(),
        ttl_hours: input.ttl_hours,
        grant_id: grant.id,
      },
    })

    return grant
  }

  async reviewJob(input: {
    job_id: string
    actor_user_id: string
    verdict: 'approve' | 'reject' | 'quarantine'
    reason?: string
  }): Promise<{ job: IncubationJob; next_action?: 'grant_required' }> {
    const job = await this.deps.incubationRepo.findJobById(input.job_id)
    if (!job) throw new NotFoundError('IncubationJob', input.job_id)
    if (job.status !== 'PENDING') {
      throw new AppError(
        409,
        `Incubation job ${input.job_id} is ${job.status}; only PENDING jobs can be reviewed`,
        'CONFLICT',
      )
    }

    const patch: { status?: 'REJECTED' | 'QUARANTINED'; meta: Record<string, unknown> } = {
      meta: {
        ...(job.meta ?? {}),
        review_reason: input.reason?.trim() || null,
      },
    }
    if (input.verdict === 'reject') {
      patch.status = 'REJECTED'
    } else if (input.verdict === 'quarantine') {
      patch.status = 'QUARANTINED'
    }

    const updated = await this.deps.incubationRepo.updateJob(input.job_id, {
      ...(patch.status ? { status: patch.status } : {}),
      meta: patch.meta,
    })

    if (!updated) throw new NotFoundError('IncubationJob', input.job_id)

    await this.deps.incubationRepo.createEvent({
      job_id: input.job_id,
      event_type: `review_${input.verdict}`,
      actor_user_id: input.actor_user_id,
      payload: {
        reason: input.reason?.trim() || null,
      },
    })

    if (input.verdict === 'approve') {
      return {
        job: updated,
        next_action: 'grant_required',
      }
    }

    return { job: updated }
  }
}
