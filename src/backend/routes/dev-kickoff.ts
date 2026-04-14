import { Router, type IRouter, type Response } from 'express'
import {
  kickoffBootstrapService,
  kickoffPatchImportService,
  kickoffRunArtifactService,
  kickoffRuntimeReadinessService,
  warmupGovernanceService,
} from '../container.js'
import { AppError, NotFoundError } from '../lib/errors.js'
import {
  kickoffBootstrapSchema,
  kickoffImportSchema,
  kickoffRunIdParamSchema,
} from '../validation/kickoff-schemas.js'
import { validate } from '../validation/validate.js'

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

async function buildKickoffStatus() {
  const latestRun = await kickoffRunArtifactService.readLatestRun()
  const marker = await kickoffRunArtifactService.readCurrentDataMode()
  const suites = await warmupGovernanceService.listSuites()
  const activeSuite = suites.find((suite) => suite.state === 'active') ?? null
  const candidateSuite = suites.find((suite) => suite.state === 'review_ready') ?? null
  const inferredMode = activeSuite
    ? 'kickoff-active'
    : candidateSuite
      ? 'kickoff-candidate'
      : 'unknown'
  const preferInferredMode = marker?.mode === 'unknown' && inferredMode !== 'unknown'
  const currentMode = preferInferredMode ? inferredMode : (marker?.mode ?? inferredMode)
  const shouldExposeKickoffState = currentMode === 'kickoff-candidate' || currentMode === 'kickoff-active'
  const currentSuiteId = shouldExposeKickoffState
    ? (marker?.suite_id ?? activeSuite?.id ?? candidateSuite?.id ?? null)
    : null
  const currentSuiteDetail = currentSuiteId
    ? await warmupGovernanceService.getSuiteDetail(currentSuiteId)
    : null

  return {
    data: {
      current_data_mode: currentMode,
      mode_source: preferInferredMode ? 'inferred' : (marker?.source ?? 'inferred'),
      latest_run: latestRun?.summary ?? null,
      latest_import_report: latestRun?.import_report ?? null,
      latest_runtime_readiness:
        shouldExposeKickoffState
          ? (latestRun?.readiness
            ?? (currentSuiteDetail ? await kickoffRuntimeReadinessService.buildForSuite(currentSuiteDetail.id) : null))
          : null,
      current_suite: {
        id: currentSuiteDetail?.id ?? null,
        label: currentSuiteDetail?.suite_label ?? null,
        state: currentSuiteDetail?.state ?? null,
        kickoff_batch_id: currentSuiteDetail?.kickoff_batch_id ?? null,
        warmup_batch_id: currentSuiteDetail?.warmup_batch_id ?? null,
        active_baseline_id: currentSuiteDetail?.active_baseline?.is_current
          ? currentSuiteDetail.active_baseline.id
          : null,
      },
    },
  }
}

const devKickoffRouter: IRouter = Router()

devKickoffRouter.post(
  '/dev/kickoff/bootstrap',
  validate(kickoffBootstrapSchema),
  async (req, res) => {
    try {
      const data = await kickoffBootstrapService.bootstrap(req.body)
      res.status(201).json({ data })
    } catch (err) {
      if (tryHandleAppError(res, err)) return
      throw err
    }
  },
)

devKickoffRouter.post(
  '/dev/kickoff/imports',
  validate(kickoffImportSchema),
  async (req, res) => {
    try {
      const data = await kickoffPatchImportService.importPatch(req.body)
      res.status(req.body.dry_run ? 200 : 201).json({ data })
    } catch (err) {
      if (tryHandleAppError(res, err)) return
      throw err
    }
  },
)

devKickoffRouter.get('/dev/kickoff/status', async (_req, res) => {
  try {
    res.json(await buildKickoffStatus())
  } catch (err) {
    if (tryHandleAppError(res, err)) return
    throw err
  }
})

devKickoffRouter.get('/dev/kickoff/runs', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 10, 20)
    const data = await kickoffRunArtifactService.listRecentRuns(limit)
    res.json({ data })
  } catch (err) {
    if (tryHandleAppError(res, err)) return
    throw err
  }
})

devKickoffRouter.get('/dev/kickoff/runs/latest', async (_req, res) => {
  try {
    const data = await kickoffRunArtifactService.readLatestRun()
    if (!data) throw new NotFoundError('kickoff run', 'latest')
    res.json({ data })
  } catch (err) {
    if (tryHandleAppError(res, err)) return
    throw err
  }
})

devKickoffRouter.get(
  '/dev/kickoff/runs/:runId',
  validate(kickoffRunIdParamSchema, 'params'),
  async (req, res) => {
    try {
      const data = await kickoffRunArtifactService.readRun(String(req.params.runId))
      if (!data) throw new NotFoundError('kickoff run', String(req.params.runId))
      res.json({ data })
    } catch (err) {
      if (tryHandleAppError(res, err)) return
      throw err
    }
  },
)

export { devKickoffRouter }
