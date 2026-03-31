import { describe, expect, it, vi } from 'vitest'
import { createHealthRouter, createLegacyApiHealthRouter } from '../health.js'
import type { ApiResponse } from '../../lib/types.js'
import type { HealthResponse, HealthService } from '../../health/service.js'

function buildHealthResponse(response: HealthResponse): HealthResponse {
  return response
}

function createMockResponse<TBody>() {
  const state: {
    statusCode: number | null
    body: TBody | null
  } = {
    statusCode: null,
    body: null,
  }

  return {
    state,
    res: {
      status(code: number) {
        state.statusCode = code
        return this
      },
      json(body: TBody) {
        state.body = body
        return this
      },
    },
  }
}

async function invokeRoute<TBody>(
  routerFactory: (healthService: HealthService) => unknown,
  healthService: HealthService,
  path: '/livez' | '/readyz' | '/health',
) {
  const router = routerFactory(healthService) as unknown as {
    stack: Array<{
      route?: {
        path?: string
        stack: Array<{ handle: (req: unknown, res: unknown) => Promise<void> | void }>
      }
    }>
  }
  const layer = router.stack.find((item) => item.route?.path === path)
  if (!layer?.route) {
    throw new Error(`Route ${path} not found`)
  }

  const { state, res } = createMockResponse<TBody>()
  await layer.route.stack[0]!.handle({}, res)
  return state
}

describe('health routes', () => {
  it('maps livez and health responses to HTTP 200', async () => {
    const healthService: HealthService = {
      getLiveness: vi.fn(async () =>
        buildHealthResponse({
        ok: true,
        service: 'llm-forum',
        checks: { app: 'ok' },
        version: '0.1.0',
        ts: '2026-03-29T00:00:00.000Z',
        }),
      ),
      getReadiness: vi.fn(async () =>
        buildHealthResponse({
        ok: true,
        service: 'llm-forum',
        checks: { app: 'ok', db: 'ok', redis: 'ok' },
        version: '0.1.0',
        ts: '2026-03-29T00:00:00.000Z',
        }),
      ),
    }

    const livez = await invokeRoute<HealthResponse>(createHealthRouter, healthService, '/livez')
    const health = await invokeRoute<HealthResponse>(createHealthRouter, healthService, '/health')

    expect(livez.statusCode).toBe(200)
    expect(livez.body?.checks).toEqual({ app: 'ok' })
    expect(health.statusCode).toBe(200)
    expect(health.body?.checks).toEqual({ app: 'ok', db: 'ok', redis: 'ok' })
  })

  it('maps readiness failures to HTTP 503', async () => {
    const healthService: HealthService = {
      getLiveness: vi.fn(async () =>
        buildHealthResponse({
        ok: true,
        service: 'llm-forum',
        checks: { app: 'ok' },
        version: '0.1.0',
        ts: '2026-03-29T00:00:00.000Z',
        }),
      ),
      getReadiness: vi.fn(async () =>
        buildHealthResponse({
        ok: false,
        service: 'llm-forum',
        checks: { app: 'ok', db: 'fail', redis: 'ok' },
        version: '0.1.0',
        ts: '2026-03-29T00:00:00.000Z',
        }),
      ),
    }

    const res = await invokeRoute<HealthResponse>(createHealthRouter, healthService, '/readyz')

    expect(res.statusCode).toBe(503)
    expect(res.body?.ok).toBe(false)
    expect(res.body?.checks).toEqual({ app: 'ok', db: 'fail', redis: 'ok' })
  })

  it('preserves the legacy /v1/health ApiResponse wrapper contract', async () => {
    const healthService: HealthService = {
      getLiveness: vi.fn(async () =>
        buildHealthResponse({
        ok: true,
        service: 'llm-forum',
        checks: { app: 'ok' },
        version: '0.1.0',
        ts: '2026-03-29T00:00:00.000Z',
        }),
      ),
      getReadiness: vi.fn(async () =>
        buildHealthResponse({
        ok: false,
        service: 'llm-forum',
        checks: { app: 'ok', db: 'fail', redis: 'ok' },
        version: '0.1.0',
        ts: '2026-03-29T00:00:00.000Z',
        }),
      ),
    }

    const legacy = await invokeRoute<
      ApiResponse<{
        status: 'ok' | 'fail'
        timestamp: string
        uptime: number
      }>
    >(createLegacyApiHealthRouter, healthService, '/health')

    expect(legacy.statusCode).toBe(503)
    expect(legacy.body).toEqual({
      data: {
        status: 'fail',
        timestamp: '2026-03-29T00:00:00.000Z',
        uptime: expect.any(Number),
      },
    })
  })
})
