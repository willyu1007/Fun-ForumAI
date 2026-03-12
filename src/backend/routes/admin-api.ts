import { Router, type IRouter } from 'express'
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
  privateChannelServices,
} from '../container.js'
import { config } from '../lib/config.js'
import { getRuntimeBuildInfo } from '../lib/runtime-build-info.js'
import { richCommunitiesMetrics } from '../lib/rich-communities-metrics.js'
import { buildPersonaObservabilitySummary } from '../runtime/persona-observation.js'
import { runtimeFeatureMetrics } from '../runtime/runtime-feature-metrics.js'
import { personaObservability } from '../runtime/persona-observability.js'
import { readPersonaObservation } from '../runtime/persona-observation.js'
import {
  startRolloutEvidenceWindow,
  getActiveRolloutWindow,
  clearActiveRolloutWindow,
  collectIdentityWriteDelta,
  collectCostBaselineFromLedger,
  collectFallbackOrDegradedEntries,
} from '../runtime/rollout-evidence-collector.js'
import { validate } from '../validation/validate.js'
import { governanceActionSchema } from '../validation/schemas.js'
import { resolveEffectiveDisclosureCap } from './admin-api-utils.js'

export const adminApiRouter: IRouter = Router()

adminApiRouter.get('/admin/moderation/queue', requireHumanAuth, requireAdmin, async (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined
  const case_type = typeof req.query.case_type === 'string' ? req.query.case_type : undefined
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined
  const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : undefined
  const result = await reviewService.listQueue({ status, case_type, cursor, limit })
  res.json({ data: result.items, meta: { cursor: result.next_cursor } })
})

adminApiRouter.get('/admin/moderation/cases/:caseId', requireHumanAuth, requireAdmin, async (req, res) => {
  const detail = await reviewService.getCaseDetail(String(req.params.caseId))
  if (!detail) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Case not found' } })
    return
  }
  res.json({ data: detail })
})

adminApiRouter.post('/admin/moderation/cases/:caseId/assign', requireHumanAuth, requireAdmin, async (req, res) => {
  const assignee_user_id = typeof req.body?.assignee_user_id === 'string' ? req.body.assignee_user_id : null
  const updated = await reviewService.assignCase(String(req.params.caseId), assignee_user_id)
  if (!updated) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Case not found' } })
    return
  }
  res.json({ data: updated })
})

adminApiRouter.post('/admin/moderation/cases/:caseId/resolve', requireHumanAuth, requireAdmin, async (req, res) => {
  const resolution_action = typeof req.body?.resolution_action === 'string'
    ? req.body.resolution_action.trim()
    : ''
  if (!resolution_action) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'resolution_action is required' } })
    return
  }
  const updated = await reviewService.resolveCase(String(req.params.caseId), resolution_action)
  if (!updated) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Case not found' } })
    return
  }
  res.json({ data: updated })
})

adminApiRouter.post('/admin/moderation/cases/:caseId/reopen', requireHumanAuth, requireAdmin, async (req, res) => {
  const opened_reason = typeof req.body?.opened_reason === 'string'
    ? req.body.opened_reason.trim()
    : 'manual_reopen'
  const updated = await reviewService.reopenCase(String(req.params.caseId), opened_reason)
  if (!updated) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Case not found' } })
    return
  }
  res.json({ data: updated })
})

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

adminApiRouter.post('/admin/identity-reviews/:userId', requireHumanAuth, requireAdmin, async (req, res) => {
  const status = typeof req.body?.status === 'string' ? req.body.status : ''
  const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined
  if (status !== 'VERIFIED' && status !== 'REJECTED' && status !== 'EXPIRED' && status !== 'PENDING') {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'status must be PENDING, VERIFIED, REJECTED, or EXPIRED' },
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
  await reviewService.resolveCase(identityCase.id, `identity_${status.toLowerCase()}`)
  res.json({ data: reviewRecord })
})

adminApiRouter.get('/admin/agents/:agentId/risk-profile', requireHumanAuth, requireAdmin, async (req, res) => {
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
  const configActionLogs = await riskGovernanceRepo.listGovernanceActionLogs('config_revision', agentId)
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
      }
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))

  res.json({
    data: {
      agent,
      latest_config: latestConfig,
      spillover_events: riskEvents.items,
      recent_config_actions: configActionLogs,
      recent_private_provenance,
      effective_disclosure_cap: resolveEffectiveDisclosureCap({
        latestConfig,
        privacySettings,
      }),
    },
  })
})

adminApiRouter.get('/admin/runtime/stats', requireHumanAuth, requireAdmin, async (_req, res) => {
  const queueSize = await runtimeLoop.getQueueSize()
  const eventQueueSize = await eventQueue.size()
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

adminApiRouter.post('/admin/runtime/features/reset', requireHumanAuth, requireAdmin, async (_req, res) => {
  if (!config.features.runtimeFeaturesV1) {
    res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Runtime feature observability is disabled by feature flag.' },
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
})

adminApiRouter.get('/admin/runtime/features', requireHumanAuth, requireAdmin, async (_req, res) => {
  if (!config.features.runtimeFeaturesV1) {
    res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Runtime feature observability is disabled by feature flag.' },
    })
    return
  }

  const counters = runtimeFeatureMetrics.snapshot()
  const richCounters = richCommunitiesMetrics.snapshot()
  const observability = await personaObservability.snapshotAggregated()
  const guidance = await guidanceObservabilityService.snapshot()
  const recentLedgerEntries = await usageLedgerRepo.listRecent(200)
  const build = getRuntimeBuildInfo()

  res.json({
    data: {
      flags: config.features,
      runtime: {
        queue_backend: config.runtime.queueBackend,
        leader_backend: config.runtime.leaderBackend,
        llm_provider: config.llm.provider,
        llm_model: config.llm.model,
        build,
        persona_runtime: {
          enabled: config.features.personaRuntimeV1,
          scenes: config.features.personaRuntimeScenes,
          writeback_enabled: config.features.personaWritebackV1,
        },
      },
      counters,
      persona_observability: buildPersonaObservabilitySummary(counters.persona),
      rich_communities: richCounters,
      guidance: {
        flags: {
          guidance_v1: config.features.guidanceV1,
          guidance_recall_v1: config.features.guidanceRecallV1,
        },
        ...guidance,
      },
      observability: {
        ...observability,
        render_log_preview: personaObservability.latestRenderLog(recentLedgerEntries, 20),
      },
    },
  })
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
      res.status(503).json({ error: { code: 'SERVICE_UNAVAILABLE', message: 'Social graph service unavailable' } })
      return
    }

    const relation = await relationService.adminUnblock(fromAgentId, toAgentId, reason.trim())
    res.json({ data: relation })
  },
)

adminApiRouter.post('/admin/rollout/evidence-window/start', requireHumanAuth, requireAdmin, (_req, res) => {
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
})

adminApiRouter.post('/admin/rollout/evidence-window/collect', requireHumanAuth, requireAdmin, async (req, res) => {
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
})

adminApiRouter.get('/admin/rollout/fallback-entries', requireHumanAuth, requireAdmin, async (_req, res) => {
  const allEntries = await usageLedgerRepo.listRecent(1_000)
  const fallbackEntries = collectFallbackOrDegradedEntries(allEntries)
  res.json({
    data: {
      total: fallbackEntries.length,
      entries: fallbackEntries.slice(0, 100),
    },
  })
})
