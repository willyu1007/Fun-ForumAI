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
    scope?: 'ABSTRACT_ONLY' | 'SCENARIO_LEVEL' | 'DETAIL_LEVEL'
    anonymity_level?: 'strong' | 'medium' | 'light'
    quote_policy?: 'NO_QUOTE' | 'PARAPHRASE_ONLY' | 'ALLOW_QUOTE'
    no_go_topics?: string[]
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
    try {
      const { grant } = await this.deps.incubationRepo.grantJobTx({
        jobId: input.job_id,
        expectedCurrentStatus: 'PENDING',
        grant: {
          job_id: input.job_id,
          reviewer_user_id: input.actor_user_id,
          reason: input.reason.trim(),
          ttl_hours: input.ttl_hours,
          scope: input.scope,
          anonymity_level: input.anonymity_level,
          quote_policy: input.quote_policy,
          no_go_topics: input.no_go_topics ?? [],
          policy: {
            scope: input.scope ?? 'ABSTRACT_ONLY',
            anonymity_level: input.anonymity_level ?? 'strong',
            quote_policy: input.quote_policy ?? 'PARAPHRASE_ONLY',
            no_go_topics: input.no_go_topics ?? [],
          },
          expires_at: expiresAt,
        },
        jobPatch: {
          status: 'GRANTED',
          phase: 'RESEARCHING',
          expires_at: expiresAt,
        },
        event: {
          job_id: input.job_id,
          event_type: 'grant_created',
          actor_user_id: input.actor_user_id,
          payload: {
            reason: input.reason.trim(),
            ttl_hours: input.ttl_hours,
            scope: input.scope ?? 'ABSTRACT_ONLY',
            anonymity_level: input.anonymity_level ?? 'strong',
            quote_policy: input.quote_policy ?? 'PARAPHRASE_ONLY',
            no_go_topics: input.no_go_topics ?? [],
          },
        },
      })
      return grant
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('incubation_job_status_conflict:')) {
        throw new AppError(
          409,
          `Incubation job ${input.job_id} changed state while granting; retry from latest state`,
          'CONFLICT',
        )
      }
      throw err
    }
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

    const existingMeta = (job.meta ?? {}) as Record<string, unknown>
    if (existingMeta.review_verdict) {
      throw new AppError(
        409,
        `Incubation job ${input.job_id} already reviewed (verdict: ${existingMeta.review_verdict}); submit grant or create a new job`,
        'CONFLICT',
      )
    }

    const meta: Record<string, unknown> = {
      ...existingMeta,
      review_verdict: input.verdict,
      review_reason: input.reason?.trim() || null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: input.actor_user_id,
    }

    let status: 'REJECTED' | 'QUARANTINED' | undefined
    if (input.verdict === 'reject') {
      status = 'REJECTED'
    } else if (input.verdict === 'quarantine') {
      status = 'QUARANTINED'
    }

    const updated = await this.deps.incubationRepo.updateJob(input.job_id, {
      ...(status ? { status } : {}),
      phase: status ? 'ABORTED' : 'AWAIT_GRANT',
      review: {
        verdict: input.verdict,
        reason: input.reason?.trim() || null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: input.actor_user_id,
      },
      meta,
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
