import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type {
  WarmupVerifierDiagnosis,
  WarmupVerifierProbeManifest,
  WarmupVerifierSurfaceAudit,
} from '../../../shared/warmup-verifier.js'

const ORIGINAL_CWD = process.cwd()

describe('WarmupRunArtifactService', () => {
  beforeEach(() => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'warmup-run-artifacts-'))
    process.chdir(tempRoot)
  })

  afterEach(() => {
    process.chdir(ORIGINAL_CWD)
  })

  it('writes and reads a complete warm-up verifier artifact set', async () => {
    const { WarmupRunArtifactService } = await import('../warmup-run-artifact-service.js')
    const service = new WarmupRunArtifactService()

    const run = await service.createRun({
      triggered_by_user_id: 'admin-1',
    })
    const initialDetail = await service.readRun(run.run_id)

    for (const path of Object.values(initialDetail!.artifacts)) {
      expect(existsSync(path)).toBe(true)
    }
    expect(readFileSync(initialDetail!.artifacts.diagnosis_path, 'utf8')).toContain('[]')

    const diagnoses: WarmupVerifierDiagnosis[] = [{
      phase: 'surface_search',
      subsystem: 'search_projection',
      code: 'surface.search.missing_expected_content',
      severity: 'error',
      summary_zh: 'search 没有命中 probe 内容。',
      evidence_refs: [{
        artifact: 'surface-audit.json',
        pointer: '$.initial.search',
        note: null,
      }],
      recommended_next_check: '检查 search projection refresh。',
      raw_reason: null,
    }]

    const probeManifest: WarmupVerifierProbeManifest = {
      run_id: run.run_id,
      probe_token: 'probe-1',
      triggered_by_user_id: 'admin-1',
      forced: true,
      agent_id: 'agent-1',
      community_id: 'community-1',
      post_id: 'post-1',
      title: 'Probe title [probe:probe-1]',
      tags: ['warmup-probe', 'warmup-probe:run-1'],
      visibility: 'PUBLIC',
      state: 'APPROVED',
      created_at: '2026-04-15T08:00:00.000Z',
    }

    const surfaceAudit: WarmupVerifierSurfaceAudit = {
      initial: {
        stage: 'initial',
        feed: {
          surface: 'feed',
          ok: true,
          expectation: 'probe_visible',
          detail: 'feed ok',
          probe_post_id: 'post-1',
          observed_post_ids: ['post-1'],
          matched_probe: true,
          checked_at: '2026-04-15T08:00:00.000Z',
        },
        home: {
          surface: 'home',
          ok: true,
          expectation: 'baseline_content_present',
          detail: 'home ok',
          probe_post_id: 'post-1',
          observed_post_ids: ['base-1'],
          baseline_match_count: 1,
          checked_at: '2026-04-15T08:00:00.000Z',
        },
        highlights: {
          surface: 'highlights',
          ok: true,
          expectation: 'baseline_content_present',
          detail: 'highlights ok',
          probe_post_id: 'post-1',
          observed_post_ids: ['base-1'],
          baseline_match_count: 1,
          checked_at: '2026-04-15T08:00:00.000Z',
        },
        search: {
          surface: 'search',
          ok: false,
          expectation: 'probe_visible',
          detail: 'search miss',
          probe_post_id: 'post-1',
          observed_post_ids: [],
          matched_probe: false,
          checked_at: '2026-04-15T08:00:00.000Z',
        },
      },
      after_quarantine: null,
      after_restore: null,
      after_cleanup: null,
    }

    await service.writeSuiteSnapshotBefore(run.run_id, { suite: 'before' })
    await service.writeSuiteSnapshotAfter(run.run_id, { suite: 'after' })
    await service.writeBaselineAdmissionBefore(run.run_id, { allow_public_growth: true })
    await service.writeBaselineAdmissionAfter(run.run_id, { allow_public_growth: true })
    await service.writeProbeManifest(run.run_id, probeManifest)
    await service.writeSurfaceAudit(run.run_id, surfaceAudit)
    await service.writeGovernanceDrill(run.run_id, {
      quarantine: {
        action: 'quarantine',
        ok: true,
        detail: 'quarantine ok',
        checked_at: '2026-04-15T08:01:00.000Z',
      },
      restore: {
        action: 'restore',
        ok: false,
        detail: 'restore failed',
        checked_at: '2026-04-15T08:02:00.000Z',
      },
      cleanup: {
        action: 'cleanup',
        ok: true,
        detail: 'cleanup ok',
        checked_at: '2026-04-15T08:03:00.000Z',
      },
    })
    await service.writeDiagnosis(run.run_id, diagnoses)
    await service.appendFailure(run.run_id, {
      phase: 'surface_search',
      message: 'search miss',
      at: '2026-04-15T08:00:00.000Z',
    })
    await service.writeResultSummary(run.run_id, '# Warm-up Closure Verifier')
    await service.completeRun(run.run_id, {
      status: 'failed',
      failed_phase: 'surface_search',
      suite_id: 'suite-1',
      suite_label: 'suite label',
      active_baseline_id: 'baseline-1',
      kickoff_batch_id: 'kickoff-batch-1',
      warmup_batch_id: 'warmup-batch-1',
      probe_token: probeManifest.probe_token,
      probe_post_id: probeManifest.post_id,
      diagnoses,
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
    })

    const latest = await service.readLatestRun()

    expect(latest?.summary.run_id).toBe(run.run_id)
    expect(latest?.summary.failed_phase).toBe('surface_search')
    expect(latest?.summary.surface_matrix.search).toBe(false)
    expect(latest?.probe_manifest?.probe_token).toBe('probe-1')
    expect(latest?.surface_audit?.initial?.search.ok).toBe(false)
    expect(latest?.top_diagnosis?.code).toBe('surface.search.missing_expected_content')
    expect(latest?.artifacts.artifact_dir).toContain('.ai/.tmp/warmup-runs')
  })
})
