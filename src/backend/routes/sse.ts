import { Router, type IRouter } from 'express'
import * as container from '../container.js'
import { config } from '../lib/config.js'
import { resolveGuidanceActorContext, toGuidanceActorChannelKey } from '../guidance/http.js'
import { tryAuthenticateHuman } from '../middleware/human-auth.js'
import type { SseHub } from '../sse/hub.js'
import { AppError } from '../lib/errors.js'
import { getUnexpectedErrorLogMessage, getUnexpectedErrorMessage } from '../lib/public-error-message.js'

let clientCounter = 0

function parseIdsParam(value: unknown): string[] {
  if (typeof value !== 'string') return []
  return value.split(',').map((item) => item.trim()).filter(Boolean)
}

export function createSseRouter(hub: SseHub): IRouter {
  const router: IRouter = Router()

  router.get('/events/stream', async (req, res) => {
    const roomIds = parseIdsParam(req.query.rooms)
    const sessionIds = parseIdsParam(req.query.sessions)
    const subscribeGuidanceActor = config.features.guidanceV1 && roomIds.length === 0 && sessionIds.length === 0

    if (sessionIds.length > 0) {
      const user = tryAuthenticateHuman(req)
      if (!user) {
        res.status(401).json({
          error: { code: 'UNAUTHORIZED', message: 'Authentication required for session stream' },
        })
        return
      }

      const services = container.privateChannelServices
      if (!services) {
        res.status(503).json({ error: { code: 'DB_UNAVAILABLE', message: 'Database not available' } })
        return
      }

      for (const sessionId of sessionIds) {
        try {
          const session = await services.channelService.getSession(sessionId)
          if (session.human_user_id !== user.userId) {
            res.status(403).json({
              error: { code: 'FORBIDDEN', message: `No access to session ${sessionId}` },
            })
            return
          }
        } catch (err) {
          if (err instanceof AppError) {
            res.status(err.statusCode).json({ error: { code: err.code, message: err.message } })
            return
          }
          console.error('[SSE] stream setup error:', getUnexpectedErrorLogMessage(err))
          res.status(500).json({
            error: {
              code: 'INTERNAL_ERROR',
              message: getUnexpectedErrorMessage(err),
            },
          })
          return
        }
      }
    }

    const guidanceActorKey = subscribeGuidanceActor
      ? toGuidanceActorChannelKey(resolveGuidanceActorContext(req, res))
      : null
    const clientId = `sse-${++clientCounter}-${Date.now().toString(36)}`
    hub.addClient(clientId, res)
    if (guidanceActorKey) {
      hub.subscribeActor(clientId, guidanceActorKey)
    }

    for (const roomId of roomIds) {
      hub.subscribeRoom(clientId, roomId)
    }
    for (const sessionId of sessionIds) {
      hub.subscribeSession(clientId, sessionId)
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
