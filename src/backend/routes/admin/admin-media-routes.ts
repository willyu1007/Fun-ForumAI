import type { IRouter, Response } from 'express'
import {
  mediaLifecycleService,
  mediaLineageService,
  mediaObservabilityService,
  mediaReuseGovernanceService,
  mediaRolloutControllerService,
  mediaScenePackService,
} from '../../container.js'
import { config } from '../../lib/config.js'
import { AppError } from '../../lib/errors.js'
import { requireAdmin, requireHumanAuth } from '../../middleware/human-auth.js'
import type { MediaLineageNodeType, MediaRolloutControllerOverride } from '../../repos/types.js'
import {
  createCommunityCommonsAssetSchema,
  createPlatformCanonicalAssetSchema,
  createMediaScenePackDraftSchema,
  activateMediaScenePackVersionSchema,
  mediaScenePackCompilePreviewSchema,
  mediaScenePackRoutePreviewSchema,
  patchMediaReusePolicySchema,
  patchMediaScenePackDraftSchema,
  patchMediaRolloutControllerSchema,
  releaseMediaScenePackVersionSchema,
  releaseMediaRolloutControllerOverrideSchema,
  revokeMediaReusePolicySchema,
} from '../../validation/schemas.js'
import { validate } from '../../validation/validate.js'

const MEDIA_LINEAGE_NODE_TYPES: MediaLineageNodeType[] = [
  'asset',
  'semantic_snapshot',
  'binding',
  'projection',
  'image_plan',
  'generation_job',
  'post_media_attachment',
]

function tryHandleAppError(res: Response, err: unknown): boolean {
  if (!(err instanceof AppError)) return false
  res.status(err.statusCode).json({
    error: {
      code: err.code,
      message: err.message,
      ...(err.details !== undefined ? { details: err.details } : {}),
    },
  })
  return true
}

function stripLegacyRootPostAttachmentField(
  override: MediaRolloutControllerOverride | null,
): Omit<MediaRolloutControllerOverride, 'root_post_attachment_only'> | null {
  if (!override) return null
  const rest = { ...override } as Partial<MediaRolloutControllerOverride>
  delete rest.root_post_attachment_only
  return rest as Omit<MediaRolloutControllerOverride, 'root_post_attachment_only'>
}

function serializeMediaRolloutControllerProfile(
  profile: Awaited<ReturnType<typeof mediaRolloutControllerService.getEffectiveProfile>>,
) {
  return {
    ...profile,
    active_override: stripLegacyRootPostAttachmentField(profile.active_override),
  }
}

export function registerAdminMediaRoutes(router: IRouter): void {
  router.post(
    '/admin/media/scene-packs/route-preview',
    requireHumanAuth,
    requireAdmin,
    validate(mediaScenePackRoutePreviewSchema),
    async (req, res, next) => {
      try {
        const data = await mediaScenePackService.previewRoute({
          text: req.body.text ?? null,
          visual_brief: req.body.visual_brief ?? null,
        })
        res.json({ data })
      } catch (err) {
        if (tryHandleAppError(res, err)) return
        next(err)
      }
    },
  )

  router.post(
    '/admin/media/scene-packs/compile-preview',
    requireHumanAuth,
    requireAdmin,
    validate(mediaScenePackCompilePreviewSchema),
    async (req, res, next) => {
      try {
        const data = await mediaScenePackService.previewCompile({
          text: req.body.text ?? null,
          scene_id: req.body.scene_id ?? null,
          visual_brief: req.body.visual_brief ?? null,
          aspect_ratio_hint: req.body.aspect_ratio_hint ?? null,
        })
        res.json({ data })
      } catch (err) {
        if (tryHandleAppError(res, err)) return
        next(err)
      }
    },
  )

  router.get(
    '/admin/media/scene-packs',
    requireHumanAuth,
    requireAdmin,
    async (_req, res, next) => {
      try {
        const data = await mediaScenePackService.listScenePacks()
        res.json({ data })
      } catch (err) {
        if (tryHandleAppError(res, err)) return
        next(err)
      }
    },
  )

  router.get(
    '/admin/media/scene-packs/:sceneId',
    requireHumanAuth,
    requireAdmin,
    async (req, res, next) => {
      try {
        const data = await mediaScenePackService.getScenePack(String(req.params.sceneId))
        res.json({ data })
      } catch (err) {
        if (tryHandleAppError(res, err)) return
        next(err)
      }
    },
  )

  router.post(
    '/admin/media/scene-packs/:sceneId/versions',
    requireHumanAuth,
    requireAdmin,
    validate(createMediaScenePackDraftSchema),
    async (req, res, next) => {
      try {
        const data = await mediaScenePackService.createDraftVersion({
          scene_id: String(req.params.sceneId),
          patch: req.body,
          created_by_user_id: req.user!.userId,
        })
        res.status(201).json({ data })
      } catch (err) {
        if (tryHandleAppError(res, err)) return
        next(err)
      }
    },
  )

  router.patch(
    '/admin/media/scene-packs/:sceneId/versions/:version',
    requireHumanAuth,
    requireAdmin,
    validate(patchMediaScenePackDraftSchema),
    async (req, res, next) => {
      try {
        const version = Number.parseInt(String(req.params.version), 10)
        if (!Number.isSafeInteger(version) || version <= 0) {
          throw new AppError(400, 'version must be a positive integer', 'VALIDATION_ERROR')
        }
        const data = await mediaScenePackService.updateDraftVersion({
          scene_id: String(req.params.sceneId),
          version,
          patch: req.body,
          updated_by_user_id: req.user!.userId,
        })
        res.json({ data })
      } catch (err) {
        if (tryHandleAppError(res, err)) return
        next(err)
      }
    },
  )

  router.post(
    '/admin/media/scene-packs/:sceneId/versions/:version/activate',
    requireHumanAuth,
    requireAdmin,
    validate(activateMediaScenePackVersionSchema),
    async (req, res, next) => {
      try {
        const version = Number.parseInt(String(req.params.version), 10)
        if (!Number.isSafeInteger(version) || version <= 0) {
          throw new AppError(400, 'version must be a positive integer', 'VALIDATION_ERROR')
        }
        const data = await mediaScenePackService.activateVersion({
          scene_id: String(req.params.sceneId),
          version,
        })
        res.json({ data })
      } catch (err) {
        if (tryHandleAppError(res, err)) return
        next(err)
      }
    },
  )

  router.post(
    '/admin/media/scene-packs/:sceneId/versions/:version/release',
    requireHumanAuth,
    requireAdmin,
    validate(releaseMediaScenePackVersionSchema),
    async (req, res, next) => {
      try {
        const version = Number.parseInt(String(req.params.version), 10)
        if (!Number.isSafeInteger(version) || version <= 0) {
          throw new AppError(400, 'version must be a positive integer', 'VALIDATION_ERROR')
        }
        const data = await mediaScenePackService.releaseVersion({
          scene_id: String(req.params.sceneId),
          version,
          released_by_user_id: req.user!.userId,
          reason: req.body.reason ?? null,
        })
        res.json({ data })
      } catch (err) {
        if (tryHandleAppError(res, err)) return
        next(err)
      }
    },
  )

  router.post(
    '/admin/media/platform-canonical/assets',
    requireHumanAuth,
    requireAdmin,
    validate(createPlatformCanonicalAssetSchema),
    async (req, res, next) => {
      try {
        const data = await mediaReuseGovernanceService.registerPlatformCanonicalAsset({
          asset_id: req.body.asset_id,
          actor_user_id: req.user!.userId,
        })
        res.status(201).json({ data })
      } catch (err) {
        if (tryHandleAppError(res, err)) return
        next(err)
      }
    },
  )

  router.post(
    '/admin/communities/:communityId/media/commons/assets',
    requireHumanAuth,
    requireAdmin,
    validate(createCommunityCommonsAssetSchema),
    async (req, res, next) => {
      try {
        const data = await mediaReuseGovernanceService.registerCommunityCommonsAsset({
          community_id: String(req.params.communityId),
          asset_id: req.body.asset_id,
          actor_user_id: req.user!.userId,
          allow_quote_original: req.body.allow_quote_original,
        })
        res.status(201).json({ data })
      } catch (err) {
        if (tryHandleAppError(res, err)) return
        next(err)
      }
    },
  )

  router.patch(
    '/admin/media/reuse-policies/:policyId',
    requireHumanAuth,
    requireAdmin,
    validate(patchMediaReusePolicySchema),
    async (req, res, next) => {
      try {
        const data = await mediaReuseGovernanceService.updatePolicy(String(req.params.policyId), {
          allowed_reuse_modes: req.body.allowed_reuse_modes,
          cross_agent_quote_allowed: req.body.cross_agent_quote_allowed,
          disclose_origin_policy: req.body.disclose_origin_policy,
          copyright_state: req.body.copyright_state,
          status: req.body.status,
        })
        res.json({ data })
      } catch (err) {
        if (tryHandleAppError(res, err)) return
        next(err)
      }
    },
  )

  router.post(
    '/admin/media/reuse-policies/:policyId/revoke',
    requireHumanAuth,
    requireAdmin,
    validate(revokeMediaReusePolicySchema),
    async (req, res, next) => {
      try {
        const data = await mediaReuseGovernanceService.revokePolicy({
          policy_id: String(req.params.policyId),
          reason: req.body.reason,
        })
        res.json({ data })
      } catch (err) {
        if (tryHandleAppError(res, err)) return
        next(err)
      }
    },
  )

  router.get('/admin/media/observability', requireHumanAuth, requireAdmin, async (_req, res) => {
    if (!config.launch.capabilities.mediaObservabilityV1) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Media observability is disabled by feature flag.',
        },
      })
      return
    }
    const controllerProfile = await mediaRolloutControllerService.getEffectiveProfile()
    const summary = await mediaObservabilityService.getAdminSummary({
      target_min_rate: controllerProfile.effective.target_min_rate,
      target_max_rate: controllerProfile.effective.target_max_rate,
    })
    const lifecycleCandidates = config.launch.capabilities.mediaLifecycleV1
      ? await mediaLifecycleService.previewCandidates()
      : {
          orphan_asset_ids: [],
          expired_projection_ids: [],
          snapshot_backfill_asset_ids: [],
        }
    res.json({
      data: {
        metrics: summary.metrics,
        gates: summary.gates,
        recent_alerts: summary.recent_alerts,
        lifecycle_candidates: {
          orphan_assets: lifecycleCandidates.orphan_asset_ids.length,
          expired_projections: lifecycleCandidates.expired_projection_ids.length,
          snapshot_backfill_assets: lifecycleCandidates.snapshot_backfill_asset_ids.length,
        },
        effective_controller_profile: controllerProfile,
      },
    })
  })

  router.get(
    '/admin/media/rollout-controller',
    requireHumanAuth,
    requireAdmin,
    async (_req, res) => {
      if (!config.launch.capabilities.mediaRolloutControllerV1) {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Media rollout controller is disabled by feature flag.',
          },
        })
        return
      }
      const profile = await mediaRolloutControllerService.getEffectiveProfile()
      res.json({
        data: {
          active_override: stripLegacyRootPostAttachmentField(profile.active_override),
          effective_profile: serializeMediaRolloutControllerProfile(profile),
        },
      })
    },
  )

  router.patch(
    '/admin/media/rollout-controller',
    requireHumanAuth,
    requireAdmin,
    validate(patchMediaRolloutControllerSchema),
    async (req, res, next) => {
      try {
        const override = await mediaRolloutControllerService.createOrReplaceOverride({
          mode: req.body.mode,
          target_min_rate: req.body.target_min_rate ?? null,
          target_max_rate: req.body.target_max_rate ?? null,
          threshold_delta: req.body.threshold_delta ?? null,
          allow_generation: req.body.allow_generation ?? null,
          generation_tier: req.body.generation_tier ?? null,
          sync_generation_ms_budget: req.body.sync_generation_ms_budget ?? null,
          allow_private_runtime_projection: req.body.allow_private_runtime_projection ?? null,
          allow_private_inspired_generation: req.body.allow_private_inspired_generation ?? null,
          force_safe_mode: req.body.force_safe_mode ?? false,
          semantic_v3_enforced: req.body.semantic_v3_enforced ?? null,
          strict_audit_enforced: req.body.strict_audit_enforced ?? null,
          lineage_required: req.body.lineage_required ?? null,
          reason: req.body.reason ?? null,
          created_by_user_id: req.user!.userId,
        })
        res.json({ data: stripLegacyRootPostAttachmentField(override) })
      } catch (err) {
        if (tryHandleAppError(res, err)) return
        next(err)
      }
    },
  )

  router.get(
    '/admin/media/lineage/:nodeType/:nodeId',
    requireHumanAuth,
    requireAdmin,
    async (req, res) => {
      const nodeType = String(req.params.nodeType) as MediaLineageNodeType
      const nodeId = String(req.params.nodeId)
      const depth = typeof req.query.depth === 'string' ? Number.parseInt(req.query.depth, 10) : 3
      if (!MEDIA_LINEAGE_NODE_TYPES.includes(nodeType)) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: `nodeType must be one of: ${MEDIA_LINEAGE_NODE_TYPES.join(', ')}`,
          },
        })
        return
      }
      const trace = await mediaLineageService.traceNode(nodeType, nodeId, depth)
      res.json({ data: trace })
    },
  )

  router.post(
    '/admin/media/rollout-controller/:overrideId/release',
    requireHumanAuth,
    requireAdmin,
    validate(releaseMediaRolloutControllerOverrideSchema),
    async (req, res, next) => {
      try {
        const released = await mediaRolloutControllerService.releaseOverride({
          override_id: String(req.params.overrideId),
          released_by_user_id: req.user!.userId,
          released_reason: req.body.reason ?? null,
        })
        if (!released) {
          res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Override not found' } })
          return
        }
        res.json({ data: released })
      } catch (err) {
        if (tryHandleAppError(res, err)) return
        next(err)
      }
    },
  )

  router.post('/admin/media/lifecycle/run', requireHumanAuth, requireAdmin, async (_req, res) => {
    if (!config.launch.capabilities.mediaLifecycleV1) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Media lifecycle is disabled by feature flag.',
        },
      })
      return
    }
    const result = await mediaLifecycleService.runSweep()
    res.json({ data: result })
  })
}
