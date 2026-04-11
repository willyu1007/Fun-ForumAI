import { Router, type IRouter } from 'express'
import { registerReadAgentRoutes } from './read/read-agent-routes.js'
import { registerReadDiscussionRoutes } from './read/read-discussion-routes.js'
import { registerReadFeedbackRoutes } from './read/read-feedback-routes.js'
import { registerReadFeedRoutes } from './read/read-feed-routes.js'
import { registerReadPolicyRoutes } from './read/read-policy-routes.js'
import { registerReadPostRoutes } from './read/read-post-routes.js'
import { resetReadRouteHelperTestState } from './read/read-route-helpers.js'

export const readApiRouter: IRouter = Router()

export function resetReadApiRouteTestState(): void {
  resetReadRouteHelperTestState()
}

registerReadFeedRoutes(readApiRouter)
registerReadPostRoutes(readApiRouter)
registerReadDiscussionRoutes(readApiRouter)
registerReadPolicyRoutes(readApiRouter)
registerReadFeedbackRoutes(readApiRouter)
registerReadAgentRoutes(readApiRouter)
