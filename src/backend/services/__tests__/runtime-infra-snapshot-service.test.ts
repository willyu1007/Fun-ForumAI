import { describe, expect, it } from 'vitest'
import {
  RuntimeInfraSnapshotService,
  buildProcessSection,
  probePostgresSection,
  probeRedisQueueSection,
  type InfraSnapshotSection,
} from '../runtime-infra-snapshot-service.js'

const okSection = (summary: string): InfraSnapshotSection => ({ status: 'ok', summary })
const skippedSection = (summary: string): InfraSnapshotSection => ({ status: 'skipped', summary })

describe('RuntimeInfraSnapshotService.snapshot', () => {
  it('aggregates section results and reports the worst overall status', async () => {
    const service = new RuntimeInfraSnapshotService({
      now: () => new Date('2026-04-27T10:00:00.000Z'),
      pollIntervalMs: 15_000,
      process: () => okSection('process ok'),
      http: () => okSection('http ok'),
      postgres: () => ({ status: 'warn', summary: 'slow', metrics: {} }),
      redisQueue: () => okSection('redis ok'),
      sse: () => okSection('sse ok'),
      llm: () => okSection('llm ok'),
      storageMedia: () => skippedSection('storage skipped'),
    })

    const snap = await service.snapshot()
    expect(snap.generated_at).toBe('2026-04-27T10:00:00.000Z')
    expect(snap.poll_interval_ms).toBe(15_000)
    expect(snap.overall_status).toBe('warn')
    expect(snap.sections.postgres.status).toBe('warn')
    expect(snap.sections.storageMedia.status).toBe('skipped')
  })

  it('returns partial results when one section throws — overall status reflects the failure', async () => {
    const service = new RuntimeInfraSnapshotService({
      process: () => okSection('process ok'),
      http: () => {
        throw new Error('http telemetry collector exploded')
      },
      postgres: () => okSection('postgres ok'),
      redisQueue: () => okSection('redis ok'),
      sse: () => okSection('sse ok'),
      llm: () => okSection('llm ok'),
      storageMedia: () => okSection('storage ok'),
    })

    const snap = await service.snapshot()
    expect(snap.sections.http.status).toBe('critical')
    expect(snap.sections.http.error_code).toBe('snapshot_section_error')
    expect(snap.sections.http.error_message_redacted).toContain('http telemetry collector exploded')
    expect(snap.sections.process.status).toBe('ok')
    expect(snap.overall_status).toBe('critical')
  })

  it('treats critical > warn > unknown > ok when escalating', async () => {
    const service = new RuntimeInfraSnapshotService({
      process: () => ({ status: 'unknown' }),
      http: () => okSection('a'),
      postgres: () => okSection('b'),
      redisQueue: () => ({ status: 'critical' }),
      sse: () => okSection('c'),
      llm: () => ({ status: 'warn' }),
      storageMedia: () => okSection('d'),
    })
    const snap = await service.snapshot()
    expect(snap.overall_status).toBe('critical')
  })
})

describe('buildProcessSection', () => {
  it('returns ok with metrics from process state', () => {
    const section = buildProcessSection({
      uptimeSeconds: 1234.5,
      rssBytes: 100,
      heapUsedBytes: 50,
      buildFingerprint: 'sha:abc',
      nodeEnv: 'test',
    })
    expect(section.status).toBe('ok')
    expect(section.metrics).toMatchObject({
      uptime_seconds: 1235,
      rss_bytes: 100,
      heap_used_bytes: 50,
      build_fingerprint: 'sha:abc',
      node_env: 'test',
    })
  })
})

describe('probePostgresSection', () => {
  it('returns skipped when persistence is disabled', async () => {
    const section = await probePostgresSection({ enabled: false, ping: async () => {} })
    expect(section.status).toBe('skipped')
  })

  it('returns ok with low latency', async () => {
    const section = await probePostgresSection({
      enabled: true,
      ping: async () => {},
    })
    expect(section.status).toBe('ok')
    expect(section.latency_ms).toBeGreaterThanOrEqual(0)
  })

  it('returns warn when latency crosses the warn threshold', async () => {
    const section = await probePostgresSection({
      enabled: true,
      ping: async () => {
        await new Promise((resolve) => setTimeout(resolve, 80))
      },
      thresholdWarnMs: 50,
      thresholdCriticalMs: 5000,
    })
    expect(section.status).toBe('warn')
  })

  it('returns critical with sanitized error message when ping throws', async () => {
    const section = await probePostgresSection({
      enabled: true,
      ping: async () => {
        throw new Error('connection refused on 127.0.0.1:5432')
      },
    })
    expect(section.status).toBe('critical')
    expect(section.error_code).toBe('postgres_ping_failed')
    expect(section.error_message_redacted).toContain('connection refused')
  })
})

describe('probeRedisQueueSection', () => {
  it('returns skipped when Redis runtime queue is not enabled', async () => {
    const section = await probeRedisQueueSection({
      enabled: false,
      ping: async () => {},
      queueSize: async () => 0,
      oldestTimestampMs: async () => null,
    })
    expect(section.status).toBe('skipped')
  })

  it('reports queue size and oldest event age and stays ok under thresholds', async () => {
    const fixedNow = 1_700_000_000_000
    const section = await probeRedisQueueSection({
      enabled: true,
      ping: async () => {},
      queueSize: async () => 50,
      oldestTimestampMs: async () => fixedNow - 10_000,
      now: () => fixedNow,
    })
    expect(section.status).toBe('ok')
    expect(section.metrics).toMatchObject({
      queue_size: 50,
      oldest_event_age_ms: 10_000,
    })
  })

  it('escalates to critical when queue size is very large', async () => {
    const fixedNow = 1_700_000_000_000
    const section = await probeRedisQueueSection({
      enabled: true,
      ping: async () => {},
      queueSize: async () => 5500,
      oldestTimestampMs: async () => null,
      now: () => fixedNow,
    })
    expect(section.status).toBe('critical')
  })

  it('reports critical when ping fails', async () => {
    const section = await probeRedisQueueSection({
      enabled: true,
      ping: async () => {
        throw new Error('timeout connecting to redis')
      },
      queueSize: async () => 0,
      oldestTimestampMs: async () => null,
    })
    expect(section.status).toBe('critical')
    expect(section.error_code).toBe('redis_queue_probe_failed')
  })
})
