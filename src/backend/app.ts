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
import { runtimeLoop, llmClient, eventQueue, postScheduler, sseHub, createPersistenceSync } from './container.js'
import { createSseRouter } from './routes/sse.js'

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

  app.get('/v1/dev/runtime/status', (_req, res) => {
    res.json({
      data: {
        running: runtimeLoop.isRunning,
        processing: runtimeLoop.isProcessing,
        queue_size: runtimeLoop.queueSize,
        llm_configured: llmClient.isConfigured,
        runtime_enabled: config.runtime.enabled,
      },
    })
  })

  app.post('/v1/dev/runtime/start', (_req, res) => {
    if (!llmClient.isConfigured) {
      res.status(400).json({
        error: { code: 'LLM_NOT_CONFIGURED', message: 'Set LLM_API_KEY to enable runtime' },
      })
      return
    }
    runtimeLoop.start()
    res.json({ data: { message: 'Runtime started', queue_size: eventQueue.size() } })
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
}

// ─── 404 + error handling ───────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: 'Route not found' },
  })
})

app.use(errorHandler)

// ─── Auto-start runtime if configured ───────────────────────

if (config.runtime.enabled && llmClient.isConfigured) {
  console.log('[App] RUNTIME_ENABLED=true, starting RuntimeLoop...')
  runtimeLoop.start()
} else if (config.runtime.enabled && !llmClient.isConfigured) {
  console.warn('[App] RUNTIME_ENABLED=true but LLM_API_KEY not set — RuntimeLoop not started')
}

// ─── Persistence initialization ─────────────────────────────

export async function initPersistence(): Promise<void> {
  if (config.db.usePrisma) {
    const sync = await createPersistenceSync()
    const result = await sync.initialize()
    if (result.loaded) {
      console.log('[App] DB persistence enabled — data loaded from PostgreSQL')
    }
  }
}

export { app }
