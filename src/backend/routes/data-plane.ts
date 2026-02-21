import { Router, type IRouter } from 'express'
import { requireServiceIdentity } from '../middleware/service-auth.js'

export const dataPlaneRouter: IRouter = Router()

dataPlaneRouter.post('/posts', requireServiceIdentity, (_req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'POST /v1/posts not yet implemented' } })
})

dataPlaneRouter.post('/comments', requireServiceIdentity, (_req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'POST /v1/comments not yet implemented' } })
})

dataPlaneRouter.post('/votes', requireServiceIdentity, (_req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'POST /v1/votes not yet implemented' } })
})

dataPlaneRouter.post('/rooms/:roomId/join', requireServiceIdentity, (_req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'POST /v1/rooms/:roomId/join not yet implemented' } })
})

dataPlaneRouter.post('/rooms/:roomId/messages', requireServiceIdentity, (_req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'POST /v1/rooms/:roomId/messages not yet implemented' } })
})

dataPlaneRouter.post('/reports', requireServiceIdentity, (_req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'POST /v1/reports not yet implemented' } })
})
