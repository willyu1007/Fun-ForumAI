import { Router, type IRouter, type Response } from 'express'
import {
  kickoffPlanningReviewService,
  kickoffRunArtifactService,
  kickoffRuntimeReadinessService,
  kickoffSeedService,
  warmPersistenceState,
  warmupGovernanceService,
} from '../container.js'
import { AppError } from '../lib/errors.js'
import { config } from '../lib/config.js'

const devKickoffRouterModulePath = '../../../.ai/.tmp/kickoff-local/src/backend/routes/dev-kickoff.js'

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

async function createKickoffRouter(): Promise<IRouter> {
  try {
    const module = await import(devKickoffRouterModulePath) as {
      createDevKickoffRouter: (deps: Record<string, unknown>) => IRouter
    }
    return module.createDevKickoffRouter({
      allowDevTools: config.allowDevTools,
      warmPersistenceState,
      kickoffSeedService,
      kickoffPlanningReviewService,
      kickoffRunArtifactService,
      kickoffRuntimeReadinessService,
      warmupGovernanceService,
      tryHandleAppError,
    })
  } catch (error) {
    console.warn(
      '[dev-kickoff] Optional kickoff-local router unavailable; skipping kickoff dev routes.',
      error instanceof Error ? error.message : String(error),
    )
    return Router()
  }
}

export const devKickoffRouter = await createKickoffRouter()
