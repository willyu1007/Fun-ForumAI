import type { Response, Router } from 'express'
import {
  kickoffRunArtifactService,
  kickoffRuntimeReadinessService,
  kickoffSeedService,
  warmPersistenceState,
  warmupGovernanceService,
} from '../container.js'
import { AppError } from '../lib/errors.js'
import { config } from '../lib/config.js'

const devKickoffRouterModulePath = '../../../.ai/.tmp/kickoff-local/src/backend/routes/dev-kickoff.js'
const { createDevKickoffRouter } = await import(devKickoffRouterModulePath) as {
  createDevKickoffRouter: (deps: Record<string, unknown>) => Router
}

function tryHandleAppError(res: Response, err: unknown): boolean {
  if (!(err instanceof AppError)) {
    return false
  }

  res.status(err.statusCode).json({
    error: {
      code: err.code,
      message: err.message,
      details: err.details,
    },
  })
  return true
}

export const devKickoffRouter = createDevKickoffRouter({
  allowDevTools: config.allowDevTools,
  warmPersistenceState,
  kickoffSeedService,
  kickoffRunArtifactService,
  kickoffRuntimeReadinessService,
  warmupGovernanceService,
  tryHandleAppError,
})
