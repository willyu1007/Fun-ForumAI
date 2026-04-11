import type { IRouter, Response } from 'express'
import {
  reviewService,
  riskGovernanceRepo,
  feedbackService,
  inviteCodeService,
  adminUserAccessService,
} from '../../container.js'
import { requireAdmin, requireHumanAuth } from '../../middleware/human-auth.js'
import { AppError, ValidationError } from '../../lib/errors.js'
import { validate } from '../../validation/validate.js'
import {
  adminUserIdParamSchema,
  feedbackCategorySchema,
  feedbackStatusSchema,
  grantAdminAccessSchema,
  patchAdminFeedbackSchema,
} from '../../validation/schemas.js'

function tryHandleAppError(res: Response, err: unknown): boolean {
  if (!(err instanceof AppError)) return false
  res.status(err.statusCode).json({
    error: {
      code: err.code,
      message: err.message,
      ...(err.details !== undefined ? { details: err.details } : {}),
    },
  })
  return true
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

export function registerAdminReviewRoutes(router: IRouter): void {
  router.get('/admin/moderation/queue', requireHumanAuth, requireAdmin, async (req, res) => {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined
    const case_type = typeof req.query.case_type === 'string' ? req.query.case_type : undefined
    const queue = typeof req.query.queue === 'string' ? req.query.queue : undefined
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined
    const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : undefined
    const result = await reviewService.listQueue({ status, case_type, queue, cursor, limit })
    res.json({ data: result.items, meta: { cursor: result.next_cursor } })
  })

  router.get(
    '/admin/moderation/cases/:caseId',
    requireHumanAuth,
    requireAdmin,
    async (req, res) => {
      const detail = await reviewService.getCaseDetail(String(req.params.caseId))
      if (!detail) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Case not found' } })
        return
      }
      res.json({ data: detail })
    },
  )

  router.get(
    '/admin/moderation/cases/:caseId/evidence-export',
    requireHumanAuth,
    requireAdmin,
    async (req, res) => {
      const redaction =
        typeof req.query.redaction === 'string' ? req.query.redaction.trim() : undefined
      if (redaction && redaction !== 'operator' && redaction !== 'share') {
        res
          .status(400)
          .json({
            error: { code: 'VALIDATION_ERROR', message: 'redaction must be operator or share' },
          })
        return
      }
      const exportBundle = await reviewService.buildEvidenceExport(String(req.params.caseId), {
        redaction,
      })
      if (!exportBundle) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Case not found' } })
        return
      }
      res.json({ data: exportBundle })
    },
  )

  router.post(
    '/admin/moderation/cases/:caseId/assign',
    requireHumanAuth,
    requireAdmin,
    async (req, res) => {
      const assignee_user_id =
        typeof req.body?.assignee_user_id === 'string' ? req.body.assignee_user_id : null
      const updated = await reviewService.assignCase(
        String(req.params.caseId),
        assignee_user_id,
        req.user!.userId,
      )
      if (!updated) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Case not found' } })
        return
      }
      res.json({ data: updated })
    },
  )

  router.post(
    '/admin/moderation/cases/:caseId/transfer',
    requireHumanAuth,
    requireAdmin,
    async (req, res) => {
      const assignee_user_id =
        typeof req.body?.assignee_user_id === 'string' ? req.body.assignee_user_id.trim() : ''
      const assigned_role =
        typeof req.body?.assigned_role === 'string' ? req.body.assigned_role.trim() : undefined
      const operator_note =
        typeof req.body?.operator_note === 'string' ? req.body.operator_note.trim() : undefined
      if (!assignee_user_id) {
        res
          .status(400)
          .json({ error: { code: 'VALIDATION_ERROR', message: 'assignee_user_id is required' } })
        return
      }
      const updated = await reviewService.transferCase(
        String(req.params.caseId),
        assignee_user_id,
        req.user!.userId,
        {
          assigned_role,
          operator_note,
        },
      )
      if (!updated) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Case not found' } })
        return
      }
      res.json({ data: updated })
    },
  )

  router.post(
    '/admin/moderation/cases/:caseId/release',
    requireHumanAuth,
    requireAdmin,
    async (req, res) => {
      const operator_note =
        typeof req.body?.operator_note === 'string' ? req.body.operator_note.trim() : undefined
      const released = await reviewService.releaseCase(String(req.params.caseId), req.user!.userId, {
        operator_note,
      })
      if (!released) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Case not found' } })
        return
      }
      res.json({ data: released })
    },
  )

  router.post(
    '/admin/moderation/cases/:caseId/resolve',
    requireHumanAuth,
    requireAdmin,
    async (req, res) => {
      const resolution_action =
        typeof req.body?.resolution_action === 'string' ? req.body.resolution_action.trim() : ''
      const resolution_note =
        typeof req.body?.resolution_note === 'string' ? req.body.resolution_note.trim() : null
      if (!resolution_action) {
        res
          .status(400)
          .json({ error: { code: 'VALIDATION_ERROR', message: 'resolution_action is required' } })
        return
      }
      const updated = await reviewService.resolveCase(
        String(req.params.caseId),
        resolution_action,
        req.user!.userId,
        resolution_note,
      )
      if (!updated) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Case not found' } })
        return
      }
      res.json({ data: updated })
    },
  )

  router.post(
    '/admin/moderation/tasks/:taskId/claim',
    requireHumanAuth,
    requireAdmin,
    async (req, res) => {
      const assigned_role =
        typeof req.body?.assigned_role === 'string' ? req.body.assigned_role.trim() : undefined
      const operator_note =
        typeof req.body?.operator_note === 'string' ? req.body.operator_note.trim() : undefined
      const result = await reviewService.claimTask(String(req.params.taskId), req.user!.userId, {
        assigned_role,
        operator_note,
      })
      if (!result) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Task not found' } })
        return
      }
      res.json({ data: result })
    },
  )

  router.post(
    '/admin/moderation/cases/:caseId/reopen',
    requireHumanAuth,
    requireAdmin,
    async (req, res) => {
      const opened_reason =
        typeof req.body?.opened_reason === 'string' ? req.body.opened_reason.trim() : 'manual_reopen'
      const updated = await reviewService.reopenCase(
        String(req.params.caseId),
        opened_reason,
        req.user!.userId,
      )
      if (!updated) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Case not found' } })
        return
      }
      res.json({ data: updated })
    },
  )

  router.get('/admin/feedback', requireHumanAuth, requireAdmin, async (req, res) => {
    try {
      const status = parseFeedbackStatusQuery(req.query.status)
      const category = parseFeedbackCategoryQuery(req.query.category)
      const source_route = typeof req.query.source_route === 'string'
        ? req.query.source_route
        : undefined
      const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined
      const limitRaw = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 20
      const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : 20
      const result = await feedbackService.listForAdmin({
        status,
        category,
        source_route,
        cursor,
        limit,
      })
      res.json({ data: result.items, meta: { cursor: result.next_cursor } })
    } catch (err) {
      if (tryHandleAppError(res, err)) return
      throw err
    }
  })

  router.get('/admin/feedback/:feedbackId', requireHumanAuth, requireAdmin, async (req, res) => {
    try {
      const detail = await feedbackService.getDetailForAdmin(String(req.params.feedbackId))
      res.json({ data: detail })
    } catch (err) {
      if (tryHandleAppError(res, err)) return
      throw err
    }
  })

  router.get('/admin/invite-codes', requireHumanAuth, requireAdmin, async (_req, res) => {
    if (!inviteCodeService) {
      res.status(503).json({ error: { code: 'SERVICE_UNAVAILABLE', message: '邀请码服务不可用' } })
      return
    }

    try {
      const inviteCodes = await inviteCodeService.listForAdmin()
      res.json({ data: inviteCodes })
    } catch (err) {
      if (tryHandleAppError(res, err)) return
      throw err
    }
  })

  router.get('/admin/admin-users', requireHumanAuth, requireAdmin, async (_req, res) => {
    if (!adminUserAccessService) {
      res.status(503).json({ error: { code: 'SERVICE_UNAVAILABLE', message: '管理员服务不可用' } })
      return
    }

    try {
      const admins = await adminUserAccessService.listAdmins()
      res.json({ data: admins })
    } catch (err) {
      if (tryHandleAppError(res, err)) return
      throw err
    }
  })

  router.post(
    '/admin/admin-users/grant',
    requireHumanAuth,
    requireAdmin,
    validate(grantAdminAccessSchema),
    async (req, res) => {
      if (!adminUserAccessService) {
        res.status(503).json({ error: { code: 'SERVICE_UNAVAILABLE', message: '管理员服务不可用' } })
        return
      }

      try {
        const admin = await adminUserAccessService.grantAdmin({
          userId: req.body.userId,
          email: req.body.email,
          phone: req.body.phone,
        })
        res.json({ data: admin })
      } catch (err) {
        if (tryHandleAppError(res, err)) return
        throw err
      }
    },
  )

  router.post(
    '/admin/admin-users/:userId/revoke',
    requireHumanAuth,
    requireAdmin,
    validate(adminUserIdParamSchema, 'params'),
    async (req, res) => {
      if (!adminUserAccessService) {
        res.status(503).json({ error: { code: 'SERVICE_UNAVAILABLE', message: '管理员服务不可用' } })
        return
      }

      try {
        const admin = await adminUserAccessService.revokeAdmin({
          targetUserId: String(req.params.userId),
          actorUserId: req.user!.userId,
        })
        res.json({ data: admin })
      } catch (err) {
        if (tryHandleAppError(res, err)) return
        throw err
      }
    },
  )

  router.patch(
    '/admin/feedback/:feedbackId',
    requireHumanAuth,
    requireAdmin,
    validate(patchAdminFeedbackSchema),
    async (req, res) => {
      try {
        const detail = await feedbackService.updateByAdmin({
          id: String(req.params.feedbackId),
          actor_user_id: req.user!.userId,
          status: req.body.status,
          public_resolution_note: req.body.public_resolution_note,
          internal_note: req.body.internal_note,
        })
        res.json({ data: detail })
      } catch (err) {
        if (tryHandleAppError(res, err)) return
        throw err
      }
    },
  )

  router.get('/admin/identity-reviews', requireHumanAuth, requireAdmin, async (req, res) => {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined
    const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 50
    const result = await riskGovernanceRepo.listIdentityVerifications({
      status,
      cursor,
      limit: Math.min(limit, 100),
    })
    res.json({ data: result.items, meta: { cursor: result.next_cursor } })
  })

  router.post(
    '/admin/identity-reviews/:userId',
    requireHumanAuth,
    requireAdmin,
    async (req, res) => {
      const status = typeof req.body?.status === 'string' ? req.body.status : ''
      const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined
      if (
        status !== 'VERIFIED' &&
        status !== 'REJECTED' &&
        status !== 'EXPIRED' &&
        status !== 'PENDING'
      ) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'status must be PENDING, VERIFIED, REJECTED, or EXPIRED',
          },
        })
        return
      }

      const reviewRecord = await riskGovernanceRepo.upsertIdentityVerification({
        user_id: String(req.params.userId),
        status,
        reviewed_by_user_id: req.user!.userId,
        reason,
        reviewed_at: new Date(),
      })
      const identityCase = await reviewService.openIdentityReviewCase({
        user_id: String(req.params.userId),
        opened_by: req.user!.userId,
        summary_text: `Manual identity review resolved as ${status}`,
        evidence: {
          status,
          reason: reason ?? null,
          reviewed_by_user_id: req.user!.userId,
        },
      })
      await reviewService.resolveCase(
        identityCase.id,
        `identity_${status.toLowerCase()}`,
        req.user!.userId,
      )
      res.json({ data: reviewRecord })
    },
  )
}
