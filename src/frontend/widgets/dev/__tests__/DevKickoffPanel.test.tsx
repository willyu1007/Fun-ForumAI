import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useDevKickoffLatestRun, useDevKickoffRun, useDevKickoffStatus } from '@/api/hooks/dev'
import { DevKickoffPanel } from '../DevKickoffPanel'

vi.mock('@/api/hooks/dev', () => ({
  useDevKickoffStatus: vi.fn(),
  useDevKickoffLatestRun: vi.fn(),
  useDevKickoffRun: vi.fn(),
}))

const useDevKickoffStatusMock = vi.mocked(useDevKickoffStatus)
const useDevKickoffLatestRunMock = vi.mocked(useDevKickoffLatestRun)
const useDevKickoffRunMock = vi.mocked(useDevKickoffRun)

describe('DevKickoffPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useDevKickoffStatusMock.mockReturnValue({
      data: {
        data: {
          current_data_mode: 'kickoff-candidate',
          mode_source: 'marker',
          latest_run: null,
          latest_import_report: {
            report_meta: {
              run_id: 'run-1',
              patch_id: 'patch-1',
              dry_run: false,
            },
            summary_after_import: {
              posts: 4,
              threads: 3,
              turns: 2,
              media: 1,
            },
            recommended_next_actions: ['review suite'],
            failure_phase: null,
          },
          latest_runtime_readiness: {
            activation_readiness: { ok: true, reasons: [] },
            layer_readiness: {
              kickoff_layer_ready: true,
              warmup_layer_ready: true,
            },
            quality_state: {
              warning_count: 1,
              summary: {
                media_coverage_ratio: 0.5,
              },
            },
            admission: {
              allow_public_growth: true,
            },
          },
          current_suite: {
            id: 'suite-1',
            label: 'kickoff-v1',
            state: 'review_ready',
            kickoff_batch_id: 'batch-kickoff',
            warmup_batch_id: 'batch-warmup',
            active_baseline_id: null,
          },
        },
      },
      error: null,
      refetch: vi.fn(),
    } as never)
    useDevKickoffLatestRunMock.mockReturnValue({
      data: {
        data: {
          summary: {
            run_id: 'run-1',
            run_type: 'import',
            profile_id: 'local-llm-assisted-candidate',
            artifact_dir: '/tmp/run-1',
            failed_phase: null,
          },
          artifacts: {
            context_pack_path: '/tmp/run-1/context-pack.json',
            generated_patch_path: '/tmp/run-1/generated-patch.yaml',
            import_report_path: '/tmp/run-1/import-report.json',
            readiness_snapshot_path: '/tmp/run-1/readiness-snapshot.json',
            repair_patch_path: '/tmp/run-1/repair-patch.yaml',
            failure_log_path: '/tmp/run-1/failure-log.json',
          },
        },
      },
      error: null,
      refetch: vi.fn(),
    } as never)
    useDevKickoffRunMock.mockReturnValue({
      data: null,
      error: null,
      refetch: vi.fn(),
    } as never)
  })

  it('renders current mode, latest import summary, and artifact paths', () => {
    render(<DevKickoffPanel open onOpenChange={vi.fn()} />)

    expect(screen.getByText('Local Kickoff 调试台')).toBeTruthy()
    expect(screen.getAllByText('kickoff-candidate').length).toBeGreaterThan(0)
    expect(screen.getByText('Current Status')).toBeTruthy()
    expect(screen.getByText('Latest Import Summary')).toBeTruthy()
    expect(screen.getByText('Run Detail')).toBeTruthy()
    expect(screen.getByText('/tmp/run-1')).toBeTruthy()
    expect(screen.getByText('/tmp/run-1/generated-patch.yaml')).toBeTruthy()
  })
})
