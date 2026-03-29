import { Router, type IRouter } from 'express'
import type { ApiResponse } from '../lib/types.js'
import type { HealthResponse, HealthService } from '../health/service.js'

interface LegacyHealthData {
  status: 'ok' | 'fail'
  timestamp: string
  uptime: number
}

function buildUnexpectedFailureResponse(): HealthResponse {
  return {
    ok: false,
    service: 'unknown',
    checks: {
      app: 'fail',
      db: 'skipped',
      redis: 'skipped',
    },
    version: 'unknown',
    ts: new Date().toISOString(),
  }
}

function buildLegacyHealthResponse(body: HealthResponse): ApiResponse<LegacyHealthData> {
  return {
    data: {
      status: body.ok ? 'ok' : 'fail',
      timestamp: body.ts,
      uptime: process.uptime(),
    },
  }
}

function buildLegacyUnexpectedFailureResponse(): ApiResponse<LegacyHealthData> {
  return buildLegacyHealthResponse(buildUnexpectedFailureResponse())
}

export function createHealthRouter(healthService: HealthService): IRouter {
  const router: IRouter = Router()

  router.get('/livez', async (_req, res) => {
    try {
      const body = await healthService.getLiveness()
      res.status(body.ok ? 200 : 503).json(body)
    } catch (err) {
      console.warn('[Health] livez handler failed', err instanceof Error ? err.message : String(err))
      res.status(503).json(buildUnexpectedFailureResponse())
    }
  })

  async function respondReadiness(res: {
    status(code: number): { json(body: HealthResponse): void }
  }): Promise<void> {
    try {
      const body = await healthService.getReadiness()
      res.status(body.ok ? 200 : 503).json(body)
    } catch (err) {
      console.warn('[Health] readiness handler failed', err instanceof Error ? err.message : String(err))
      res.status(503).json(buildUnexpectedFailureResponse())
    }
  }

  router.get('/readyz', async (_req, res) => {
    await respondReadiness(res)
  })

  router.get('/health', async (_req, res) => {
    await respondReadiness(res)
  })

  return router
}

export function createLegacyApiHealthRouter(healthService: HealthService): IRouter {
  const router: IRouter = Router()

  router.get('/health', async (_req, res) => {
    try {
      const body = await healthService.getReadiness()
      res.status(body.ok ? 200 : 503).json(buildLegacyHealthResponse(body))
    } catch (err) {
      console.warn('[Health] legacy health handler failed', err instanceof Error ? err.message : String(err))
      res.status(503).json(buildLegacyUnexpectedFailureResponse())
    }
  })

  return router
}
