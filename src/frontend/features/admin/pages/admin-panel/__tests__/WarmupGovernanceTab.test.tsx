import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { WarmupGovernanceTab } from '../WarmupGovernanceTab'

function createWarmupState() {
  return {
    suites: [],
    selectedSuiteId: null,
    setSelectedSuiteId: vi.fn(),
    detail: null,
    latestVerifierRun: {
      summary: {
        run_id: 'run-1',
        status: 'failed',
        triggered_by_user_id: 'admin-1',
        suite_id: 'suite-1',
        suite_label: 'suite label',
        active_baseline_id: 'baseline-1',
        kickoff_batch_id: 'kickoff-batch-1',
        warmup_batch_id: 'warmup-batch-1',
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
        started_at: '2026-04-15T08:00:00.000Z',
        completed_at: '2026-04-15T08:02:00.000Z',
      },
      artifacts: {
        artifact_dir: '/tmp/warmup-run-1',
        run_summary_path: '/tmp/warmup-run-1/run-summary.json',
        suite_snapshot_before_path: '/tmp/warmup-run-1/suite-snapshot-before.json',
        suite_snapshot_after_path: '/tmp/warmup-run-1/suite-snapshot-after.json',
        baseline_admission_before_path: '/tmp/warmup-run-1/baseline-admission-before.json',
        baseline_admission_after_path: '/tmp/warmup-run-1/baseline-admission-after.json',
        probe_manifest_path: '/tmp/warmup-run-1/probe-manifest.json',
        surface_audit_path: '/tmp/warmup-run-1/surface-audit.json',
        governance_drill_path: '/tmp/warmup-run-1/governance-drill.json',
        diagnosis_path: '/tmp/warmup-run-1/diagnosis.json',
        failure_log_path: '/tmp/warmup-run-1/failure-log.json',
        result_summary_path: '/tmp/warmup-run-1/result-summary.md',
      },
      diagnoses: [{
        phase: 'surface_search',
        subsystem: 'search_projection',
        code: 'surface.search.missing_expected_content',
        severity: 'error',
        summary_zh: 'search 没有命中 probe 内容。',
        evidence_refs: [],
        recommended_next_check: '检查 search projection refresh。',
        raw_reason: null,
      }],
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
    createMutation: { isPending: false },
    reviewMutation: { isPending: false },
    retryMutation: { isPending: false },
    rebuildMutation: { isPending: false },
    startMutation: { isPending: false },
    archiveMutation: { isPending: false },
    runVerifierMutation: { isPending: false },
    previewMutation: { isPending: false },
    executeMutation: { isPending: false },
    previewEditMutation: { isPending: false },
    applyEditMutation: { isPending: false },
    suiteLabel: '',
    setSuiteLabel: vi.fn(),
    topupPosts: '0',
    setTopupPosts: vi.fn(),
    reviewDecision: 'pass_to_active',
    setReviewDecision: vi.fn(),
    reviewNote: '',
    setReviewNote: vi.fn(),
    reviewReasons: [],
    toggleReason: vi.fn(),
    governanceAction: 'quarantine',
    setGovernanceAction: vi.fn(),
    governancePreview: null,
    editAction: 'rewrite_post',
    setEditAction: vi.fn(),
    editReason: '',
    setEditReason: vi.fn(),
    editPostId: '',
    setEditPostId: vi.fn(),
    editThreadId: '',
    setEditThreadId: vi.fn(),
    editTurnId: '',
    setEditTurnId: vi.fn(),
    editPayload: '{}',
    setEditPayload: vi.fn(),
    editPreview: null,
    latestEditResult: null,
    handleCreateSuite: vi.fn(),
    handleReviewSuite: vi.fn(),
    handleRetrySuite: vi.fn(),
    handleRebuildSuite: vi.fn(),
    handleStartWarmupSuite: vi.fn(),
    handleArchiveSuite: vi.fn(),
    handleRunVerifier: vi.fn(),
    handlePreviewGovernance: vi.fn(),
    handleExecuteGovernance: vi.fn(),
    handlePreviewEdit: vi.fn(),
    handleApplyEdit: vi.fn(),
  }
}

describe('WarmupGovernanceTab', () => {
  it('renders the latest verifier summary and reruns the verifier from the existing tab', () => {
    const warmup = createWarmupState()

    render(<WarmupGovernanceTab warmup={warmup as never} />)

    expect(screen.getByText('Warmup Runtime Verifier')).toBeTruthy()
    expect(screen.getByText('search 没有命中 probe 内容。')).toBeTruthy()
    expect(screen.getByText('/tmp/warmup-run-1')).toBeTruthy()
    expect(screen.getByText('failed')).toBeTruthy()
    expect(screen.getByText('cleanup ok')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '重新执行 verifier' }))
    expect(warmup.handleRunVerifier).toHaveBeenCalledTimes(1)
  })
})
