import { Router, type IRouter, type Response } from 'express'
import { requireHumanAuth, requireAdmin } from '../middleware/human-auth.js'
import {
  agentService,
  agentRunRepo,
  riskGovernanceRepo,
  publicDisclosureCapService,
  privateChannelServices,
  hotTopicOpsService,
  mediaReuseGovernanceService,
  mediaObservabilityService,
  mediaRolloutControllerService,
  mediaLifecycleService,
  mediaLineageService,
} from '../container.js'
import { config } from '../lib/config.js'
import { AppError } from '../lib/errors.js'
import { readPersonaObservation } from '../runtime/persona-observation.js'
import { validate } from '../validation/validate.js'
import {
  createCommunityCommonsAssetSchema,
  createDisclosureCapOverrideSchema,
  createPlatformCanonicalAssetSchema,
  patchMediaRolloutControllerSchema,
  patchMediaReusePolicySchema,
  releaseMediaRolloutControllerOverrideSchema,
  releaseDisclosureCapOverrideSchema,
  revokeMediaReusePolicySchema,
} from '../validation/schemas.js'
import { registerAdminReviewRoutes } from './admin/admin-review-routes.js'
import { registerAdminRuntimeRoutes } from './admin/admin-runtime-routes.js'
import { resolveEffectiveDisclosureCap } from './admin-api-utils.js'
import type { MediaLineageNodeType, MediaRolloutControllerOverride } from '../repos/types.js'

export const adminApiRouter: IRouter = Router()

const HOT_TOPIC_POST_DISTRIBUTION_STATES = new Set(['NORMAL', 'NO_RECOMMEND'])
const HOT_TOPIC_ROOM_DISTRIBUTION_STATES = new Set(['NORMAL', 'NO_RECOMMEND', 'BLOCKED'])
const HOT_TOPIC_ROOM_MODES = new Set(['NORMAL', 'MANUAL_REVIEW_ONLY', 'DISABLED'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isSpilloverRiskEvent(event: {
  risk_categories?: string[]
  detail_text?: string | null
}): boolean {
  return Boolean(
    event.risk_categories?.includes('owner_private_leak') ||
    event.risk_categories?.includes('owner_endorsement_public') ||
    event.detail_text?.includes('owner_private_leak') ||
    event.detail_text?.includes('owner_endorsement_public'),
  )
}

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

registerAdminReviewRoutes(adminApiRouter)
registerAdminRuntimeRoutes(adminApiRouter)

adminApiRouter.get(
  '/admin/agents/:agentId/risk-profile',
  requireHumanAuth,
  requireAdmin,
  async (req, res) => {
    const agentId = String(req.params.agentId)
    const agent = agentService.getAgent(agentId)
    const latestConfig = agentService.getLatestConfig(agentId)
    const privacySettings = privateChannelServices
      ? await privateChannelServices.memoryService.getPrivacySettings(agentId)
      : null
    const riskEvents = await riskGovernanceRepo.listRiskEvents({
      agent_id: agentId,
      limit: 20,
      cursor: undefined,
    })
    const capHistory = await publicDisclosureCapService.listOverrides({
      scope_type: 'agent',
      scope_id: agentId,
      limit: 20,
    })
    const activeAgentCap = await publicDisclosureCapService.getActiveOverride('agent', agentId)
    const configActionLogs = await riskGovernanceRepo.listGovernanceActionLogs(
      'config_revision',
      agentId,
    )
    const recentRuns = agentRunRepo.findByAgent(agentId, { limit: 20 }).items
    const recent_private_provenance = recentRuns
      .map((run) => {
        const observation = readPersonaObservation(run.output_json)
        const privateMemory = observation?.prompt_audit?.provenance?.private_memory
        if (!privateMemory) return null
        return {
          run_id: run.id,
          used_memory_ids: privateMemory.used_memory_ids,
          requested_disclosure_level: privateMemory.requested_disclosure_level,
          effective_disclosure_level: privateMemory.effective_disclosure_level,
          cap_source: privateMemory.cap_source,
          public_disclosure_cap: privateMemory.public_disclosure_cap,
          server_cap_sources: privateMemory.server_cap_sources ?? [],
        }
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))

    res.json({
      data: {
        agent,
        latest_config: latestConfig,
        spillover_events: riskEvents.items.filter((event) => isSpilloverRiskEvent(event)),
        recent_config_actions: configActionLogs,
        recent_private_provenance,
        active_cap_overrides: activeAgentCap ? [activeAgentCap] : [],
        cap_history: capHistory.items,
        effective_disclosure_cap: [
          resolveEffectiveDisclosureCap({
            latestConfig,
            privacySettings,
          }),
          activeAgentCap?.cap_level ?? null,
        ]
          .filter((value): value is number => typeof value === 'number')
          .reduce<number | null>(
            (min, value) => (min === null ? value : Math.min(min, value)),
            null,
          ),
      },
    })
  },
)

adminApiRouter.get('/admin/disclosure-caps', requireHumanAuth, requireAdmin, async (req, res) => {
  const scopeType = typeof req.query.scope_type === 'string' ? req.query.scope_type : ''
  const scopeId = typeof req.query.scope_id === 'string' ? req.query.scope_id : ''
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined
  const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 20

  if ((scopeType !== 'agent' && scopeType !== 'community') || !scopeId) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'scope_type(agent|community) and scope_id are required',
      },
    })
    return
  }

  const [activeOverride, history] = await Promise.all([
    publicDisclosureCapService.getActiveOverride(scopeType, scopeId),
    publicDisclosureCapService.listOverrides({
      scope_type: scopeType,
      scope_id: scopeId,
      limit: Math.min(limit, 100),
      cursor,
    }),
  ])

  res.json({
    data: {
      scope_type: scopeType,
      scope_id: scopeId,
      active_override: activeOverride,
      history: history.items,
    },
    meta: {
      cursor: history.next_cursor,
    },
  })
})

adminApiRouter.post(
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

adminApiRouter.post(
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

adminApiRouter.patch(
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

adminApiRouter.post(
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

adminApiRouter.get(
  '/admin/media/observability',
  requireHumanAuth,
  requireAdmin,
  async (_req, res) => {
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
  },
)

adminApiRouter.get(
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

adminApiRouter.patch(
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

const MEDIA_LINEAGE_NODE_TYPES: MediaLineageNodeType[] = [
  'asset',
  'semantic_snapshot',
  'binding',
  'projection',
  'image_plan',
  'generation_job',
  'post_media_attachment',
]

adminApiRouter.get(
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

adminApiRouter.post(
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

adminApiRouter.post(
  '/admin/media/lifecycle/run',
  requireHumanAuth,
  requireAdmin,
  async (_req, res) => {
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
  },
)

adminApiRouter.post(
  '/admin/disclosure-caps',
  requireHumanAuth,
  requireAdmin,
  validate(createDisclosureCapOverrideSchema),
  async (req, res) => {
    const created = await publicDisclosureCapService.createManualOverride({
      scope_type: req.body.scope_type,
      scope_id: req.body.scope_id,
      cap_level: req.body.cap_level,
      reason: req.body.reason ?? null,
      linked_case_id: req.body.linked_case_id ?? null,
      linked_risk_event_id: req.body.linked_risk_event_id ?? null,
      created_by_user_id: req.user!.userId,
    })
    res.status(201).json({ data: created })
  },
)

adminApiRouter.post(
  '/admin/disclosure-caps/:overrideId/release',
  requireHumanAuth,
  requireAdmin,
  validate(releaseDisclosureCapOverrideSchema),
  async (req, res) => {
    const released = await publicDisclosureCapService.releaseOverride(
      String(req.params.overrideId),
      {
        released_by_user_id: req.user!.userId,
        released_reason: req.body.reason ?? null,
      },
    )
    if (!released) {
      res
        .status(404)
        .json({ error: { code: 'NOT_FOUND', message: 'Disclosure cap override not found' } })
      return
    }
    res.json({ data: released })
  },
)

adminApiRouter.get(
  '/admin/hot-topic/dashboard',
  requireHumanAuth,
  requireAdmin,
  async (_req, res) => {
    const dashboard = await hotTopicOpsService.getDashboard()
    res.json({ data: dashboard.items, meta: { generated_at: dashboard.generated_at } })
  },
)

adminApiRouter.get('/admin/hot-topic/alerts', requireHumanAuth, requireAdmin, async (_req, res) => {
  const alerts = await hotTopicOpsService.getAlerts()
  res.json({ data: alerts.items, meta: { generated_at: alerts.generated_at } })
})

adminApiRouter.post(
  '/admin/hot-topic/posts/:postId/distribution',
  requireHumanAuth,
  requireAdmin,
  async (req, res) => {
    if (!isRecord(req.body)) {
      res
        .status(400)
        .json({ error: { code: 'VALIDATION_ERROR', message: 'Request body must be an object' } })
      return
    }

    const distributionState =
      typeof req.body.distribution_state === 'string' ? req.body.distribution_state.trim() : ''
    const reason = typeof req.body.reason === 'string' ? req.body.reason.trim() : null
    if (!HOT_TOPIC_POST_DISTRIBUTION_STATES.has(distributionState)) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'distribution_state must be NORMAL or NO_RECOMMEND',
        },
      })
      return
    }

    const item = await hotTopicOpsService.updatePostDistribution({
      post_id: String(req.params.postId),
      distribution_state: distributionState as 'NORMAL' | 'NO_RECOMMEND',
      actor_user_id: req.user!.userId,
      reason,
    })
    res.json({ data: item })
  },
)

adminApiRouter.post(
  '/admin/hot-topic/rooms/:roomId/control',
  requireHumanAuth,
  requireAdmin,
  async (req, res) => {
    if (!isRecord(req.body)) {
      res
        .status(400)
        .json({ error: { code: 'VALIDATION_ERROR', message: 'Request body must be an object' } })
      return
    }

    const hotTopicMode =
      typeof req.body.hot_topic_mode === 'string' ? req.body.hot_topic_mode.trim() : null
    const distributionState =
      typeof req.body.distribution_state === 'string' ? req.body.distribution_state.trim() : null
    const reason = typeof req.body.reason === 'string' ? req.body.reason.trim() : null

    if (hotTopicMode !== null && !HOT_TOPIC_ROOM_MODES.has(hotTopicMode)) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'hot_topic_mode must be NORMAL, MANUAL_REVIEW_ONLY, or DISABLED',
        },
      })
      return
    }
    if (distributionState !== null && !HOT_TOPIC_ROOM_DISTRIBUTION_STATES.has(distributionState)) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'distribution_state must be NORMAL, NO_RECOMMEND, or BLOCKED',
        },
      })
      return
    }

    const item = await hotTopicOpsService.updateRoomControl({
      room_id: String(req.params.roomId),
      actor_user_id: req.user!.userId,
      hot_topic_mode: hotTopicMode as 'NORMAL' | 'MANUAL_REVIEW_ONLY' | 'DISABLED' | undefined,
      distribution_state: distributionState as 'NORMAL' | 'NO_RECOMMEND' | 'BLOCKED' | undefined,
      reason,
    })
    res.json({ data: item })
  },
)
