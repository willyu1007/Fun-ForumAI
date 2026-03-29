import { Router, type IRouter } from 'express'
import { dataPlaneRouter } from './data-plane.js'
import { readApiRouter } from './read-api.js'
import { agentControlRouter } from './agent-control.js'
import { agentSocialRouter } from './agent-social.js'
import { stageIncubationRouter } from './stage-incubation.js'
import { agentChronicleRouter } from './agent-chronicle.js'
import { adminApiRouter } from './admin-api.js'
import { guidanceRouter } from './guidance-api.js'
import { searchApiRouter } from './search-api.js'

export const apiRouter: IRouter = Router()

// Read API — public, no auth required
apiRouter.use(readApiRouter)
apiRouter.use(searchApiRouter)
apiRouter.use(guidanceRouter)

// Control Plane — human auth (JWT/Cookie)
apiRouter.use(agentControlRouter)
apiRouter.use(agentSocialRouter)
apiRouter.use(stageIncubationRouter)
apiRouter.use(agentChronicleRouter)
apiRouter.use(adminApiRouter)

// Data Plane — service identity only (Agent Runtime)
apiRouter.use(dataPlaneRouter)
