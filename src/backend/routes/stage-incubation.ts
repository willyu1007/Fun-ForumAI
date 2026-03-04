import fs from 'node:fs'
import path from 'node:path'
import { Router, type IRouter } from 'express'
import { requireHumanAuth, requireAdmin } from '../middleware/human-auth.js'
import { agentService, communityRepo, stageTierService, incubationService, aftershowService } from '../container.js'
import { config } from '../lib/config.js'
import { ForbiddenError, NotFoundError, ValidationError } from '../lib/errors.js'
import { validate } from '../validation/validate.js'
import { parseStageSpecV1, resolveStageSpecFromRules, setStageSpecIntoRules } from '../stage/index.js'
import { applySeasonRotationAtomic, StageTemplateValidationError } from '../stage/stage-template-ops.js'
import {
  patchCommunityStageSpecSchema,
  triggerAftershowSchema,
  createIncubationGrantSchema,
  createIncubationReviewVerdictSchema,
  adminSeasonRotateSchema,
} from '../validation/schemas.js'

export const stageIncubationRouter: IRouter = Router()

stageIncubationRouter.get('/communities/:communityId/stage-spec', requireHumanAuth, async (req, res) => {
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

stageIncubationRouter.patch(
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

stageIncubationRouter.get('/agents/:agentId/stage-tier', requireHumanAuth, async (req, res) => {
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

stageIncubationRouter.post(
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

stageIncubationRouter.get('/incubation/jobs/:jobId', requireHumanAuth, async (req, res) => {
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

stageIncubationRouter.post(
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

stageIncubationRouter.post(
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

stageIncubationRouter.post(
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
