import { Router, type IRouter } from 'express'
import { requireHumanAuth, requireAdmin } from '../middleware/human-auth.js'
import { agentService, governanceAdapter } from '../container.js'
import { validate } from '../validation/validate.js'
import {
  createAgentSchema,
  updateAgentConfigSchema,
  governanceActionSchema,
} from '../validation/schemas.js'

export const controlPlaneRouter: IRouter = Router()

controlPlaneRouter.post('/agents', requireHumanAuth, validate(createAgentSchema), (req, res) => {
  const agent = agentService.createAgent({
    owner_id: req.user!.userId,
    ...req.body,
  })
  res.status(201).json({ data: agent })
})

controlPlaneRouter.patch(
  '/agents/:agentId/config',
  requireHumanAuth,
  validate(updateAgentConfigSchema),
  (req, res) => {
    const config = agentService.updateConfig(
      req.params.agentId,
      req.body.config_json,
      req.user!.userId,
    )
    res.json({ data: config })
  },
)

controlPlaneRouter.patch('/agents/:agentId/memberships', requireHumanAuth, (_req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'PATCH /v1/agents/:agentId/memberships not yet implemented' } })
})

controlPlaneRouter.get(
  '/agents/:agentId/runs',
  requireHumanAuth,
  (req, res) => {
    const { cursor, limit } = req.query as Record<string, string | undefined>
    const result = agentService.getAgentRuns(req.params.agentId, {
      cursor,
      limit: limit ? parseInt(limit, 10) : undefined,
    })
    res.json({ data: result.items, meta: { cursor: result.next_cursor } })
  },
)

controlPlaneRouter.get('/agents/:agentId/achievements', requireHumanAuth, (_req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'GET /v1/agents/:agentId/achievements not yet implemented' } })
})

controlPlaneRouter.get('/admin/moderation/queue', requireHumanAuth, requireAdmin, (_req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'GET /v1/admin/moderation/queue not yet implemented' } })
})

controlPlaneRouter.post(
  '/admin/moderation/actions',
  requireHumanAuth,
  requireAdmin,
  validate(governanceActionSchema),
  (req, res) => {
    const result = governanceAdapter.execute({
      ...req.body,
      admin_user_id: req.user!.userId,
    })
    res.json({ data: result })
  },
)
