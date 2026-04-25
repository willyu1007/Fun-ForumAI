/**
 * T-209 cue-data-and-board — admin Cue Board routes.
 *
 * Mounts:
 *   GET  /v1/admin/programming/cue-board                — read-only timeline
 *   POST /v1/admin/programming/cue-board/baseline-import — opt-in baseline
 *                                                          import (closes the
 *                                                          deferred-Q gap from
 *                                                          T-209 00-overview;
 *                                                          dev/admin-only)
 *
 * Auth: requireHumanAuth + requireAdmin (matches existing admin routes).
 *
 * Read-only board in this bundle. T-210 introduces the corresponding edit /
 * mutation endpoints on top of the same service surface.
 */

import type { IRouter, Response } from 'express'
import { z, ZodError } from 'zod'
import { cueBoardReadService, cueRepo } from '../../container.js'
import { BaselineCueImporter } from '../../programming/cue/baseline-cue-importer.js'
import { AppError } from '../../lib/errors.js'
import { requireAdmin, requireHumanAuth } from '../../middleware/human-auth.js'

const isoDateString = z
  .string()
  .min(1)
  .refine((s) => !Number.isNaN(Date.parse(s)), {
    message: 'must be a valid ISO 8601 datetime string',
  })

const querySchema = z
  .object({
    schedule_id: z.string().min(1).optional(),
    community_id: z.string().min(1).optional(),
    from: isoDateString.optional(),
    to: isoDateString.optional(),
    limit: z.coerce.number().int().min(1).max(500).optional(),
  })
  .strict()

function sendValidationError(res: Response, err: ZodError, fallback: 'query' | 'data' = 'query') {
  res.status(400).json({
    error: {
      code: 'VALIDATION_ERROR',
      message: err.issues
        .map((i) => `${i.path.join('.') || fallback}: ${i.message}`)
        .join('; '),
      details: err.issues,
    },
  })
}

/**
 * If a downstream Zod parse fails (typically because a JSON column was
 * authored with stale schema), surface it as 422 — admins get a clear
 * "data integrity" signal instead of an opaque 500.
 */
function handleAggregateError(res: Response, err: unknown): boolean {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details !== undefined ? { details: err.details } : {}),
      },
    })
    return true
  }
  if (err instanceof ZodError) {
    res.status(422).json({
      error: {
        code: 'CUE_DATA_INTEGRITY_ERROR',
        message: err.issues
          .map((i) => `${i.path.join('.') || 'cue'}: ${i.message}`)
          .join('; '),
        details: err.issues,
      },
    })
    return true
  }
  return false
}

export function registerAdminCueBoardRoutes(router: IRouter): void {
  router.get(
    '/admin/programming/cue-board',
    requireHumanAuth,
    requireAdmin,
    async (req, res) => {
      const parsed = querySchema.safeParse(req.query)
      if (!parsed.success) {
        sendValidationError(res, parsed.error, 'query')
        return
      }
      const q = parsed.data
      try {
        const data = await cueBoardReadService.getBoardPayload({
          schedule_id: q.schedule_id,
          community_id: q.community_id,
          from: q.from ? new Date(q.from) : undefined,
          to: q.to ? new Date(q.to) : undefined,
          limit: q.limit,
        })
        res.json({ data })
      } catch (err) {
        if (handleAggregateError(res, err)) return
        throw err
      }
    },
  )

  router.post(
    '/admin/programming/cue-board/baseline-import',
    requireHumanAuth,
    requireAdmin,
    async (_req, res) => {
      try {
        const importer = new BaselineCueImporter({ repo: cueRepo })
        const result = await importer.run()
        res.json({
          data: {
            schedule_id: result.schedule.id,
            schedule_status: result.schedule.status,
            schedule_source: result.schedule.source,
            baseline_contract_version: result.schedule.baseline_contract_version,
            cue_count: result.cues.length,
            is_new: result.is_new,
          },
        })
      } catch (err) {
        if (handleAggregateError(res, err)) return
        throw err
      }
    },
  )
}
