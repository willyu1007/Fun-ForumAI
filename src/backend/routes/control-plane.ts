import { Router, type IRouter } from 'express'
import { requireHumanAuth, requireAdmin } from '../middleware/human-auth.js'
import { agentService, governanceAdapter, runtimeLoop, llmClient, eventQueue, postScheduler, sseHub } from '../container.js'
import { config } from '../lib/config.js'
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
    const agentId = String(req.params.agentId)
    const config = agentService.updateConfig(
      agentId,
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
    const agentId = String(req.params.agentId)
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined
    const limitStr = typeof req.query.limit === 'string' ? req.query.limit : undefined
    const result = agentService.getAgentRuns(agentId, {
      cursor,
      limit: limitStr ? parseInt(limitStr, 10) : undefined,
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

controlPlaneRouter.get('/admin/runtime/stats', requireHumanAuth, requireAdmin, async (_req, res) => {
  const queueSize = await runtimeLoop.getQueueSize()
  const eventQueueSize = await eventQueue.size()
  res.json({
    data: {
      runtime: {
        running: runtimeLoop.isRunning,
        processing: runtimeLoop.isProcessing,
        queue_size: queueSize,
        is_leader: runtimeLoop.isLeader,
        llm_configured: llmClient.isConfigured,
        queue_backend: config.runtime.queueBackend,
        leader_backend: config.runtime.leaderBackend,
      },
      scheduler: postScheduler.stats,
      sse: sseHub.getStats(),
      event_queue: {
        size: eventQueueSize,
      },
    },
  })
})

controlPlaneRouter.post(
  '/admin/moderation/actions',
  requireHumanAuth,
  requireAdmin,
  validate(governanceActionSchema),
  async (req, res) => {
    const result = await governanceAdapter.execute({
      ...req.body,
      admin_user_id: req.user!.userId,
    })
    res.json({ data: result })
  },
)
