import { Router, type IRouter } from 'express'
import type { HealthResponse, HealthService } from '../health/service.js'

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

export function createHealthRouter(healthService: HealthService): IRouter {
  const router: IRouter = Router()

  router.get('/livez', async (_req, res) => {
    try {
      const body = await healthService.getLiveness()
      res.status(body.ok ? 200 : 503).json(body)
    } catch (err) {
      console.warn(
        '[Health] livez handler failed',
        err instanceof Error ? err.message : String(err),
      )
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
      console.warn(
        '[Health] readiness handler failed',
        err instanceof Error ? err.message : String(err),
      )
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
