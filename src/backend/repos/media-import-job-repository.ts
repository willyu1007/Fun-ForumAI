import type {
  CreateMediaImportJobInput,
  MediaImportJob,
  UpdateMediaImportJobPatch,
} from './types.js'

export interface ClaimMediaImportJobInput {
  now: Date
  worker_id: string
  global_concurrency: number
  running_timeout_ms: number
}

export interface MediaImportJobRepository {
  create(input: CreateMediaImportJobInput): Promise<MediaImportJob>
  findById(id: string): Promise<MediaImportJob | null>
  findByRequestFingerprint(requestFingerprint: string): Promise<MediaImportJob | null>
  listRecentByIntentFingerprint(intentFingerprint: string, limit?: number): Promise<MediaImportJob[]>
  listExpiredInputArtifactJobs(
    now: Date,
    successRetentionMs: number,
    failedRetentionMs: number,
    limit?: number,
  ): Promise<MediaImportJob[]>
  listExpiredResultArtifactJobs(
    now: Date,
    retentionMs: number,
    limit?: number,
  ): Promise<MediaImportJob[]>
  update(id: string, patch: UpdateMediaImportJobPatch): Promise<MediaImportJob | null>
  claimNextReady(input: ClaimMediaImportJobInput): Promise<MediaImportJob | null>
  touchHeartbeat(id: string, heartbeatAt: Date): Promise<MediaImportJob | null>
  markExpiredStagedJobs(now: Date, staleAfterMs: number): Promise<MediaImportJob[]>
  markTimedOutRunningJobs(now: Date, timeoutMs: number): Promise<MediaImportJob[]>
}

let counter = 0
function cuid(): string {
  return `media_import_job_${Date.now()}_${String(++counter).padStart(8, '0')}`
}

function compareRecent(a: MediaImportJob, b: MediaImportJob): number {
  return b.created_at.getTime() - a.created_at.getTime() || b.id.localeCompare(a.id)
}

export class InMemoryMediaImportJobRepository implements MediaImportJobRepository {
  private readonly store = new Map<string, MediaImportJob>()

  async create(input: CreateMediaImportJobInput): Promise<MediaImportJob> {
    const now = new Date()
    const entity: MediaImportJob = {
      id: input.id ?? cuid(),
      status: input.status,
      phase: input.phase,
      entrypoint: input.entrypoint,
      requested_by_type: input.requested_by_type,
      requested_by_id: input.requested_by_id,
      manifest_version: input.manifest_version,
      intent_fingerprint: input.intent_fingerprint,
      request_fingerprint: input.request_fingerprint,
      staging_manifest_key: input.staging_manifest_key,
      normalized_manifest_key: input.normalized_manifest_key ?? null,
      result_manifest_key: input.result_manifest_key ?? null,
      failure_log_key: input.failure_log_key ?? null,
      scope_summary_json: input.scope_summary_json,
      total_items: input.total_items ?? 0,
      processed_items: input.processed_items ?? 0,
      created_items: input.created_items ?? 0,
      reused_items: input.reused_items ?? 0,
      suppressed_items: input.suppressed_items ?? 0,
      failed_items: input.failed_items ?? 0,
      attempt_count: input.attempt_count ?? 0,
      failed_phase: input.failed_phase ?? null,
      error_code: input.error_code ?? null,
      error_message: input.error_message ?? null,
      claimed_by_worker: input.claimed_by_worker ?? null,
      started_at: input.started_at ?? null,
      finished_at: input.finished_at ?? null,
      last_heartbeat_at: input.last_heartbeat_at ?? null,
      retry_of_job_id: input.retry_of_job_id ?? null,
      created_at: now,
      updated_at: now,
    }
    this.store.set(entity.id, entity)
    return entity
  }

  async findById(id: string): Promise<MediaImportJob | null> {
    return this.store.get(id) ?? null
  }

  async findByRequestFingerprint(requestFingerprint: string): Promise<MediaImportJob | null> {
    return Array.from(this.store.values())
      .find((item) => item.request_fingerprint === requestFingerprint) ?? null
  }

  async listRecentByIntentFingerprint(intentFingerprint: string, limit = 10): Promise<MediaImportJob[]> {
    return Array.from(this.store.values())
      .filter((item) => item.intent_fingerprint === intentFingerprint)
      .sort(compareRecent)
      .slice(0, limit)
  }

  async listExpiredInputArtifactJobs(
    now: Date,
    successRetentionMs: number,
    failedRetentionMs: number,
    limit = 50,
  ): Promise<MediaImportJob[]> {
    const successCutoff = now.getTime() - successRetentionMs
    const failedCutoff = now.getTime() - failedRetentionMs
    return Array.from(this.store.values())
      .filter((item) => {
        if (!item.staging_manifest_key && !item.normalized_manifest_key) return false
        const anchor = item.finished_at ?? item.created_at
        if (item.status === 'succeeded' || item.status === 'partial_succeeded') {
          return anchor.getTime() <= successCutoff
        }
        if (item.status === 'failed' || item.status === 'cancelled') {
          return anchor.getTime() <= failedCutoff
        }
        return false
      })
      .sort(compareRecent)
      .slice(0, limit)
  }

  async listExpiredResultArtifactJobs(
    now: Date,
    retentionMs: number,
    limit = 50,
  ): Promise<MediaImportJob[]> {
    const cutoff = now.getTime() - retentionMs
    return Array.from(this.store.values())
      .filter((item) => {
        if (!item.result_manifest_key && !item.failure_log_key) return false
        if (
          item.status !== 'succeeded'
          && item.status !== 'partial_succeeded'
          && item.status !== 'failed'
          && item.status !== 'cancelled'
        ) {
          return false
        }
        const anchor = item.finished_at ?? item.created_at
        return anchor.getTime() <= cutoff
      })
      .sort(compareRecent)
      .slice(0, limit)
  }

  async update(id: string, patch: UpdateMediaImportJobPatch): Promise<MediaImportJob | null> {
    const entity = this.store.get(id)
    if (!entity) return null
    if (patch.status !== undefined) entity.status = patch.status
    if (patch.phase !== undefined) entity.phase = patch.phase
    if (patch.staging_manifest_key !== undefined) entity.staging_manifest_key = patch.staging_manifest_key
    if (patch.normalized_manifest_key !== undefined) entity.normalized_manifest_key = patch.normalized_manifest_key
    if (patch.result_manifest_key !== undefined) entity.result_manifest_key = patch.result_manifest_key
    if (patch.failure_log_key !== undefined) entity.failure_log_key = patch.failure_log_key
    if (patch.scope_summary_json !== undefined) entity.scope_summary_json = patch.scope_summary_json
    if (patch.total_items !== undefined) entity.total_items = patch.total_items
    if (patch.processed_items !== undefined) entity.processed_items = patch.processed_items
    if (patch.created_items !== undefined) entity.created_items = patch.created_items
    if (patch.reused_items !== undefined) entity.reused_items = patch.reused_items
    if (patch.suppressed_items !== undefined) entity.suppressed_items = patch.suppressed_items
    if (patch.failed_items !== undefined) entity.failed_items = patch.failed_items
    if (patch.attempt_count !== undefined) entity.attempt_count = patch.attempt_count
    if (patch.failed_phase !== undefined) entity.failed_phase = patch.failed_phase
    if (patch.error_code !== undefined) entity.error_code = patch.error_code
    if (patch.error_message !== undefined) entity.error_message = patch.error_message
    if (patch.claimed_by_worker !== undefined) entity.claimed_by_worker = patch.claimed_by_worker
    if (patch.started_at !== undefined) entity.started_at = patch.started_at
    if (patch.finished_at !== undefined) entity.finished_at = patch.finished_at
    if (patch.last_heartbeat_at !== undefined) entity.last_heartbeat_at = patch.last_heartbeat_at
    entity.updated_at = new Date()
    return entity
  }

  async claimNextReady(input: ClaimMediaImportJobInput): Promise<MediaImportJob | null> {
    const runningCount = Array.from(this.store.values()).filter((item) => item.status === 'running').length
    if (runningCount >= input.global_concurrency) return null
    const next = Array.from(this.store.values())
      .filter((item) => item.status === 'staged' || item.status === 'queued')
      .sort((left, right) => left.created_at.getTime() - right.created_at.getTime())[0] ?? null
    if (!next) return null
    next.status = 'running'
    next.claimed_by_worker = input.worker_id
    next.started_at = next.started_at ?? input.now
    next.last_heartbeat_at = input.now
    next.attempt_count += 1
    next.updated_at = input.now
    return next
  }

  async touchHeartbeat(id: string, heartbeatAt: Date): Promise<MediaImportJob | null> {
    const entity = this.store.get(id)
    if (!entity) return null
    entity.last_heartbeat_at = heartbeatAt
    entity.updated_at = heartbeatAt
    return entity
  }

  async markExpiredStagedJobs(now: Date, staleAfterMs: number): Promise<MediaImportJob[]> {
    const threshold = now.getTime() - staleAfterMs
    const expired: MediaImportJob[] = []
    for (const entity of this.store.values()) {
      if (entity.status !== 'staged' && entity.status !== 'queued') continue
      if (entity.created_at.getTime() > threshold) continue
      entity.status = 'failed'
      entity.error_code = 'staging_expired'
      entity.error_message = 'staged import job expired before processing'
      entity.finished_at = now
      entity.updated_at = now
      expired.push(entity)
    }
    return expired
  }

  async markTimedOutRunningJobs(now: Date, timeoutMs: number): Promise<MediaImportJob[]> {
    const threshold = now.getTime() - timeoutMs
    const timedOut: MediaImportJob[] = []
    for (const entity of this.store.values()) {
      if (entity.status !== 'running') continue
      const heartbeat = entity.last_heartbeat_at ?? entity.started_at
      if (!heartbeat || heartbeat.getTime() > threshold) continue
      entity.status = 'queued'
      entity.claimed_by_worker = null
      entity.updated_at = now
      timedOut.push(entity)
    }
    return timedOut
  }
}
