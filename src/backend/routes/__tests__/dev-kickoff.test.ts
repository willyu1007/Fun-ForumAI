import express from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const bootstrap = vi.fn()
const importPatch = vi.fn()
const readLatestRun = vi.fn()
const readCurrentDataMode = vi.fn()
const readRun = vi.fn()
const buildForSuite = vi.fn()
const listSuites = vi.fn()
const getSuiteDetail = vi.fn()

vi.mock('../../container.js', () => ({
  kickoffBootstrapService: {
    bootstrap,
  },
  kickoffPatchImportService: {
    importPatch,
  },
  kickoffRunArtifactService: {
    readLatestRun,
    readCurrentDataMode,
    readRun,
  },
  kickoffRuntimeReadinessService: {
    buildForSuite,
  },
  warmupGovernanceService: {
    listSuites,
    getSuiteDetail,
  },
}))

async function createApp() {
  vi.resetModules()
  const { devKickoffRouter } = await import('../dev-kickoff.js')
  const app = express()
  app.use(express.json())
  app.use('/v1', devKickoffRouter)
  return app
}

describe('dev kickoff routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('boots kickoff through the dedicated bootstrap route', async () => {
    bootstrap.mockResolvedValue({
      mode: 'candidate',
      suite_id: 'suite-1',
      suite_label: 'kickoff-v1',
      kickoff_batch_id: 'kickoff-batch-1',
      warmup_batch_id: 'warmup-batch-1',
      baseline_id: null,
      counts: {
        posts: 2,
        threads: 1,
        turns: 0,
        votes: 0,
        media: 0,
        communities: 1,
        media_covered_posts: 0,
        media_coverage_ratio: 0,
      },
      readiness: {
        contract_version: 1,
      },
      reused_existing_suite: false,
      failed_phase: null,
      run_id: 'run-1',
    })

    const app = await createApp()
    const res = await request(app)
      .post('/v1/dev/kickoff/bootstrap')
      .send({
        mode: 'candidate',
        profile_id: 'local-llm-assisted-candidate',
      })

    expect(res.status).toBe(201)
    expect(bootstrap).toHaveBeenCalledWith({
      mode: 'candidate',
      profile_id: 'local-llm-assisted-candidate',
    })
    expect(res.body.data).toMatchObject({
      suite_id: 'suite-1',
      run_id: 'run-1',
    })
  })

  it('returns aggregated kickoff status from marker, suite detail, and runtime readiness', async () => {
    readLatestRun.mockResolvedValue({
      summary: {
        run_id: 'run-1',
      },
      import_report: {
        report_meta: {
          run_id: 'run-1',
        },
      },
      readiness: null,
    })
    readCurrentDataMode.mockResolvedValue({
      mode: 'kickoff-candidate',
      source: 'marker',
      suite_id: 'suite-1',
    })
    listSuites.mockResolvedValue([
      { id: 'suite-1', state: 'review_ready', suite_label: 'kickoff-v1' },
    ])
    getSuiteDetail.mockResolvedValue({
      id: 'suite-1',
      suite_label: 'kickoff-v1',
      state: 'review_ready',
      kickoff_batch_id: 'kickoff-batch-1',
      warmup_batch_id: 'warmup-batch-1',
      active_baseline: null,
    })
    buildForSuite.mockResolvedValue({
      contract_version: 1,
      suite_id: 'suite-1',
      activation_readiness: {
        ok: true,
        reasons: [],
      },
    })

    const app = await createApp()
    const res = await request(app).get('/v1/dev/kickoff/status')

    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({
      current_data_mode: 'kickoff-candidate',
      mode_source: 'marker',
      current_suite: {
        id: 'suite-1',
        kickoff_batch_id: 'kickoff-batch-1',
      },
      latest_runtime_readiness: {
        suite_id: 'suite-1',
      },
    })
  })

  it('does not expose stale kickoff suite state when the current data mode is non-kickoff', async () => {
    readLatestRun.mockResolvedValue(null)
    readCurrentDataMode.mockResolvedValue({
      mode: 'canonical',
      source: 'marker',
      suite_id: null,
    })
    listSuites.mockResolvedValue([
      { id: 'suite-stale', state: 'review_ready', suite_label: 'stale-kickoff' },
    ])

    const app = await createApp()
    const res = await request(app).get('/v1/dev/kickoff/status')

    expect(res.status).toBe(200)
    expect(getSuiteDetail).not.toHaveBeenCalled()
    expect(buildForSuite).not.toHaveBeenCalled()
    expect(res.body.data).toMatchObject({
      current_data_mode: 'canonical',
      current_suite: {
        id: null,
      },
      latest_runtime_readiness: null,
    })
  })

  it('falls back to inferred kickoff mode when the marker is unknown', async () => {
    readLatestRun.mockResolvedValue({
      summary: {
        run_id: 'run-1',
      },
      import_report: null,
      readiness: null,
    })
    readCurrentDataMode.mockResolvedValue({
      mode: 'unknown',
      source: 'marker',
      suite_id: null,
    })
    listSuites.mockResolvedValue([
      { id: 'suite-active', state: 'active', suite_label: 'kickoff-v1' },
    ])
    getSuiteDetail.mockResolvedValue({
      id: 'suite-active',
      suite_label: 'kickoff-v1',
      state: 'active',
      kickoff_batch_id: 'kickoff-batch-1',
      warmup_batch_id: 'warmup-batch-1',
      active_baseline: {
        id: 'baseline-1',
        is_current: true,
      },
    })
    buildForSuite.mockResolvedValue({
      contract_version: 1,
      suite_id: 'suite-active',
      admission: {
        allow_public_growth: true,
      },
    })

    const app = await createApp()
    const res = await request(app).get('/v1/dev/kickoff/status')

    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({
      current_data_mode: 'kickoff-active',
      mode_source: 'inferred',
      current_suite: {
        id: 'suite-active',
        active_baseline_id: 'baseline-1',
      },
      latest_runtime_readiness: {
        suite_id: 'suite-active',
      },
    })
  })

  it('returns latest and specific run details', async () => {
    readLatestRun.mockResolvedValue({
      summary: {
        run_id: 'run-latest',
      },
    })
    readRun.mockResolvedValue({
      summary: {
        run_id: 'run-123',
      },
    })

    const app = await createApp()
    const latestRes = await request(app).get('/v1/dev/kickoff/runs/latest')
    const detailRes = await request(app).get('/v1/dev/kickoff/runs/run-123')

    expect(latestRes.status).toBe(200)
    expect(detailRes.status).toBe(200)
    expect(readRun).toHaveBeenCalledWith('run-123')
    expect(latestRes.body.data.summary.run_id).toBe('run-latest')
    expect(detailRes.body.data.summary.run_id).toBe('run-123')
  })
})
