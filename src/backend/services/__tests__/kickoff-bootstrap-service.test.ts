import { describe, expect, it, vi } from 'vitest'
import { ConflictError, ValidationError } from '../../lib/errors.js'
import { KickoffBootstrapService } from '../kickoff-bootstrap-service.js'

describe('KickoffBootstrapService', () => {
  it('rejects bootstrap requests whose mode does not match the selected kickoff profile', async () => {
    const service = new KickoffBootstrapService({
      warmupGovernanceService: {
        createLaunchSuite: vi.fn(),
        reviewSuite: vi.fn(),
        getSuiteDetail: vi.fn(),
      } as never,
      runtimeReadinessService: {
        buildForSuite: vi.fn(),
      } as never,
      runArtifactService: {
        createRun: vi.fn(),
      } as never,
    })

    await expect(service.bootstrap({
      mode: 'active',
      profile_id: 'local-llm-assisted-candidate',
    })).rejects.toBeInstanceOf(ValidationError)
  })

  it('rejects a second bootstrap while one is already running', async () => {
    let resolveCreateSuite: ((value: { suite_id: string; reused_existing_suite: boolean }) => void) | null = null
    const createLaunchSuite = vi.fn(() => new Promise<{ suite_id: string; reused_existing_suite: boolean }>((resolve) => {
      resolveCreateSuite = resolve
    }))
    const createRun = vi.fn().mockResolvedValue({
      run_id: 'run-1',
      run_type: 'bootstrap',
      mode: 'active',
      profile_id: 'local-llm-assisted-runtime-simulation',
      patch_id: null,
      suite_id: null,
      suite_label: null,
      kickoff_batch_id: null,
      warmup_batch_id: null,
      baseline_id: null,
      failed_phase: null,
      artifact_dir: '/tmp/run-1',
      started_at: new Date().toISOString(),
      completed_at: null,
    })
    const getSuiteDetail = vi.fn().mockResolvedValue({
      id: 'suite-1',
      suite_label: 'kickoff-v1',
      state: 'review_ready',
      kickoff_batch_id: 'kickoff-batch-1',
      warmup_batch_id: 'warmup-batch-1',
      active_baseline: null,
    })
    const reviewSuite = vi.fn().mockResolvedValue({
      suite: {
        id: 'suite-1',
        suite_label: 'kickoff-v1',
        state: 'active',
        kickoff_batch_id: 'kickoff-batch-1',
        warmup_batch_id: 'warmup-batch-1',
        active_baseline: {
          id: 'baseline-1',
          is_current: true,
        },
      },
    })
    const buildForSuite = vi.fn().mockResolvedValue({
      activation_readiness: { ok: true },
      quality_state: { summary: { posts: 14 } },
    })
    const service = new KickoffBootstrapService({
      warmupGovernanceService: {
        createLaunchSuite,
        reviewSuite,
        getSuiteDetail,
      } as never,
      runtimeReadinessService: {
        buildForSuite,
      } as never,
      runArtifactService: {
        createRun,
        writeContextPack: vi.fn().mockResolvedValue(undefined),
        writeReadiness: vi.fn().mockResolvedValue(undefined),
        writeDiffSummary: vi.fn().mockResolvedValue(undefined),
        recordDataMode: vi.fn().mockResolvedValue(undefined),
        completeRun: vi.fn().mockResolvedValue(undefined),
        writeFailureLog: vi.fn().mockResolvedValue(undefined),
      } as never,
    })

    const first = service.bootstrap({
      mode: 'active',
      profile_id: 'local-llm-assisted-runtime-simulation',
      reset_before_bootstrap: false,
    })

    await expect(service.bootstrap({
      mode: 'active',
      profile_id: 'local-llm-assisted-runtime-simulation',
      reset_before_bootstrap: false,
    })).rejects.toBeInstanceOf(ConflictError)

    resolveCreateSuite?.({
      suite_id: 'suite-1',
      reused_existing_suite: false,
    })

    await expect(first).resolves.toMatchObject({
      suite_id: 'suite-1',
      baseline_id: 'baseline-1',
      failed_phase: null,
    })
    expect(createRun).toHaveBeenCalledTimes(1)
  })
})
