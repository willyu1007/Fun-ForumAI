import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  useDevKickoffLatestRun,
  useDevKickoffRecentRuns,
  useDevKickoffRun,
  useDevKickoffStatus,
} from '@/api/hooks/dev'
import { DevKickoffPanel } from '../DevKickoffPanel'

vi.mock('@/api/hooks/dev', () => ({
  useDevKickoffStatus: vi.fn(),
  useDevKickoffLatestRun: vi.fn(),
  useDevKickoffRecentRuns: vi.fn(),
  useDevKickoffRun: vi.fn(),
}))

const useDevKickoffStatusMock = vi.mocked(useDevKickoffStatus)
const useDevKickoffLatestRunMock = vi.mocked(useDevKickoffLatestRun)
const useDevKickoffRecentRunsMock = vi.mocked(useDevKickoffRecentRuns)
const useDevKickoffRunMock = vi.mocked(useDevKickoffRun)

const RECENT_RUNS = [
  {
    run_id: 'run-1',
    run_type: 'import' as const,
    mode: null,
    profile_id: 'local-llm-assisted-candidate',
    patch_id: null,
    suite_id: null,
    suite_label: null,
    kickoff_batch_id: null,
    warmup_batch_id: null,
    baseline_id: null,
    failed_phase: null,
    artifact_dir: '/tmp/run-1',
    started_at: '2026-04-13T14:00:00.000Z',
    completed_at: '2026-04-13T14:01:00.000Z',
  },
  {
    run_id: 'run-2',
    run_type: 'bootstrap' as const,
    mode: null,
    profile_id: 'local-llm-assisted-candidate',
    patch_id: null,
    suite_id: null,
    suite_label: null,
    kickoff_batch_id: null,
    warmup_batch_id: null,
    baseline_id: null,
    failed_phase: 'create_suite',
    artifact_dir: '/tmp/run-2',
    started_at: '2026-04-13T13:00:00.000Z',
    completed_at: '2026-04-13T13:01:00.000Z',
  },
]

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
    useDevKickoffRecentRunsMock.mockReturnValue({
      data: { data: RECENT_RUNS },
      error: null,
      refetch: vi.fn(),
    } as never)
    useDevKickoffRunMock.mockReturnValue({
      data: null,
      error: null,
      refetch: vi.fn(),
    } as never)
  })

  it('renders section titles, mode badge, readiness lights, and import summary', () => {
    render(<DevKickoffPanel open onOpenChange={vi.fn()} />)

    expect(screen.getByText('Kickoff 调控台')).toBeTruthy()
    expect(screen.getAllByText('kickoff-candidate').length).toBeGreaterThan(0)
    expect(screen.getByText('系统状态')).toBeTruthy()
    expect(screen.getByText('最近导入')).toBeTruthy()
    expect(screen.getByText('运行详情')).toBeTruthy()

    const lights = screen.getByTestId('readiness-lights')
    expect(lights).toBeTruthy()
    expect(screen.getByText('全部就绪')).toBeTruthy()

    expect(screen.getByText('kickoff-v1')).toBeTruthy()
    expect(screen.getByText('review suite')).toBeTruthy()
  })

  it('hides suite details when no suite is associated', () => {
    useDevKickoffStatusMock.mockReturnValue({
      data: {
        data: {
          current_data_mode: 'unknown',
          mode_source: 'inferred',
          latest_run: null,
          latest_import_report: null,
          latest_runtime_readiness: null,
          current_suite: { id: null, label: null, state: null, kickoff_batch_id: null, warmup_batch_id: null, active_baseline_id: null },
        },
      },
      error: null,
      refetch: vi.fn(),
    } as never)
    useDevKickoffLatestRunMock.mockReturnValue({ data: null, error: null, refetch: vi.fn() } as never)
    useDevKickoffRecentRunsMock.mockReturnValue({ data: { data: [] }, error: null, refetch: vi.fn() } as never)

    render(<DevKickoffPanel open onOpenChange={vi.fn()} />)

    expect(screen.getByText('未关联 Suite')).toBeTruthy()
    expect(screen.getByText('暂无导入记录')).toBeTruthy()
    expect(screen.getByText('暂无运行记录')).toBeTruthy()
  })

  it('reveals artifact paths with hints when toggle is clicked', () => {
    render(<DevKickoffPanel open onOpenChange={vi.fn()} />)

    expect(screen.queryByText('产物根目录')).toBeNull()

    fireEvent.click(screen.getByText('Artifact 路径'))

    expect(screen.getByText('/tmp/run-1')).toBeTruthy()
    expect(screen.getByText('产物根目录')).toBeTruthy()
    expect(screen.getByText('生成的内容补丁')).toBeTruthy()
    expect(screen.getByText('导入结果报告')).toBeTruthy()
  })

  it('renders run selector dropdown trigger when recent runs exist', () => {
    render(<DevKickoffPanel open onOpenChange={vi.fn()} />)

    const trigger = screen.getByRole('button', { name: /run-1/i })
    expect(trigger).toBeTruthy()
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu')
  })

  it('hides run selector when no recent runs', () => {
    useDevKickoffRecentRunsMock.mockReturnValue({
      data: { data: [] },
      error: null,
      refetch: vi.fn(),
    } as never)

    render(<DevKickoffPanel open onOpenChange={vi.fn()} />)

    expect(screen.queryByRole('button', { name: /run-1/i })).toBeNull()
  })
})
