import type { IRouter, Response } from 'express'
import { warmupClosureVerifierService, warmupGovernanceService } from '../../container.js'
import { AppError } from '../../lib/errors.js'
import { requireAdmin, requireHumanAuth } from '../../middleware/human-auth.js'
import {
  runWarmupVerifierSchema,
  startWarmupRunSchema,
  warmupRunIdParamSchema,
  warmupVerifierRunIdParamSchema,
} from '../../validation/schemas.js'
import { validate } from '../../validation/validate.js'

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

export function registerAdminKickoffRoutes(router: IRouter): void {
  router.get('/admin/kickoff', requireHumanAuth, requireAdmin, async (_req, res) => {
    try {
      const data = await warmupGovernanceService.getKickoffStatus()
      res.json({ data })
    } catch (err) {
      if (tryHandleAppError(res, err)) return
      throw err
    }
  })

  router.get('/admin/warmup/runs', requireHumanAuth, requireAdmin, async (_req, res) => {
    try {
      const data = await warmupGovernanceService.listWarmupRuns()
      res.json({ data })
    } catch (err) {
      if (tryHandleAppError(res, err)) return
      throw err
    }
  })

  router.post(
    '/admin/warmup/runs',
    requireHumanAuth,
    requireAdmin,
    validate(startWarmupRunSchema),
    async (req, res) => {
      try {
        const data = await warmupGovernanceService.startWarmupRun({
          actor_user_id: req.user!.userId,
          target_posts: req.body.target_posts,
          max_attempts: req.body.max_attempts,
        })
        res.status(201).json({ data })
      } catch (err) {
        if (tryHandleAppError(res, err)) return
        throw err
      }
    },
  )

  router.get(
    '/admin/warmup/runs/:id',
    requireHumanAuth,
    requireAdmin,
    validate(warmupRunIdParamSchema, 'params'),
    async (req, res) => {
      try {
        const data = await warmupGovernanceService.getWarmupRun(String(req.params.id))
        res.json({ data })
      } catch (err) {
        if (tryHandleAppError(res, err)) return
        throw err
      }
    },
  )

  router.post(
    '/admin/warmup/runs/:id/rollback',
    requireHumanAuth,
    requireAdmin,
    validate(warmupRunIdParamSchema, 'params'),
    async (req, res) => {
      try {
        const data = await warmupGovernanceService.rollbackWarmupRun({
          run_id: String(req.params.id),
          actor_user_id: req.user!.userId,
        })
        res.json({ data })
      } catch (err) {
        if (tryHandleAppError(res, err)) return
        throw err
      }
    },
  )

  router.post(
    '/admin/warmup/verifier/runs',
    requireHumanAuth,
    requireAdmin,
    validate(runWarmupVerifierSchema),
    async (req, res) => {
      try {
        const data = await warmupClosureVerifierService.run({
          triggered_by_user_id: req.user!.userId,
        })
        res.status(201).json({ data })
      } catch (err) {
        if (tryHandleAppError(res, err)) return
        throw err
      }
    },
  )

  router.get(
    '/admin/warmup/verifier/runs/latest',
    requireHumanAuth,
    requireAdmin,
    async (_req, res) => {
      try {
        const data = await warmupClosureVerifierService.getLatestRun()
        if (!data) {
          res.status(404).json({
            error: {
              code: 'NOT_FOUND',
              message: 'No warm-up verifier run found',
            },
          })
          return
        }
        res.json({ data })
      } catch (err) {
        if (tryHandleAppError(res, err)) return
        throw err
      }
    },
  )

  router.get(
    '/admin/warmup/verifier/runs/:id',
    requireHumanAuth,
    requireAdmin,
    validate(warmupVerifierRunIdParamSchema, 'params'),
    async (req, res) => {
      try {
        const data = await warmupClosureVerifierService.getRun(String(req.params.id))
        if (!data) {
          res.status(404).json({
            error: {
              code: 'NOT_FOUND',
              message: 'Warm-up verifier run not found',
            },
          })
          return
        }
        res.json({ data })
      } catch (err) {
        if (tryHandleAppError(res, err)) return
        throw err
      }
    },
  )
}
