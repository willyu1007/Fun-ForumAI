import { Router, type IRouter, type Request, type Response } from 'express'
import multer from 'multer'
import { requireHumanAuth } from '../middleware/human-auth.js'
import {
  agentConfigLintService,
  agentService,
  agentDeletionService,
  mediaAssetControlService,
  inferenceProfileService,
  reviewService,
  searchProjectionService,
  agentBioRefreshService,
} from '../container.js'
import { config } from '../lib/config.js'
import { ForbiddenError, ValidationError } from '../lib/errors.js'
import { ensureDevAuthUserPersisted } from '../lib/dev-auth-user.js'
import { validate } from '../validation/validate.js'
import { buildAgentReadPayload } from '../identity/agent-identity.js'
import { normalizeAgentRunReadPayload } from '../runtime/persona-observation.js'
import { guidanceOrchestrator } from '../container.js'
import { trackGuidanceEventFromRequest } from '../guidance/http.js'
import {
  createAgentSchema,
  patchAgentInferenceProfileSchema,
  updateAgentConfigSchema,
  updateAgentProfileSchema,
} from '../validation/schemas.js'

export const agentControlRouter: IRouter = Router()

const mediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
})

const AGENT_MEDIA_DISABLED_MESSAGE = 'Multimodal agent media is disabled by feature flag.'
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function mergeConfigJson(
  base: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...base }
  for (const [key, value] of Object.entries(patch)) {
    const existing = merged[key]
    if (isPlainRecord(existing) && isPlainRecord(value)) {
      merged[key] = mergeConfigJson(existing, value)
      continue
    }
    merged[key] = value
  }
  return merged
}

function assertOwnerOrAdmin(
  agentId: string,
  actor: { userId: string; role: 'user' | 'admin' },
  options?: { requireMutable?: boolean },
): void {
  const existing = agentService.getAgent(agentId)
  const isAllowed = actor.role === 'admin' || existing.owner_id === actor.userId
  if (!isAllowed) {
    throw new ForbiddenError('Only owner or admin can access this agent control surface')
  }
  if (options?.requireMutable !== false) {
    agentService.assertAgentMutable(existing)
  }
}

async function ensureAgentMediaRouteEnabled(_req: Request, res: Response): Promise<boolean> {
  if (!config.launch.capabilities.multimodalAgentMediaV1) {
    res.status(403).json({
      error: {
        code: 'FORBIDDEN',
        message: AGENT_MEDIA_DISABLED_MESSAGE,
      },
    })
    return false
  }

  return true
}

agentControlRouter.post(
  '/agents',
  requireHumanAuth,
  validate(createAgentSchema),
  async (req, res) => {
    await ensureDevAuthUserPersisted(req.user!)
    const agent = await agentService.createAgentPersisted({
      owner_id: req.user!.userId,
      ...req.body,
    })
    await agentBioRefreshService.refresh(agent.id, {
      refresh_kind: 'bootstrap',
      reason: 'agent_create',
    })
    // Make newly created agents discoverable on the first read, even when
    // bio refresh commits and downstream hooks are still asynchronous.
    await searchProjectionService.refreshAgent(agent.id)
    await trackGuidanceEventFromRequest(
      req,
      res,
      guidanceOrchestrator,
      'AGENT_CREATED',
      { agent_id: agent.id },
      { dedup_key: `agent_created:${req.user!.userId}:${agent.id}` },
    )
    res.status(201).json({
      data: buildAgentReadPayload(agent, agentService.getLatestConfig(agent.id)),
    })
  },
)

agentControlRouter.patch(
  '/agents/:agentId/profile',
  requireHumanAuth,
  validate(updateAgentProfileSchema),
  async (req, res) => {
    const agentId = String(req.params.agentId)
    assertOwnerOrAdmin(agentId, req.user!)

    const updated = agentService.updateProfile({
      agent_id: agentId,
      display_name: req.body.display_name,
      avatar_url: req.body.avatar_url,
    })
    await searchProjectionService.reconcileAgent(agentId, {
      reason: 'agent_profile',
      scopes: ['agent', 'posts', 'threads', 'communities'],
    })
    res.json({
      data: buildAgentReadPayload(updated, agentService.getLatestConfig(agentId)),
    })
  },
)

agentControlRouter.delete(
  '/agents/:agentId',
  requireHumanAuth,
  async (req, res) => {
    const agentId = String(req.params.agentId)
    assertOwnerOrAdmin(agentId, req.user!, { requireMutable: false })
    const result = await agentDeletionService.deleteAgent(agentId)
    res.json({ data: result })
  },
)

agentControlRouter.patch(
  '/agents/:agentId/config',
  requireHumanAuth,
  validate(updateAgentConfigSchema),
  async (req, res) => {
    const agentId = String(req.params.agentId)
    assertOwnerOrAdmin(agentId, req.user!)
    const beforeConfig = agentService.getLatestConfigRevision(agentId)?.config_json ?? {}
    const mergedConfig = mergeConfigJson(beforeConfig, req.body.config_json)
    const review = agentConfigLintService.lint({
      before_config: beforeConfig,
      after_config: mergedConfig,
    })
    if (review.review_status === 'PENDING') {
      const reviewCase = await reviewService.openConfigReviewCase({
        agent_id: agentId,
        updated_by: req.user!.userId,
        summary_text: `High-risk config update queued for review: ${agentId}`,
        evidence: {
          before_config: beforeConfig,
          after_config: mergedConfig,
          lint_warnings: review.lint_warnings,
        },
      })
      review.review_case_id = reviewCase.id
    }
    const config = await agentService.updateConfig(
      agentId,
      req.body.config_json,
      req.user!.userId,
      review,
    )
    res.json({
      data: config,
      meta: {
        effective_immediately:
          config.review_status === 'NOT_REQUIRED' || config.review_status === 'APPROVED',
      },
    })
  },
)

agentControlRouter.patch(
  '/agents/:agentId/inference-profile',
  requireHumanAuth,
  validate(patchAgentInferenceProfileSchema),
  async (req, res) => {
    if (req.user!.role !== 'admin') {
      throw new ForbiddenError('Only admin can manage inference profiles')
    }

    const agentId = String(req.params.agentId)
    const action = req.body.action
    const result =
      action === 'start_shadow_review'
        ? {
            shadow_review: await inferenceProfileService.startShadowReview(
              agentId,
              req.user!.userId,
            ),
            profile: await inferenceProfileService.getProfile(agentId),
          }
        : action === 'collect_shadow_review'
          ? {
              shadow_review: await inferenceProfileService.collectShadowReview(
                agentId,
                req.user!.userId,
              ),
              profile: await inferenceProfileService.getProfile(agentId),
            }
          : {
              profile:
                action === 'approve_shadow'
                  ? await inferenceProfileService.approveShadow(agentId, req.user!.userId)
                  : action === 'block_challenger'
                    ? await inferenceProfileService.blockChallenger(agentId, req.user!.userId)
                    : await inferenceProfileService.setManualVoiceLineLock(
                        agentId,
                        Boolean(req.body.locked),
                        req.user!.userId,
                      ),
              shadow_review: (await inferenceProfileService.getDebug(agentId)).shadowReview,
            }

    res.json({
      data: result.profile,
      meta: {
        shadow_review: result.shadow_review,
      },
    })
  },
)

agentControlRouter.post(
  '/agents/:agentId/media/url',
  requireHumanAuth,
  async (req, res) => {
    if (!(await ensureAgentMediaRouteEnabled(req, res))) return
    assertOwnerOrAdmin(String(req.params.agentId), req.user!)

    const source_url = String(req.body?.source_url ?? '').trim()
    const owner_note = typeof req.body?.owner_note === 'string' ? req.body.owner_note : undefined
    if (!source_url) {
      throw new ValidationError('source_url is required')
    }

    const data = await mediaAssetControlService.createFromUrl({
      agent_id: String(req.params.agentId),
      owner_user_id: req.user!.userId,
      source_url,
      owner_note,
    })

    res.status(201).json({ data })
  },
)

agentControlRouter.post(
  '/agents/:agentId/media/upload',
  requireHumanAuth,
  async (req, res, next) => {
    if (!(await ensureAgentMediaRouteEnabled(req, res))) return

    mediaUpload.single('file')(req, res, async (err) => {
      if (err) {
        if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
          next(new ValidationError('media exceeds 10MB limit'))
          return
        }
        next(new ValidationError('invalid upload payload'))
        return
      }

      try {
        assertOwnerOrAdmin(String(req.params.agentId), req.user!)
        if (!req.file || req.file.size <= 0) {
          throw new ValidationError('file is required')
        }

        const ownerNoteRaw = (req.body as Record<string, unknown> | undefined)?.owner_note
        const owner_note = typeof ownerNoteRaw === 'string' ? ownerNoteRaw : undefined

        const data = await mediaAssetControlService.createFromUpload({
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
  },
)

agentControlRouter.get(
  '/agents/:agentId/media',
  requireHumanAuth,
  async (req, res) => {
    if (!(await ensureAgentMediaRouteEnabled(req, res))) return
    assertOwnerOrAdmin(String(req.params.agentId), req.user!)
    const data = await mediaAssetControlService.getLibrary(String(req.params.agentId), req.user!.userId)
    res.json({ data })
  },
)

agentControlRouter.get(
  '/agents/:agentId/media/current',
  requireHumanAuth,
  async (req, res) => {
    if (!(await ensureAgentMediaRouteEnabled(req, res))) return
    assertOwnerOrAdmin(String(req.params.agentId), req.user!)
    const data = await mediaAssetControlService.getCurrent(String(req.params.agentId), req.user!.userId)
    res.json({ data })
  },
)

agentControlRouter.delete(
  '/agents/:agentId/media/current',
  requireHumanAuth,
  async (req, res) => {
    if (!(await ensureAgentMediaRouteEnabled(req, res))) return
    assertOwnerOrAdmin(String(req.params.agentId), req.user!)
    const data = await mediaAssetControlService.cancelCurrent(String(req.params.agentId), req.user!.userId)
    res.json({ data })
  },
)

agentControlRouter.post(
  '/agents/:agentId/media/:assetId/archive',
  requireHumanAuth,
  async (req, res) => {
    if (!(await ensureAgentMediaRouteEnabled(req, res))) return
    assertOwnerOrAdmin(String(req.params.agentId), req.user!)
    const data = await mediaAssetControlService.archiveAsset({
      agent_id: String(req.params.agentId),
      owner_user_id: req.user!.userId,
      asset_id: String(req.params.assetId),
    })
    res.json({ data })
  },
)

agentControlRouter.post(
  '/agents/:agentId/media/:assetId/restore',
  requireHumanAuth,
  async (req, res) => {
    if (!(await ensureAgentMediaRouteEnabled(req, res))) return
    assertOwnerOrAdmin(String(req.params.agentId), req.user!)
    const data = await mediaAssetControlService.restoreAsset({
      agent_id: String(req.params.agentId),
      owner_user_id: req.user!.userId,
      asset_id: String(req.params.assetId),
    })
    res.json({ data })
  },
)

agentControlRouter.post(
  '/agents/:agentId/media/:assetId/promote',
  requireHumanAuth,
  async (req, res) => {
    if (!(await ensureAgentMediaRouteEnabled(req, res))) return
    assertOwnerOrAdmin(String(req.params.agentId), req.user!)
    const data = await mediaAssetControlService.promoteAsset({
      agent_id: String(req.params.agentId),
      owner_user_id: req.user!.userId,
      asset_id: String(req.params.assetId),
    })
    res.json({ data })
  },
)

agentControlRouter.post(
  '/agents/:agentId/media/:assetId/demote',
  requireHumanAuth,
  async (req, res) => {
    if (!(await ensureAgentMediaRouteEnabled(req, res))) return
    assertOwnerOrAdmin(String(req.params.agentId), req.user!)
    const data = await mediaAssetControlService.demoteAsset({
      agent_id: String(req.params.agentId),
      owner_user_id: req.user!.userId,
      asset_id: String(req.params.assetId),
    })
    res.json({ data })
  },
)

agentControlRouter.get('/agents/:agentId/runs', requireHumanAuth, (req, res) => {
  const agentId = String(req.params.agentId)
  assertOwnerOrAdmin(agentId, req.user!, { requireMutable: false })
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined
  const limitStr = typeof req.query.limit === 'string' ? req.query.limit : undefined
  const result = agentService.getAgentRuns(agentId, {
    cursor,
    limit: limitStr ? parseInt(limitStr, 10) : undefined,
  })
  res.json({
    data: result.items.map((run) => normalizeAgentRunReadPayload(run)),
    meta: { cursor: result.next_cursor },
  })
})
