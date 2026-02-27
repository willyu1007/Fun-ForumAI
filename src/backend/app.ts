import express, { type Express } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import cookieParser from 'cookie-parser'
import { config } from './lib/config.js'
import { apiRouter } from './routes/index.js'
import { healthRouter } from './routes/health.js'
import { errorHandler } from './middleware/error-handler.js'
import { requestLogger } from './middleware/request-logger.js'
import { devSeedRouter } from './routes/dev-seed.js'
import { runtimeLoop, llmClient, eventQueue, postScheduler, sseHub, hydrateRepositories, roomLifecycle, conversationClock, authService, privateChannelScheduler, nurtureScheduler, relationScheduler, promptLayerService, agentService, promptEngine } from './container.js'
import { createSseRouter } from './routes/sse.js'
import { chatApiRouter } from './routes/chat-api.js'
import { agentGrowthRouter } from './routes/agent-growth-api.js'
import { agentDashboardRouter } from './routes/agent-dashboard-api.js'
import { createAuthRouter } from './routes/auth-api.js'
import { requireHumanAuth } from './middleware/human-auth.js'
import { privateChannelRouter } from './routes/private-channel-api.js'
import { notificationRouter } from './routes/notification-api.js'

const app: Express = express()

app.use(helmet())
app.use(
  cors({
    origin: config.cors.origins,
    credentials: true,
  }),
)
app.use(compression())
app.use(express.json({ limit: '1mb' }))
app.use(cookieParser())
app.use(requestLogger)

app.use('/health', healthRouter)
app.use('/v1', apiRouter)
app.use('/v1', devSeedRouter)
app.use('/v1', createSseRouter(sseHub))
app.use('/v1', chatApiRouter)
app.use('/v1', agentGrowthRouter)
app.use('/v1', agentDashboardRouter)

if (authService) {
  app.use('/v1', createAuthRouter(authService))
} else if (config.nodeEnv !== 'production') {
  // Minimal dev-only auth/me so DevAuthToolbar works without DB
  const devAuthRouter = express.Router()
  devAuthRouter.get('/auth/me', requireHumanAuth, (req, res) => {
    res.json({
      data: {
        user: {
          id: req.user!.userId,
          email: req.user!.email,
          displayName: req.user!.role === 'admin' ? '开发管理员' : '开发用户',
          avatarUrl: null,
          planTier: req.user!.role === 'admin' ? 'ADMIN' : 'FREE',
          role: req.user!.role,
        },
      },
    })
  })
  devAuthRouter.post('/auth/logout', (_req, res) => {
    res.clearCookie('auth_token', { path: '/' })
    res.json({ data: { message: '已退出登录' } })
  })
  app.use('/v1', devAuthRouter)
}

app.use('/v1', privateChannelRouter)
app.use('/v1', notificationRouter)

// ─── Dev runtime endpoints ──────────────────────────────────

if (config.nodeEnv !== 'production') {
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
        llm_configured: llmClient.isConfigured,
        runtime_enabled: config.runtime.enabled,
        queue_backend: config.runtime.queueBackend,
        leader_backend: config.runtime.leaderBackend,
      },
    })
  })

  app.post('/v1/dev/runtime/start', async (_req, res) => {
    if (!llmClient.isConfigured) {
      res.status(400).json({
        error: { code: 'LLM_NOT_CONFIGURED', message: 'Set LLM_API_KEY to enable runtime' },
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
    if (!llmClient.isConfigured) {
      res.status(400).json({
        error: { code: 'LLM_NOT_CONFIGURED', message: 'Set LLM_API_KEY to enable posting' },
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
        scene?: 'forum_post' | 'forum_comment' | 'chat_room'
        conversation_text?: string
        topic_hints?: string[]
        room_member_last_spoke_at?: string | null
        variables?: Record<string, string>
      }

      if (!body.agent_id || !body.template_id || !body.scene) {
        res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'agent_id, template_id and scene are required' },
        })
        return
      }

      if (!promptLayerService) {
        res.status(503).json({
          error: { code: 'SERVICE_UNAVAILABLE', message: 'PromptLayerService not initialized' },
        })
        return
      }

      let agentDisplayName: string
      try {
        agentDisplayName = agentService.getAgent(body.agent_id).display_name
      } catch {
        res.status(404).json({
          error: { code: 'NOT_FOUND', message: `Agent ${body.agent_id} not found` },
        })
        return
      }

      const persona = promptLayerService.getPersona(body.agent_id)
      const layers = await promptLayerService.composeLayers({
        agentId: body.agent_id,
        scene: body.scene,
        conversationText: body.conversation_text ?? '',
        topicHints: body.topic_hints ?? [],
        roomMemberState: body.room_member_last_spoke_at !== undefined
          ? { last_spoke_at: body.room_member_last_spoke_at ? new Date(body.room_member_last_spoke_at) : null }
          : undefined,
      })

      const defaults: Record<string, string> = {
        persona_name: persona.name,
        persona_style: persona.style,
        persona_interests: persona.interests.join('、'),
        persona_language: persona.language,
        community_name: '调试社区',
        community_description: '',
        community_rules: '',
        post_title: '调试标题',
        post_body: body.conversation_text ?? '调试内容',
        post_author: agentDisplayName,
        existing_comments: '',
        thread_context: '',
        target_comment_author: '调试对象',
        target_comment_body: body.conversation_text ?? '调试评论',
        room_name: '调试房间',
        room_description: '',
        recent_messages: body.conversation_text ?? '（无）',
        layer_growth: layers.layer1_growth ?? '',
        layer_style: layers.layer2_style ?? '',
        layer_instructions: layers.layer3_instructions ?? '',
        layer_overrides: layers.layer4_overrides ?? '',
        layer_memory: layers.layer5_memory ?? '',
        layer_privacy: layers.layer6_privacy ?? '',
      }

      const variables = { ...defaults, ...(body.variables ?? {}) }
      const messages = promptEngine.render(body.template_id, variables)

      res.json({
        data: {
          layers,
          messages,
        },
      })
    } catch (err) {
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

// ─── Auto-start runtime if configured ───────────────────────

if (config.runtime.enabled && llmClient.isConfigured) {
  console.log('[App] RUNTIME_ENABLED=true, starting RuntimeLoop...')
  runtimeLoop.start()
} else if (config.runtime.enabled && !llmClient.isConfigured) {
  console.warn('[App] RUNTIME_ENABLED=true but LLM_API_KEY not set — RuntimeLoop not started')
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

// ─── Persistence initialization ─────────────────────────────

export async function initPersistence(): Promise<void> {
  if (config.db.usePrisma) {
    await hydrateRepositories()
    console.log('[App] DB persistence enabled — Pg repositories hydrated')
  }
}

export { app }
