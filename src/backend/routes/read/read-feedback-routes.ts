import type { IRouter } from 'express'
import multer from 'multer'
import { complaintAppealService, feedbackService } from '../../container.js'
import { ValidationError } from '../../lib/errors.js'
import { requireHumanAuth } from '../../middleware/human-auth.js'
import {
  createFeedbackSchema,
  feedbackCategorySchema,
  feedbackStatusSchema,
} from '../../validation/schemas.js'

const feedbackUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 3 },
})

function isAttachmentInput(item: unknown): item is { ref: string; type: string } {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return false
  const record = item as Record<string, unknown>
  return typeof record.ref === 'string' && typeof record.type === 'string'
}

function parseFeedbackStatusQuery(value: unknown) {
  if (typeof value !== 'string') {
    return undefined
  }
  const parsed = feedbackStatusSchema.safeParse(value)
  if (!parsed.success) {
    throw new ValidationError('invalid feedback status')
  }
  return parsed.data
}

function parseFeedbackCategoryQuery(value: unknown) {
  if (typeof value !== 'string') {
    return undefined
  }
  const parsed = feedbackCategorySchema.safeParse(value)
  if (!parsed.success) {
    throw new ValidationError('invalid feedback category')
  }
  return parsed.data
}

export function registerReadFeedbackRoutes(router: IRouter): void {
  router.post('/feedback', requireHumanAuth, async (req, res, next) => {
    feedbackUpload.fields([
      { name: 'attachments', maxCount: 3 },
      { name: 'attachments[]', maxCount: 3 },
    ])(req, res, async (err) => {
      if (err) {
        if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
          next(new ValidationError('media exceeds 10MB limit'))
          return
        }
        if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_COUNT') {
          next(new ValidationError('attachments exceed 3 file limit'))
          return
        }
        next(new ValidationError('invalid upload payload'))
        return
      }

      try {
        const parsed = createFeedbackSchema.parse(req.body)
        const filesByField = req.files && !Array.isArray(req.files) ? req.files : {}
        const files = [
          ...(filesByField.attachments ?? []),
          ...(filesByField['attachments[]'] ?? []),
        ]
        const result = await feedbackService.create({
          created_by_user_id: req.user!.userId,
          category: parsed.category,
          title: parsed.title,
          body: parsed.body,
          entry_surface: parsed.entry_surface ?? null,
          source_route: parsed.source_route ?? null,
          attachments: files.map((file) => ({
            mime_type: file.mimetype,
            bytes: file.buffer,
            original_name: file.originalname,
          })),
        })
        res.status(201).json({ data: result })
      } catch (uploadErr) {
        next(uploadErr)
      }
    })
  })

  router.get('/feedback', requireHumanAuth, async (req, res, next) => {
    try {
      const status = parseFeedbackStatusQuery(req.query.status)
      const category = parseFeedbackCategoryQuery(req.query.category)
      const source_route = typeof req.query.source_route === 'string'
        ? req.query.source_route
        : undefined
      const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined
      const limitRaw = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 20
      const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : 20
      const result = await feedbackService.listForUser(req.user!.userId, {
        status,
        category,
        source_route,
        cursor,
        limit,
      })
      res.json({ data: result.items, meta: { cursor: result.next_cursor } })
    } catch (err) {
      next(err)
    }
  })

  router.get('/feedback/attachments/:attachmentId', requireHumanAuth, async (req, res, next) => {
    try {
      const attachment = await feedbackService.getAttachmentForActor({
        attachment_id: String(req.params.attachmentId),
        actor_user_id: req.user!.userId,
        actor_role: req.user!.role,
      })
      res.setHeader('Content-Type', attachment.attachment.mime_type)
      res.setHeader('Content-Length', String(attachment.data.byteLength))
      res.setHeader('Cache-Control', 'private, max-age=3600')
      res.send(attachment.data)
    } catch (err) {
      next(err)
    }
  })

  router.get('/feedback/:feedbackId', requireHumanAuth, async (req, res, next) => {
    try {
      const detail = await feedbackService.getDetailForUser(
        req.user!.userId,
        String(req.params.feedbackId),
      )
      res.json({ data: detail })
    } catch (err) {
      next(err)
    }
  })

  router.post('/reports', requireHumanAuth, async (req, res) => {
    const target_type = typeof req.body?.target_type === 'string' ? req.body.target_type.trim() : ''
    const target_id = typeof req.body?.target_id === 'string' ? req.body.target_id.trim() : ''
    const complaint_type =
      typeof req.body?.complaint_type === 'string' ? req.body.complaint_type.trim() : undefined
    const reason_code =
      typeof req.body?.reason_code === 'string' ? req.body.reason_code.trim() : undefined
    const detail_text = typeof req.body?.detail_text === 'string' ? req.body.detail_text : undefined
    const rawAttachments = Array.isArray(req.body?.attachments)
      ? (req.body.attachments as unknown[])
      : null
    const attachments = rawAttachments
      ? rawAttachments
          .filter(isAttachmentInput)
          .map((item) => ({ ref: item.ref.trim(), type: item.type.trim() }))
          .filter((item) => item.ref.length > 0 && item.type.length > 0)
      : undefined

    if (!target_type || !target_id) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'target_type and target_id are required' },
      })
      return
    }

    const result = await complaintAppealService.createComplaint({
      reporter_user_id: req.user!.userId,
      target_type,
      target_id,
      complaint_type,
      reason_code,
      detail_text,
      attachments,
    })
    res.status(201).json({ data: result })
  })

  router.get('/reports', requireHumanAuth, async (req, res) => {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined
    const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : undefined
    const result = await complaintAppealService.listReportsForUser({
      reporter_user_id: req.user!.userId,
      status,
      cursor,
      limit,
    })
    res.json({ data: result.items, meta: { cursor: result.next_cursor } })
  })

  router.post('/appeals', requireHumanAuth, async (req, res) => {
    const target_type = typeof req.body?.target_type === 'string' ? req.body.target_type.trim() : ''
    const target_id = typeof req.body?.target_id === 'string' ? req.body.target_id.trim() : ''
    const appeal_type =
      typeof req.body?.appeal_type === 'string' ? req.body.appeal_type.trim() : undefined
    const requester_type =
      typeof req.body?.requester_type === 'string' ? req.body.requester_type.trim() : undefined
    const linked_complaint_ticket_id =
      typeof req.body?.linked_complaint_ticket_id === 'string'
        ? req.body.linked_complaint_ticket_id.trim()
        : undefined
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : ''

    if (!target_type || !target_id || !reason) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'target_type, target_id and reason are required',
        },
      })
      return
    }

    const result = await complaintAppealService.createAppeal({
      requester_user_id: req.user!.userId,
      requester_type,
      target_type,
      target_id,
      appeal_type,
      reason,
      linked_complaint_ticket_id,
    })
    res.status(201).json({ data: result })
  })

  router.get('/appeals', requireHumanAuth, async (req, res) => {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined
    const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : undefined
    const result = await complaintAppealService.listAppealsForUser({
      requester_user_id: req.user!.userId,
      status,
      cursor,
      limit,
    })
    res.json({ data: result.items, meta: { cursor: result.next_cursor } })
  })
}
