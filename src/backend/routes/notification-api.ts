import { Router, type IRouter } from 'express'
import type { PrismaClient } from '@prisma/client'
import { requireHumanAuth } from '../middleware/human-auth.js'
import { NotificationService } from '../services/notification-service.js'
import { PgNotificationRepository } from '../repos/pg/pg-notification-repository.js'
import { AppError } from '../lib/errors.js'

function getPrismaOrNull(): PrismaClient | null {
  return ((globalThis as Record<string, unknown>).__forumPrisma as PrismaClient) ?? null
}

let _notificationService: NotificationService | null = null

function getNotificationService(): NotificationService | null {
  if (_notificationService) return _notificationService
  const prisma = getPrismaOrNull()
  if (!prisma) return null
  _notificationService = new NotificationService(new PgNotificationRepository(prisma))
  return _notificationService
}

export const notificationRouter: IRouter = Router()

notificationRouter.get('/me/notifications', requireHumanAuth, async (req, res) => {
  const svc = getNotificationService()
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
  const svc = getNotificationService()
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
  const svc = getNotificationService()
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
