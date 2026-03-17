import { access } from 'node:fs/promises'
import { constants } from 'node:fs'

async function loadLocalEnv(): Promise<void> {
  try {
    await access('.env.local', constants.F_OK)
  } catch {
    return
  }

  try {
    const { config: dotenvConfig } = await import('dotenv')
    dotenvConfig({ path: '.env.local' })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn(`[backend] Skipping .env.local load: ${message}`)
  }
}

async function main() {
  await loadLocalEnv()

  const [
    { app, initPersistence, startBackgroundServices, stopBackgroundServices },
    { config },
    { getRuntimeBuildInfo },
    { disconnectPrisma },
    { closeRuntimeInfrastructure },
  ] = await Promise.all([
    import('./app.js'),
    import('./lib/config.js'),
    import('./lib/runtime-build-info.js'),
    import('./persistence/prisma-client.js'),
    import('./container.js'),
  ])

  await initPersistence()
  startBackgroundServices()

  if (config.features.runtimeFeaturesV1) {
    console.log('[RuntimeFeatures] startup', JSON.stringify({
      build: getRuntimeBuildInfo(),
      flags: config.features,
      runtime: {
        queue_backend: config.runtime.queueBackend,
        leader_backend: config.runtime.leaderBackend,
        bootstrap_llm_provider: config.llm.provider,
        bootstrap_llm_model: config.llm.model,
      },
    }))
  }

  const server = app.listen(config.port, () => {
    console.log(`[backend] Server running on http://localhost:${config.port}`)
    console.log(`[backend] Environment: ${config.nodeEnv}`)
  })

  function shutdown() {
    console.log('[backend] Shutting down gracefully...')
    stopBackgroundServices()

    server.close(() => {
      Promise.allSettled([
        closeRuntimeInfrastructure(),
        disconnectPrisma(),
      ]).then(() => {
        console.log('[backend] Server closed')
        process.exit(0)
      })
    })
    setTimeout(() => {
      console.error('[backend] Forced shutdown after timeout')
      process.exit(1)
    }, 10_000)
  }

  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}

main().catch((err) => {
  console.error('[backend] Failed to start:', err)
  process.exit(1)
})
