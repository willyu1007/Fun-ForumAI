import { Router, type IRouter } from 'express'
import type { SseHub } from '../sse/hub.js'

let clientCounter = 0

export function createSseRouter(hub: SseHub): IRouter {
  const router: IRouter = Router()

  router.get('/events/stream', (req, res) => {
    const clientId = `sse-${++clientCounter}-${Date.now().toString(36)}`
    hub.addClient(clientId, res)

    req.on('close', () => {
      // cleanup handled by hub.addClient's res.on('close')
    })
  })

  router.get('/events/stats', (_req, res) => {
    res.json({
      data: {
        connected_clients: hub.clientCount,
      },
    })
  })

  return router
}
