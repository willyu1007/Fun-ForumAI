/**
 * T-210 M1 — admin Cue Editor mutation routes.
 *
 * Mounts admin-side mutation endpoints for the public discussion cue editor:
 *   POST   /v1/admin/programming/cues
 *   PATCH  /v1/admin/programming/cues/:id
 *   POST   /v1/admin/programming/cues/:id/cancel
 *   POST   /v1/admin/programming/cues/:id/force-skip
 *   POST   /v1/admin/programming/cues/:id/publish
 *   POST   /v1/admin/programming/cues/:id/media
 *   DELETE /v1/admin/programming/cues/:id/media/:mediaId
 *   POST   /v1/admin/programming/schedule/:id/rollback
 *
 * Each route mounts: requireHumanAuth -> requireAdmin ->
 * requireProgrammingPermission(<perm>) per cue-editor-admin/02-architecture.md
 * §3.3 mapping. Service layer (CueEditorService) owns validation +
 * change-row recording.
 */

import type { IRouter, Request, Response, NextFunction } from 'express'
import { z, ZodError } from 'zod'
import { AppError, UnauthorizedError } from '../../lib/errors.js'
import { CueEditorService } from '../../services/cue-editor-service.js'
import { MediaPickerService } from '../../services/media-picker-service.js'
import { CuePreviewService } from '../../services/cue-preview-service.js'
import { loadSignalServiceStub } from '../../services/__stubs__/load-signal-service-stub.js'
import { directorCueBriefStub } from '../../services/__stubs__/director-cue-brief-stub.js'
import {
  cueRepo as containerCueRepo,
  mediaAssetRepo as containerMediaAssetRepo,
} from '../../container.js'
import type { CueRepository } from '../../repos/cue-repository.js'
import { requireAdmin, requireHumanAuth } from '../../middleware/human-auth.js'
import { requireProgrammingPermission } from '../../middleware/require-programming-permission.js'
import { PROGRAMMING_PERMISSIONS } from '../../programming/cue/permissions.js'

const SCOPE_SCHEMA = z
  .object({
    mode: z.enum(['single', 'community_family', 'runtime_select']),
    community_id: z.string().min(1).optional(),
    community_family_id: z.string().min(1).optional(),
  })
  .strict()

const CREATE_BODY = z
  .object({
    schedule_id: z.string().min(1),
    scope: SCOPE_SCHEMA,
    patch: z.unknown(),
  })
  .strict()

const PATCH_BODY = z.object({ patch: z.unknown() }).strict()

const CANCEL_BODY = z
  .object({
    reason: z.string().min(1).max(500).optional(),
  })
  .strict()
  .optional()

const ATTACH_MEDIA_BODY = z
  .object({
    asset_id: z.string().min(1),
    semantic_snapshot_id: z.string().min(1).nullish(),
    role: z.enum([
      'context_anchor',
      'mood_reference',
      'evidence_card',
      'visual_seed',
      'cover_candidate',
      'continuity_anchor',
    ]),
    usage_strength: z.enum(['optional', 'preferred']).optional(),
    use_policy: z
      .enum([
        'runtime_only',
        'prefer_runtime_context',
        'prefer_public_display',
        'allow_generated_derivative',
      ])
      .optional(),
    selection_note: z.string().max(2000).nullish(),
    sort_order: z.number().int().min(0).optional(),
    reuse_limit: z.number().int().min(0).nullish(),
    validation_status: z.enum(['valid', 'invalid', 'blocked', 'degraded']).optional(),
    validation_reason: z.string().max(2000).nullish(),
  })
  .strict()

const ROLLBACK_BODY = z
  .object({
    summary: z.string().min(1).max(500).optional(),
  })
  .strict()
  .optional()

function getActor(req: Request) {
  if (!req.user) throw new UnauthorizedError('Not authenticated')
  return { userId: req.user.userId, role: req.user.role }
}

function sendValidationError(res: Response, err: ZodError) {
  res.status(400).json({
    error: {
      code: 'VALIDATION_ERROR',
      message: err.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; '),
      details: err.issues,
    },
  })
}

function handleAppError(err: unknown, res: Response, next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details !== undefined ? { details: err.details } : {}),
      },
    })
    return
  }
  next(err)
}

export function registerAdminCueRoutes(
  router: IRouter,
  options?: {
    service?: CueEditorService
    mediaPicker?: MediaPickerService
    previewService?: CuePreviewService
    /**
     * Cue repository used by the read-only GET endpoints (`/cues/:id` and
     * `/audit`). When omitted, falls back to the container singleton. Tests
     * pass an in-memory instance shared with the editor service so the read
     * endpoints observe the same state.
     */
    cueRepo?: CueRepository
  },
): void {
  const cueRepo = options?.cueRepo ?? containerCueRepo
  const mediaAssetRepo = containerMediaAssetRepo
  const cueEditorService = options?.service ?? new CueEditorService({ repo: cueRepo })
  const mediaPickerService =
    options?.mediaPicker ?? new MediaPickerService({ mediaAssetRepo })
  const cuePreviewService =
    options?.previewService ??
    new CuePreviewService({
      repo: cueRepo,
      mediaAssetRepo,
      loadSignalService: loadSignalServiceStub,
      directorCueBrief: directorCueBriefStub,
    })
  // POST /v1/admin/programming/cues — create draft cue
  router.post(
    '/admin/programming/cues',
    requireHumanAuth,
    requireAdmin,
    requireProgrammingPermission(PROGRAMMING_PERMISSIONS.edit_programming_draft),
    async (req, res, next) => {
      const parsed = CREATE_BODY.safeParse(req.body)
      if (!parsed.success) return sendValidationError(res, parsed.error)
      try {
        const result = await cueEditorService.createCueDraft(
          {
            scheduleId: parsed.data.schedule_id,
            scope: parsed.data.scope as Parameters<typeof cueEditorService.createCueDraft>[0]['scope'],
            patch: parsed.data.patch as never,
          },
          getActor(req),
        )
        res.status(201).json({ data: { cue: result.cue, change: result.change } })
      } catch (err) {
        return handleAppError(err, res, next)
      }
    },
  )

  // GET /v1/admin/programming/cues/:id — full cue detail for editor
  router.get(
    '/admin/programming/cues/:id',
    requireHumanAuth,
    requireAdmin,
    requireProgrammingPermission(PROGRAMMING_PERMISSIONS.view_programming),
    async (req, res, next) => {
      try {
        const cue = await cueRepo.findCueById(req.params.id)
        if (!cue) {
          res.status(404).json({
            error: { code: 'NOT_FOUND', message: `Cue ${req.params.id} not found` },
          })
          return
        }
        const [media, changes] = await Promise.all([
          cueRepo.listMediaForCue(cue.id),
          cueRepo.listChangesForCue(cue.id),
        ])
        res.json({ data: { cue, media, recent_changes: changes.slice(0, 20) } })
      } catch (err) {
        return handleAppError(err, res, next)
      }
    },
  )

  // PATCH /v1/admin/programming/cues/:id — apply CuePatchV1 to existing cue
  router.patch(
    '/admin/programming/cues/:id',
    requireHumanAuth,
    requireAdmin,
    requireProgrammingPermission(PROGRAMMING_PERMISSIONS.edit_programming_draft),
    async (req, res, next) => {
      const parsed = PATCH_BODY.safeParse(req.body)
      if (!parsed.success) return sendValidationError(res, parsed.error)
      try {
        const result = await cueEditorService.updateCue(
          req.params.id,
          parsed.data.patch,
          getActor(req),
        )
        res.json({ data: { cue: result.cue, change: result.change } })
      } catch (err) {
        return handleAppError(err, res, next)
      }
    },
  )

  // POST /v1/admin/programming/cues/:id/cancel
  router.post(
    '/admin/programming/cues/:id/cancel',
    requireHumanAuth,
    requireAdmin,
    requireProgrammingPermission(PROGRAMMING_PERMISSIONS.cancel_scheduled_cue),
    async (req, res, next) => {
      const parsed = CANCEL_BODY.safeParse(req.body ?? {})
      if (!parsed.success) return sendValidationError(res, parsed.error)
      try {
        const result = await cueEditorService.cancelCue(
          req.params.id,
          getActor(req),
          parsed.data?.reason,
        )
        res.json({ data: { cue: result.cue, change: result.change } })
      } catch (err) {
        return handleAppError(err, res, next)
      }
    },
  )

  // POST /v1/admin/programming/cues/:id/force-skip
  router.post(
    '/admin/programming/cues/:id/force-skip',
    requireHumanAuth,
    requireAdmin,
    requireProgrammingPermission(PROGRAMMING_PERMISSIONS.force_skip_due_cue),
    async (req, res, next) => {
      const parsed = CANCEL_BODY.safeParse(req.body ?? {})
      if (!parsed.success) return sendValidationError(res, parsed.error)
      try {
        const result = await cueEditorService.forceSkipCue(
          req.params.id,
          getActor(req),
          parsed.data?.reason,
        )
        res.json({ data: { cue: result.cue, change: result.change } })
      } catch (err) {
        return handleAppError(err, res, next)
      }
    },
  )

  // POST /v1/admin/programming/cues/:id/preview — pre-publish 5-stage chain
  router.post(
    '/admin/programming/cues/:id/preview',
    requireHumanAuth,
    requireAdmin,
    requireProgrammingPermission(PROGRAMMING_PERMISSIONS.edit_programming_draft),
    async (req, res, next) => {
      const PREVIEW_BODY = z.object({ patch: z.unknown() }).strict()
      const parsed = PREVIEW_BODY.safeParse(req.body)
      if (!parsed.success) return sendValidationError(res, parsed.error)
      try {
        const result = await cuePreviewService.preview({
          cueId: req.params.id,
          rawPatch: parsed.data.patch,
        })
        res.json({ data: result })
      } catch (err) {
        return handleAppError(err, res, next)
      }
    },
  )

  // POST /v1/admin/programming/cues/:id/publish
  router.post(
    '/admin/programming/cues/:id/publish',
    requireHumanAuth,
    requireAdmin,
    requireProgrammingPermission(PROGRAMMING_PERMISSIONS.publish_programming_schedule),
    async (req, res, next) => {
      try {
        const result = await cueEditorService.publishCue(req.params.id, getActor(req))
        res.json({ data: { cue: result.cue, change: result.change } })
      } catch (err) {
        return handleAppError(err, res, next)
      }
    },
  )

  // POST /v1/admin/programming/cues/:id/media — attach media
  router.post(
    '/admin/programming/cues/:id/media',
    requireHumanAuth,
    requireAdmin,
    requireProgrammingPermission(PROGRAMMING_PERMISSIONS.manage_programming_media),
    async (req, res, next) => {
      const parsed = ATTACH_MEDIA_BODY.safeParse(req.body)
      if (!parsed.success) return sendValidationError(res, parsed.error)
      try {
        const result = await cueEditorService.attachCueMedia(
          req.params.id,
          parsed.data,
          getActor(req),
        )
        res.status(201).json({ data: { media_id: result.media_id, change: result.change } })
      } catch (err) {
        return handleAppError(err, res, next)
      }
    },
  )

  // DELETE /v1/admin/programming/cues/:id/media/:mediaId
  router.delete(
    '/admin/programming/cues/:id/media/:mediaId',
    requireHumanAuth,
    requireAdmin,
    requireProgrammingPermission(PROGRAMMING_PERMISSIONS.manage_programming_media),
    async (req, res, next) => {
      try {
        const result = await cueEditorService.removeCueMedia(
          req.params.id,
          req.params.mediaId,
          getActor(req),
        )
        res.json({ data: { removed: result.removed, change: result.change } })
      } catch (err) {
        return handleAppError(err, res, next)
      }
    },
  )

  // GET /v1/admin/programming/media-picker — server-side filtered media list
  router.get(
    '/admin/programming/media-picker',
    requireHumanAuth,
    requireAdmin,
    requireProgrammingPermission(PROGRAMMING_PERMISSIONS.manage_programming_media),
    async (req, res, next) => {
      const PICKER_QUERY = z
        .object({
          community_id: z.string().min(1).optional(),
          limit: z.coerce.number().int().min(1).max(100).optional(),
          cursor: z.string().min(1).optional(),
        })
        .strict()
      const parsed = PICKER_QUERY.safeParse(req.query)
      if (!parsed.success) return sendValidationError(res, parsed.error)
      try {
        const result = await mediaPickerService.list({
          communityId: parsed.data.community_id,
          limit: parsed.data.limit,
          cursor: parsed.data.cursor,
        })
        res.json({ data: result })
      } catch (err) {
        return handleAppError(err, res, next)
      }
    },
  )

  // GET /v1/admin/programming/audit — list CueChange rows by filter
  router.get(
    '/admin/programming/audit',
    requireHumanAuth,
    requireAdmin,
    requireProgrammingPermission(PROGRAMMING_PERMISSIONS.inspect_programming_audit),
    async (req, res, next) => {
      const AUDIT_QUERY = z
        .object({
          cue_id: z.string().min(1).optional(),
          schedule_id: z.string().min(1).optional(),
          actor_user_id: z.string().min(1).optional(),
          limit: z.coerce.number().int().min(1).max(200).optional(),
        })
        .strict()
        .refine((v) => v.cue_id || v.schedule_id, {
          message: 'cue_id or schedule_id is required',
        })
      const parsed = AUDIT_QUERY.safeParse(req.query)
      if (!parsed.success) return sendValidationError(res, parsed.error)
      try {
        const limit = parsed.data.limit ?? 50
        let changes = parsed.data.cue_id
          ? await cueRepo.listChangesForCue(parsed.data.cue_id)
          : await cueRepo.listChangesForSchedule(parsed.data.schedule_id!)
        if (parsed.data.actor_user_id) {
          changes = changes.filter((c) => c.actor_user_id === parsed.data.actor_user_id)
        }
        res.json({ data: { items: changes.slice(0, limit), total: changes.length } })
      } catch (err) {
        return handleAppError(err, res, next)
      }
    },
  )

  // POST /v1/admin/programming/schedule/:id/rollback
  router.post(
    '/admin/programming/schedule/:id/rollback',
    requireHumanAuth,
    requireAdmin,
    requireProgrammingPermission(PROGRAMMING_PERMISSIONS.rollback_programming_schedule),
    async (req, res, next) => {
      const parsed = ROLLBACK_BODY.safeParse(req.body ?? {})
      if (!parsed.success) return sendValidationError(res, parsed.error)
      try {
        const result = await cueEditorService.rollbackSchedule(
          req.params.id,
          getActor(req),
          parsed.data?.summary,
        )
        res.status(201).json({ data: { schedule: result.schedule, change: result.change } })
      } catch (err) {
        return handleAppError(err, res, next)
      }
    },
  )
}
