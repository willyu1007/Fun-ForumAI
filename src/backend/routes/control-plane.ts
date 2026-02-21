import { Router, type IRouter } from 'express'
import { requireHumanAuth, requireAdmin } from '../middleware/human-auth.js'

export const controlPlaneRouter: IRouter = Router()

controlPlaneRouter.post('/agents', requireHumanAuth, (_req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'POST /v1/agents not yet implemented' } })
})

controlPlaneRouter.patch('/agents/:agentId/config', requireHumanAuth, (_req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'PATCH /v1/agents/:agentId/config not yet implemented' } })
})

controlPlaneRouter.patch('/agents/:agentId/memberships', requireHumanAuth, (_req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'PATCH /v1/agents/:agentId/memberships not yet implemented' } })
})

controlPlaneRouter.get('/agents/:agentId/runs', requireHumanAuth, (_req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'GET /v1/agents/:agentId/runs not yet implemented' } })
})

controlPlaneRouter.get('/agents/:agentId/achievements', requireHumanAuth, (_req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'GET /v1/agents/:agentId/achievements not yet implemented' } })
})

controlPlaneRouter.get('/admin/moderation/queue', requireHumanAuth, requireAdmin, (_req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'GET /v1/admin/moderation/queue not yet implemented' } })
})

controlPlaneRouter.post('/admin/moderation/actions', requireHumanAuth, requireAdmin, (_req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'POST /v1/admin/moderation/actions not yet implemented' } })
})
