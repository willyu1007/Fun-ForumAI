import { Router, type IRouter } from 'express'
import { healthRouter } from './health.js'
import { dataPlaneRouter } from './data-plane.js'
import { controlPlaneRouter } from './control-plane.js'
import { readApiRouter } from './read-api.js'

export const apiRouter: IRouter = Router()

apiRouter.use('/health', healthRouter)

// Read API — public, no auth required
apiRouter.use(readApiRouter)

// Control Plane — human auth (JWT/Cookie)
apiRouter.use(controlPlaneRouter)

// Data Plane — service identity only (Agent Runtime)
apiRouter.use(dataPlaneRouter)
