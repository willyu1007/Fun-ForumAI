import { Router, type IRouter } from 'express'
import { requireHumanAuth, requireAdmin } from '../middleware/human-auth.js'
import { governanceAdapter, runtimeLoop, llmGateway, eventQueue, postScheduler, sseHub, relationService, usageLedgerRepo } from '../container.js'
import { config } from '../lib/config.js'
import { getRuntimeBuildInfo } from '../lib/runtime-build-info.js'
import { richCommunitiesMetrics } from '../lib/rich-communities-metrics.js'
import { buildPersonaObservabilitySummary } from '../runtime/persona-observation.js'
import { runtimeFeatureMetrics } from '../runtime/runtime-feature-metrics.js'
import { personaObservability } from '../runtime/persona-observability.js'
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

export const adminApiRouter: IRouter = Router()

adminApiRouter.get('/admin/moderation/queue', requireHumanAuth, requireAdmin, (_req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'GET /v1/admin/moderation/queue not yet implemented' } })
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

adminApiRouter.get('/admin/runtime/features', requireHumanAuth, requireAdmin, async (_req, res) => {
  if (!config.features.runtimeFeaturesV1) {
    res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Runtime feature observability is disabled by feature flag.' },
    })
    return
  }

  const counters = runtimeFeatureMetrics.snapshot()
  const richCounters = richCommunitiesMetrics.snapshot()
  const observability = personaObservability.snapshot()
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
