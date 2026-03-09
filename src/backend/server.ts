import { app, initPersistence } from './app.js'
import { config } from './lib/config.js'
import { getRuntimeBuildInfo } from './lib/runtime-build-info.js'
import { disconnectPrisma } from './persistence/prisma-client.js'
import {
  runtimeLoop,
  roomLifecycle,
  conversationClock,
  privateChannelScheduler,
  pprRefreshScheduler,
  cultureDigestScheduler,
  communityConfigScheduler,
  roleAssignmentExpiryScheduler,
  closeRuntimeInfrastructure,
} from './container.js'

async function main() {
  await initPersistence()

  if (config.features.runtimeFeaturesV1) {
    console.log('[RuntimeFeatures] startup', JSON.stringify({
      build: getRuntimeBuildInfo(),
      flags: config.features,
      runtime: {
        queue_backend: config.runtime.queueBackend,
        leader_backend: config.runtime.leaderBackend,
        llm_provider: config.llm.provider,
        llm_model: config.llm.model,
      },
    }))
  }

  const server = app.listen(config.port, () => {
    console.log(`[backend] Server running on http://localhost:${config.port}`)
    console.log(`[backend] Environment: ${config.nodeEnv}`)
  })

  function shutdown() {
    console.log('[backend] Shutting down gracefully...')
    runtimeLoop.stop()
    roomLifecycle.stop()
    conversationClock.stop()
    privateChannelScheduler?.stop()
    pprRefreshScheduler?.stop()
    cultureDigestScheduler?.stop()
    communityConfigScheduler?.stop()
    roleAssignmentExpiryScheduler?.stop()

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
