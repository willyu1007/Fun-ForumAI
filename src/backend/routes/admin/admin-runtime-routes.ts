import type { IRouter, Response } from 'express'
import {
  agentBioRefreshService,
  agentService,
  eventQueue,
  governanceAdapter,
  guidanceObservabilityService,
  identityGateService,
  llmGateway,
  llmRegistryBundle,
  launchProgrammingOpsService,
  postScheduler,
  privateChannelServices,
  proactiveInteractionService,
  relationService,
  runtimeLoop,
  searchProjectionService,
  searchTelemetryService,
  sseHub,
  usageLedgerRepo,
} from '../../container.js'
import { config } from '../../lib/config.js'
import { AppError } from '../../lib/errors.js'
import { requireAdmin, requireHumanAuth } from '../../middleware/human-auth.js'
import { validate } from '../../validation/validate.js'
import { governanceActionSchema } from '../../validation/schemas.js'
import { getRuntimeBuildInfo } from '../../lib/runtime-build-info.js'
import { richCommunitiesMetrics } from '../../lib/rich-communities-metrics.js'
import { buildPersonaObservabilitySummary } from '../../runtime/persona-observation.js'
import { runtimeFeatureMetrics } from '../../runtime/runtime-feature-metrics.js'
import { personaObservability } from '../../runtime/persona-observability.js'
import { summarizeProviderAdmission } from '../../llm/provider-admission.js'
import { buildRuntimeAuthorityState } from '../../llm/runtime-authority-state.js'
import {
  clearActiveRolloutWindow,
  collectCostBaselineFromLedger,
  collectFallbackOrDegradedEntries,
  collectIdentityWriteDelta,
  getActiveRolloutWindow,
  startRolloutEvidenceWindow,
  summarizeLedgerAttribution,
} from '../../runtime/rollout-evidence-collector.js'
import { resolvePostLaunchTuningProfile } from '../../launch/post-launch-tuning.js'
import { getLightweightPersonalizationRuntime } from '../../launch/lightweight-personalization.js'
import { resolveEffectiveLaunchVisualRollout } from '../../launch/visual-rollout.js'
import { buildPrivateSessionRawEventId } from '../../context-memory/runtime.js'
import { PRIVATE_SESSION_TIMEOUT_MS } from '../../services/private-channel-service.js'

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

export function registerAdminRuntimeRoutes(router: IRouter): void {
  router.get('/admin/runtime/stats', requireHumanAuth, requireAdmin, async (_req, res) => {
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

  router.post('/admin/runtime/features/reset', requireHumanAuth, requireAdmin, async (_req, res) => {
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
  })

  router.get('/admin/runtime/features', requireHumanAuth, requireAdmin, async (_req, res) => {
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
            fallback_count: counters.forum_orchestration.fallback_count,
            fallback_counters: counters.forum_orchestration.fallback_counters,
            no_write_counters: counters.forum_orchestration.no_write_counters,
            selection_path_counts: counters.forum_orchestration.selection_path_counts,
            recent_fallback_samples: counters.forum_orchestration.recent_fallback_samples,
            recent_no_write_samples: counters.forum_orchestration.recent_no_write_samples,
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

  router.post(
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

  router.post(
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

  router.post(
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

  router.get(
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

  router.get('/admin/launch/programming-ops', requireHumanAuth, requireAdmin, async (_req, res) => {
    try {
      const data = await launchProgrammingOpsService.getAdminPayload()
      res.json({ data, meta: data.meta })
    } catch (err) {
      if (tryHandleAppError(res, err)) return
      throw err
    }
  })

  router.post(
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

  router.post('/admin/relations/unblock', requireHumanAuth, requireAdmin, async (req, res) => {
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
  })

  router.post('/admin/rollout/evidence-window/start', requireHumanAuth, requireAdmin, (_req, res) => {
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

  router.post(
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

  router.get('/admin/rollout/fallback-entries', requireHumanAuth, requireAdmin, async (_req, res) => {
    const allEntries = await usageLedgerRepo.listRecent(1_000)
    const fallbackEntries = collectFallbackOrDegradedEntries(allEntries)
    res.json({
      data: {
        total: fallbackEntries.length,
        entries: fallbackEntries.slice(0, 100),
      },
    })
  })
}
