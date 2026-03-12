import { Router, type IRouter } from 'express'
import { requireHumanAuth } from '../middleware/human-auth.js'
import { AppError } from '../lib/errors.js'
import { notificationService } from '../container.js'

export const notificationRouter: IRouter = Router()

notificationRouter.get('/me/notifications', requireHumanAuth, async (req, res) => {
  const svc = notificationService
  if (!svc) {
    res.json({ data: { items: [], next_cursor: null, unread_count: 0 } })
    return
  }

  try {
    const limit = Math.min(parseInt(String(req.query.limit ?? '20'), 10), 50)
    const cursor = req.query.cursor as string | undefined
    const read = req.query.read === 'true' ? true
      : req.query.read === 'false' ? false
      : undefined

    const result = await svc.list(req.user!.userId, { limit, cursor, read })
    res.json({ data: result })
  } catch (err) {
    handleError(res, err)
  }
})

notificationRouter.post('/me/notifications/:id/read', requireHumanAuth, async (req, res) => {
  const svc = notificationService
  if (!svc) {
    res.status(503).json({ error: { code: 'DB_UNAVAILABLE', message: 'Database not available' } })
    return
  }

  try {
    const notification = await svc.markRead(String(req.params.id), req.user!.userId)
    if (!notification) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Notification not found' } })
      return
    }
    res.json({ data: notification })
  } catch (err) {
    handleError(res, err)
  }
})

notificationRouter.post('/me/notifications/read-all', requireHumanAuth, async (req, res) => {
  const svc = notificationService
  if (!svc) {
    res.status(503).json({ error: { code: 'DB_UNAVAILABLE', message: 'Database not available' } })
    return
  }

  try {
    const count = await svc.markAllRead(req.user!.userId)
    res.json({ data: { count } })
  } catch (err) {
    handleError(res, err)
  }
})

function handleError(res: import('express').Response, err: unknown): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: { code: err.code, message: err.message } })
  } else {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[NotificationAPI] Error:', message)
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message } })
  }
}
