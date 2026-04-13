import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const ORIGINAL_CWD = process.cwd()

describe('KickoffRunArtifactService', () => {
  beforeEach(() => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'kickoff-run-artifacts-'))
    process.chdir(tempRoot)
  })

  afterEach(() => {
    process.chdir(ORIGINAL_CWD)
  })

  it('writes and reads a complete kickoff run artifact set', async () => {
    const { KickoffRunArtifactService } = await import('../kickoff-run-artifact-service.js')
    const service = new KickoffRunArtifactService()

    const run = await service.createRun({
      run_type: 'import',
      mode: 'candidate',
      profile_id: 'local-llm-assisted-candidate',
      patch_id: 'patch-1',
      suite_label: 'kickoff-v1',
    })

    const patch = {
      patch_meta: {
        contract_version: 1,
        patch_id: 'patch-1',
        patch_kind: 'local-llm-assisted-candidate',
        generated_by_tool: 'vitest',
        generated_at: '2026-04-13T00:00:00.000Z',
        iteration: 1,
        parent_patch_id: null,
        repair_of_patch_id: null,
      },
      target: {
        mode: 'candidate',
        suite_label: 'kickoff-v1',
        expected_seed_profile: 'launch',
        target_environment: 'local',
        target_batch_scope: 'both',
      },
      source_contract_refs: {
        launch_manifest_path: 'config/launch/manifest.v1.yaml',
        manifest_version: 1,
        community_rules_contract_path: 'config/launch/community_rules.v1.yaml',
        system_roster_contract_path: 'config/launch/system_roster.v1.yaml',
        programming_schedule_contract_path: 'config/launch/launch_programming_schedule.v1.yaml',
        visual_rollout_contract_path: 'config/launch/visual_surface_rollout.v1.yaml',
      },
      preconditions: {
        require_clean_db: true,
        require_launch_seed_ready: true,
        require_no_other_review_ready_suite: true,
        require_roster_memberships_ready: true,
        require_media_backend_available: false,
      },
      operations: [],
      quality_expectations: {
        summary_floor: {
          posts: 1,
          threads: 1,
          turns: 0,
          votes: 0,
        },
        coverage_floor: {
          communities: 1,
          media_coverage_ratio: 0,
        },
        media_floor: {
          minimum_media_assets: 0,
        },
        interaction_floor: {
          minimum_threads: 1,
          minimum_turns: 0,
        },
        key_communities_expected: ['warmup-arena'],
        key_shelves_expected: ['must_watch_today'],
        aftershow_pipeline_expected: true,
        allow_public_growth_expected: false,
      },
      notes: ['artifact test'],
    } as const

    const readiness = {
      contract_version: 1,
      suite_id: 'suite-1',
      suite_label: 'kickoff-v1',
      suite_state: 'review_ready',
      kickoff_batch_id: 'kickoff-batch-1',
      warmup_batch_id: 'warmup-batch-1',
      active_baseline_id: null,
      activation_readiness: {
        ok: true,
        reasons: [],
      },
      layer_readiness: {
        kickoff_layer_ready: true,
        warmup_layer_ready: true,
        key_communities_ready: true,
        key_shelves_ready: true,
        media_access_ok: true,
        aftershow_pipeline_ok: true,
      },
      quality_state: {
        summary: {
          posts: 1,
          threads: 1,
          turns: 0,
          votes: 0,
          media: 0,
          communities: 1,
          media_covered_posts: 0,
          media_coverage_ratio: 0,
        },
        warning_count: 0,
        warnings: [],
      },
      admission: {
        allow_public_growth: false,
        reasons: [],
        has_active_baseline: false,
        active_baseline_id: null,
      },
      generated_at: '2026-04-13T00:05:00.000Z',
    } as const

    await service.writeContextPack(run.run_id, { suite: 'kickoff-v1' })
    await service.writePatch(run.run_id, patch as never)
    await service.writeRepairPatch(run.run_id, patch as never)
    await service.writeImportReport(run.run_id, {
      contract_version: 1,
      report_meta: {
        run_id: run.run_id,
        patch_id: 'patch-1',
        dry_run: false,
        imported_at: '2026-04-13T00:10:00.000Z',
        profile_id: 'local-llm-assisted-candidate',
      },
      resolved_context: {
        mode: 'candidate',
        suite_id: 'suite-1',
        suite_label: 'kickoff-v1',
        kickoff_batch_id: 'kickoff-batch-1',
        warmup_batch_id: 'warmup-batch-1',
      },
      preflight_results: [],
      resolution_map: [],
      op_results: [],
      summary_after_import: readiness.quality_state.summary,
      readiness_snapshot: readiness as never,
      observability: {
        affected_post_ids: [],
        affected_thread_ids: [],
        artifact_dir: run.artifact_dir,
      },
      recommended_next_actions: ['review_candidate_suite'],
      failure_phase: null,
    })
    await service.writeReadiness(run.run_id, readiness as never)
    await service.writeDiffSummary(run.run_id, '# Kickoff Import')
    await service.recordDataMode({
      mode: 'kickoff-candidate',
      suite_id: 'suite-1',
      suite_label: 'kickoff-v1',
      baseline_id: null,
    })
    await service.completeRun(run.run_id, {
      suite_id: 'suite-1',
      suite_label: 'kickoff-v1',
      kickoff_batch_id: 'kickoff-batch-1',
      warmup_batch_id: 'warmup-batch-1',
      failed_phase: null,
    })

    const latest = await service.readLatestRun()
    const marker = await service.readCurrentDataMode()

    expect(marker).toMatchObject({
      mode: 'kickoff-candidate',
      source: 'marker',
      suite_id: 'suite-1',
    })
    expect(latest?.summary.run_id).toBe(run.run_id)
    expect(latest?.patch?.patch_meta.patch_id).toBe('patch-1')
    expect(latest?.import_report?.report_meta.run_id).toBe(run.run_id)
    expect(latest?.readiness?.suite_id).toBe('suite-1')
    expect(latest?.artifacts.context_pack_path).toContain('.ai/.tmp/kickoff-runs')
    expect(latest?.diff_summary).toContain('Kickoff Import')
  })
})
