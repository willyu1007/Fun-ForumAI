import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { WarmupGovernanceTab } from '../WarmupGovernanceTab'

function createWarmupState() {
  return {
    kickoff: {
      id: 'kickoff-1',
      baseline_label: 'kickoff-v1',
      state: 'active',
      created_by_user_id: 'admin-1',
      created_at: '2026-04-18T08:00:00.000Z',
      updated_at: '2026-04-18T08:00:00.000Z',
      activated_at: '2026-04-18T08:00:00.000Z',
      kickoff_batch_id: 'kickoff-1-batch',
      current_warmup_run_id: 'run-1',
      kickoff_batch: {
        id: 'kickoff-1-batch',
        batch_kind: 'kickoff',
        state: 'active',
        source_batch_id: null,
        revision_key: 'kickoff:v1',
        package_hash: 'kickoff:v1',
        notes: null,
        activated_at: '2026-04-18T08:00:00.000Z',
        archived_at: null,
        created_at: '2026-04-18T08:00:00.000Z',
        updated_at: '2026-04-18T08:00:00.000Z',
        stats: {
          posts: 12,
          threads: 12,
          turns: 24,
          votes: 36,
          media: 8,
          communities: 6,
          media_covered_posts: 8,
          media_coverage_ratio: 0.67,
        },
        coverage: [],
        samples: [],
      },
      current_warmup_run: null,
      verification: {
        ok: true,
        missing: [],
      },
    },
    runs: [
      {
        id: 'run-1',
        state: 'active',
        is_current: true,
        source_run_id: null,
        target_posts: 4,
        max_attempts: 8,
        attempted: 4,
        triggered: 4,
        stop_reason: 'target_reached',
        errors: [],
        created_at: '2026-04-18T09:00:00.000Z',
        updated_at: '2026-04-18T09:02:00.000Z',
        activated_at: '2026-04-18T09:02:00.000Z',
        archived_at: null,
        stats: {
          posts: 4,
          threads: 4,
          turns: 8,
          votes: 12,
          media: 2,
          communities: 2,
          media_covered_posts: 2,
          media_coverage_ratio: 0.5,
        },
      },
    ],
    selectedRunId: 'run-1',
    setSelectedRunId: vi.fn(),
    detail: {
      id: 'run-1',
      state: 'active',
      is_current: true,
      source_run_id: null,
      target_posts: 4,
      max_attempts: 8,
      attempted: 4,
      triggered: 4,
      stop_reason: 'target_reached',
      errors: [],
      created_at: '2026-04-18T09:00:00.000Z',
      updated_at: '2026-04-18T09:02:00.000Z',
      activated_at: '2026-04-18T09:02:00.000Z',
      archived_at: null,
      stats: {
        posts: 4,
        threads: 4,
        turns: 8,
        votes: 12,
        media: 2,
        communities: 2,
        media_covered_posts: 2,
        media_coverage_ratio: 0.5,
      },
      kickoff_baseline_id: 'kickoff-1',
      kickoff_label: 'kickoff-v1',
      coverage: [
        {
          community_id: 'community-1',
          community_slug: 'hot-arena',
          community_name: 'Hot Arena',
          post_count: 2,
        },
      ],
      samples: [],
      rolled_back_at: null,
    },
    latestVerifierRun: {
      summary: {
        run_id: 'verifier-1',
        status: 'failed',
        triggered_by_user_id: 'admin-1',
        kickoff_baseline_id: 'kickoff-1',
        kickoff_baseline_label: 'kickoff-v1',
        kickoff_batch_id: 'kickoff-1-batch',
        warmup_batch_id: 'run-1',
        probe_token: 'probe-1',
        probe_post_id: 'post-1',
        failed_phase: 'surface_search',
        top_diagnosis_code: 'surface.search.missing_expected_content',
        top_diagnosis_summary_zh: 'search 没有命中 probe 内容。',
        surface_matrix: {
          feed: true,
          home: true,
          highlights: true,
          search: false,
        },
        governance_drill: {
          quarantine_ok: true,
          restore_ok: false,
          cleanup_ok: true,
        },
        artifact_dir: '/tmp/warmup-run-1',
        started_at: '2026-04-18T10:00:00.000Z',
        completed_at: '2026-04-18T10:02:00.000Z',
      },
      artifacts: {
        artifact_dir: '/tmp/warmup-run-1',
        run_summary_path: '/tmp/warmup-run-1/run-summary.json',
        kickoff_snapshot_before_path: '/tmp/warmup-run-1/kickoff-snapshot-before.json',
        kickoff_snapshot_after_path: '/tmp/warmup-run-1/kickoff-snapshot-after.json',
        baseline_admission_before_path: '/tmp/warmup-run-1/baseline-admission-before.json',
        baseline_admission_after_path: '/tmp/warmup-run-1/baseline-admission-after.json',
        probe_manifest_path: '/tmp/warmup-run-1/probe-manifest.json',
        surface_audit_path: '/tmp/warmup-run-1/surface-audit.json',
        governance_drill_path: '/tmp/warmup-run-1/governance-drill.json',
        diagnosis_path: '/tmp/warmup-run-1/diagnosis.json',
        failure_log_path: '/tmp/warmup-run-1/failure-log.json',
        result_summary_path: '/tmp/warmup-run-1/result-summary.md',
      },
      diagnoses: [
        {
          phase: 'surface_search',
          subsystem: 'search_projection',
          code: 'surface.search.missing_expected_content',
          severity: 'error',
          summary_zh: 'search 没有命中 probe 内容。',
          evidence_refs: [],
          recommended_next_check: '检查 search projection refresh。',
          raw_reason: null,
        },
      ],
      top_diagnosis: {
        phase: 'surface_search',
        subsystem: 'search_projection',
        code: 'surface.search.missing_expected_content',
        severity: 'error',
        summary_zh: 'search 没有命中 probe 内容。',
        evidence_refs: [],
        recommended_next_check: '检查 search projection refresh。',
        raw_reason: null,
      },
      surface_audit: null,
      governance_drill: null,
      probe_manifest: null,
    },
    startMutation: { isPending: false },
    rollbackMutation: { isPending: false },
    runVerifierMutation: { isPending: false },
    targetPosts: '4',
    setTargetPosts: vi.fn(),
    maxAttempts: '8',
    setMaxAttempts: vi.fn(),
    handleStartWarmupRun: vi.fn(),
    handleRollbackWarmupRun: vi.fn(),
    handleRunVerifier: vi.fn(),
  }
}

describe('WarmupGovernanceTab', () => {
  it('renders kickoff, warmup run, and verifier state on the simplified control plane', () => {
    const warmup = createWarmupState()

    render(<WarmupGovernanceTab warmup={warmup as never} />)

    expect(screen.getByText('Kickoff Baseline')).toBeTruthy()
    expect(screen.getByText('kickoff-v1')).toBeTruthy()
    expect(screen.getByText('Selected Run')).toBeTruthy()
    expect(screen.getByText('search 没有命中 probe 内容。')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Run Verifier' }))
    expect(warmup.handleRunVerifier).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Rollback Selected Run' }))
    expect(warmup.handleRollbackWarmupRun).toHaveBeenCalledTimes(1)
  })

  it('disables start and verifier controls while a generating run is active', () => {
    const warmup = createWarmupState()
    warmup.runs = [
      {
        ...warmup.runs[0],
        id: 'run-generating',
        state: 'generating',
        is_current: true,
        attempted: 1,
        triggered: 0,
      },
    ]
    warmup.selectedRunId = 'run-generating'
    warmup.detail = {
      ...warmup.detail,
      id: 'run-generating',
      state: 'generating',
      is_current: true,
      attempted: 1,
      triggered: 0,
    }

    render(<WarmupGovernanceTab warmup={warmup as never} />)

    expect(screen.getByRole('button', { name: 'Start Warmup' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('button', { name: 'Run Verifier' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('button', { name: 'Rollback Selected Run' }).hasAttribute('disabled')).toBe(true)
    expect(
      screen.getByText('当前已有 warmup run 正在执行，待其结束后再启动下一次 run 或执行 verifier。'),
    ).toBeTruthy()
  })

  it('disables rollback for archived runs after cleanup is complete', () => {
    const warmup = createWarmupState()
    warmup.runs = [
      {
        ...warmup.runs[0],
        state: 'archived',
        is_current: false,
        stop_reason: 'rolled_back',
      },
    ]
    warmup.detail = {
      ...warmup.detail,
      state: 'archived',
      is_current: false,
      stop_reason: 'rolled_back',
    }

    render(<WarmupGovernanceTab warmup={warmup as never} />)

    expect(screen.getByRole('button', { name: 'Rollback Selected Run' }).hasAttribute('disabled')).toBe(true)
  })
})
