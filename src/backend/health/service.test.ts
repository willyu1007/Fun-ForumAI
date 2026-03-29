import { describe, expect, it, vi } from 'vitest'
import { createHealthService } from './service.js'

const buildInfo = {
  service_name: 'llm-forum',
  package_name: 'llm-only-forum-chat',
  package_version: '0.1.0',
  node_version: 'v20.19.6',
  hostname: null,
  code_fingerprint: 'sha256:test',
  fingerprint_basis: [],
}

describe('health service', () => {
  it('caches readiness probe results for the configured TTL', async () => {
    let currentTs = 0
    const probeDb = vi.fn(async () => ({ status: 'ok' as const }))
    const probeRedis = vi.fn(async () => ({ status: 'ok' as const }))
    const service = createHealthService({
      state: {
        getAppStatus: () => ({ live: true, ready: true, reason: null }),
      },
      getBuildInfo: () => buildInfo,
      probeDb,
      probeRedis,
      readinessCacheTtlMs: 3_000,
      now: () => currentTs,
      logger: { warn: vi.fn() },
    })

    const first = await service.getReadiness()
    currentTs = 1_000
    const second = await service.getReadiness()
    currentTs = 4_000
    const third = await service.getReadiness()

    expect(first.ok).toBe(true)
    expect(second.ok).toBe(true)
    expect(third.ok).toBe(true)
    expect(probeDb).toHaveBeenCalledTimes(2)
    expect(probeRedis).toHaveBeenCalledTimes(2)
  })

  it('returns not-ready without probing dependencies when the app is draining', async () => {
    const probeDb = vi.fn(async () => ({ status: 'ok' as const }))
    const probeRedis = vi.fn(async () => ({ status: 'ok' as const }))
    const logger = { warn: vi.fn() }
    const service = createHealthService({
      state: {
        getAppStatus: () => ({ live: true, ready: false, reason: 'shutting_down' }),
      },
      getBuildInfo: () => buildInfo,
      probeDb,
      probeRedis,
      logger,
    })

    const readiness = await service.getReadiness()
    const liveness = await service.getLiveness()

    expect(readiness.ok).toBe(false)
    expect(readiness.checks).toEqual({
      app: 'fail',
      db: 'skipped',
      redis: 'skipped',
    })
    expect(liveness.ok).toBe(true)
    expect(liveness.checks).toEqual({ app: 'ok' })
    expect(probeDb).not.toHaveBeenCalled()
    expect(probeRedis).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledTimes(1)
  })

  it('deduplicates repeated readiness failure logs until the failure signature changes', async () => {
    const logger = { warn: vi.fn() }
    let dbFailure = 'db_down'
    const service = createHealthService({
      state: {
        getAppStatus: () => ({ live: true, ready: true, reason: null }),
      },
      getBuildInfo: () => buildInfo,
      probeDb: vi.fn(async () => ({ status: 'fail' as const, failure: dbFailure })),
      probeRedis: vi.fn(async () => ({ status: 'ok' as const })),
      readinessCacheTtlMs: 0,
      logger,
    })

    await service.getReadiness()
    await service.getReadiness()
    dbFailure = 'db_still_down'
    await service.getReadiness()

    expect(logger.warn).toHaveBeenCalledTimes(2)
    expect(logger.warn).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('"service":"llm-forum"'),
    )
    expect(logger.warn).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('"failing_checks":["db"]'),
    )
    expect(logger.warn).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('db=db_still_down'),
    )
  })
})
