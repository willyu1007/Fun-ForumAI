import fs from 'node:fs'
import path from 'node:path'
import { Router, type IRouter } from 'express'
import { requireHumanAuth, requireAdmin } from '../middleware/human-auth.js'
import {
  agentService,
  communityRepo,
  stageTierService,
  incubationService,
  aftershowService,
  communityConfigService,
  roleAssignmentService,
} from '../container.js'
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
  createConfigProposalSchema,
  validateConfigProposalSchema,
  approveConfigProposalSchema,
  rejectConfigProposalSchema,
  applyConfigProposalSchema,
  rollbackConfigSchema,
  createRoleAssignmentSchema,
  updateRoleAssignmentSchema,
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
    if (config.features.controlPlaneConfigV1) {
      const proposal = await communityConfigService.createProposal({
        community_id: communityId,
        patch: { stage_spec_v1: stageSpec },
        summary: 'Update stage spec',
        reason: 'Compatibility patch from /stage-spec endpoint',
        proposed_by_user_id: req.user!.userId,
      })

      const validation = await communityConfigService.validateProposal({
        proposal_id: proposal.id,
        community_id: communityId,
        actor_user_id: req.user!.userId,
      })
      if (validation.validation_errors.length > 0) {
        throw new ValidationError(validation.validation_errors.join('; '))
      }

      const approved = await communityConfigService.approveProposal({
        proposal_id: proposal.id,
        community_id: communityId,
        actor_user_id: req.user!.userId,
        actor_role: req.user!.role,
      })

      const applied = await communityConfigService.applyProposal({
        proposal_id: approved.id,
        community_id: communityId,
        actor_user_id: req.user!.userId,
        actor_role: req.user!.role,
      })
      if (!applied.version) {
        throw new ValidationError('stage-spec compatibility flow expected immediate config application')
      }

      res.json({
        data: {
          community_id: communityId,
          stage_spec: stageSpec,
          config_patch_id: applied.patch.id,
          config_version_id: applied.version.id,
          config_version: applied.version.version,
        },
      })
      return
    }

    const nextRules = setStageSpecIntoRules(community.rules_json, stageSpec)
    const updated = communityRepo.update(communityId, { rules_json: nextRules })
    if (!updated) throw new NotFoundError('Community', communityId)

    res.json({
      data: {
        community_id: communityId,
        stage_spec: stageSpec,
      },
    })
  },
)

stageIncubationRouter.get('/communities/:communityId/config', requireHumanAuth, async (req, res) => {
  if (!config.features.controlPlaneConfigV1) {
    res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Control Plane config API is disabled by feature flag.' },
    })
    return
  }
  const data = await communityConfigService.getCurrentConfig(String(req.params.communityId))
  res.json({ data })
})

stageIncubationRouter.post(
  '/communities/:communityId/config/proposals',
  requireHumanAuth,
  validate(createConfigProposalSchema),
  async (req, res) => {
    if (!config.features.controlPlaneConfigV1) {
      res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Control Plane config API is disabled by feature flag.' },
      })
      return
    }

    const patch = await communityConfigService.createProposal({
      community_id: String(req.params.communityId),
      patch: req.body.patch,
      summary: req.body.summary,
      reason: req.body.reason,
      proposed_by_user_id: req.user!.userId,
      risk_level: req.body.risk_level,
    })
    res.status(201).json({ data: patch })
  },
)

stageIncubationRouter.post(
  '/communities/:communityId/config/proposals/:proposalId/validate',
  requireHumanAuth,
  validate(validateConfigProposalSchema),
  async (req, res) => {
    if (!config.features.controlPlaneConfigV1) {
      res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Control Plane config API is disabled by feature flag.' },
      })
      return
    }

    const result = await communityConfigService.validateProposal({
      proposal_id: String(req.params.proposalId),
      community_id: String(req.params.communityId),
      actor_user_id: req.user!.userId,
    })
    res.json({ data: result })
  },
)

stageIncubationRouter.post(
  '/communities/:communityId/config/proposals/:proposalId/approve',
  requireHumanAuth,
  requireAdmin,
  validate(approveConfigProposalSchema),
  async (req, res) => {
    if (!config.features.controlPlaneConfigV1) {
      res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Control Plane config API is disabled by feature flag.' },
      })
      return
    }

    const patch = await communityConfigService.approveProposal({
      proposal_id: String(req.params.proposalId),
      community_id: String(req.params.communityId),
      actor_user_id: req.user!.userId,
      actor_role: req.user!.role,
      reason: req.body.reason,
    })
    res.json({ data: patch })
  },
)

stageIncubationRouter.post(
  '/communities/:communityId/config/proposals/:proposalId/reject',
  requireHumanAuth,
  requireAdmin,
  validate(rejectConfigProposalSchema),
  async (req, res) => {
    if (!config.features.controlPlaneConfigV1) {
      res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Control Plane config API is disabled by feature flag.' },
      })
      return
    }

    const patch = await communityConfigService.rejectProposal({
      proposal_id: String(req.params.proposalId),
      community_id: String(req.params.communityId),
      actor_user_id: req.user!.userId,
      actor_role: req.user!.role,
      reason: req.body.reason,
    })
    res.json({ data: patch })
  },
)

stageIncubationRouter.post(
  '/communities/:communityId/config/apply',
  requireHumanAuth,
  validate(applyConfigProposalSchema),
  async (req, res) => {
    if (!config.features.controlPlaneConfigV1) {
      res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Control Plane config API is disabled by feature flag.' },
      })
      return
    }

    const result = await communityConfigService.applyProposal({
      proposal_id: req.body.proposal_id,
      community_id: String(req.params.communityId),
      actor_user_id: req.user!.userId,
      actor_role: req.user!.role,
      effective_at: req.body.effective_at ? new Date(req.body.effective_at) : null,
    })
    res.json({ data: result })
  },
)

stageIncubationRouter.post(
  '/communities/:communityId/config/rollback',
  requireHumanAuth,
  requireAdmin,
  validate(rollbackConfigSchema),
  async (req, res) => {
    if (!config.features.controlPlaneConfigV1) {
      res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Control Plane config API is disabled by feature flag.' },
      })
      return
    }

    const version = await communityConfigService.rollbackToVersion({
      community_id: String(req.params.communityId),
      version_id: req.body.version_id,
      actor_user_id: req.user!.userId,
      actor_role: req.user!.role,
      reason: req.body.reason,
    })
    res.status(201).json({ data: version })
  },
)

stageIncubationRouter.get('/communities/:communityId/config/history', requireHumanAuth, async (req, res) => {
  if (!config.features.controlPlaneConfigV1) {
    res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Control Plane config API is disabled by feature flag.' },
    })
    return
  }
  const data = await communityConfigService.getHistory(String(req.params.communityId))
  res.json({ data })
})

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

stageIncubationRouter.post(
  '/communities/:communityId/role-assignments',
  requireHumanAuth,
  requireAdmin,
  validate(createRoleAssignmentSchema),
  async (req, res) => {
    if (!config.features.roleAssignmentV1) {
      res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Role assignment API is disabled by feature flag.' },
      })
      return
    }

    const assignment = await roleAssignmentService.assign({
      community_id: String(req.params.communityId),
      scope: req.body.scope,
      scope_id: req.body.scope_id,
      role: req.body.role,
      agent_id: req.body.agent_id,
      actor_user_id: req.user!.userId,
      expires_at: req.body.expires_at ? new Date(req.body.expires_at) : null,
      meta: req.body.meta ?? null,
    })

    res.status(201).json({ data: assignment })
  },
)

stageIncubationRouter.patch(
  '/communities/:communityId/role-assignments/:assignmentId',
  requireHumanAuth,
  requireAdmin,
  validate(updateRoleAssignmentSchema),
  async (req, res) => {
    if (!config.features.roleAssignmentV1) {
      res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Role assignment API is disabled by feature flag.' },
      })
      return
    }

    const updated = await roleAssignmentService.update({
      assignment_id: String(req.params.assignmentId),
      community_id: String(req.params.communityId),
      status: req.body.status,
      role: req.body.role,
      expires_at: req.body.expires_at === undefined
        ? undefined
        : (req.body.expires_at ? new Date(req.body.expires_at) : null),
      actor_user_id: req.user!.userId,
      reason: req.body.reason,
    })
    res.json({ data: updated })
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
