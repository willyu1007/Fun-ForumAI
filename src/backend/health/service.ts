import type { RuntimeBuildInfo } from '../lib/runtime-build-info.js'
import type { AppHealthStatus } from './state.js'

export type HealthCheckStatus = 'ok' | 'fail' | 'skipped'

export interface HealthResponse {
  ok: boolean
  service: string
  checks: {
    app: HealthCheckStatus
    db?: HealthCheckStatus
    redis?: HealthCheckStatus
  }
  version: string
  ts: string
}

export interface HealthService {
  getLiveness(): Promise<HealthResponse>
  getReadiness(): Promise<HealthResponse>
}

export interface DependencyProbeResult {
  status: HealthCheckStatus
  failure?: string
}

interface CachedReadinessResult {
  expiresAt: number
  db: DependencyProbeResult
  redis: DependencyProbeResult
}

interface HealthServiceDeps {
  state: {
    getAppStatus(): AppHealthStatus
  }
  getBuildInfo: () => RuntimeBuildInfo
  probeDb: () => Promise<DependencyProbeResult>
  probeRedis: () => Promise<DependencyProbeResult>
  readinessCacheTtlMs?: number
  logger?: Pick<Console, 'warn'>
  now?: () => number
}

interface HealthFailureLogPayload {
  scope: 'livez' | 'readyz'
  service: string
  failing_checks: string[]
  summary: string
  ts: string
}

export function createHealthService(deps: HealthServiceDeps): HealthService {
  const readinessCacheTtlMs = deps.readinessCacheTtlMs ?? 3_000
  const now = deps.now ?? (() => Date.now())
  const logger = deps.logger ?? console
  let readinessCache: CachedReadinessResult | null = null
  const lastFailureSignatureByScope = new Map<string, string>()

  function buildBaseResponse(ts: string): Omit<HealthResponse, 'ok' | 'checks'> {
    const buildInfo = deps.getBuildInfo()
    return {
      service: buildInfo.service_name,
      version: buildInfo.package_version ?? buildInfo.code_fingerprint,
      ts,
    }
  }

  function maybeLogFailure(
    scope: 'livez' | 'readyz',
    signaturePayload: Record<string, unknown>,
    logPayload: HealthFailureLogPayload,
  ): void {
    const signature = JSON.stringify(signaturePayload)
    if (signature === lastFailureSignatureByScope.get(scope)) return
    lastFailureSignatureByScope.set(scope, signature)
    logger.warn(`[Health] check failed ${JSON.stringify(logPayload)}`)
  }

  function clearFailureSignature(scope: string): void {
    lastFailureSignatureByScope.delete(scope)
  }

  async function getCachedOrProbeDependencies(): Promise<{
    db: DependencyProbeResult
    redis: DependencyProbeResult
  }> {
    const currentTs = now()
    if (readinessCache && readinessCache.expiresAt > currentTs) {
      return {
        db: readinessCache.db,
        redis: readinessCache.redis,
      }
    }

    const [db, redis] = await Promise.all([deps.probeDb(), deps.probeRedis()])
    readinessCache = {
      expiresAt: currentTs + readinessCacheTtlMs,
      db,
      redis,
    }
    return { db, redis }
  }

  return {
    async getLiveness(): Promise<HealthResponse> {
      const ts = new Date(now()).toISOString()
      const app = deps.state.getAppStatus()
      const baseResponse = buildBaseResponse(ts)
      const ok = app.live
      const response: HealthResponse = {
        ...baseResponse,
        ok,
        checks: {
          app: ok ? 'ok' : 'fail',
        },
      }

      if (ok) {
        clearFailureSignature('livez')
      } else {
        const summary = app.reason ?? 'unhealthy'
        maybeLogFailure(
          'livez',
          {
            app: summary,
          },
          {
            scope: 'livez',
            service: baseResponse.service,
            failing_checks: ['app'],
            summary,
            ts,
          },
        )
      }

      return response
    },

    async getReadiness(): Promise<HealthResponse> {
      const ts = new Date(now()).toISOString()
      const app = deps.state.getAppStatus()
      const baseResponse = buildBaseResponse(ts)

      if (!app.ready) {
        const response: HealthResponse = {
          ...baseResponse,
          ok: false,
          checks: {
            app: 'fail',
            db: 'skipped',
            redis: 'skipped',
          },
        }
        const summary = app.reason ?? 'not_ready'
        maybeLogFailure(
          'readyz',
          {
            app: summary,
          },
          {
            scope: 'readyz',
            service: baseResponse.service,
            failing_checks: ['app'],
            summary,
            ts,
          },
        )
        return response
      }

      const { db, redis } = await getCachedOrProbeDependencies()
      const ok = db.status !== 'fail' && redis.status !== 'fail'
      const response: HealthResponse = {
        ...baseResponse,
        ok,
        checks: {
          app: 'ok',
          db: db.status,
          redis: redis.status,
        },
      }

      if (ok) {
        clearFailureSignature('readyz')
      } else {
        const failedChecks = [
          ...(db.status === 'fail' ? ['db'] : []),
          ...(redis.status === 'fail' ? ['redis'] : []),
        ]
        const dbSummary = db.status === 'fail' ? db.failure ?? 'db_probe_failed' : db.status
        const redisSummary =
          redis.status === 'fail' ? redis.failure ?? 'redis_probe_failed' : redis.status
        maybeLogFailure(
          'readyz',
          {
            db: dbSummary,
            redis: redisSummary,
          },
          {
            scope: 'readyz',
            service: baseResponse.service,
            failing_checks: failedChecks,
            summary: failedChecks
              .map((check) => (check === 'db' ? `db=${dbSummary}` : `redis=${redisSummary}`))
              .join(', '),
            ts,
          },
        )
      }

      return response
    },
  }
}
