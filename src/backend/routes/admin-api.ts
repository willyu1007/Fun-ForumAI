import { Router, type IRouter, type Response } from 'express'
import { requireHumanAuth, requireAdmin } from '../middleware/human-auth.js'
import {
  agentService,
  agentRunRepo,
  governanceAdapter,
  runtimeLoop,
  llmGateway,
  eventQueue,
  postScheduler,
  sseHub,
  relationService,
  usageLedgerRepo,
  guidanceObservabilityService,
  reviewService,
  riskGovernanceRepo,
  publicDisclosureCapService,
  privateChannelServices,
  hotTopicOpsService,
  feedbackService,
  inviteCodeService,
  adminUserAccessService,
  identityGateService,
  llmRegistryBundle,
  mediaReuseGovernanceService,
  mediaObservabilityService,
  mediaRolloutControllerService,
  mediaLifecycleService,
  mediaLineageService,
  searchTelemetryService,
  searchProjectionService,
  agentBioRefreshService,
  launchProgrammingOpsService,
  proactiveInteractionService,
} from '../container.js'
import { config } from '../lib/config.js'
import { AppError, ValidationError } from '../lib/errors.js'
import { getRuntimeBuildInfo } from '../lib/runtime-build-info.js'
import { richCommunitiesMetrics } from '../lib/rich-communities-metrics.js'
import { buildPersonaObservabilitySummary } from '../runtime/persona-observation.js'
import { runtimeFeatureMetrics } from '../runtime/runtime-feature-metrics.js'
import { personaObservability } from '../runtime/persona-observability.js'
import { readPersonaObservation } from '../runtime/persona-observation.js'
import { summarizeProviderAdmission } from '../llm/provider-admission.js'
import { buildRuntimeAuthorityState } from '../llm/runtime-authority-state.js'
import {
  startRolloutEvidenceWindow,
  getActiveRolloutWindow,
  clearActiveRolloutWindow,
  collectIdentityWriteDelta,
  collectCostBaselineFromLedger,
  collectFallbackOrDegradedEntries,
  summarizeLedgerAttribution,
} from '../runtime/rollout-evidence-collector.js'
import { validate } from '../validation/validate.js'
import {
  createCommunityCommonsAssetSchema,
  createDisclosureCapOverrideSchema,
  adminUserIdParamSchema,
  grantAdminAccessSchema,
  createPlatformCanonicalAssetSchema,
  feedbackCategorySchema,
  feedbackStatusSchema,
  governanceActionSchema,
  patchMediaRolloutControllerSchema,
  patchAdminFeedbackSchema,
  patchMediaReusePolicySchema,
  releaseMediaRolloutControllerOverrideSchema,
  releaseDisclosureCapOverrideSchema,
  revokeMediaReusePolicySchema,
} from '../validation/schemas.js'
import { resolveEffectiveDisclosureCap } from './admin-api-utils.js'
import type { MediaLineageNodeType, MediaRolloutControllerOverride } from '../repos/types.js'
import { resolvePostLaunchTuningProfile } from '../launch/post-launch-tuning.js'
import { getLightweightPersonalizationRuntime } from '../launch/lightweight-personalization.js'
import { resolveEffectiveLaunchVisualRollout } from '../launch/visual-rollout.js'
import { buildPrivateSessionRawEventId } from '../context-memory/runtime.js'
import { PRIVATE_SESSION_TIMEOUT_MS } from '../services/private-channel-service.js'

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

function buildExecutionPlanPreview(entries: Awaited<ReturnType<typeof usageLedgerRepo.listRecent>>) {
  return entries.slice(0, 20).map((entry) => ({
    trace_id: entry.trace_id,
    intent: entry.intent,
    visibility: entry.visibility,
    agent_id: entry.agent_id,
    provider_id: entry.provider_id ?? null,
    model_id: entry.model_id ?? null,
    policy_id: entry.policy_id ?? null,
    adapter_id: entry.adapter_id ?? null,
    credential_id: entry.credential_id ?? null,
    route_order: entry.route_order ?? [],
    ordered_candidates: entry.ordered_candidates ?? [],
    fallback_chain: entry.fallback_chain ?? [],
    fallback_history: entry.fallback_history ?? [],
    merge_trace: entry.merge_trace ?? null,
    resolved_params: entry.resolved_params ?? null,
    success: entry.success,
    error_code: entry.error_code ?? null,
    created_at: entry.created_at,
  }))
}

function buildPrivateSessionCloseoutTraceIds(sessionId: string, agentId: string) {
  const rawEventId = buildPrivateSessionRawEventId(sessionId)
  return {
    raw_event_id: rawEventId,
    extract_trace_id: `context-extract:${rawEventId}`,
    distill_trace_id: `context-distill:${rawEventId}`,
    identity_trace_id: `identity-finalize:${agentId}:${rawEventId}`,
  }
}

function resolveRuntimeCloseoutCandidateIds(agentId: string): string[] {
  if (agentId) return [agentId]
  return agentService.listActiveAgents({ limit: 50 }).items.map((agent) => agent.id)
}

function resolveMinimumCloseoutStaleMinutes(messageCount: number): number {
  const timeoutMinutes = Math.ceil(PRIVATE_SESSION_TIMEOUT_MS / 60_000)
  return timeoutMinutes + messageCount + 5
}

adminApiRouter.get('/admin/moderation/queue', requireHumanAuth, requireAdmin, async (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined
  const case_type = typeof req.query.case_type === 'string' ? req.query.case_type : undefined
  const queue = typeof req.query.queue === 'string' ? req.query.queue : undefined
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined
  const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : undefined
  const result = await reviewService.listQueue({ status, case_type, queue, cursor, limit })
  res.json({ data: result.items, meta: { cursor: result.next_cursor } })
})

adminApiRouter.get(
  '/admin/moderation/cases/:caseId',
  requireHumanAuth,
  requireAdmin,
  async (req, res) => {
    const detail = await reviewService.getCaseDetail(String(req.params.caseId))
    if (!detail) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Case not found' } })
      return
    }
    res.json({ data: detail })
  },
)

adminApiRouter.get(
  '/admin/moderation/cases/:caseId/evidence-export',
  requireHumanAuth,
  requireAdmin,
  async (req, res) => {
    const redaction =
      typeof req.query.redaction === 'string' ? req.query.redaction.trim() : undefined
    if (redaction && redaction !== 'operator' && redaction !== 'share') {
      res
        .status(400)
        .json({
          error: { code: 'VALIDATION_ERROR', message: 'redaction must be operator or share' },
        })
      return
    }
    const exportBundle = await reviewService.buildEvidenceExport(String(req.params.caseId), {
      redaction,
    })
    if (!exportBundle) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Case not found' } })
      return
    }
    res.json({ data: exportBundle })
  },
)

adminApiRouter.post(
  '/admin/moderation/cases/:caseId/assign',
  requireHumanAuth,
  requireAdmin,
  async (req, res) => {
    const assignee_user_id =
      typeof req.body?.assignee_user_id === 'string' ? req.body.assignee_user_id : null
    const updated = await reviewService.assignCase(
      String(req.params.caseId),
      assignee_user_id,
      req.user!.userId,
    )
    if (!updated) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Case not found' } })
      return
    }
    res.json({ data: updated })
  },
)

adminApiRouter.post(
  '/admin/moderation/cases/:caseId/transfer',
  requireHumanAuth,
  requireAdmin,
  async (req, res) => {
    const assignee_user_id =
      typeof req.body?.assignee_user_id === 'string' ? req.body.assignee_user_id.trim() : ''
    const assigned_role =
      typeof req.body?.assigned_role === 'string' ? req.body.assigned_role.trim() : undefined
    const operator_note =
      typeof req.body?.operator_note === 'string' ? req.body.operator_note.trim() : undefined
    if (!assignee_user_id) {
      res
        .status(400)
        .json({ error: { code: 'VALIDATION_ERROR', message: 'assignee_user_id is required' } })
      return
    }
    const updated = await reviewService.transferCase(
      String(req.params.caseId),
      assignee_user_id,
      req.user!.userId,
      {
        assigned_role,
        operator_note,
      },
    )
    if (!updated) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Case not found' } })
      return
    }
    res.json({ data: updated })
  },
)

adminApiRouter.post(
  '/admin/moderation/cases/:caseId/release',
  requireHumanAuth,
  requireAdmin,
  async (req, res) => {
    const operator_note =
      typeof req.body?.operator_note === 'string' ? req.body.operator_note.trim() : undefined
    const released = await reviewService.releaseCase(String(req.params.caseId), req.user!.userId, {
      operator_note,
    })
    if (!released) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Case not found' } })
      return
    }
    res.json({ data: released })
  },
)

adminApiRouter.post(
  '/admin/moderation/cases/:caseId/resolve',
  requireHumanAuth,
  requireAdmin,
  async (req, res) => {
    const resolution_action =
      typeof req.body?.resolution_action === 'string' ? req.body.resolution_action.trim() : ''
    const resolution_note =
      typeof req.body?.resolution_note === 'string' ? req.body.resolution_note.trim() : null
    if (!resolution_action) {
      res
        .status(400)
        .json({ error: { code: 'VALIDATION_ERROR', message: 'resolution_action is required' } })
      return
    }
    const updated = await reviewService.resolveCase(
      String(req.params.caseId),
      resolution_action,
      req.user!.userId,
      resolution_note,
    )
    if (!updated) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Case not found' } })
      return
    }
    res.json({ data: updated })
  },
)

adminApiRouter.post(
  '/admin/moderation/tasks/:taskId/claim',
  requireHumanAuth,
  requireAdmin,
  async (req, res) => {
    const assigned_role =
      typeof req.body?.assigned_role === 'string' ? req.body.assigned_role.trim() : undefined
    const operator_note =
      typeof req.body?.operator_note === 'string' ? req.body.operator_note.trim() : undefined
    const result = await reviewService.claimTask(String(req.params.taskId), req.user!.userId, {
      assigned_role,
      operator_note,
    })
    if (!result) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Task not found' } })
      return
    }
    res.json({ data: result })
  },
)

adminApiRouter.post(
  '/admin/moderation/cases/:caseId/reopen',
  requireHumanAuth,
  requireAdmin,
  async (req, res) => {
    const opened_reason =
      typeof req.body?.opened_reason === 'string' ? req.body.opened_reason.trim() : 'manual_reopen'
    const updated = await reviewService.reopenCase(
      String(req.params.caseId),
      opened_reason,
      req.user!.userId,
    )
    if (!updated) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Case not found' } })
      return
    }
    res.json({ data: updated })
  },
)

adminApiRouter.get('/admin/feedback', requireHumanAuth, requireAdmin, async (req, res) => {
  try {
    const status = parseFeedbackStatusQuery(req.query.status)
    const category = parseFeedbackCategoryQuery(req.query.category)
    const source_route = typeof req.query.source_route === 'string'
      ? req.query.source_route
      : undefined
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined
    const limitRaw = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 20
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : 20
    const result = await feedbackService.listForAdmin({
      status,
      category,
      source_route,
      cursor,
      limit,
    })
    res.json({ data: result.items, meta: { cursor: result.next_cursor } })
  } catch (err) {
    if (tryHandleAppError(res, err)) return
    throw err
  }
})

adminApiRouter.get('/admin/feedback/:feedbackId', requireHumanAuth, requireAdmin, async (req, res) => {
  try {
    const detail = await feedbackService.getDetailForAdmin(String(req.params.feedbackId))
    res.json({ data: detail })
  } catch (err) {
    if (tryHandleAppError(res, err)) return
    throw err
  }
})

adminApiRouter.get('/admin/invite-codes', requireHumanAuth, requireAdmin, async (_req, res) => {
  if (!inviteCodeService) {
    res.status(503).json({ error: { code: 'SERVICE_UNAVAILABLE', message: '邀请码服务不可用' } })
    return
  }

  try {
    const inviteCodes = await inviteCodeService.listForAdmin()
    res.json({ data: inviteCodes })
  } catch (err) {
    if (tryHandleAppError(res, err)) return
    throw err
  }
})

adminApiRouter.get('/admin/admin-users', requireHumanAuth, requireAdmin, async (_req, res) => {
  if (!adminUserAccessService) {
    res.status(503).json({ error: { code: 'SERVICE_UNAVAILABLE', message: '管理员服务不可用' } })
    return
  }

  try {
    const admins = await adminUserAccessService.listAdmins()
    res.json({ data: admins })
  } catch (err) {
    if (tryHandleAppError(res, err)) return
    throw err
  }
})

adminApiRouter.post(
  '/admin/admin-users/grant',
  requireHumanAuth,
  requireAdmin,
  validate(grantAdminAccessSchema),
  async (req, res) => {
    if (!adminUserAccessService) {
      res.status(503).json({ error: { code: 'SERVICE_UNAVAILABLE', message: '管理员服务不可用' } })
      return
    }

    try {
      const admin = await adminUserAccessService.grantAdmin({
        userId: req.body.userId,
        email: req.body.email,
        phone: req.body.phone,
      })
      res.json({ data: admin })
    } catch (err) {
      if (tryHandleAppError(res, err)) return
      throw err
    }
  },
)

adminApiRouter.post(
  '/admin/admin-users/:userId/revoke',
  requireHumanAuth,
  requireAdmin,
  validate(adminUserIdParamSchema, 'params'),
  async (req, res) => {
    if (!adminUserAccessService) {
      res.status(503).json({ error: { code: 'SERVICE_UNAVAILABLE', message: '管理员服务不可用' } })
      return
    }

    try {
      const admin = await adminUserAccessService.revokeAdmin({
        targetUserId: String(req.params.userId),
        actorUserId: req.user!.userId,
      })
      res.json({ data: admin })
    } catch (err) {
      if (tryHandleAppError(res, err)) return
      throw err
    }
  },
)

adminApiRouter.patch(
  '/admin/feedback/:feedbackId',
  requireHumanAuth,
  requireAdmin,
  validate(patchAdminFeedbackSchema),
  async (req, res) => {
    try {
      const detail = await feedbackService.updateByAdmin({
        id: String(req.params.feedbackId),
        actor_user_id: req.user!.userId,
        status: req.body.status,
        public_resolution_note: req.body.public_resolution_note,
        internal_note: req.body.internal_note,
      })
      res.json({ data: detail })
    } catch (err) {
      if (tryHandleAppError(res, err)) return
      throw err
    }
  },
)

function parseFeedbackStatusQuery(value: unknown) {
  if (typeof value !== 'string') {
    return undefined
  }
  const parsed = feedbackStatusSchema.safeParse(value)
  if (!parsed.success) {
    throw new ValidationError('invalid feedback status')
  }
  return parsed.data
}

function parseFeedbackCategoryQuery(value: unknown) {
  if (typeof value !== 'string') {
    return undefined
  }
  const parsed = feedbackCategorySchema.safeParse(value)
  if (!parsed.success) {
    throw new ValidationError('invalid feedback category')
  }
  return parsed.data
}

adminApiRouter.get('/admin/identity-reviews', requireHumanAuth, requireAdmin, async (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined
  const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 50
  const result = await riskGovernanceRepo.listIdentityVerifications({
    status,
    cursor,
    limit: Math.min(limit, 100),
  })
  res.json({ data: result.items, meta: { cursor: result.next_cursor } })
})

adminApiRouter.post(
  '/admin/identity-reviews/:userId',
  requireHumanAuth,
  requireAdmin,
  async (req, res) => {
    const status = typeof req.body?.status === 'string' ? req.body.status : ''
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined
    if (
      status !== 'VERIFIED' &&
      status !== 'REJECTED' &&
      status !== 'EXPIRED' &&
      status !== 'PENDING'
    ) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'status must be PENDING, VERIFIED, REJECTED, or EXPIRED',
        },
      })
      return
    }

    const reviewRecord = await riskGovernanceRepo.upsertIdentityVerification({
      user_id: String(req.params.userId),
      status,
      reviewed_by_user_id: req.user!.userId,
      reason,
      reviewed_at: new Date(),
    })
    const identityCase = await reviewService.openIdentityReviewCase({
      user_id: String(req.params.userId),
      opened_by: req.user!.userId,
      summary_text: `Manual identity review resolved as ${status}`,
      evidence: {
        status,
        reason: reason ?? null,
        reviewed_by_user_id: req.user!.userId,
      },
    })
    await reviewService.resolveCase(
      identityCase.id,
      `identity_${status.toLowerCase()}`,
      req.user!.userId,
    )
    res.json({ data: reviewRecord })
  },
)

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

adminApiRouter.get('/admin/runtime/stats', requireHumanAuth, requireAdmin, async (_req, res) => {
  const queueSize = await runtimeLoop.getQueueSize()
  const eventQueueSize = await eventQueue.size()
  const recentLedgerEntries = await usageLedgerRepo.listRecent(200)
  const authorityState = buildRuntimeAuthorityState({
    routingMode: config.llm.routingMode,
    recentLedgerEntries,
  })
  const identityGate = identityGateService.getRuntimeState()
  res.json({
    data: {
      runtime: {
        running: runtimeLoop.isRunning,
        processing: runtimeLoop.isProcessing,
        queue_size: queueSize,
        is_leader: runtimeLoop.isLeader,
        llm_configured: llmGateway.isConfigured,
        node_env: config.nodeEnv,
        queue_backend: config.runtime.queueBackend,
        leader_backend: config.runtime.leaderBackend,
        routing_mode: config.llm.routingMode,
        authority_state: authorityState,
        identity_gate: identityGate,
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

adminApiRouter.post(
  '/admin/runtime/features/reset',
  requireHumanAuth,
  requireAdmin,
  async (_req, res) => {
    if (!config.launch.capabilities.runtimeFeaturesV1) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Runtime feature observability is disabled by feature flag.',
        },
      })
      return
    }

    await personaObservability.resetAggregated()
    const snapshot = await personaObservability.snapshotAggregated()
    res.json({
      data: {
        reset_at: new Date().toISOString(),
        observability: snapshot,
      },
    })
  },
)

adminApiRouter.get('/admin/runtime/features', requireHumanAuth, requireAdmin, async (_req, res) => {
  if (!config.launch.capabilities.runtimeFeaturesV1) {
    res.status(403).json({
      error: {
        code: 'FORBIDDEN',
        message: 'Runtime feature observability is disabled by feature flag.',
      },
    })
    return
  }

  const counters = runtimeFeatureMetrics.snapshot()
  const richCounters = richCommunitiesMetrics.snapshot()
  const observability = await personaObservability.snapshotAggregated()
  const guidance = await guidanceObservabilityService.snapshot()
  const search = searchTelemetryService.snapshot()
  const searchHealth = await searchProjectionService.inspectReadModelHealth()
  const recentLedgerEntries = await usageLedgerRepo.listRecent(200)
  const build = getRuntimeBuildInfo()
  const providerAdmission = summarizeProviderAdmission(llmRegistryBundle)
  const attributionSummary = summarizeLedgerAttribution(recentLedgerEntries)
  const fallbackEntries = collectFallbackOrDegradedEntries(recentLedgerEntries)
  const authorityState = buildRuntimeAuthorityState({
    routingMode: config.llm.routingMode,
    recentLedgerEntries,
  })
  const identityGate = identityGateService.getRuntimeState()
  const tuning = resolvePostLaunchTuningProfile({
    enabled: config.launch.capabilities.postLaunchTuningV1,
    profileId: config.launchTuning.activeProfile || null,
  })
  const lightweightPersonalization = config.launch.capabilities.lightweightPersonalizationV1
    ? getLightweightPersonalizationRuntime()
    : null
  const effectiveVisualRollout = tuning ? resolveEffectiveLaunchVisualRollout() : null

  res.json({
    data: {
      launch_capabilities: config.launch.capabilities,
      runtime: {
        queue_backend: config.runtime.queueBackend,
        leader_backend: config.runtime.leaderBackend,
        routing_mode: config.llm.routingMode,
        identity_gate: identityGate,
        build,
        persona_runtime: {
          enabled: config.launch.capabilities.personaRuntimeV1,
          scenes: config.launch.capabilities.personaRuntimeScenes,
          writeback_enabled: config.launch.capabilities.personaWritebackV1,
        },
        forum_orchestration: {
          shadow: config.launch.capabilities.forumOrchestrationShadow,
          selection_cutover: config.launch.capabilities.forumOrchestrationSelectionCutover,
          envelope_cutover: config.launch.capabilities.forumOrchestrationEnvelopeCutover,
        },
        lightweight_personalization: lightweightPersonalization
          ? {
              enabled: true,
              viewer_context: lightweightPersonalization.viewer_context,
              rollback: lightweightPersonalization.rollback,
              public_view_events: lightweightPersonalization.public_view_events,
            }
          : {
              enabled: false,
            },
        post_launch_tuning: tuning
          ? {
              enabled: true,
              active_profile_id: tuning.active_profile_id,
              rollback_profile: tuning.runtime.activation.rollback_profile,
              effective_overrides: tuning.active_profile,
              effective_visual_rollout: effectiveVisualRollout,
            }
          : {
              enabled: false,
              rollback_profile: 'baseline',
            },
      },
      counters,
      provider_admission: providerAdmission,
      persona_observability: buildPersonaObservabilitySummary(counters.persona),
      rich_communities: richCounters,
      guidance: {
        flags: {
          guidance_v1: config.launch.capabilities.guidanceV1,
          guidance_recall_v1: config.launch.capabilities.guidanceRecallV1,
        },
        ...guidance,
      },
      search: {
        telemetry: search,
        health: searchHealth,
      },
      agent_bio: agentBioRefreshService.inspectObservability(),
      observability: {
        ...observability,
        render_log_preview: personaObservability.latestRenderLog(recentLedgerEntries, 20),
        execution_plan_preview: buildExecutionPlanPreview(recentLedgerEntries),
        fallback_or_degraded_preview: {
          total: fallbackEntries.length,
          entries: fallbackEntries.slice(0, 20),
        },
        attribution_summary: attributionSummary,
        authority_state: authorityState,
      },
    },
  })
})

adminApiRouter.post(
  '/admin/runtime/closeout/visible/private-reply',
  requireHumanAuth,
  requireAdmin,
  async (req, res) => {
    if (!privateChannelServices) {
      res.status(503).json({
        error: { code: 'SERVICE_UNAVAILABLE', message: 'Private channel closeout is unavailable.' },
      })
      return
    }

    const agentId = typeof req.body?.agent_id === 'string' ? req.body.agent_id.trim() : ''
    const humanUserId = typeof req.body?.human_user_id === 'string' ? req.body.human_user_id.trim() : ''
    const content = typeof req.body?.content === 'string' && req.body.content.trim()
      ? req.body.content.trim()
      : '请用一句简短的话回应，确认你已准备好继续这段私聊。'

    const candidateIds = resolveRuntimeCloseoutCandidateIds(agentId)

    if (candidateIds.length === 0) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'No active agents are available for runtime closeout.' },
      })
      return
    }

    const failures: Array<Record<string, string>> = []
    for (const candidateAgentId of candidateIds) {
      try {
        const agent = agentService.getAgent(candidateAgentId)
        const selectedHumanUserId = humanUserId || agent.owner_id
        const result = await privateChannelServices.channelService.runCloseoutVisibleReply({
          agentId: agent.id,
          humanUserId: selectedHumanUserId,
          content,
        })
        const traceId = `private-chat:${result.session.id}:${result.human_message.id}`
        const ledgerEntries = await usageLedgerRepo.listByTracePrefix(traceId, 10)

        res.json({
          data: {
            mode: 'private_reply',
            agent_id: agent.id,
            human_user_id: selectedHumanUserId,
            session_id: result.session.id,
            trace_id: traceId,
            human_message_id: result.human_message.id,
            agent_reply_id: result.agent_reply.id,
            token_cost: result.token_cost,
            ledger_entries: ledgerEntries,
          },
        })
        return
      } catch (err) {
        failures.push({
          agent_id: candidateAgentId,
          human_user_id: humanUserId || '',
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    res.status(422).json({
      error: {
        code: 'CLOSEOUT_VISIBLE_PRIVATE_REPLY_UNAVAILABLE',
        message: 'No eligible visible private-reply path succeeded for runtime closeout.',
        details: { attempts: failures.slice(0, 20) },
      },
    })
  },
)

adminApiRouter.post(
  '/admin/runtime/closeout/visible/proactive-opening',
  requireHumanAuth,
  requireAdmin,
  async (req, res) => {
    if (!proactiveInteractionService) {
      res.status(503).json({
        error: { code: 'SERVICE_UNAVAILABLE', message: 'Proactive closeout is unavailable.' },
      })
      return
    }

    const agentId = typeof req.body?.agent_id === 'string' ? req.body.agent_id.trim() : ''
    const humanUserId = typeof req.body?.human_user_id === 'string' ? req.body.human_user_id.trim() : ''
    const context = typeof req.body?.context === 'string' && req.body.context.trim()
      ? req.body.context.trim()
      : '请主动打个招呼，确认你已准备好继续这段交流，并保持一句话内完成。'
    const candidateIds = resolveRuntimeCloseoutCandidateIds(agentId)

    if (candidateIds.length === 0) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'No active agents are available for runtime closeout.' },
      })
      return
    }

    const failures: Array<Record<string, string>> = []
    for (const candidateAgentId of candidateIds) {
      try {
        const agent = agentService.getAgent(candidateAgentId)
        const selectedHumanUserId = humanUserId || agent.owner_id
        const result = await proactiveInteractionService.runCloseoutProactiveOpening({
          agentId: agent.id,
          humanUserId: selectedHumanUserId,
          context,
        })
        const ledgerEntries = await usageLedgerRepo.listByTracePrefix(result.trace_id, 10)

        res.json({
          data: {
            mode: 'proactive_opening',
            agent_id: agent.id,
            human_user_id: selectedHumanUserId,
            session_id: result.session.id,
            trace_id: result.trace_id,
            opening_message_id: result.opening_message.id,
            token_cost: result.token_cost,
            ledger_entries: ledgerEntries,
          },
        })
        return
      } catch (err) {
        failures.push({
          agent_id: candidateAgentId,
          human_user_id: humanUserId || '',
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    res.status(422).json({
      error: {
        code: 'CLOSEOUT_VISIBLE_PROACTIVE_OPENING_UNAVAILABLE',
        message: 'No eligible visible proactive-opening path succeeded for runtime closeout.',
        details: { attempts: failures.slice(0, 20) },
      },
    })
  },
)

adminApiRouter.post(
  '/admin/runtime/closeout/hidden-worker/private-session-fixture',
  requireHumanAuth,
  requireAdmin,
  async (req, res) => {
    if (!privateChannelServices) {
      res.status(503).json({
        error: { code: 'SERVICE_UNAVAILABLE', message: 'Private channel closeout is unavailable.' },
      })
      return
    }

    try {
      const agentId = typeof req.body?.agent_id === 'string' ? req.body.agent_id.trim() : ''
      const humanUserId = typeof req.body?.human_user_id === 'string' ? req.body.human_user_id.trim() : ''
      const messageCountRaw = typeof req.body?.message_count === 'number'
        ? req.body.message_count
        : Number.parseInt(String(req.body?.message_count ?? ''), 10)
      const staleMinutesRaw = typeof req.body?.stale_minutes === 'number'
        ? req.body.stale_minutes
        : Number.parseInt(String(req.body?.stale_minutes ?? ''), 10)
      const selectedAgent = agentId
        ? agentService.getAgent(agentId)
        : agentService.listActiveAgents({ limit: 1 }).items[0]

      if (!selectedAgent) {
        res.status(404).json({
          error: { code: 'NOT_FOUND', message: 'No active agents are available for runtime closeout.' },
        })
        return
      }

      const selectedHumanUserId = humanUserId || selectedAgent.owner_id
      const messageCount = Number.isFinite(messageCountRaw)
        ? Math.max(4, Math.min(messageCountRaw, 10))
        : 4
      const minimumStaleMinutes = resolveMinimumCloseoutStaleMinutes(messageCount)
      const staleMinutes = Number.isFinite(staleMinutesRaw)
        ? Math.max(staleMinutesRaw, minimumStaleMinutes)
        : minimumStaleMinutes
      const startedAt = new Date(Date.now() - staleMinutes * 60_000)
      const fixtureMessages = Array.from({ length: messageCount }, (_, index) => ({
        authorType: index % 2 === 0 ? 'HUMAN' as const : 'AGENT' as const,
        content: index % 2 === 0
          ? `Runtime closeout fixture owner message ${index + 1}.`
          : `Runtime closeout fixture agent reply ${index + 1}.`,
        createdAt: new Date(startedAt.getTime() + (index + 1) * 60_000),
      }))
      const result = await privateChannelServices.channelService.createCloseoutFixtureSession({
        agentId: selectedAgent.id,
        humanUserId: selectedHumanUserId,
        startedAt,
        messages: fixtureMessages,
      })
      const traceIds = buildPrivateSessionCloseoutTraceIds(result.session.id, selectedAgent.id)

      res.status(201).json({
        data: {
          agent_id: selectedAgent.id,
          human_user_id: selectedHumanUserId,
          session_id: result.session.id,
          started_at: result.session.started_at.toISOString(),
          digest_status: result.session.digest_status,
          trace_ids: traceIds,
          message_count: result.messages.length,
          messages: result.messages.map((message) => ({
            id: message.id,
            author_type: message.author_type,
            created_at: message.created_at.toISOString(),
          })),
          minimum_stale_minutes: minimumStaleMinutes,
          scheduler_wait_hint_ms: 5 * 60 * 1000,
          timeout_threshold_ms: PRIVATE_SESSION_TIMEOUT_MS,
        },
      })
    } catch (err) {
      if (tryHandleAppError(res, err)) return
      throw err
    }
  },
)

adminApiRouter.get(
  '/admin/runtime/closeout/hidden-worker/private-session-fixture/:sessionId',
  requireHumanAuth,
  requireAdmin,
  async (req, res) => {
    if (!privateChannelServices) {
      res.status(503).json({
        error: { code: 'SERVICE_UNAVAILABLE', message: 'Private channel closeout is unavailable.' },
      })
      return
    }

    try {
      const session = await privateChannelServices.channelService.getSession(String(req.params.sessionId))
      const messageCount = await privateChannelServices.channelService.getMessageCount(session.id)
      const traceIds = buildPrivateSessionCloseoutTraceIds(session.id, session.agent_id)
      const [extractEntries, distillEntries, identityEntries] = await Promise.all([
        usageLedgerRepo.listByTracePrefix(traceIds.extract_trace_id, 10),
        usageLedgerRepo.listByTracePrefix(traceIds.distill_trace_id, 10),
        usageLedgerRepo.listByTracePrefix(traceIds.identity_trace_id, 10),
      ])

      res.json({
        data: {
          session_id: session.id,
          agent_id: session.agent_id,
          human_user_id: session.human_user_id,
          status: session.status,
          digest_status: session.digest_status,
          started_at: session.started_at.toISOString(),
          ended_at: session.ended_at?.toISOString() ?? null,
          message_count: messageCount,
          trace_ids: traceIds,
          ledger: {
            extract: extractEntries,
            distill: distillEntries,
            identity: identityEntries,
          },
        },
      })
    } catch (err) {
      if (tryHandleAppError(res, err)) return
      throw err
    }
  },
)

adminApiRouter.get('/admin/launch/programming-ops', requireHumanAuth, requireAdmin, async (_req, res) => {
  try {
    const data = await launchProgrammingOpsService.getAdminPayload()
    res.json({ data, meta: data.meta })
  } catch (err) {
    if (tryHandleAppError(res, err)) return
    throw err
  }
})

adminApiRouter.post(
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

adminApiRouter.post(
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
      res
        .status(503)
        .json({
          error: { code: 'SERVICE_UNAVAILABLE', message: 'Social graph service unavailable' },
        })
      return
    }

    const relation = await relationService.adminUnblock(fromAgentId, toAgentId, reason.trim())
    res.json({ data: relation })
  },
)

adminApiRouter.post(
  '/admin/rollout/evidence-window/start',
  requireHumanAuth,
  requireAdmin,
  (_req, res) => {
    const existing = getActiveRolloutWindow()
    if (existing) {
      res.status(409).json({
        error: {
          code: 'CONFLICT',
          message: 'An evidence window is already active.',
          started_at: existing.startedAt.toISOString(),
        },
      })
      return
    }
    const window = startRolloutEvidenceWindow()
    res.json({ data: { started_at: window.startedAt.toISOString() } })
  },
)

adminApiRouter.post(
  '/admin/rollout/evidence-window/collect',
  requireHumanAuth,
  requireAdmin,
  async (req, res) => {
    const window = getActiveRolloutWindow()
    if (!window) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'No active evidence window. Call POST /start first.' },
      })
      return
    }

    const agentId = typeof req.body?.agent_id === 'string' ? req.body.agent_id : ''
    if (!agentId) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'agent_id is required in request body.' },
      })
      return
    }

    const identityDelta = collectIdentityWriteDelta(window.beforeSnapshot)

    const { attribution, gate } = await collectCostBaselineFromLedger(
      usageLedgerRepo,
      agentId,
      window.startedAt,
    )

    const allEntries = await usageLedgerRepo.listRecent(1_000)
    const fallbackEntries = collectFallbackOrDegradedEntries(allEntries)

    clearActiveRolloutWindow()

    res.json({
      data: {
        window_started_at: window.startedAt.toISOString(),
        collected_at: new Date().toISOString(),
        identity_write_delta: identityDelta,
        cost_baseline: { attribution, gate },
        fallback_or_degraded: {
          total: fallbackEntries.length,
          entries: fallbackEntries.slice(0, 50),
        },
      },
    })
  },
)

adminApiRouter.get(
  '/admin/rollout/fallback-entries',
  requireHumanAuth,
  requireAdmin,
  async (_req, res) => {
    const allEntries = await usageLedgerRepo.listRecent(1_000)
    const fallbackEntries = collectFallbackOrDegradedEntries(allEntries)
    res.json({
      data: {
        total: fallbackEntries.length,
        entries: fallbackEntries.slice(0, 100),
      },
    })
  },
)
