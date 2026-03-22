import type {
  CreateMediaGenerationJobInput,
  MediaGenerationJob,
  MediaGenerationJobStatus,
} from './types.js'

export interface UpdateMediaGenerationJobPatch {
  status?: MediaGenerationJobStatus
  attempt_count?: number
  output_asset_id?: string | null
  error_code?: string | null
  error_message?: string | null
  started_at?: Date | null
  finished_at?: Date | null
}

export interface ClaimMediaGenerationJobInput {
  now: Date
  running_timeout_ms: number
  max_attempts: number
  global_concurrency: number
  provider_concurrency: number
  provider?: string
}

export interface MediaGenerationJobRepository {
  create(input: CreateMediaGenerationJobInput): Promise<MediaGenerationJob>
  findById(id: string): Promise<MediaGenerationJob | null>
  findByFingerprint(requestFingerprint: string): Promise<MediaGenerationJob | null>
  findByOutputAssetId(assetId: string): Promise<MediaGenerationJob[]>
  markTimedOutRunningJobs(now: Date, timeoutMs: number): Promise<MediaGenerationJob[]>
  update(id: string, patch: UpdateMediaGenerationJobPatch): Promise<MediaGenerationJob | null>
  claimNextQueued(input: ClaimMediaGenerationJobInput): Promise<MediaGenerationJob | null>
  cancelQueuedByProjectionIds(
    projectionIds: string[],
    reason: string,
    now: Date,
  ): Promise<MediaGenerationJob[]>
}

let counter = 0
function cuid(): string {
  return `media_generation_job_${Date.now()}_${++counter}`
}

function isTimedOut(job: MediaGenerationJob, now: Date, timeoutMs: number): boolean {
  if (job.status !== 'running' || !job.started_at) return false
  return now.getTime() - job.started_at.getTime() >= timeoutMs
}

export class InMemoryMediaGenerationJobRepository implements MediaGenerationJobRepository {
  private readonly store = new Map<string, MediaGenerationJob>()

  async create(input: CreateMediaGenerationJobInput): Promise<MediaGenerationJob> {
    const now = new Date()
    const entity: MediaGenerationJob = {
      id: input.id ?? cuid(),
      agent_id: input.agent_id,
      plan_id: input.plan_id ?? null,
      status: input.status ?? 'queued',
      provider: input.provider,
      model_name: input.model_name,
      request_fingerprint: input.request_fingerprint,
      prompt_brief: input.prompt_brief,
      style_hint: input.style_hint ?? null,
      aspect_ratio_hint: input.aspect_ratio_hint ?? null,
      based_on_projection_ids: [...input.based_on_projection_ids],
      attempt_count: input.attempt_count ?? 0,
      output_asset_id: input.output_asset_id ?? null,
      error_code: input.error_code ?? null,
      error_message: input.error_message ?? null,
      started_at: input.started_at ?? null,
      finished_at: input.finished_at ?? null,
      created_at: now,
      updated_at: now,
    }
    this.store.set(entity.id, entity)
    return entity
  }

  async findById(id: string): Promise<MediaGenerationJob | null> {
    return this.store.get(id) ?? null
  }

  async findByFingerprint(requestFingerprint: string): Promise<MediaGenerationJob | null> {
    return Array.from(this.store.values())
      .find((job) => job.request_fingerprint === requestFingerprint) ?? null
  }

  async findByOutputAssetId(assetId: string): Promise<MediaGenerationJob[]> {
    return Array.from(this.store.values())
      .filter((job) => job.output_asset_id === assetId)
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
  }

  async markTimedOutRunningJobs(now: Date, timeoutMs: number): Promise<MediaGenerationJob[]> {
    const timedOut: MediaGenerationJob[] = []
    for (const job of this.store.values()) {
      if (!isTimedOut(job, now, timeoutMs)) continue
      job.status = 'timed_out'
      job.finished_at = now
      job.error_code = 'running_timeout'
      job.error_message = 'generation job exceeded running timeout'
      job.updated_at = now
      timedOut.push(job)
    }
    return timedOut
  }

  async update(id: string, patch: UpdateMediaGenerationJobPatch): Promise<MediaGenerationJob | null> {
    const current = this.store.get(id)
    if (!current) return null
    if (patch.status !== undefined) current.status = patch.status
    if (patch.attempt_count !== undefined) current.attempt_count = patch.attempt_count
    if (patch.output_asset_id !== undefined) current.output_asset_id = patch.output_asset_id
    if (patch.error_code !== undefined) current.error_code = patch.error_code
    if (patch.error_message !== undefined) current.error_message = patch.error_message
    if (patch.started_at !== undefined) current.started_at = patch.started_at
    if (patch.finished_at !== undefined) current.finished_at = patch.finished_at
    current.updated_at = new Date()
    return current
  }

  async claimNextQueued(input: ClaimMediaGenerationJobInput): Promise<MediaGenerationJob | null> {
    const running = Array.from(this.store.values())
      .filter((job) => job.status === 'running')
    if (running.length >= input.global_concurrency) return null
    if (input.provider) {
      const runningForProvider = running.filter((job) => job.provider === input.provider)
      if (runningForProvider.length >= input.provider_concurrency) return null
    }

    const next = Array.from(this.store.values())
      .filter((job) => job.status === 'queued')
      .filter((job) => (input.provider ? job.provider === input.provider : true))
      .filter((job) => job.attempt_count < input.max_attempts)
      .sort((left, right) => left.created_at.getTime() - right.created_at.getTime())[0] ?? null
    if (!next) return null

    next.status = 'running'
    next.started_at = input.now
    next.finished_at = null
    next.attempt_count += 1
    next.error_code = null
    next.error_message = null
    next.updated_at = input.now
    return next
  }

  async cancelQueuedByProjectionIds(
    projectionIds: string[],
    reason: string,
    now: Date,
  ): Promise<MediaGenerationJob[]> {
    const lookup = new Set(projectionIds)
    if (lookup.size === 0) return []
    const cancelled: MediaGenerationJob[] = []
    for (const job of this.store.values()) {
      if (job.status !== 'queued') continue
      if (!job.based_on_projection_ids.some((projectionId) => lookup.has(projectionId))) continue
      job.status = 'cancelled'
      job.error_code = 'policy_revoked'
      job.error_message = reason
      job.finished_at = now
      job.updated_at = now
      cancelled.push(job)
    }
    return cancelled
  }
}
