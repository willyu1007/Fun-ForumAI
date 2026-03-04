import fs from 'node:fs'
import path from 'node:path'
import { Router, type IRouter } from 'express'
import multer from 'multer'
import { requireHumanAuth, requireAdmin } from '../middleware/human-auth.js'
import { agentService, governanceAdapter, runtimeLoop, llmClient, eventQueue, postScheduler, sseHub, relationService, humanParticipationService, inclinationAssetService, achievementChronicleService, agentCommunityMembershipService, communityRepo, stageTierService, incubationService, aftershowService } from '../container.js'
import { config } from '../lib/config.js'
import { richCommunitiesMetrics } from '../lib/rich-communities-metrics.js'
import { ForbiddenError, NotFoundError, ValidationError } from '../lib/errors.js'
import { ensureDevAuthUserPersisted } from '../lib/dev-auth-user.js'
import { validate } from '../validation/validate.js'
import { runtimeFeatureMetrics } from '../runtime/runtime-feature-metrics.js'
import { parseStageSpecV1, resolveStageSpecFromRules, setStageSpecIntoRules } from '../stage/index.js'
import { applySeasonRotationAtomic, StageTemplateValidationError } from '../stage/stage-template-ops.js'
import {
  createAgentSchema,
  updateAgentConfigSchema,
  updateAgentMembershipsSchema,
  patchAgentMembershipStatusSchema,
  patchCommunityStageSpecSchema,
  triggerAftershowSchema,
  createIncubationGrantSchema,
  createIncubationReviewVerdictSchema,
  updateAgentProfileSchema,
  governanceActionSchema,
  adminSeasonRotateSchema,
} from '../validation/schemas.js'

export const controlPlaneRouter: IRouter = Router()

const inclinationUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
})

controlPlaneRouter.post('/agents', requireHumanAuth, validate(createAgentSchema), async (req, res) => {
  await ensureDevAuthUserPersisted(req.user!)
  const agent = await agentService.createAgentPersisted({
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
  async (req, res) => {
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

    const result = await agentCommunityMembershipService.patchMemberships({
      agent_id: agentId,
      add: req.body.add ?? [],
      remove: req.body.remove ?? [],
      role: req.body.role,
      actor_user_id: actor.userId,
    })
    res.json({ data: result })
  },
)

controlPlaneRouter.patch(
  '/agents/:agentId/memberships/:communityId/status',
  requireHumanAuth,
  validate(patchAgentMembershipStatusSchema),
  async (req, res) => {
    if (!config.features.membershipStatusV1) {
      res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Membership status control is disabled by feature flag.' },
      })
      return
    }

    const agentId = String(req.params.agentId)
    const communityId = String(req.params.communityId)
    const actor = req.user!
    const existing = agentService.getAgent(agentId)
    const isAllowed = actor.role === 'admin' || existing.owner_id === actor.userId
    if (!isAllowed) {
      throw new ForbiddenError('Only owner or admin can update membership status')
    }

    const data = await agentCommunityMembershipService.updateMembershipStatus({
      agent_id: agentId,
      community_id: communityId,
      status: req.body.status,
      reason: req.body.reason,
      actor_user_id: actor.userId,
      actor_role: actor.role,
    })

    res.json({ data })
  },
)

controlPlaneRouter.get('/communities/:communityId/stage-spec', requireHumanAuth, async (req, res) => {
  if (!config.features.stageSpecV1) {
    res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'StageSpec API is disabled by feature flag.' },
    })
    return
  }

  const communityId = String(req.params.communityId)
  const community = communityRepo.findById(communityId)
  if (!community) {
    throw new NotFoundError('Community', communityId)
  }

  const resolved = resolveStageSpecFromRules(community.rules_json, { community_id: communityId })
  res.json({
    data: {
      community_id: communityId,
      stage_spec: resolved.stage_spec,
      meta: {
        used_fallback: resolved.used_fallback,
        errors: resolved.errors,
      },
    },
  })
})

controlPlaneRouter.patch(
  '/communities/:communityId/stage-spec',
  requireHumanAuth,
  requireAdmin,
  validate(patchCommunityStageSpecSchema),
  async (req, res) => {
    if (!config.features.stageSpecV1) {
      res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'StageSpec API is disabled by feature flag.' },
      })
      return
    }

    const communityId = String(req.params.communityId)
    const community = communityRepo.findById(communityId)
    if (!community) {
      throw new NotFoundError('Community', communityId)
    }

    const stageSpec = parseStageSpecV1(req.body)
    const nextRules = setStageSpecIntoRules(community.rules_json, stageSpec)
    const updated = communityRepo.update(communityId, {
      rules_json: nextRules,
    })
    if (!updated) {
      throw new NotFoundError('Community', communityId)
    }

    res.json({
      data: {
        community_id: communityId,
        stage_spec: stageSpec,
      },
    })
  },
)

controlPlaneRouter.get('/agents/:agentId/stage-tier', requireHumanAuth, async (req, res) => {
  if (!config.features.stageTierV1) {
    res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Stage tier API is disabled by feature flag.' },
    })
    return
  }

  const agentId = String(req.params.agentId)
  const actor = req.user!
  const existing = agentService.getAgent(agentId)
  const isAllowed = actor.role === 'admin' || existing.owner_id === actor.userId
  if (!isAllowed) {
    throw new ForbiddenError('Only owner or admin can access stage tier')
  }

  const snapshot = await stageTierService.getSnapshot(agentId)
  res.json({
    data: {
      agent_id: agentId,
      tier: snapshot.tier,
      score: snapshot.score,
      achievement_points: snapshot.achievement_points,
      chronicle_points: snapshot.chronicle_points,
      trust_penalty: snapshot.trust_penalty,
      reasoning: snapshot.reasoning,
      updated_at: snapshot.updated_at.toISOString(),
    },
  })
})

controlPlaneRouter.post(
  '/posts/:postId/aftershow/trigger',
  requireHumanAuth,
  validate(triggerAftershowSchema),
  async (req, res) => {
    if (!config.features.aftershowV1) {
      res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Aftershow API is disabled by feature flag.' },
      })
      return
    }

    const result = await aftershowService.trigger({
      post_id: String(req.params.postId),
      triggered_by_user_id: req.user!.userId,
      actor_role: req.user!.role,
      mode: req.body.mode,
      force: req.body.force,
    })

    res.status(201).json({ data: result })
  },
)

controlPlaneRouter.get('/incubation/jobs/:jobId', requireHumanAuth, async (req, res) => {
  if (!config.features.incubationV1) {
    res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Incubation API is disabled by feature flag.' },
    })
    return
  }

  const result = await incubationService.getJob(String(req.params.jobId))
  if (req.user!.role !== 'admin') {
    const proposer = agentService.getAgent(result.job.proposer_agent_id)
    const isOwner = proposer.owner_id === req.user!.userId
    const isReviewer = result.grants.some((item) => item.reviewer_user_id === req.user!.userId)
    if (!isOwner && !isReviewer) {
      throw new ForbiddenError('Only admin, owner, or assigned reviewer can access incubation job details')
    }
  }
  res.json({ data: result })
})

controlPlaneRouter.post(
  '/incubation/jobs/:jobId/grant',
  requireHumanAuth,
  validate(createIncubationGrantSchema),
  async (req, res) => {
    if (!config.features.incubationV1) {
      res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Incubation API is disabled by feature flag.' },
      })
      return
    }

    if (req.user!.role !== 'admin') {
      throw new ForbiddenError('Only admin can grant incubation jobs')
    }

    const grant = await incubationService.grantJob({
      job_id: String(req.params.jobId),
      actor_user_id: req.user!.userId,
      reason: req.body.reason,
      ttl_hours: req.body.ttl_hours,
      scope: req.body.scope,
      anonymity_level: req.body.anonymity_level,
      quote_policy: req.body.quote_policy,
      no_go_topics: req.body.no_go_topics,
    })

    res.status(201).json({ data: grant })
  },
)

controlPlaneRouter.post(
  '/incubation/jobs/:jobId/review-verdict',
  requireHumanAuth,
  validate(createIncubationReviewVerdictSchema),
  async (req, res) => {
    if (!config.features.incubationV1) {
      res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Incubation API is disabled by feature flag.' },
      })
      return
    }

    if (req.user!.role !== 'admin') {
      throw new ForbiddenError('Only admin can submit incubation review verdict')
    }

    const job = await incubationService.reviewJob({
      job_id: String(req.params.jobId),
      actor_user_id: req.user!.userId,
      verdict: req.body.verdict,
      reason: req.body.reason,
    })

    res.status(201).json({ data: job })
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
        node_env: config.nodeEnv,
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
  const richCounters = richCommunitiesMetrics.snapshot()

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
      rich_communities: richCounters,
    },
  })
})

controlPlaneRouter.post(
  '/admin/stage/season-rotate',
  requireHumanAuth,
  requireAdmin,
  validate(adminSeasonRotateSchema),
  async (req, res) => {
    if (!config.features.stageRotationV1) {
      res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Stage rotation is disabled by feature flag.' },
      })
      return
    }

    const openCount = req.body.open_count
    const dryRun = req.body.dry_run
    if (config.nodeEnv === 'production' && !dryRun) {
      throw new ForbiddenError('Production environment only supports dry_run=true. Use script workflow for real season rotation.')
    }
    const baseDir = path.join(process.cwd(), 'docs/stage-templates/v1')
    const manifestPath = path.join(baseDir, 'library.manifest.yaml')
    if (!fs.existsSync(manifestPath)) {
      throw new NotFoundError('StageTemplateManifest', manifestPath)
    }

    let rotationResult: {
      open_count: number
      dry_run: boolean
      replaced: Array<{ slot: string; template_id: string }>
      activated: Array<{ slot: string; template_id: string }>
      exported_templates: number
      launch_templates: number
    }
    try {
      rotationResult = applySeasonRotationAtomic({
        base_dir: baseDir,
        open_count: openCount,
        dry_run: dryRun,
      })
    } catch (error) {
      if (error instanceof StageTemplateValidationError) {
        throw new ValidationError(error.message)
      }
      throw error
    }

    res.json({
      data: {
        ...rotationResult,
      },
    })
  },
)

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
