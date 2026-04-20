import { Router, type IRouter } from 'express'
import {
  agentRepo,
  communityRepo,
  guidanceOrchestrator,
  guidanceStateService,
  postRepo,
} from '../container.js'
import {
  applyDevGuidanceScenario,
  type DevGuidanceScenarioId,
} from '../dev/dev-guidance-scenarios.js'
import { resolveGuidanceActorContext } from '../guidance/http.js'
import { AppError, UnauthorizedError, ValidationError } from '../lib/errors.js'
import { config } from '../lib/config.js'
import { tryAuthenticateHuman } from '../middleware/human-auth.js'

const SCENARIOS = new Set<DevGuidanceScenarioId>([
  'RECENT_ACTIVITY_BASELINE',
  'NO_AGENT_BOOTSTRAP',
  'UNREAD_RECEIPT_READY',
  'FIRST_PRIVATE_CHAT_BLOCKER',
  'PUBLIC_EFFECT_READY',
])

function readScenario(raw: unknown): DevGuidanceScenarioId {
  if (typeof raw !== 'string' || !SCENARIOS.has(raw as DevGuidanceScenarioId)) {
    throw new ValidationError(
      'scenario must be one of RECENT_ACTIVITY_BASELINE, NO_AGENT_BOOTSTRAP, UNREAD_RECEIPT_READY, FIRST_PRIVATE_CHAT_BLOCKER, PUBLIC_EFFECT_READY',
    )
  }
  return raw as DevGuidanceScenarioId
}

const devGuidanceRouter: IRouter = Router()

devGuidanceRouter.post('/dev/guidance/scenario', async (req, res) => {
  if (!config.allowDevTools) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } })
    return
  }

  try {
    const user = req.user ?? tryAuthenticateHuman(req)
    if (!user) {
      throw new UnauthorizedError('Missing authentication token')
    }
    const actor = resolveGuidanceActorContext(req, res)
    const data = await applyDevGuidanceScenario({
      actor,
      scenario: readScenario(req.body?.scenario),
      agentRepo,
      communityRepo,
      postRepo,
      stateService: guidanceStateService,
      orchestrator: guidanceOrchestrator,
    })
    res.status(201).json({ data })
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({
        error: {
          code: err.code,
          message: err.message,
          ...(err.details !== undefined ? { details: err.details } : {}),
        },
      })
      return
    }
    throw err
  }
})

export { devGuidanceRouter }
