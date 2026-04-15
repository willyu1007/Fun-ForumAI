import type { IRouter, Response } from 'express'
import {
  kickoffSuiteEditService,
  warmupClosureVerifierService,
  warmupGovernanceService,
} from '../../container.js'
import { AppError } from '../../lib/errors.js'
import { requireAdmin, requireHumanAuth } from '../../middleware/human-auth.js'
import {
  archiveWarmupSuiteSchema,
  createWarmupSuiteSchema,
  executeWarmupGovernanceBatchSchema,
  previewWarmupGovernanceBatchSchema,
  rebuildWarmupSuiteSchema,
  retryWarmupSuiteSchema,
  reviewWarmupSuiteSchema,
  runWarmupVerifierSchema,
  warmupSuiteIdParamSchema,
  warmupVerifierRunIdParamSchema,
} from '../../validation/schemas.js'
import { kickoffSuiteEditSchema } from '../../validation/kickoff-schemas.js'
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

export function registerAdminWarmStartRoutes(router: IRouter): void {
  router.get('/admin/warm-start/suites', requireHumanAuth, requireAdmin, async (_req, res) => {
    const data = await warmupGovernanceService.listSuites()
    res.json({ data })
  })

  router.post(
    '/admin/warm-start/suites',
    requireHumanAuth,
    requireAdmin,
    validate(createWarmupSuiteSchema),
    async (req, res) => {
      try {
        const data = await warmupGovernanceService.createLaunchSuite({
          suite_label: req.body.suite_label ?? null,
          max_runtime_topup_posts: req.body.max_runtime_topup_posts ?? 0,
          created_by_user_id: req.user!.userId,
        })
        res.status(data.reused_existing_suite ? 200 : 201).json({ data })
      } catch (err) {
        if (tryHandleAppError(res, err)) return
        throw err
      }
    },
  )

  router.post(
    '/admin/warm-start/verifier/runs',
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
    '/admin/warm-start/verifier/runs/latest',
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
    '/admin/warm-start/verifier/runs/:id',
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

  router.get(
    '/admin/warm-start/suites/:id',
    requireHumanAuth,
    requireAdmin,
    validate(warmupSuiteIdParamSchema, 'params'),
    async (req, res) => {
      try {
        const data = await warmupGovernanceService.getSuiteDetail(String(req.params.id))
        res.json({ data })
      } catch (err) {
        if (tryHandleAppError(res, err)) return
        throw err
      }
    },
  )

  router.post(
    '/admin/warm-start/suites/:id/review',
    requireHumanAuth,
    requireAdmin,
    validate(warmupSuiteIdParamSchema, 'params'),
    validate(reviewWarmupSuiteSchema),
    async (req, res) => {
      try {
        const data = await warmupGovernanceService.reviewSuite({
          suite_id: String(req.params.id),
          reviewer_user_id: req.user!.userId,
          decision: req.body.decision,
          reason_codes: req.body.reason_codes ?? [],
          note: req.body.note ?? null,
          confirm_activation: req.body.confirm_activation ?? false,
        })
        res.json({ data })
      } catch (err) {
        if (tryHandleAppError(res, err)) return
        throw err
      }
    },
  )

  router.post(
    '/admin/warm-start/suites/:id/retry',
    requireHumanAuth,
    requireAdmin,
    validate(warmupSuiteIdParamSchema, 'params'),
    validate(retryWarmupSuiteSchema),
    async (req, res) => {
      try {
        const data = await warmupGovernanceService.retrySuite({
          suite_id: String(req.params.id),
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
    '/admin/warm-start/suites/:id/rebuild',
    requireHumanAuth,
    requireAdmin,
    validate(warmupSuiteIdParamSchema, 'params'),
    validate(rebuildWarmupSuiteSchema),
    async (req, res) => {
      try {
        const data = await warmupGovernanceService.rebuildSuite({
          suite_id: String(req.params.id),
          actor_user_id: req.user!.userId,
          max_runtime_topup_posts: req.body.max_runtime_topup_posts ?? 0,
        })
        res.json({ data })
      } catch (err) {
        if (tryHandleAppError(res, err)) return
        throw err
      }
    },
  )

  router.post(
    '/admin/warm-start/suites/:id/archive',
    requireHumanAuth,
    requireAdmin,
    validate(warmupSuiteIdParamSchema, 'params'),
    validate(archiveWarmupSuiteSchema),
    async (req, res) => {
      try {
        const data = await warmupGovernanceService.archiveSuite({
          suite_id: String(req.params.id),
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
    '/admin/governance/batches/preview',
    requireHumanAuth,
    requireAdmin,
    validate(previewWarmupGovernanceBatchSchema),
    async (req, res) => {
      try {
        const data = await warmupGovernanceService.previewGovernanceBatch(req.body)
        res.json({ data })
      } catch (err) {
        if (tryHandleAppError(res, err)) return
        throw err
      }
    },
  )

  router.post(
    '/admin/governance/batches',
    requireHumanAuth,
    requireAdmin,
    validate(executeWarmupGovernanceBatchSchema),
    async (req, res) => {
      try {
        const data = await warmupGovernanceService.executeGovernanceBatch({
          ...req.body,
          requested_by_user_id: req.user!.userId,
        })
        res.status(201).json({ data })
      } catch (err) {
        if (tryHandleAppError(res, err)) return
        throw err
      }
    },
  )

  router.get(
    '/admin/governance/batches/:id',
    requireHumanAuth,
    requireAdmin,
    validate(warmupSuiteIdParamSchema, 'params'),
    async (req, res) => {
      try {
        const data = await warmupGovernanceService.getGovernanceBatch(String(req.params.id))
        res.json({ data })
      } catch (err) {
        if (tryHandleAppError(res, err)) return
        throw err
      }
    },
  )

  router.post(
    '/admin/warm-start/suites/:id/edits/preview',
    requireHumanAuth,
    requireAdmin,
    validate(warmupSuiteIdParamSchema, 'params'),
    validate(kickoffSuiteEditSchema),
    async (req, res) => {
      try {
        const bodySuiteId = req.body.target?.suite_id
        if (bodySuiteId && bodySuiteId !== String(req.params.id)) {
          throw new AppError(400, 'suite_id in body must match route param', 'VALIDATION_ERROR')
        }
        const data = await kickoffSuiteEditService.previewEdit({
          ...req.body,
          target: {
            ...req.body.target,
            suite_id: String(req.params.id),
          },
        })
        res.json({ data })
      } catch (err) {
        if (tryHandleAppError(res, err)) return
        throw err
      }
    },
  )

  router.post(
    '/admin/warm-start/suites/:id/edits',
    requireHumanAuth,
    requireAdmin,
    validate(warmupSuiteIdParamSchema, 'params'),
    validate(kickoffSuiteEditSchema),
    async (req, res) => {
      try {
        const bodySuiteId = req.body.target?.suite_id
        if (bodySuiteId && bodySuiteId !== String(req.params.id)) {
          throw new AppError(400, 'suite_id in body must match route param', 'VALIDATION_ERROR')
        }
        const data = await kickoffSuiteEditService.applyEdit({
          ...req.body,
          target: {
            ...req.body.target,
            suite_id: String(req.params.id),
          },
        })
        res.json({ data })
      } catch (err) {
        if (tryHandleAppError(res, err)) return
        throw err
      }
    },
  )
}
