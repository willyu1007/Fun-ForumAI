import { Prisma, type MediaImportJobRecord as PrismaMediaImportJobRecord } from '@prisma/client'
import type {
  CreateMediaImportJobInput,
  MediaImportJob,
  UpdateMediaImportJobPatch,
} from '../types.js'
import type {
  ClaimMediaImportJobInput,
  MediaImportJobRepository,
} from '../media-import-job-repository.js'
import type { PrismaDbClient } from './prisma-db-client.js'

export class PgMediaImportJobRepository implements MediaImportJobRepository {
  constructor(private readonly prisma: PrismaDbClient) {}

  async create(input: CreateMediaImportJobInput): Promise<MediaImportJob> {
    const row = await this.prisma.mediaImportJobRecord.create({
      data: {
        ...(input.id ? { id: input.id } : {}),
        status: input.status,
        phase: input.phase,
        entrypoint: input.entrypoint,
        requestedByType: input.requested_by_type,
        requestedById: input.requested_by_id,
        manifestVersion: input.manifest_version,
        intentFingerprint: input.intent_fingerprint,
        requestFingerprint: input.request_fingerprint,
        stagingManifestKey: input.staging_manifest_key,
        normalizedManifestKey: input.normalized_manifest_key ?? null,
        resultManifestKey: input.result_manifest_key ?? null,
        failureLogKey: input.failure_log_key ?? null,
        scopeSummaryJson: input.scope_summary_json as unknown as Prisma.InputJsonValue,
        totalItems: input.total_items ?? 0,
        processedItems: input.processed_items ?? 0,
        createdItems: input.created_items ?? 0,
        reusedItems: input.reused_items ?? 0,
        suppressedItems: input.suppressed_items ?? 0,
        failedItems: input.failed_items ?? 0,
        attemptCount: input.attempt_count ?? 0,
        failedPhase: input.failed_phase ?? null,
        errorCode: input.error_code ?? null,
        errorMessage: input.error_message ?? null,
        claimedByWorker: input.claimed_by_worker ?? null,
        startedAt: input.started_at ?? null,
        finishedAt: input.finished_at ?? null,
        lastHeartbeatAt: input.last_heartbeat_at ?? null,
        retryOfJobId: input.retry_of_job_id ?? null,
      },
    })
    return toDomain(row)
  }

  async findById(id: string): Promise<MediaImportJob | null> {
    const row = await this.prisma.mediaImportJobRecord.findUnique({ where: { id } })
    return row ? toDomain(row) : null
  }

  async findByRequestFingerprint(requestFingerprint: string): Promise<MediaImportJob | null> {
    const row = await this.prisma.mediaImportJobRecord.findUnique({ where: { requestFingerprint } })
    return row ? toDomain(row) : null
  }

  async listRecentByIntentFingerprint(intentFingerprint: string, limit = 10): Promise<MediaImportJob[]> {
    const rows = await this.prisma.mediaImportJobRecord.findMany({
      where: { intentFingerprint },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
    })
    return rows.map(toDomain)
  }

  async listExpiredInputArtifactJobs(
    now: Date,
    successRetentionMs: number,
    failedRetentionMs: number,
    limit = 50,
  ): Promise<MediaImportJob[]> {
    const successCutoff = new Date(now.getTime() - successRetentionMs)
    const failedCutoff = new Date(now.getTime() - failedRetentionMs)
    const rows = await this.prisma.mediaImportJobRecord.findMany({
      where: {
        AND: [
          {
            OR: [
              { stagingManifestKey: { not: null } },
              { normalizedManifestKey: { not: null } },
              { items: { some: { stagingObjectKey: { not: null } } } },
            ],
          },
          {
            OR: [
              {
                status: { in: ['succeeded', 'partial_succeeded'] },
                finishedAt: { lte: successCutoff },
              },
              {
                status: { in: ['failed', 'cancelled'] },
                finishedAt: { lte: failedCutoff },
              },
            ],
          },
        ],
      },
      orderBy: [{ finishedAt: 'asc' }, { createdAt: 'asc' }],
      take: limit,
    })
    return rows.map(toDomain)
  }

  async listExpiredResultArtifactJobs(
    now: Date,
    retentionMs: number,
    limit = 50,
  ): Promise<MediaImportJob[]> {
    const cutoff = new Date(now.getTime() - retentionMs)
    const rows = await this.prisma.mediaImportJobRecord.findMany({
      where: {
        status: { in: ['succeeded', 'partial_succeeded', 'failed', 'cancelled'] },
        finishedAt: { lte: cutoff },
        OR: [
          { resultManifestKey: { not: null } },
          { failureLogKey: { not: null } },
        ],
      },
      orderBy: [{ finishedAt: 'asc' }, { createdAt: 'asc' }],
      take: limit,
    })
    return rows.map(toDomain)
  }

  async update(id: string, patch: UpdateMediaImportJobPatch): Promise<MediaImportJob | null> {
    const row = await this.prisma.mediaImportJobRecord.update({
      where: { id },
      data: {
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.phase !== undefined ? { phase: patch.phase } : {}),
        ...(patch.staging_manifest_key !== undefined ? { stagingManifestKey: patch.staging_manifest_key } : {}),
        ...(patch.normalized_manifest_key !== undefined ? { normalizedManifestKey: patch.normalized_manifest_key } : {}),
        ...(patch.result_manifest_key !== undefined ? { resultManifestKey: patch.result_manifest_key } : {}),
        ...(patch.failure_log_key !== undefined ? { failureLogKey: patch.failure_log_key } : {}),
        ...(patch.scope_summary_json !== undefined
          ? { scopeSummaryJson: patch.scope_summary_json as unknown as Prisma.InputJsonValue }
          : {}),
        ...(patch.total_items !== undefined ? { totalItems: patch.total_items } : {}),
        ...(patch.processed_items !== undefined ? { processedItems: patch.processed_items } : {}),
        ...(patch.created_items !== undefined ? { createdItems: patch.created_items } : {}),
        ...(patch.reused_items !== undefined ? { reusedItems: patch.reused_items } : {}),
        ...(patch.suppressed_items !== undefined ? { suppressedItems: patch.suppressed_items } : {}),
        ...(patch.failed_items !== undefined ? { failedItems: patch.failed_items } : {}),
        ...(patch.attempt_count !== undefined ? { attemptCount: patch.attempt_count } : {}),
        ...(patch.failed_phase !== undefined ? { failedPhase: patch.failed_phase } : {}),
        ...(patch.error_code !== undefined ? { errorCode: patch.error_code } : {}),
        ...(patch.error_message !== undefined ? { errorMessage: patch.error_message } : {}),
        ...(patch.claimed_by_worker !== undefined ? { claimedByWorker: patch.claimed_by_worker } : {}),
        ...(patch.started_at !== undefined ? { startedAt: patch.started_at } : {}),
        ...(patch.finished_at !== undefined ? { finishedAt: patch.finished_at } : {}),
        ...(patch.last_heartbeat_at !== undefined ? { lastHeartbeatAt: patch.last_heartbeat_at } : {}),
      },
    }).catch((error) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return null
      }
      throw error
    })
    return row ? toDomain(row) : null
  }

  async claimNextReady(input: ClaimMediaImportJobInput): Promise<MediaImportJob | null> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      WITH capacity AS (
        SELECT COUNT(*) FILTER (WHERE status = 'running')::int AS running_jobs
        FROM media_import_jobs
      ),
      next_job AS (
        SELECT job.id
        FROM media_import_jobs AS job
        CROSS JOIN capacity
        WHERE job.status IN ('staged', 'queued')
          AND capacity.running_jobs < ${input.global_concurrency}
        ORDER BY job.created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      UPDATE media_import_jobs AS job
      SET
        status = 'running',
        claimed_by_worker = ${input.worker_id},
        started_at = COALESCE(job.started_at, ${input.now}),
        last_heartbeat_at = ${input.now},
        attempt_count = job.attempt_count + 1,
        updated_at = NOW()
      WHERE job.id IN (SELECT id FROM next_job)
      RETURNING job.id
    `)
    const row = rows[0] ?? null
    if (!row?.id) return null
    const claimed = await this.prisma.mediaImportJobRecord.findUnique({ where: { id: row.id } })
    return claimed ? toDomain(claimed) : null
  }

  async touchHeartbeat(id: string, heartbeatAt: Date): Promise<MediaImportJob | null> {
    return this.update(id, {
      last_heartbeat_at: heartbeatAt,
    })
  }

  async markExpiredStagedJobs(now: Date, staleAfterMs: number): Promise<MediaImportJob[]> {
    const threshold = new Date(now.getTime() - staleAfterMs)
    await this.prisma.mediaImportJobRecord.updateMany({
      where: {
        status: { in: ['staged', 'queued'] },
        createdAt: { lte: threshold },
      },
      data: {
        status: 'failed',
        errorCode: 'staging_expired',
        errorMessage: 'staged import job expired before processing',
        finishedAt: now,
      },
    })
    const rows = await this.prisma.mediaImportJobRecord.findMany({
      where: {
        status: 'failed',
        errorCode: 'staging_expired',
        finishedAt: now,
      },
    })
    return rows.map(toDomain)
  }

  async markTimedOutRunningJobs(now: Date, timeoutMs: number): Promise<MediaImportJob[]> {
    const threshold = new Date(now.getTime() - timeoutMs)
    await this.prisma.mediaImportJobRecord.updateMany({
      where: {
        status: 'running',
        OR: [
          { lastHeartbeatAt: { lte: threshold } },
          { lastHeartbeatAt: null, startedAt: { lte: threshold } },
        ],
      },
      data: {
        status: 'queued',
        claimedByWorker: null,
      },
    })
    const rows = await this.prisma.mediaImportJobRecord.findMany({
      where: {
        status: 'queued',
        updatedAt: { gte: threshold },
      },
      orderBy: [{ updatedAt: 'desc' }],
    })
    return rows.map(toDomain)
  }
}

function toDomain(row: PrismaMediaImportJobRecord): MediaImportJob {
  return {
    id: row.id,
    status: row.status as MediaImportJob['status'],
    phase: row.phase as MediaImportJob['phase'],
    entrypoint: row.entrypoint as MediaImportJob['entrypoint'],
    requested_by_type: row.requestedByType as MediaImportJob['requested_by_type'],
    requested_by_id: row.requestedById,
    manifest_version: row.manifestVersion,
    intent_fingerprint: row.intentFingerprint,
    request_fingerprint: row.requestFingerprint,
    staging_manifest_key: row.stagingManifestKey,
    normalized_manifest_key: row.normalizedManifestKey,
    result_manifest_key: row.resultManifestKey,
    failure_log_key: row.failureLogKey,
    scope_summary_json: row.scopeSummaryJson as unknown as MediaImportJob['scope_summary_json'],
    total_items: row.totalItems,
    processed_items: row.processedItems,
    created_items: row.createdItems,
    reused_items: row.reusedItems,
    suppressed_items: row.suppressedItems,
    failed_items: row.failedItems,
    attempt_count: row.attemptCount,
    failed_phase: row.failedPhase as MediaImportJob['failed_phase'],
    error_code: row.errorCode,
    error_message: row.errorMessage,
    claimed_by_worker: row.claimedByWorker,
    started_at: row.startedAt,
    finished_at: row.finishedAt,
    last_heartbeat_at: row.lastHeartbeatAt,
    retry_of_job_id: row.retryOfJobId,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }
}
