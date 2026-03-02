import { Router, type IRouter } from 'express'
import multer from 'multer'
import { requireHumanAuth, requireAdmin } from '../middleware/human-auth.js'
import { agentService, governanceAdapter, runtimeLoop, llmClient, eventQueue, postScheduler, sseHub, relationService, humanParticipationService, inclinationAssetService, achievementChronicleService, agentCommunityMembershipService } from '../container.js'
import { config } from '../lib/config.js'
import { ForbiddenError, ValidationError } from '../lib/errors.js'
import { validate } from '../validation/validate.js'
import { runtimeFeatureMetrics } from '../runtime/runtime-feature-metrics.js'
import {
  createAgentSchema,
  updateAgentConfigSchema,
  updateAgentMembershipsSchema,
  updateAgentProfileSchema,
  governanceActionSchema,
} from '../validation/schemas.js'

export const controlPlaneRouter: IRouter = Router()

const inclinationUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
})

controlPlaneRouter.post('/agents', requireHumanAuth, validate(createAgentSchema), (req, res) => {
  const agent = agentService.createAgent({
    owner_id: req.user!.userId,
    ...req.body,
  })
  res.status(201).json({ data: agent })
})

controlPlaneRouter.patch(
  '/agents/:agentId/profile',
  requireHumanAuth,
  validate(updateAgentProfileSchema),
  (req, res) => {
    const agentId = String(req.params.agentId)
    const actor = req.user!
    const existing = agentService.getAgent(agentId)
    const isAllowed = actor.role === 'admin' || existing.owner_id === actor.userId
    if (!isAllowed) {
      throw new ForbiddenError('Only owner or admin can update agent profile')
    }

    const updated = agentService.updateProfile({
      agent_id: agentId,
      display_name: req.body.display_name,
      avatar_url: req.body.avatar_url,
    })
    res.json({ data: updated })
  },
)

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

controlPlaneRouter.post('/agents/:agentId/inclination-asset/url', requireHumanAuth, async (req, res) => {
  if (!config.features.multimodalAgentInclinationV1) {
    res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Multimodal agent inclination is disabled by feature flag.' },
    })
    return
  }

  const source_url = String(req.body?.source_url ?? '').trim()
  const owner_note = typeof req.body?.owner_note === 'string' ? req.body.owner_note : undefined
  if (!source_url) {
    throw new ValidationError('source_url is required')
  }

  const data = await inclinationAssetService.createFromUrl({
    agent_id: String(req.params.agentId),
    owner_user_id: req.user!.userId,
    source_url,
    owner_note,
  })

  res.status(201).json({ data })
})

controlPlaneRouter.post('/agents/:agentId/inclination-asset/upload', requireHumanAuth, async (req, res, next) => {
  if (!config.features.multimodalAgentInclinationV1) {
    res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Multimodal agent inclination is disabled by feature flag.' },
    })
    return
  }

  inclinationUpload.single('file')(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        next(new ValidationError('media exceeds 10MB limit'))
        return
      }
      next(new ValidationError('invalid upload payload'))
      return
    }

    try {
      if (!req.file || req.file.size <= 0) {
        throw new ValidationError('file is required')
      }

      const ownerNoteRaw = (req.body as Record<string, unknown> | undefined)?.owner_note
      const owner_note = typeof ownerNoteRaw === 'string' ? ownerNoteRaw : undefined

      const data = await inclinationAssetService.createFromUpload({
        agent_id: String(req.params.agentId),
        owner_user_id: req.user!.userId,
        owner_note,
        original_name: req.file.originalname,
        mime_type: req.file.mimetype,
        bytes: req.file.buffer,
      })

      res.status(201).json({ data })
    } catch (uploadErr) {
      next(uploadErr)
    }
  })
})

controlPlaneRouter.get('/agents/:agentId/inclination-asset/current', requireHumanAuth, (req, res) => {
  if (!config.features.multimodalAgentInclinationV1) {
    res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Multimodal agent inclination is disabled by feature flag.' },
    })
    return
  }
  const data = inclinationAssetService.getCurrent(String(req.params.agentId), req.user!.userId)
  res.json({ data })
})

controlPlaneRouter.delete('/agents/:agentId/inclination-asset/current', requireHumanAuth, (req, res) => {
  if (!config.features.multimodalAgentInclinationV1) {
    res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Multimodal agent inclination is disabled by feature flag.' },
    })
    return
  }
  const data = inclinationAssetService.cancelCurrent(String(req.params.agentId), req.user!.userId)
  res.json({ data })
})

controlPlaneRouter.post('/agents/:agentId/follow', requireHumanAuth, async (req, res) => {
  if (!config.features.humanParticipationV1) {
    res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Human participation is disabled by feature flag.' },
    })
    return
  }

  const result = await humanParticipationService.followAgent(req.user!.userId, String(req.params.agentId))
  res.status(201).json({ data: result })
})

controlPlaneRouter.delete('/agents/:agentId/follow', requireHumanAuth, async (req, res) => {
  if (!config.features.humanParticipationV1) {
    res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Human participation is disabled by feature flag.' },
    })
    return
  }

  const result = await humanParticipationService.unfollowAgent(req.user!.userId, String(req.params.agentId))
  res.json({ data: result })
})

controlPlaneRouter.patch(
  '/agents/:agentId/memberships',
  requireHumanAuth,
  validate(updateAgentMembershipsSchema),
  (req, res) => {
    if (!config.features.membershipsV1) {
      res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Membership management is disabled by feature flag.' },
      })
      return
    }

    const agentId = String(req.params.agentId)
    const actor = req.user!
    const existing = agentService.getAgent(agentId)
    const isAllowed = actor.role === 'admin' || existing.owner_id === actor.userId
    if (!isAllowed) {
      throw new ForbiddenError('Only owner or admin can update memberships')
    }

    const result = agentCommunityMembershipService.patchMemberships({
      agent_id: agentId,
      add: req.body.add ?? [],
      remove: req.body.remove ?? [],
      role: req.body.role,
      actor_user_id: actor.userId,
    })
    res.json({ data: result })
  },
)

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

controlPlaneRouter.get('/agents/:agentId/achievements', requireHumanAuth, async (req, res) => {
  const agentId = String(req.params.agentId)
  const actor = req.user!
  const existing = agentService.getAgent(agentId)
  const isAllowed = actor.role === 'admin' || existing.owner_id === actor.userId
  if (!isAllowed) {
    throw new ForbiddenError('Only owner or admin can access achievements')
  }

  if (actor.role === 'admin') {
    console.log('AchievementAccessAudit', JSON.stringify({
      actor_user_id: actor.userId,
      actor_role: actor.role,
      target_agent_id: agentId,
      endpoint: 'GET /v1/agents/:agentId/achievements',
      at: new Date().toISOString(),
    }))
  }

  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined
  const limitRaw = typeof req.query.limit === 'string' ? Number.parseInt(req.query.limit, 10) : undefined
  const result = await achievementChronicleService.listAchievementsForOwner(agentId, {
    cursor,
    limit: Number.isFinite(limitRaw) ? limitRaw : undefined,
  })
  res.json({ data: result.items, meta: { cursor: result.next_cursor } })
})

controlPlaneRouter.get('/agents/:agentId/chronicle', requireHumanAuth, async (req, res) => {
  const agentId = String(req.params.agentId)
  const actor = req.user!
  const existing = agentService.getAgent(agentId)
  const isAllowed = actor.role === 'admin' || existing.owner_id === actor.userId
  if (!isAllowed) {
    throw new ForbiddenError('Only owner or admin can access chronicle')
  }

  if (actor.role === 'admin') {
    console.log('AchievementAccessAudit', JSON.stringify({
      actor_user_id: actor.userId,
      actor_role: actor.role,
      target_agent_id: agentId,
      endpoint: 'GET /v1/agents/:agentId/chronicle',
      at: new Date().toISOString(),
    }))
  }

  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined
  const limitRaw = typeof req.query.limit === 'string' ? Number.parseInt(req.query.limit, 10) : undefined
  const includeFolded = String(req.query.include_folded ?? 'false') === 'true'

  const result = await achievementChronicleService.listChronicleForOwner(agentId, {
    cursor,
    limit: Number.isFinite(limitRaw) ? limitRaw : undefined,
    include_folded: includeFolded,
  })

  res.json({
    data: result.items,
    meta: {
      cursor: result.next_cursor,
      folded_count: result.folded_count,
    },
  })
})

controlPlaneRouter.get('/me/followed-agents', requireHumanAuth, (req, res) => {
  if (!config.features.humanParticipationV1) {
    res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Human participation is disabled by feature flag.' },
    })
    return
  }

  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined
  const limitRaw = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 20
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 20

  const result = humanParticipationService.listFollowedAgents({
    user_id: req.user!.userId,
    cursor,
    limit,
  })

  res.json({ data: result.items, meta: { cursor: result.next_cursor } })
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
      relations: relationService ? relationService.getMetrics().snapshot() : null,
    },
  })
})

controlPlaneRouter.get('/admin/runtime/features', requireHumanAuth, requireAdmin, (_req, res) => {
  if (!config.features.runtimeFeaturesV1) {
    res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Runtime feature observability is disabled by feature flag.' },
    })
    return
  }

  const counters = runtimeFeatureMetrics.snapshot()

  res.json({
    data: {
      flags: config.features,
      runtime: {
        queue_backend: config.runtime.queueBackend,
        leader_backend: config.runtime.leaderBackend,
        llm_provider: config.llm.provider,
        llm_model: config.llm.model,
      },
      counters,
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

controlPlaneRouter.post(
  '/admin/relations/unblock',
  requireHumanAuth,
  requireAdmin,
  async (req, res) => {
    const fromAgentId = typeof req.body?.from_agent_id === 'string' ? req.body.from_agent_id : ''
    const toAgentId = typeof req.body?.to_agent_id === 'string' ? req.body.to_agent_id : ''
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : ''

    if (!fromAgentId || !toAgentId || !reason.trim()) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'from_agent_id, to_agent_id and reason are required',
        },
      })
      return
    }

    if (!relationService) {
      res.status(503).json({ error: { code: 'SERVICE_UNAVAILABLE', message: 'Social graph service unavailable' } })
      return
    }

    const relation = await relationService.adminUnblock(fromAgentId, toAgentId, reason.trim())
    res.json({ data: relation })
  },
)
