import { Router, type IRouter, type Response } from 'express'
import {
  kickoffBootstrapService,
  kickoffPatchImportService,
  kickoffRunArtifactService,
  kickoffRuntimeReadinessService,
  warmPersistenceState,
  warmupGovernanceService,
} from '../container.js'
import { AppError, NotFoundError } from '../lib/errors.js'
import {
  kickoffBootstrapSchema,
  kickoffImportSchema,
  kickoffRunIdParamSchema,
} from '../validation/kickoff-schemas.js'
import { validate } from '../validation/validate.js'

function buildFlowStatus(input: {
  currentMode: string
  currentSuiteDetail: {
    kickoff_batch_id: string | null
    active_baseline?: { id: string; is_current: boolean } | null
    warmup_batch_id: string | null
  } | null
  liveRuntimeReadiness: {
    activation_readiness?: { ok: boolean }
    layer_readiness?: { warmup_layer_ready: boolean }
    admission?: { allow_public_growth: boolean }
  } | null
}) {
  const foundationReady = Boolean(input.currentSuiteDetail?.kickoff_batch_id)
  const activeBaselineReady = Boolean(
    input.currentSuiteDetail?.active_baseline?.is_current && input.currentMode === 'kickoff-active',
  )
  const activationReady =
    input.liveRuntimeReadiness?.activation_readiness?.ok === true || activeBaselineReady
  const runtimeReady =
    activeBaselineReady &&
    input.liveRuntimeReadiness?.layer_readiness?.warmup_layer_ready === true &&
    input.liveRuntimeReadiness?.admission?.allow_public_growth === true

  if (!foundationReady) {
    return {
      phase: 'idle',
      title: '未初始化 Kickoff',
      summary: '当前没有 Kickoff Foundation。先初始化基础内容，再进入 review / activate。',
      next_action: '初始化 Kickoff',
      checkpoints: {
        foundation_ready: false,
        activation_ready: false,
        active_baseline_ready: false,
        runtime_ready: false,
      },
    } as const
  }

  if (!activationReady) {
    return {
      phase: 'foundation',
      title: '补齐基础内容',
      summary: 'Kickoff Foundation 已生成，但还没有达到激活条件。',
      next_action: '补齐基础内容',
      checkpoints: {
        foundation_ready: true,
        activation_ready: false,
        active_baseline_ready: false,
        runtime_ready: false,
      },
    } as const
  }

  if (!activeBaselineReady) {
    return {
      phase: 'activation',
      title: '等待激活',
      summary: 'Kickoff Foundation 已通过检查，下一步是 review / activate。',
      next_action: 'Review / Activate',
      checkpoints: {
        foundation_ready: true,
        activation_ready: true,
        active_baseline_ready: false,
        runtime_ready: false,
      },
    } as const
  }

  if (!runtimeReady) {
    return {
      phase: 'active',
      title: 'Kickoff 已激活',
      summary: '当前 active baseline 已成立；Warmup Runtime 还没有完全进入运行态。',
      next_action: '启动 Warmup Runtime',
      checkpoints: {
        foundation_ready: true,
        activation_ready: true,
        active_baseline_ready: true,
        runtime_ready: false,
      },
    } as const
  }

  return {
    phase: 'runtime',
    title: 'Warmup Runtime 运行中',
    summary: 'Kickoff 已激活，Warmup Runtime 已接管后续供给和真实链路验证。',
    next_action: null,
    checkpoints: {
      foundation_ready: true,
      activation_ready: true,
      active_baseline_ready: true,
      runtime_ready: true,
    },
  } as const
}

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
  await warmPersistenceState()
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
  // Database suite/baseline state is the source of truth whenever a kickoff suite exists.
  const preferInferredMode = inferredMode !== 'unknown'
  const currentMode = preferInferredMode ? inferredMode : (marker?.mode ?? inferredMode)
  const shouldExposeKickoffState =
    currentMode === 'kickoff-candidate' || currentMode === 'kickoff-active'
  const currentSuiteId = shouldExposeKickoffState
    ? (activeSuite?.id ?? candidateSuite?.id ?? marker?.suite_id ?? null)
    : null
  const currentSuiteDetail = currentSuiteId
    ? await warmupGovernanceService.getSuiteDetail(currentSuiteId)
    : null
  const liveRuntimeReadiness =
    shouldExposeKickoffState && currentSuiteDetail
      ? await kickoffRuntimeReadinessService.buildForSuite(currentSuiteDetail.id)
      : null
  const flow = buildFlowStatus({
    currentMode,
    currentSuiteDetail,
    liveRuntimeReadiness,
  })

  return {
    data: {
      current_data_mode: currentMode,
      mode_source: preferInferredMode ? 'inferred' : (marker?.source ?? 'inferred'),
      flow,
      latest_run: latestRun?.summary ?? null,
      latest_import_report: latestRun?.import_report ?? null,
      latest_runtime_readiness: shouldExposeKickoffState
        ? (liveRuntimeReadiness ?? latestRun?.readiness ?? null)
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

devKickoffRouter.post('/dev/kickoff/imports', validate(kickoffImportSchema), async (req, res) => {
  try {
    const data = await kickoffPatchImportService.importPatch(req.body)
    res.status(req.body.dry_run ? 200 : 201).json({ data })
  } catch (err) {
    if (tryHandleAppError(res, err)) return
    throw err
  }
})

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
