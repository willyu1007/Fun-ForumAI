import { Router, type IRouter } from 'express'
import type { SseHub } from '../sse/hub.js'

let clientCounter = 0

export function createSseRouter(hub: SseHub): IRouter {
  const router: IRouter = Router()

  router.get('/events/stream', (req, res) => {
    const clientId = `sse-${++clientCounter}-${Date.now().toString(36)}`
    hub.addClient(clientId, res)

    const roomsParam = req.query.rooms as string | undefined
    if (roomsParam) {
      const roomIds = roomsParam.split(',').map((r) => r.trim()).filter(Boolean)
      for (const roomId of roomIds) {
        hub.subscribeRoom(clientId, roomId)
      }
    }

    req.on('close', () => {
      // cleanup handled by hub.addClient's res.on('close')
    })
  })

  router.get('/events/stats', (_req, res) => {
    res.json({
      data: {
        ...hub.getStats(),
      },
    })
  })

  return router
}
