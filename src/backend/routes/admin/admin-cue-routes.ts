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
import { AutoPatchApplyService } from '../../services/auto-patch-apply-service.js'
import { MediaPickerService } from '../../services/media-picker-service.js'
import { CuePreviewService } from '../../services/cue-preview-service.js'
import type { CuePublicProjectionService } from '../../services/cue-public-projection-service.js'
import { DirectorCueBriefServiceImpl } from '../../programming/cue/director-cue-brief.js'
import {
  cueRepo as containerCueRepo,
  eventRepo as containerEventRepo,
  forumEventDispatcher as containerForumEventDispatcher,
  loadSignalService as containerLoadSignalService,
  mediaAssetRepo as containerMediaAssetRepo,
  cuePublicProjectionService as containerCuePublicProjectionService,
  mediaPlanResolutionRepo as containerMediaPlanResolutionRepo,
} from '../../container.js'
import type { MediaPlanResolutionRepository } from '../../repos/media-plan-resolution-repository.js'
import type { CueRepository } from '../../repos/cue-repository.js'
import { requireAdmin, requireHumanAuth } from '../../middleware/human-auth.js'
import { requireProgrammingPermission } from '../../middleware/require-programming-permission.js'
import { PROGRAMMING_PERMISSIONS } from '../../programming/cue/permissions.js'
import { ScheduleRollbackHandler } from '../../programming/cue/schedule-rollback-handler.js'

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

function routeParam(req: Request, name: string): string {
  const value = req.params[name]
  return Array.isArray(value) ? value[0] ?? '' : value ?? ''
}

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
    // T-216: route validation accepts all four strength values. Runtime
    // policy enforcement for strict strengths lives in CueMediaPlanner.
    usage_strength: z
      .enum(['optional', 'preferred', 'anchor', 'selected_only_pool'])
      .optional(),
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
    /**
     * T-214 A-M3 follow-on — apply service that closes the inbox loop.
     * Tests pass an injected instance so the auto-patch routes can be
     * exercised in-process. When omitted, we construct one from the
     * cue repo + editor service available locally.
     */
    autoPatchApplyService?: AutoPatchApplyService
    /**
     * T-215 B-M3 closer — admin preview of the public cue projection.
     * Falls back to the container singleton when omitted.
     */
    cuePublicProjectionService?: CuePublicProjectionService
    /**
     * T-216 M3 closer — audit dashboard for media plan resolutions.
     */
    mediaPlanResolutionRepo?: MediaPlanResolutionRepository
  },
): void {
  const cueRepo = options?.cueRepo ?? containerCueRepo
  const mediaAssetRepo = containerMediaAssetRepo
  // T-212 fix: production wiring threads the rollback handler so
  // `rollbackSchedule` cascades cue cancellations + emits per-cue Cancelled
  // events through the same dispatcher the worker uses. Tests that supply
  // their own `options.service` keep the historical behavior.
  const scheduleRollbackHandler =
    options?.service != null
      ? undefined
      : new ScheduleRollbackHandler({
          cueRepo,
          eventRepo: containerEventRepo,
          eventDispatcher: containerForumEventDispatcher,
        })
  const cueEditorService =
    options?.service ??
    new CueEditorService({
      repo: cueRepo,
      ...(scheduleRollbackHandler ? { scheduleRollbackHandler } : {}),
    })
  const mediaPickerService =
    options?.mediaPicker ?? new MediaPickerService({ mediaAssetRepo })
  const cuePreviewService =
    options?.previewService ??
    new CuePreviewService({
      repo: cueRepo,
      mediaAssetRepo,
      // T-213 M2: cached `LoadSignalService` (~30s TTL) replaces the stub.
      // Admission path keeps reading the live `AdmissionLoadService`.
      loadSignalService: containerLoadSignalService,
      directorCueBrief: new DirectorCueBriefServiceImpl(),
    })
  const autoPatchApplyService =
    options?.autoPatchApplyService
    ?? new AutoPatchApplyService({
      cueRepo,
      cueEditorService,
    })
  const cuePublicProjectionService =
    options?.cuePublicProjectionService ?? containerCuePublicProjectionService
  const mediaPlanResolutionRepo =
    options?.mediaPlanResolutionRepo ?? containerMediaPlanResolutionRepo
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
        const cueId = routeParam(req, 'id')
        const cue = await cueRepo.findCueById(cueId)
        if (!cue) {
          res.status(404).json({
            error: { code: 'NOT_FOUND', message: `Cue ${cueId} not found` },
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
        const cueId = routeParam(req, 'id')
        const result = await cueEditorService.updateCue(
          cueId,
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
        const cueId = routeParam(req, 'id')
        const result = await cueEditorService.cancelCue(
          cueId,
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
        const cueId = routeParam(req, 'id')
        const result = await cueEditorService.forceSkipCue(
          cueId,
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
        const cueId = routeParam(req, 'id')
        const result = await cuePreviewService.preview({
          cueId,
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
        const cueId = routeParam(req, 'id')
        const result = await cueEditorService.publishCue(cueId, getActor(req))
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
        const cueId = routeParam(req, 'id')
        const result = await cueEditorService.attachCueMedia(
          cueId,
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
        const cueId = routeParam(req, 'id')
        const mediaId = routeParam(req, 'mediaId')
        const result = await cueEditorService.removeCueMedia(
          cueId,
          mediaId,
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
        const scheduleId = routeParam(req, 'id')
        const result = await cueEditorService.rollbackSchedule(
          scheduleId,
          getActor(req),
          parsed.data?.summary,
        )
        res.status(201).json({ data: { schedule: result.schedule, change: result.change } })
      } catch (err) {
        return handleAppError(err, res, next)
      }
    },
  )

  // ---------------------------------------------------------------------------
  // T-215 B-M3 — admin preview of the public cue projection facet
  // ---------------------------------------------------------------------------
  //
  // Surfaces the same `CueProjectionFacet` the home tonight + community
  // pages would render, so admins can verify the public view (including
  // sanitization). Read-only; gated by `inspect_programming_audit` per
  // umbrella decision Q5.

  router.get(
    '/admin/programming/cue-projection',
    requireHumanAuth,
    requireAdmin,
    requireProgrammingPermission(PROGRAMMING_PERMISSIONS.inspect_programming_audit),
    async (req, res, next) => {
      const QUERY = z
        .object({
          community_id: z.string().min(1).optional(),
          lookahead_minutes: z.coerce.number().int().min(1).max(48 * 60).optional(),
          completed_window_minutes: z.coerce.number().int().min(1).max(72 * 60).optional(),
          upcoming_limit: z.coerce.number().int().min(1).max(100).optional(),
          completed_limit: z.coerce.number().int().min(1).max(100).optional(),
        })
        .strict()
      const parsed = QUERY.safeParse(req.query)
      if (!parsed.success) return sendValidationError(res, parsed.error)
      try {
        const facet = await cuePublicProjectionService.assemble({
          ...(parsed.data.community_id ? { communityId: parsed.data.community_id } : {}),
          ...(parsed.data.lookahead_minutes
            ? { lookaheadMs: parsed.data.lookahead_minutes * 60_000 }
            : {}),
          ...(parsed.data.completed_window_minutes
            ? { completedWindowMs: parsed.data.completed_window_minutes * 60_000 }
            : {}),
          ...(parsed.data.upcoming_limit
            ? { upcomingLimit: parsed.data.upcoming_limit }
            : {}),
          ...(parsed.data.completed_limit
            ? { completedLimit: parsed.data.completed_limit }
            : {}),
        })
        res.json({ data: facet })
      } catch (err) {
        return handleAppError(err, res, next)
      }
    },
  )

  // ---------------------------------------------------------------------------
  // T-216 M3 closer — media plan resolution audit dashboard
  // ---------------------------------------------------------------------------
  //
  // Read-only listing of `MediaPlanResolution` rows for a given cue
  // attempt. Admin uses this to inspect what the planner actually
  // decided per pool item: which strength was requested, what outcome
  // landed (`runtime_context` / `public_display` / `derivative_source` /
  // `degraded` / etc.), and any reason marker. Gated by
  // `inspect_programming_audit` (umbrella §5).
  //
  // For cue-id queries, the route pivots through
  // `cueRepo.listAttemptsForCue(cueId)` and returns rows for the
  // latest attempt; admins seeking a specific attempt pass attempt_id
  // directly.

  router.get(
    '/admin/programming/media-plan-resolutions',
    requireHumanAuth,
    requireAdmin,
    requireProgrammingPermission(PROGRAMMING_PERMISSIONS.inspect_programming_audit),
    async (req, res, next) => {
      const QUERY = z
        .object({
          attempt_id: z.string().min(1).optional(),
          cue_id: z.string().min(1).optional(),
          limit: z.coerce.number().int().min(1).max(200).optional(),
        })
        .strict()
        .refine((v) => Boolean(v.attempt_id || v.cue_id), {
          message: 'attempt_id or cue_id is required',
        })
      const parsed = QUERY.safeParse(req.query)
      if (!parsed.success) return sendValidationError(res, parsed.error)
      try {
        let attemptId = parsed.data.attempt_id
        if (!attemptId && parsed.data.cue_id) {
          const attempts = await cueRepo.listAttemptsForCue(parsed.data.cue_id)
          attempts.sort((a, b) => {
            const aT = a.scheduled_trigger_at?.getTime() ?? 0
            const bT = b.scheduled_trigger_at?.getTime() ?? 0
            return bT - aT
          })
          attemptId = attempts[0]?.id
        }
        if (!attemptId) {
          res.json({ data: { items: [], total: 0, attempt_id: null } })
          return
        }
        const rows = await mediaPlanResolutionRepo.findByAttempt(attemptId)
        const limited = rows.slice(0, parsed.data.limit ?? 100)
        res.json({
          data: {
            items: limited,
            total: rows.length,
            attempt_id: attemptId,
          },
        })
      } catch (err) {
        return handleAppError(err, res, next)
      }
    },
  )

  // ---------------------------------------------------------------------------
  // T-214 A-M3 — auto-patch inbox
  // ---------------------------------------------------------------------------
  //
  // Backed by `PublicDiscussionCueChange` rows with `source='automated'`. The
  // detector + LLM pipeline lands every patch with `approval_status='pending'`;
  // admin approves or rejects via these endpoints. Approve flips the row to
  // `approved` and stamps `applied_at`; reject flips to `rejected` and records
  // the supplied reason. A separate downstream worker (deferred to T-214 A-M3
  // follow-on) consumes approved rows and applies the patch via the existing
  // `CueEditorService` mutation paths — keeping the inbox routes pure
  // approval-state mutators.

  // GET /v1/admin/programming/auto-patches — list pending auto-editor patches
  router.get(
    '/admin/programming/auto-patches',
    requireHumanAuth,
    requireAdmin,
    requireProgrammingPermission(PROGRAMMING_PERMISSIONS.approve_auto_patch),
    async (req, res, next) => {
      const LIST_QUERY = z
        .object({
          approval_status: z
            .enum(['pending', 'auto_applied', 'approved', 'rejected', 'rolled_back'])
            .optional(),
          limit: z.coerce.number().int().min(1).max(200).optional(),
        })
        .strict()
      const parsed = LIST_QUERY.safeParse(req.query)
      if (!parsed.success) return sendValidationError(res, parsed.error)
      try {
        const items = await cueRepo.listAutomatedChangesByApprovalStatus({
          approval_status: parsed.data.approval_status ?? 'pending',
          limit: parsed.data.limit ?? 50,
        })
        res.json({ data: { items, total: items.length } })
      } catch (err) {
        return handleAppError(err, res, next)
      }
    },
  )

  // GET /v1/admin/programming/auto-patches/:id — full patch detail
  router.get(
    '/admin/programming/auto-patches/:id',
    requireHumanAuth,
    requireAdmin,
    requireProgrammingPermission(PROGRAMMING_PERMISSIONS.approve_auto_patch),
    async (req, res, next) => {
      try {
        const changeId = routeParam(req, 'id')
        const change = await cueRepo.findChangeById(changeId)
        if (!change) {
          res.status(404).json({
            error: {
              code: 'NOT_FOUND',
              message: `auto-patch ${changeId} not found`,
            },
          })
          return
        }
        if (change.source !== 'automated') {
          res.status(404).json({
            error: {
              code: 'NOT_FOUND',
              message: `auto-patch ${changeId} not found`,
            },
          })
          return
        }
        res.json({ data: { change } })
      } catch (err) {
        return handleAppError(err, res, next)
      }
    },
  )

  // POST /v1/admin/programming/auto-patches/:id/approve
  // T-214 A-M3 follow-on: approve closes the loop. We dispatch the
  // patch through `AutoPatchApplyService` and:
  //   - On `applied`: original row flips to `auto_applied` (the apply
  //     service stamps applied_at / actor / reason='auto_apply_to:<id>')
  //     and a follow-up manual CueChange row records the actual
  //     mutation. 200 OK with both rows.
  //   - On `unsupported`: change_type isn't auto-applicable; we mark
  //     `approval_status='approved'` (manual decision recorded), but no
  //     apply happens — admin must manually edit via Cue Board. 200 OK
  //     with a `apply_outcome: 'unsupported'` flag in the response so
  //     the frontend can surface the gap.
  //   - On `failed`: the patch can't be applied (locked field, target
  //     missing, conflict, etc.). Original row stays at `pending` so the
  //     admin can decide to reject or wait. 422 with the failure reason.
  router.post(
    '/admin/programming/auto-patches/:id/approve',
    requireHumanAuth,
    requireAdmin,
    requireProgrammingPermission(PROGRAMMING_PERMISSIONS.approve_auto_patch),
    async (req, res, next) => {
      const APPROVE_BODY = z
        .object({ reason: z.string().min(1).max(500).optional() })
        .strict()
        .optional()
      const parsed = APPROVE_BODY.safeParse(req.body ?? {})
      if (!parsed.success) return sendValidationError(res, parsed.error)
      try {
        const actor = getActor(req)
        const changeId = routeParam(req, 'id')
        const existing = await cueRepo.findChangeById(changeId)
        if (!existing || existing.source !== 'automated') {
          res.status(404).json({
            error: { code: 'NOT_FOUND', message: `auto-patch ${changeId} not found` },
          })
          return
        }
        if (existing.approval_status !== 'pending') {
          res.status(409).json({
            error: {
              code: 'INVALID_STATE',
              message: `auto-patch is already ${existing.approval_status}`,
            },
          })
          return
        }

        const outcome = await autoPatchApplyService.apply({
          change: existing,
          actor: { userId: actor.userId, role: actor.role },
        })

        if (outcome.kind === 'failed') {
          res.status(422).json({
            error: {
              code: 'APPLY_FAILED',
              message: outcome.error,
            },
          })
          return
        }

        if (outcome.kind === 'unsupported') {
          // Mark approved so the admin's intent is recorded; surface the
          // gap so the UI can prompt for a manual edit.
          const approvedRow = await cueRepo.updateChangeApproval({
            id: changeId,
            approval_status: 'approved',
            applied_at: new Date(),
            actor_user_id: actor.userId,
            ...(parsed.data?.reason !== undefined ? { reason: parsed.data.reason } : {}),
          })
          if (!approvedRow) {
            res.status(404).json({
              error: { code: 'NOT_FOUND', message: `auto-patch ${changeId} not found` },
            })
            return
          }
          res.status(200).json({
            data: {
              change: approvedRow,
              apply_outcome: 'unsupported',
              apply_unsupported_reason: outcome.reason,
            },
          })
          return
        }

        // Applied successfully — the apply service flipped the original
        // automated row to `auto_applied` (single-row audit). The
        // `cue` is present for cue-mutating change types
        // (update/cancel/defer); media-only types (attach/remove)
        // omit it.
        res.status(200).json({
          data: {
            change: outcome.change,
            apply_outcome: 'applied',
            ...(outcome.cue ? { cue: outcome.cue } : {}),
          },
        })
      } catch (err) {
        return handleAppError(err, res, next)
      }
    },
  )

  // POST /v1/admin/programming/auto-patches/:id/reject
  router.post(
    '/admin/programming/auto-patches/:id/reject',
    requireHumanAuth,
    requireAdmin,
    requireProgrammingPermission(PROGRAMMING_PERMISSIONS.approve_auto_patch),
    async (req, res, next) => {
      const REJECT_BODY = z
        .object({ reason: z.string().min(1).max(500) })
        .strict()
      const parsed = REJECT_BODY.safeParse(req.body ?? {})
      if (!parsed.success) return sendValidationError(res, parsed.error)
      try {
        const actor = getActor(req)
        const changeId = routeParam(req, 'id')
        const existing = await cueRepo.findChangeById(changeId)
        if (!existing || existing.source !== 'automated') {
          res.status(404).json({
            error: { code: 'NOT_FOUND', message: `auto-patch ${changeId} not found` },
          })
          return
        }
        if (existing.approval_status !== 'pending') {
          res.status(409).json({
            error: {
              code: 'INVALID_STATE',
              message: `auto-patch is already ${existing.approval_status}`,
            },
          })
          return
        }
        const updated = await cueRepo.updateChangeApproval({
          id: changeId,
          approval_status: 'rejected',
          applied_at: null,
          actor_user_id: actor.userId,
          reason: parsed.data.reason,
        })
        if (!updated) {
          res.status(404).json({
            error: { code: 'NOT_FOUND', message: `auto-patch ${changeId} not found` },
          })
          return
        }
        res.status(200).json({ data: { change: updated } })
      } catch (err) {
        return handleAppError(err, res, next)
      }
    },
  )
}
