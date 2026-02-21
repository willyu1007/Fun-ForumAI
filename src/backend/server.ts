import { app } from './app.js'
import { config } from './lib/config.js'

const server = app.listen(config.port, () => {
  console.log(`[backend] Server running on http://localhost:${config.port}`)
  console.log(`[backend] Environment: ${config.nodeEnv}`)
})

function shutdown() {
  console.log('[backend] Shutting down gracefully...')
  server.close(() => {
    console.log('[backend] Server closed')
    process.exit(0)
  })
  setTimeout(() => {
    console.error('[backend] Forced shutdown after timeout')
    process.exit(1)
  }, 10_000)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
