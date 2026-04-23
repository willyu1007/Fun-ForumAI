import express, { type Express } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import cookieParser from 'cookie-parser'
import { config } from './lib/config.js'
import { apiRouter } from './routes/index.js'
import { createHealthRouter } from './routes/health.js'
import { errorHandler } from './middleware/error-handler.js'
import { requestLogger } from './middleware/request-logger.js'
import {
  runtimeLoop,
  llmGateway,
  eventQueue,
  postScheduler,
  sseHub,
  warmPersistenceState,
  roomLifecycle,
  conversationClock,
  authService,
  privateChannelScheduler,
  nurtureScheduler,
  relationScheduler,
  achievementsScheduler,
  pprRefreshScheduler,
  cultureDigestScheduler,
  homeProgrammingSnapshotScheduler,
  communityConfigScheduler,
  agentBioRefreshScheduler,
  agentBiographyCompileScheduler,
  roleAssignmentExpiryScheduler,
  directorHistoryMaintenanceScheduler,
  guidanceRecallScheduler,
  mediaGenerationWorker,
  mediaImportJobWorker,
  mediaLifecycleWorker,
  promptOrchestrator,
  agentService,
  promptEngine,
  agentCommunityMembershipService,
  searchProjectionService,
  healthService,
} from './container.js'
import { createSseRouter } from './routes/sse.js'
import { chatApiRouter } from './routes/chat-api.js'
import { agentNurtureRouter } from './routes/agent-growth-api.js'
import { agentDashboardRouter } from './routes/agent-dashboard-api.js'
import { createAuthRouter } from './routes/auth-api.js'
import {
  createDevToken,
  registerDevTokenSync,
  tryAuthenticateHuman,
  type AuthenticatedUser,
} from './middleware/human-auth.js'
import { privateChannelRouter } from './routes/private-channel-api.js'
import { notificationRouter } from './routes/notification-api.js'
import { agentStatsRouter } from './routes/agent-stats-api.js'
import { createFrontendStaticRouter } from './routes/frontend-static.js'
import type { PromptBlocks } from './runtime/types.js'
import { resolveAgentIdentity } from './identity/agent-identity.js'
import { LLMGatewayContractError } from './llm/gateway-contract.js'
import { resolveCurrentVisiblePromptRef } from './llm/prompt-template-refs.js'
import type { OwnerStylePins } from './identity/agent-identity.js'

const app: Express = express()
const healthRouter = createHealthRouter(healthService)
const DEV_AUTH_COOKIE_OPTIONS = {
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000,
}
const devRouteModules = config.allowDevTools
  ? await Promise.all([
      import('./routes/dev-seed.js'),
      import('./routes/dev-kickoff.js'),
      import('./routes/dev-badge-debug.js'),
      import('./routes/dev-guidance.js'),
    ])
  : null

function isLoopbackHost(value: string | undefined): boolean {
  if (!value) return false
  try {
    const parsed = value.includes('://') ? new URL(value) : new URL(`http://${value}`)
    const hostname = parsed.hostname.toLowerCase()
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
  } catch {
    return false
  }
}

function canUseDevIdentitySwitch(req: express.Request): boolean {
  if (!config.allowDevTools) return false
  return (
    isLoopbackHost(req.hostname) ||
    isLoopbackHost(req.get('origin')) ||
    isLoopbackHost(req.get('referer'))
  )
}

function buildDevAuthProfile(user: AuthenticatedUser) {
  return {
    id: user.userId,
    email: user.email,
    phone: user.phone,
    displayName: user.role === 'admin' ? '开发管理员' : '开发用户',
    avatarUrl: null,
    birthDate: null,
    planTier: user.role === 'admin' ? 'ADMIN' : 'FREE',
    role: user.role,
  }
}

function resolveDevIdentity(identity: unknown): AuthenticatedUser | null {
  if (identity === 'user') {
    return {
      userId: 'dev-user-001',
      email: 'dev-user@llm-forum.test',
      phone: null,
      role: 'user',
      _devToken: true,
    }
  }
  if (identity === 'admin') {
    return {
      userId: 'dev-admin-001',
      email: 'dev-admin@llm-forum.test',
      phone: null,
      role: 'admin',
      _devToken: true,
    }
  }
  return null
}

function shouldCompress(req: express.Request, res: express.Response): boolean {
  if (req.path === '/v1/events/stream' || req.headers.accept?.includes('text/event-stream')) {
    return false
  }
  return compression.filter(req, res)
}

function buildDevPromptRenderDefaults(input: {
  templateId: string
  persona: {
    name: string
    style: string
    interests: string[]
    language: string
  }
  personaSeedCode: string
  blocks: PromptBlocks
}): Record<string, string> {
  const baseDefaults: Record<string, string> = {
    persona_name: input.persona.name,
    persona_style: input.persona.style,
    persona_interests: input.persona.interests.join('、'),
    persona_language: input.persona.language,
    persona_seed_code: input.personaSeedCode,
    hard_control_block: input.blocks.hard_control_block ?? '',
    compact_control_block: input.blocks.compact_control_block ?? '',
    current_context_block: input.blocks.current_context_block ?? '',
    memory_block: input.blocks.memory_block ?? '',
    soft_expression_block: input.blocks.soft_expression_block ?? '',
  }

  switch (input.templateId) {
    case 'agent-reply-to-post':
    case 'agent-create-post':
    case 'agent-reply-to-thread-turn':
    case 'agent-select-forum-arrival':
      return { ...baseDefaults, community_name: '调试社区' }
    case 'agent-plan-forum-actions':
      return {
        ...baseDefaults,
        community_name: '调试社区',
        forum_action_options_json: JSON.stringify({
          event_type: 'ThreadTurnAdded',
          action_limits: {
            max_vote_actions: 1,
            max_text_actions: 1,
            valid_shapes: [['vote'], ['add_thread_turn'], ['vote', 'add_thread_turn'], ['no_write']],
          },
          visible_targets: [
            { ref: 'event_post', allowed_actions: ['vote', 'open_thread'], label: 'post:debug' },
            { ref: 'focus_turn', allowed_actions: ['vote', 'add_thread_turn'], label: 'turn:debug' },
            { ref: 'reply_thread', allowed_actions: ['add_thread_turn'], label: 'thread:debug' },
          ],
        }, null, 2),
      }
    case 'agent-chat-reply':
      return { ...baseDefaults, room_name: '调试房间' }
    case 'agent-private-chat-reply':
      return { ...baseDefaults, owner_display_name: 'Owner' }
    case 'agent-proactive-dm-opening':
      return { ...baseDefaults, trigger_type: 'manual' }
    default:
      return baseDefaults
  }
}

app.use(helmet())
app.use(
  cors({
    origin: config.cors.origins,
    credentials: true,
  }),
)
app.use(compression({ filter: shouldCompress }))
app.use(express.json({ limit: '1mb' }))
app.use(cookieParser())
app.use(requestLogger)

app.use(healthRouter)
app.use('/v1', healthRouter)
app.use('/v1', apiRouter)
if (devRouteModules) {
  const [{ devSeedRouter }, { devKickoffRouter }, { devBadgeDebugRouter }, { devGuidanceRouter }] =
    devRouteModules
  app.use('/v1', devSeedRouter)
  app.use('/v1', devKickoffRouter)
  app.use('/v1', devBadgeDebugRouter)
  app.use('/v1', devGuidanceRouter)
}
app.use('/v1', createSseRouter(sseHub))
app.use('/v1', chatApiRouter)
app.use('/v1', agentNurtureRouter)
app.use('/v1', agentDashboardRouter)

if (config.allowDevTools) {
  const devIdentityRouter = express.Router()
  devIdentityRouter.post('/auth/dev/switch', (req, res) => {
    if (!canUseDevIdentitySwitch(req)) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } })
      return
    }

    const identity = req.body?.identity
    if (identity === 'anonymous') {
      res.clearCookie('auth_token', { path: '/' })
      res.json({ data: { user: null } })
      return
    }

    const user = resolveDevIdentity(identity)
    if (!user) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'identity must be one of anonymous, user, admin',
        },
      })
      return
    }

    res.cookie('auth_token', createDevToken(user), DEV_AUTH_COOKIE_OPTIONS)
    res.json({ data: { user: buildDevAuthProfile(user) } })
  })
  app.use('/v1', devIdentityRouter)
}

if (authService) {
  const ensuredAuthService = authService
  registerDevTokenSync(async (user) => {
    if (!user._devToken || !user.email) return
    await ensuredAuthService.ensureDevIdentity({
      userId: user.userId,
      email: user.email,
      role: user.role,
    })
  })
  app.use('/v1', createAuthRouter(ensuredAuthService))
} else if (config.allowDevTools) {
  registerDevTokenSync(null)
  // Minimal dev-only auth/me so DevAuthToolbar works without DB
  const devAuthRouter = express.Router()
  devAuthRouter.get('/auth/me', (req, res) => {
    const user = tryAuthenticateHuman(req)
    res.json({
      data: {
        user: user ? buildDevAuthProfile(user) : null,
      },
    })
  })
  devAuthRouter.post('/auth/logout', (_req, res) => {
    res.clearCookie('auth_token', { path: '/' })
    res.json({ data: { message: '已退出登录' } })
  })
  app.use('/v1', devAuthRouter)
} else {
  registerDevTokenSync(null)
}

app.use('/v1', privateChannelRouter)
app.use('/v1', notificationRouter)
app.use('/v1', agentStatsRouter)
app.use(createFrontendStaticRouter())

// ─── Dev runtime endpoints ──────────────────────────────────

if (config.allowDevTools) {
  app.post('/v1/dev/runtime/tick', async (_req, res) => {
    try {
      const result = await runtimeLoop.tick()
      res.json({ data: result })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      res.status(500).json({ error: { code: 'RUNTIME_ERROR', message } })
    }
  })

  app.get('/v1/dev/runtime/status', async (_req, res) => {
    const queueSize = await runtimeLoop.getQueueSize()
    res.json({
      data: {
        running: runtimeLoop.isRunning,
        processing: runtimeLoop.isProcessing,
        queue_size: queueSize,
        is_leader: runtimeLoop.isLeader,
        llm_configured: llmGateway.isConfigured,
        runtime_enabled: config.runtime.enabled,
        queue_backend: config.runtime.queueBackend,
        leader_backend: config.runtime.leaderBackend,
        home_programming_snapshot_scheduler_running:
          homeProgrammingSnapshotScheduler?.isRunning ?? false,
        community_config_scheduler_running: communityConfigScheduler?.isRunning ?? false,
        agent_bio_refresh_scheduler_running: agentBioRefreshScheduler?.isRunning ?? false,
        role_assignment_expiry_scheduler_running: roleAssignmentExpiryScheduler?.isRunning ?? false,
        director_history_maintenance_scheduler_running:
          directorHistoryMaintenanceScheduler?.isRunning ?? false,
        media_generation_worker_running: mediaGenerationWorker?.isRunning ?? false,
        media_import_job_worker_running: mediaImportJobWorker?.isRunning ?? false,
        media_lifecycle_worker_running: mediaLifecycleWorker?.isRunning ?? false,
      },
    })
  })

  app.post('/v1/dev/runtime/start', async (_req, res) => {
    if (!llmGateway.isConfigured) {
      res.status(400).json({
        error: {
          code: 'LLM_NOT_CONFIGURED',
          message: 'Configure at least one usable LLM credential to enable runtime',
        },
      })
      return
    }
    runtimeLoop.start()
    res.json({
      data: {
        message: 'Runtime started',
        queue_size: await eventQueue.size(),
      },
    })
  })

  app.post('/v1/dev/runtime/stop', (_req, res) => {
    runtimeLoop.stop()
    res.json({ data: { message: 'Runtime stopped' } })
  })

  app.post('/v1/dev/runtime/post', async (_req, res) => {
    if (!llmGateway.isConfigured) {
      res.status(400).json({
        error: {
          code: 'LLM_NOT_CONFIGURED',
          message: 'Configure at least one usable LLM credential to enable posting',
        },
      })
      return
    }
    try {
      const result = await postScheduler.forcePost()
      res.json({ data: result })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      res.status(500).json({ error: { code: 'POST_SCHEDULER_ERROR', message } })
    }
  })

  app.get('/v1/dev/runtime/post/stats', (_req, res) => {
    res.json({ data: postScheduler.stats })
  })

  app.post('/v1/dev/prompts/render', async (req, res) => {
    try {
      const body = req.body as {
        agent_id?: string
        template_id?: string
        scene?:
          | 'forum_post'
          | 'forum_thread'
          | 'forum_turn'
          | 'chat_room'
          | 'private_chat'
          | 'proactive_dm'
          | 'scheduled_post'
        conversation_text?: string
        topic_hints?: string[]
        room_member_last_spoke_at?: string | null
        variables?: Record<string, string>
        template_version?: number
      }

      if (body.template_version !== undefined) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message:
              'template_version is no longer accepted; dev prompt render resolves the current visible template automatically',
          },
        })
        return
      }

      if (!body.agent_id || !body.template_id || !body.scene) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'agent_id, template_id and scene are required',
          },
        })
        return
      }

      const promptRef = resolveCurrentVisiblePromptRef(body.template_id)
      if (!promptRef) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: `Unknown or archived visible template_id: ${body.template_id}`,
          },
        })
        return
      }

      if (!promptOrchestrator) {
        res.status(503).json({
          error: { code: 'SERVICE_UNAVAILABLE', message: 'PromptOrchestrator not initialized' },
        })
        return
      }

      let identityContract: {
        source: string
        persona_seed_code: string
        persona_seed_label: string
        home_voice_line_id: string
        home_voice_line_label: string
        owner_style_pins: OwnerStylePins
        visible_persona: { name: string; style: string; interests: string[]; language: string }
      }
      try {
        const agent = agentService.getAgent(body.agent_id)
        const latestConfig = agentService.getLatestConfig(body.agent_id)
        const identity = resolveAgentIdentity(agent, latestConfig)
        identityContract = {
          source: identity.source,
          persona_seed_code: identity.summary.persona_seed_code,
          persona_seed_label: identity.summary.persona_seed_label,
          home_voice_line_id: identity.summary.home_voice_line_id,
          home_voice_line_label: identity.summary.home_voice_line_label,
          owner_style_pins: identity.contract.ownerStylePins,
          visible_persona: identity.visiblePersona,
        }
      } catch {
        res.status(404).json({
          error: { code: 'NOT_FOUND', message: `Agent ${body.agent_id} not found` },
        })
        return
      }

      const composeInput = {
        agentId: body.agent_id,
        scene: body.scene,
        conversationText: body.conversation_text ?? '',
        topicHints: body.topic_hints ?? [],
        roomMemberState:
          body.room_member_last_spoke_at !== undefined
            ? {
                last_spoke_at: body.room_member_last_spoke_at
                  ? new Date(body.room_member_last_spoke_at)
                  : null,
              }
            : undefined,
      } as const

      const composed = await promptOrchestrator.compose(composeInput)
      const persona = composed.persona
      const blocks = composed.blocks
      const audit = composed.audit
      const defaults = buildDevPromptRenderDefaults({
        templateId: promptRef.id,
        persona,
        personaSeedCode: identityContract.persona_seed_code,
        blocks,
      })
      const variables = { ...defaults, ...(body.variables ?? {}) }
      const promptTemplate = promptEngine.getTemplate(promptRef)
      const messages = promptEngine.render(promptRef, variables)

      res.json({
        data: {
          blocks,
          audit,
          messages,
          prompt_template: promptTemplate
            ? {
                id: promptTemplate.prompt_template_id,
                version: promptTemplate.version,
                variables_schema: promptTemplate.variables_schema,
              }
            : {
                id: promptRef.id,
                version: promptRef.version,
                variables_schema: null,
              },
          identity_contract: identityContract!,
        },
      })
    } catch (err) {
      if (err instanceof LLMGatewayContractError) {
        res.status(400).json({
          error: {
            code: err.code,
            message: err.message,
            details: err.details ?? null,
          },
        })
        return
      }

      const message = err instanceof Error ? err.message : 'Unknown error'
      res.status(500).json({ error: { code: 'PROMPT_RENDER_FAILED', message } })
    }
  })
}

// ─── Error handling + 404 ───────────────────────────────────

app.use(errorHandler)

app.use((_req, res) => {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: 'Route not found' },
  })
})

// ─── Explicit background-service lifecycle ───────────────────

export function startBackgroundServices(): void {
  if (!config.runtime.enabled) {
    console.log('[App] RUNTIME_ENABLED=false, background services auto-start skipped')
    return
  }

  if (llmGateway.isConfigured) {
    console.log('[App] RUNTIME_ENABLED=true, starting background services...')
    runtimeLoop.start()
  } else {
    console.warn(
      '[App] RUNTIME_ENABLED=true but no usable LLM credential resolved — RuntimeLoop not started',
    )
  }

  roomLifecycle.start()
  conversationClock.start()

  if (privateChannelScheduler) {
    privateChannelScheduler.start()
  }

  if (nurtureScheduler) {
    nurtureScheduler.start()
  }

  if (relationScheduler) {
    relationScheduler.start()
  }

  if (achievementsScheduler) {
    achievementsScheduler.start()
  }

  if (pprRefreshScheduler) {
    pprRefreshScheduler.start()
  }

  if (cultureDigestScheduler) {
    cultureDigestScheduler.start()
  }

  if (homeProgrammingSnapshotScheduler) {
    homeProgrammingSnapshotScheduler.start()
  }

  if (communityConfigScheduler) {
    communityConfigScheduler.start()
  }

  if (agentBioRefreshScheduler) {
    agentBioRefreshScheduler.start()
  }

  if (agentBiographyCompileScheduler) {
    agentBiographyCompileScheduler.start()
  }

  if (config.launch.capabilities.roleAssignmentV1 && roleAssignmentExpiryScheduler) {
    roleAssignmentExpiryScheduler.start()
  }

  if (config.db.usePrisma && directorHistoryMaintenanceScheduler) {
    if (directorHistoryMaintenanceScheduler.isLaunchCatalogReady()) {
      directorHistoryMaintenanceScheduler.start()
    } else {
      console.log(
        '[App] Director history maintenance skipped: launch catalog artifact is not ready',
      )
    }
  }

  if (config.launch.capabilities.guidanceV1 && config.launch.capabilities.guidanceRecallV1 && guidanceRecallScheduler) {
    guidanceRecallScheduler.start()
  }

  if (config.launch.capabilities.mediaGenerationV1) {
    mediaGenerationWorker.start()
  }

  if (config.launch.capabilities.mediaInjectionV1) {
    mediaImportJobWorker.start()
  }

  if (config.launch.capabilities.mediaLifecycleV1) {
    mediaLifecycleWorker.start()
  }
}

export function stopBackgroundServices(): void {
  runtimeLoop.stop()
  roomLifecycle.stop()
  conversationClock.stop()
  privateChannelScheduler?.stop()
  nurtureScheduler?.stop()
  relationScheduler?.stop()
  achievementsScheduler?.stop()
  pprRefreshScheduler?.stop()
  cultureDigestScheduler?.stop()
  homeProgrammingSnapshotScheduler?.stop()
  communityConfigScheduler?.stop()
  agentBioRefreshScheduler?.stop()
  agentBiographyCompileScheduler?.stop()
  roleAssignmentExpiryScheduler?.stop()
  directorHistoryMaintenanceScheduler?.stop()
  guidanceRecallScheduler?.stop()
  mediaGenerationWorker?.stop()
  mediaImportJobWorker?.stop()
  mediaLifecycleWorker?.stop()
}

// ─── Persistence initialization ─────────────────────────────

export async function initPersistence(): Promise<void> {
  if (config.db.usePrisma) {
    await warmPersistenceState()
    console.log('[App] DB persistence enabled — persistence state warmed')

    const searchHealth = await searchProjectionService.inspectReadModelHealth()
    if (searchHealth.warnings.length > 0) {
      console.warn('[SearchReadModelHealth] warnings', JSON.stringify(searchHealth))
    } else {
      console.log('[SearchReadModelHealth] ok', JSON.stringify(searchHealth.docs))
    }
  }

  if (config.launch.capabilities.membershipsV1) {
    const summary = await agentCommunityMembershipService.runDerivedBackfill()
    console.log('[MembershipBackfill] completed', JSON.stringify(summary))
  }
}

export { app }
