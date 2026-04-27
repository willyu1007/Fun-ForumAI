/**
 * Read-only infra snapshot for the admin "运行记录" console (T-301 Slice 4).
 *
 * The snapshot is computed on demand from existing counters and cheap pings.
 * Periodic snapshot rows MUST NOT be persisted as `RuntimeOperationRecord`.
 * One failed section MUST NOT fail the whole response — each section reports
 * its own status independently.
 */

export type InfraSnapshotStatus = 'ok' | 'warn' | 'critical' | 'unknown' | 'skipped'

export interface InfraSnapshotSection {
  status: InfraSnapshotStatus
  latency_ms?: number
  summary?: string
  metrics?: Record<string, unknown>
  error_code?: string
  error_message_redacted?: string
}

export type InfraSnapshotSectionKey =
  | 'process'
  | 'http'
  | 'postgres'
  | 'redisQueue'
  | 'sse'
  | 'llm'
  | 'storageMedia'

export interface InfraSnapshot {
  generated_at: string
  poll_interval_ms: number
  overall_status: InfraSnapshotStatus
  sections: Record<InfraSnapshotSectionKey, InfraSnapshotSection>
}

export interface RuntimeInfraSnapshotDeps {
  /** Wall-clock provider (overridable in tests). */
  now?: () => Date
  /** Recommended frontend polling interval, in ms. Default 15s per contract. */
  pollIntervalMs?: number

  process: () => Promise<InfraSnapshotSection> | InfraSnapshotSection
  http: () => Promise<InfraSnapshotSection> | InfraSnapshotSection
  postgres: () => Promise<InfraSnapshotSection> | InfraSnapshotSection
  redisQueue: () => Promise<InfraSnapshotSection> | InfraSnapshotSection
  sse: () => Promise<InfraSnapshotSection> | InfraSnapshotSection
  llm: () => Promise<InfraSnapshotSection> | InfraSnapshotSection
  storageMedia: () => Promise<InfraSnapshotSection> | InfraSnapshotSection
}

const STATUS_ORDER: Record<InfraSnapshotStatus, number> = {
  ok: 0,
  skipped: 0,
  unknown: 1,
  warn: 2,
  critical: 3,
}

function escalate(a: InfraSnapshotStatus, b: InfraSnapshotStatus): InfraSnapshotStatus {
  return STATUS_ORDER[a] >= STATUS_ORDER[b] ? a : b
}

function truncate(value: string, limit = 256): string {
  if (value.length <= limit) return value
  return `${value.slice(0, Math.max(0, limit - 1))}…`
}

async function safeRun(
  key: InfraSnapshotSectionKey,
  fn: () => Promise<InfraSnapshotSection> | InfraSnapshotSection,
): Promise<InfraSnapshotSection> {
  try {
    return await fn()
  } catch (err) {
    return {
      status: 'critical',
      error_code: 'snapshot_section_error',
      error_message_redacted: truncate(err instanceof Error ? err.message : String(err)),
      summary: `${key} section failed`,
    }
  }
}

export class RuntimeInfraSnapshotService {
  private readonly deps: RuntimeInfraSnapshotDeps
  private readonly pollIntervalMs: number

  constructor(deps: RuntimeInfraSnapshotDeps) {
    this.deps = deps
    this.pollIntervalMs = deps.pollIntervalMs ?? 15_000
  }

  async snapshot(): Promise<InfraSnapshot> {
    const sections = await this.collectSections()
    const overall = (Object.values(sections) as InfraSnapshotSection[]).reduce<InfraSnapshotStatus>(
      (acc, section) => escalate(acc, section.status),
      'ok',
    )
    return {
      generated_at: this.now().toISOString(),
      poll_interval_ms: this.pollIntervalMs,
      overall_status: overall,
      sections,
    }
  }

  private async collectSections(): Promise<Record<InfraSnapshotSectionKey, InfraSnapshotSection>> {
    const [process, http, postgres, redisQueue, sse, llm, storageMedia] = await Promise.all([
      safeRun('process', this.deps.process),
      safeRun('http', this.deps.http),
      safeRun('postgres', this.deps.postgres),
      safeRun('redisQueue', this.deps.redisQueue),
      safeRun('sse', this.deps.sse),
      safeRun('llm', this.deps.llm),
      safeRun('storageMedia', this.deps.storageMedia),
    ])
    return { process, http, postgres, redisQueue, sse, llm, storageMedia }
  }

  private now(): Date {
    return this.deps.now ? this.deps.now() : new Date()
  }
}

/**
 * Build a process-section probe from the standard Node.js process metrics.
 * Always returns `ok` status because process introspection cannot fail.
 */
export function buildProcessSection(input: {
  uptimeSeconds: number
  rssBytes: number
  heapUsedBytes: number
  buildFingerprint?: string | null
  nodeEnv: string
}): InfraSnapshotSection {
  return {
    status: 'ok',
    summary: `node ${input.nodeEnv} • uptime ${Math.round(input.uptimeSeconds)}s`,
    metrics: {
      uptime_seconds: Math.round(input.uptimeSeconds),
      rss_bytes: input.rssBytes,
      heap_used_bytes: input.heapUsedBytes,
      build_fingerprint: input.buildFingerprint ?? null,
      node_env: input.nodeEnv,
    },
  }
}

/**
 * Wrap a Postgres ping (e.g. `prisma.$queryRaw\`SELECT 1\``) into a section.
 * Returns `skipped` if persistence is not active in this environment.
 */
export async function probePostgresSection(input: {
  enabled: boolean
  ping: () => Promise<void>
  thresholdWarnMs?: number
  thresholdCriticalMs?: number
}): Promise<InfraSnapshotSection> {
  if (!input.enabled) {
    return { status: 'skipped', summary: 'Prisma persistence disabled' }
  }
  const warnMs = input.thresholdWarnMs ?? 200
  const criticalMs = input.thresholdCriticalMs ?? 1000
  const startedAt = Date.now()
  try {
    await input.ping()
    const latency = Date.now() - startedAt
    let status: InfraSnapshotStatus = 'ok'
    if (latency >= criticalMs) status = 'critical'
    else if (latency >= warnMs) status = 'warn'
    return {
      status,
      latency_ms: latency,
      summary: `SELECT 1 in ${latency}ms`,
      metrics: { ping_latency_ms: latency },
    }
  } catch (err) {
    return {
      status: 'critical',
      latency_ms: Date.now() - startedAt,
      error_code: 'postgres_ping_failed',
      error_message_redacted: truncate(err instanceof Error ? err.message : String(err)),
    }
  }
}

/**
 * Wrap a Redis ping + queue size + oldest event age into a section.
 * Returns `skipped` if Redis-backed runtime queue is not enabled.
 */
export async function probeRedisQueueSection(input: {
  enabled: boolean
  ping: () => Promise<void>
  queueSize: () => Promise<number>
  oldestTimestampMs: () => Promise<number | null>
  now?: () => number
}): Promise<InfraSnapshotSection> {
  if (!input.enabled) {
    return { status: 'skipped', summary: 'Redis runtime queue disabled' }
  }
  const now = input.now ? input.now() : Date.now()
  const startedAt = Date.now()
  try {
    await input.ping()
    const pingLatency = Date.now() - startedAt
    const [size, oldestTs] = await Promise.all([input.queueSize(), input.oldestTimestampMs()])
    const oldestAgeMs = oldestTs === null ? null : Math.max(0, now - oldestTs)
    let status: InfraSnapshotStatus = 'ok'
    if (size >= 5000 || (oldestAgeMs !== null && oldestAgeMs > 300_000)) status = 'critical'
    else if (size >= 1000 || (oldestAgeMs !== null && oldestAgeMs > 60_000)) status = 'warn'
    return {
      status,
      latency_ms: pingLatency,
      summary: `queue size ${size}${oldestAgeMs !== null ? `, oldest ${Math.round(oldestAgeMs / 1000)}s` : ''}`,
      metrics: {
        ping_latency_ms: pingLatency,
        queue_size: size,
        oldest_event_age_ms: oldestAgeMs,
      },
    }
  } catch (err) {
    return {
      status: 'critical',
      latency_ms: Date.now() - startedAt,
      error_code: 'redis_queue_probe_failed',
      error_message_redacted: truncate(err instanceof Error ? err.message : String(err)),
    }
  }
}
