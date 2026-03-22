import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { GuidanceRuntimeCard, MediaOpsCard } from '../RuntimeDashboard'

describe('GuidanceRuntimeCard', () => {
  it('renders aggregated guidance runtime metrics', () => {
    render(
      <GuidanceRuntimeCard
        guidance={{
          flags: {
            guidance_v1: true,
            guidance_recall_v1: true,
          },
          bell: {
            unread_count: 3,
            active_count: 5,
          },
          per_reason: {
            WATCH_PUBLIC_EFFECT: {
              delivered: 2,
              opened: 1,
              dismissed: 0,
              completed: 1,
            },
          },
          avg_delivery_delay_ms: 120_000,
          suppression: {
            same_reason_count: 4,
            daily_cap_count: 1,
          },
          teaching_first_violation_count: 0,
        }}
      />,
    )

    expect(screen.getByText('Guidance Runtime')).toBeTruthy()
    expect(screen.getByText('3 unread')).toBeTruthy()
    expect(screen.getByText('WATCH_PUBLIC_EFFECT')).toBeTruthy()
    expect(screen.getByText('delivered 2')).toBeTruthy()
    expect(screen.getByText('opened 1')).toBeTruthy()
    expect(screen.getByText('teaching-first violations: 0')).toBeTruthy()
  })
})

describe('MediaOpsCard', () => {
  it('renders observability gates and lifecycle summary', () => {
    render(
      <MediaOpsCard
        observability={{
          metrics: {
            windows: {
              root_post_7d_start: '2026-03-15T00:00:00.000Z',
              ops_24h_start: '2026-03-21T00:00:00.000Z',
            },
            root_post: {
              attempted_7d: 20,
              display_linked_7d: 8,
              runtime_injected_7d: 10,
              text_only_7d: 4,
              runtime_only_7d: 2,
              attach_rate_7d: 0.4,
              runtime_injected_rate_7d: 0.5,
              source_mix_7d: [
                {
                  source_kind: 'canonical_public',
                  count: 6,
                  share: 0.3,
                },
              ],
              attach_success_24h: 3,
              attach_failed_24h: 1,
              attach_failure_rate_24h: 0.25,
              prompt_audit_blocked_24h: 1,
              prompt_audit_block_rate_24h: 0.1,
              critical_private_leaks_24h: 0,
            },
            generation_24h: {
              requested: 4,
              succeeded: 3,
              failed: 1,
              timed_out: 0,
              cancelled: 0,
              sync_degraded: 1,
              success_rate: 0.75,
              timeout_or_cancel_rate: 0,
              estimated_cost_cny: 4.8,
              cost_gate_active: true,
            },
            governance_24h: {
              policy_candidate_blocked: 2,
              policy_revoked: 1,
              runtime_only_downgraded: 1,
            },
          },
          gates: [
            {
              id: 'root_post_band',
              status: 'pass',
              value: 0.4,
              unit: 'ratio',
              threshold: {
                pass: '35%-45%',
                warn: '30%-35% / 45%-50%',
                block: '<30% or >50%',
              },
            },
            {
              id: 'attach_stability',
              status: 'block',
              value: 0.25,
              unit: 'ratio',
              threshold: {
                pass: '<=2%',
                warn: '<=5%',
                block: '>5%',
              },
            },
          ],
          recent_alerts: [
            {
              id: 'evt_1',
              event_type: 'display_attach_failed',
              surface: 'root_post',
              severity: 'warn',
              agent_id: 'agent_1',
              community_id: 'community_1',
              image_plan_id: 'plan_1',
              generation_job_id: null,
              asset_id: 'asset_1',
              source_kind: 'canonical_public',
              metric_value: null,
              payload_json: null,
              created_at: '2026-03-22T01:00:00.000Z',
            },
          ],
          lifecycle_candidates: {
            orphan_assets: 2,
            expired_projections: 1,
            snapshot_backfill_assets: 3,
          },
          effective_controller_profile: {
            mode: 'AUTO',
            active_override: null,
            profile: 'steady',
            metrics: {
              windows: {
                root_post_7d_start: '2026-03-15T00:00:00.000Z',
                ops_24h_start: '2026-03-21T00:00:00.000Z',
              },
              root_post: {
                attempted_7d: 20,
                display_linked_7d: 8,
                runtime_injected_7d: 10,
                text_only_7d: 4,
                runtime_only_7d: 2,
                attach_rate_7d: 0.4,
                runtime_injected_rate_7d: 0.5,
                source_mix_7d: [],
                attach_success_24h: 3,
                attach_failed_24h: 1,
                attach_failure_rate_24h: 0.25,
                prompt_audit_blocked_24h: 1,
                prompt_audit_block_rate_24h: 0.1,
                critical_private_leaks_24h: 0,
              },
              generation_24h: {
                requested: 4,
                succeeded: 3,
                failed: 1,
                timed_out: 0,
                cancelled: 0,
                sync_degraded: 1,
                success_rate: 0.75,
                timeout_or_cancel_rate: 0,
                estimated_cost_cny: 4.8,
                cost_gate_active: true,
              },
              governance_24h: {
                policy_candidate_blocked: 2,
                policy_revoked: 1,
                runtime_only_downgraded: 1,
              },
            },
            gates: [],
            effective: {
              target_min_rate: 0.35,
              target_max_rate: 0.45,
              threshold_delta: 0,
              allow_generation: true,
              generation_tier: 'medium',
              sync_generation_ms_budget: 2200,
              allow_private_runtime_projection: true,
              allow_private_inspired_generation: true,
              force_safe_mode: false,
            },
            reason: 'within_target_band',
          },
        }}
        controllerProfile={{
          mode: 'AUTO',
          active_override: null,
          profile: 'steady',
          metrics: {
            windows: {
              root_post_7d_start: '2026-03-15T00:00:00.000Z',
              ops_24h_start: '2026-03-21T00:00:00.000Z',
            },
            root_post: {
              attempted_7d: 20,
              display_linked_7d: 8,
              runtime_injected_7d: 10,
              text_only_7d: 4,
              runtime_only_7d: 2,
              attach_rate_7d: 0.4,
              runtime_injected_rate_7d: 0.5,
              source_mix_7d: [],
              attach_success_24h: 3,
              attach_failed_24h: 1,
              attach_failure_rate_24h: 0.25,
              prompt_audit_blocked_24h: 1,
              prompt_audit_block_rate_24h: 0.1,
              critical_private_leaks_24h: 0,
            },
            generation_24h: {
              requested: 4,
              succeeded: 3,
              failed: 1,
              timed_out: 0,
              cancelled: 0,
              sync_degraded: 1,
              success_rate: 0.75,
              timeout_or_cancel_rate: 0,
              estimated_cost_cny: 4.8,
              cost_gate_active: true,
            },
            governance_24h: {
              policy_candidate_blocked: 2,
              policy_revoked: 1,
              runtime_only_downgraded: 1,
            },
          },
          gates: [],
          effective: {
            target_min_rate: 0.35,
            target_max_rate: 0.45,
            threshold_delta: 0,
            allow_generation: true,
            generation_tier: 'medium',
            sync_generation_ms_budget: 2200,
            allow_private_runtime_projection: true,
            allow_private_inspired_generation: true,
            force_safe_mode: false,
          },
          reason: 'within_target_band',
        }}
        overrideId="override_1"
        overrideMode="MANUAL"
        onOverrideModeChange={() => {}}
        thresholdDelta="0"
        onThresholdDeltaChange={() => {}}
        targetMinRate="0.35"
        onTargetMinRateChange={() => {}}
        targetMaxRate="0.45"
        onTargetMaxRateChange={() => {}}
        generationTier="medium"
        onGenerationTierChange={() => {}}
        syncBudgetMs="2200"
        onSyncBudgetMsChange={() => {}}
        allowGeneration
        onAllowGenerationChange={() => {}}
        allowPrivateRuntime
        onAllowPrivateRuntimeChange={() => {}}
        allowPrivateInspired
        onAllowPrivateInspiredChange={() => {}}
        forceSafeMode={false}
        onForceSafeModeChange={() => {}}
        applyPending={false}
        releasePending={false}
        lifecyclePending={false}
        applyError={null}
        releaseError={null}
        lifecycleError={null}
        lifecycleResult={{
          run_at: '2026-03-22T02:00:00.000Z',
          archived_assets: 1,
          deleted_projections: 2,
          snapshot_backfill_attempted: 3,
          snapshot_backfill_succeeded: 2,
          snapshot_backfill_failed: 1,
        }}
        onApply={() => {}}
        onRelease={() => {}}
        onRunLifecycle={() => {}}
      />,
    )

    expect(screen.getByText('Media Ops')).toBeTruthy()
    expect(screen.getByText('root_post_band: pass')).toBeTruthy()
    expect(screen.getByText('attach_stability: block')).toBeTruthy()
    expect(screen.getByText('override active')).toBeTruthy()
    expect(screen.getByText('display_attach_failed')).toBeTruthy()
    expect(screen.getByText(/last lifecycle run:/)).toBeTruthy()
    expect(screen.getByText('snapshot backfill 2/3 · failed 1')).toBeTruthy()
  })
})
