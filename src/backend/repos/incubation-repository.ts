import type {
  IncubationJob,
  IncubationJobStatus,
  IncubationGrant,
  IncubationSourceBundle,
  IncubationEvent,
  CreateIncubationJobInput,
  UpdateIncubationJobInput,
  CreateIncubationGrantInput,
  CreateIncubationSourceBundleInput,
  CreateIncubationEventInput,
} from './types.js'

export interface GrantJobTxInput {
  jobId: string
  expectedCurrentStatus?: IncubationJobStatus
  grant: CreateIncubationGrantInput
  jobPatch: UpdateIncubationJobInput
  event: CreateIncubationEventInput
}

export interface IncubationRepository {
  createJob(input: CreateIncubationJobInput): Promise<IncubationJob>
  findJobById(jobId: string): Promise<IncubationJob | null>
  findJobByIdempotencyKey(idempotencyKey: string): Promise<IncubationJob | null>
  updateJob(jobId: string, patch: UpdateIncubationJobInput): Promise<IncubationJob | null>
  createGrant(input: CreateIncubationGrantInput): Promise<IncubationGrant>
  grantJobTx(input: GrantJobTxInput): Promise<{
    grant: IncubationGrant
    job: IncubationJob
    event: IncubationEvent
  }>
  listGrantsByJob(jobId: string): Promise<IncubationGrant[]>
  createSourceBundle(input: CreateIncubationSourceBundleInput): Promise<IncubationSourceBundle>
  listSourceBundlesByJob(jobId: string): Promise<IncubationSourceBundle[]>
  createEvent(input: CreateIncubationEventInput): Promise<IncubationEvent>
  listEventsByJob(jobId: string): Promise<IncubationEvent[]>
}

let counter = 0
function cuid(prefix: string): string {
  return `${prefix}_${Date.now()}_${++counter}`
}

export class InMemoryIncubationRepository implements IncubationRepository {
  private readonly jobs = new Map<string, IncubationJob>()
  private readonly grants = new Map<string, IncubationGrant>()
  private readonly sourceBundles = new Map<string, IncubationSourceBundle>()
  private readonly events = new Map<string, IncubationEvent>()

  async createJob(input: CreateIncubationJobInput): Promise<IncubationJob> {
    const now = input.requested_at ?? new Date()
    const row: IncubationJob = {
      id: cuid('inc_job'),
      post_id: input.post_id ?? null,
      community_id: input.community_id,
      proposer_agent_id: input.proposer_agent_id,
      status: input.status ?? 'PENDING',
      phase: input.phase ?? 'AWAIT_GRANT',
      strict_t4: input.strict_t4 ?? true,
      grant_required: input.grant_required ?? true,
      premod_required: input.premod_required ?? true,
      redaction_level: input.redaction_level ?? 'strong',
      source_count: input.source_count ?? 0,
      idempotency_key: input.idempotency_key ?? null,
      source_session_id: input.source_session_id ?? null,
      source_memory_id: input.source_memory_id ?? null,
      research: input.research ?? null,
      draft: input.draft ?? null,
      review: input.review ?? null,
      requested_at: now,
      expires_at: input.expires_at ?? null,
      meta: input.meta ?? null,
      created_at: now,
      updated_at: now,
    }
    this.jobs.set(row.id, row)
    return row
  }

  async findJobById(jobId: string): Promise<IncubationJob | null> {
    return this.jobs.get(jobId) ?? null
  }

  async findJobByIdempotencyKey(idempotencyKey: string): Promise<IncubationJob | null> {
    for (const job of this.jobs.values()) {
      if (job.idempotency_key === idempotencyKey) {
        return job
      }
    }
    return null
  }

  async updateJob(jobId: string, patch: UpdateIncubationJobInput): Promise<IncubationJob | null> {
    const row = this.jobs.get(jobId)
    if (!row) return null

    if (patch.post_id !== undefined) row.post_id = patch.post_id
    if (patch.status !== undefined) row.status = patch.status
    if (patch.phase !== undefined) row.phase = patch.phase
    if (patch.source_count !== undefined) row.source_count = patch.source_count
    if (patch.expires_at !== undefined) row.expires_at = patch.expires_at
    if (patch.research !== undefined) row.research = patch.research
    if (patch.draft !== undefined) row.draft = patch.draft
    if (patch.review !== undefined) row.review = patch.review
    if (patch.meta !== undefined) row.meta = patch.meta
    row.updated_at = new Date()

    return row
  }

  async createGrant(input: CreateIncubationGrantInput): Promise<IncubationGrant> {
    const now = input.granted_at ?? new Date()
    const row: IncubationGrant = {
      id: cuid('inc_grant'),
      job_id: input.job_id,
      reviewer_agent_id: input.reviewer_agent_id ?? null,
      reviewer_user_id: input.reviewer_user_id ?? null,
      status: input.status ?? 'ACTIVE',
      reason: input.reason,
      ttl_hours: input.ttl_hours,
      scope: input.scope ?? 'ABSTRACT_ONLY',
      anonymity_level: input.anonymity_level ?? 'strong',
      quote_policy: input.quote_policy ?? 'PARAPHRASE_ONLY',
      no_go_topics: input.no_go_topics ?? [],
      policy: input.policy ?? null,
      granted_at: now,
      expires_at: input.expires_at,
      revoked_at: null,
      meta: input.meta ?? null,
      created_at: now,
      updated_at: now,
    }
    this.grants.set(row.id, row)
    return row
  }

  async grantJobTx(input: GrantJobTxInput): Promise<{
    grant: IncubationGrant
    job: IncubationJob
    event: IncubationEvent
  }> {
    const existingJob = this.jobs.get(input.jobId)
    if (!existingJob) {
      throw new Error(`incubation_job_not_found:${input.jobId}`)
    }
    if (
      input.expectedCurrentStatus !== undefined &&
      existingJob.status !== input.expectedCurrentStatus
    ) {
      throw new Error(`incubation_job_status_conflict:${existingJob.status}`)
    }

    const previousJob: IncubationJob = { ...existingJob }
    let grant: IncubationGrant | null = null
    let event: IncubationEvent | null = null

    try {
      grant = await this.createGrant(input.grant)
      const job = await this.updateJob(input.jobId, input.jobPatch)
      if (!job) {
        throw new Error(`incubation_job_not_found:${input.jobId}`)
      }
      event = await this.createEvent(input.event)
      return { grant, job, event }
    } catch (error) {
      if (grant) {
        this.grants.delete(grant.id)
      }
      if (event) {
        this.events.delete(event.id)
      }
      this.jobs.set(input.jobId, previousJob)
      throw error
    }
  }

  async listGrantsByJob(jobId: string): Promise<IncubationGrant[]> {
    return Array.from(this.grants.values())
      .filter((row) => row.job_id === jobId)
      .sort((a, b) => b.granted_at.getTime() - a.granted_at.getTime())
  }

  async createSourceBundle(input: CreateIncubationSourceBundleInput): Promise<IncubationSourceBundle> {
    const now = new Date()
    const row: IncubationSourceBundle = {
      id: cuid('inc_src'),
      job_id: input.job_id,
      source_type: input.source_type,
      source_ref: input.source_ref,
      source_url: input.source_url ?? null,
      title: input.title ?? null,
      meta: input.meta ?? null,
      created_at: now,
      updated_at: now,
    }
    this.sourceBundles.set(row.id, row)
    return row
  }

  async listSourceBundlesByJob(jobId: string): Promise<IncubationSourceBundle[]> {
    return Array.from(this.sourceBundles.values())
      .filter((row) => row.job_id === jobId)
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
  }

  async createEvent(input: CreateIncubationEventInput): Promise<IncubationEvent> {
    const row: IncubationEvent = {
      id: cuid('inc_event'),
      job_id: input.job_id,
      event_type: input.event_type,
      actor_user_id: input.actor_user_id ?? null,
      payload: input.payload ?? null,
      created_at: new Date(),
    }
    this.events.set(row.id, row)
    return row
  }

  async listEventsByJob(jobId: string): Promise<IncubationEvent[]> {
    return Array.from(this.events.values())
      .filter((row) => row.job_id === jobId)
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
  }
}
