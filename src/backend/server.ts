import { app, initPersistence } from './app.js'
import { config } from './lib/config.js'
import { disconnectPrisma } from './persistence/prisma-client.js'

async function main() {
  await initPersistence()

  const server = app.listen(config.port, () => {
    console.log(`[backend] Server running on http://localhost:${config.port}`)
    console.log(`[backend] Environment: ${config.nodeEnv}`)
  })

  function shutdown() {
    console.log('[backend] Shutting down gracefully...')
    server.close(() => {
      disconnectPrisma().then(() => {
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
