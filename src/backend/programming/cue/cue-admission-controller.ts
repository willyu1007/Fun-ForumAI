/**
 * T-212 M3 — CueAdmissionController.
 *
 * Three-step short-circuit per T-211 §B.3 / §C:
 *   1. `community-budget-service.acquire(communityId, 'cue', cost)` — see
 *      §C.1. Cue path is the cue-side caller of invariant I-4.
 *   2. `publicGrowthGate.getRuntimeBaselineAdmission()` — same call the
 *      autonomous path uses at `RuntimeLoop.tick`. Invariant I-5.
 *   3. `LoadSignalService.get(communityId, triggerAtIso)` — T-213 supplies the
 *      live-freshness compute; this controller calls the seam regardless of
 *      stub vs live so M4 wiring needs no changes when T-213 lands.
 *
 * Reservation lifecycle (R4):
 *   - On `defer/skip/require_review` decisions, the controller releases the
 *     reservation it acquired so leaks don't accumulate.
 *   - On `admit`, the reservation is **handed to the caller** (worker). The
 *     worker MUST eventually call `release` once the attempt resolves to a
 *     terminal state (consumed, failed, cancelled). Returning the
 *     `reservationId` in the `AdmissionResult.metadata` is intentional so the
 *     worker sees what to release.
 */

import type {
  CommunityBudgetReservation,
  CommunityBudgetService,
  ProductionPath,
} from '../../services/community-budget-service.js'
import type { LoadSignalService } from '../../services/__stubs__/load-signal-service-stub.js'
import type {
  AdmissionDecision,
  AdmissionResult,
} from '../contract/index.js'
import type { PublicDiscussionCueDomain } from './types.js'

// =============================================================================
// Public types
// =============================================================================

export interface CueAdmissionRuntimeBaselineGate {
  getRuntimeBaselineAdmission(): Promise<{
    allow_public_growth: boolean
    reasons: string[]
  }>
}

export interface CueAdmissionControllerDeps {
  communityBudgetService: CommunityBudgetService
  publicGrowthGate: CueAdmissionRuntimeBaselineGate
  loadSignalService: LoadSignalService
  /**
   * Cost per acquire — defaults to 1 (one root post). Exposed so the worker
   * can override for higher-cost cues if needed (e.g., multi-turn scenes
   * post-T-216).
   */
  cuePathCost?: number
  /**
   * Default backoff (in seconds) when budget service indicates retry is
   * possible but doesn't return a `retry_after_ms`. Defaults to 60.
   */
  defaultBudgetRetryBackoffSeconds?: number
}

export interface EvaluateAdmissionInput {
  cue: PublicDiscussionCueDomain
  now: Date
}

/**
 * `AdmissionResult` extended with the live reservation handle so the worker
 * (or caller) knows which reservation to release at the terminal step.
 */
export interface CueAdmissionEvaluation {
  result: AdmissionResult
  reservation?: CommunityBudgetReservation
}

// =============================================================================
// Implementation
// =============================================================================

const PRODUCTION_PATH: ProductionPath = 'cue'

export class CueAdmissionController {
  private readonly cost: number
  private readonly defaultRetryBackoffSeconds: number

  constructor(private readonly deps: CueAdmissionControllerDeps) {
    this.cost = deps.cuePathCost ?? 1
    this.defaultRetryBackoffSeconds = deps.defaultBudgetRetryBackoffSeconds ?? 60
  }

  async evaluate(input: EvaluateAdmissionInput): Promise<CueAdmissionEvaluation> {
    const { cue, now } = input
    const communityId = resolveCommunityId(cue)
    if (!communityId) {
      // A cue without a resolvable community can't go through community-scoped
      // admission gates. Skip — no reservation to release because we never
      // acquired one.
      return {
        result: skip(['cue_missing_community_id']),
      }
    }

    // ---- Step 1: budget acquire ----
    const budget = await this.deps.communityBudgetService.acquire(
      communityId,
      PRODUCTION_PATH,
      this.cost,
    )
    if (!budget.granted) {
      const retryAfterMs = budget.retry_after_ms ?? this.defaultRetryBackoffSeconds * 1000
      return {
        result: defer({
          reasons: [`budget_${budget.reason}`],
          recommendedNextTriggerAt: new Date(now.getTime() + retryAfterMs),
        }),
      }
    }
    const reservation = budget.reservation

    // ---- Step 2: public growth gate ----
    const growth = await this.deps.publicGrowthGate.getRuntimeBaselineAdmission()
    if (!growth.allow_public_growth) {
      await this.safeRelease(reservation.reservationId)
      return {
        result: defer({
          reasons:
            growth.reasons.length > 0
              ? growth.reasons.map((r) => `growth_gate:${r}`)
              : ['growth_gate:blocked'],
        }),
      }
    }

    // ---- Step 3: load signal ----
    let snapshot
    try {
      snapshot = await this.deps.loadSignalService.get(
        communityId,
        cue.trigger_at,
      )
    } catch (err) {
      // Defensive: if the load signal service throws, treat it as a deferral
      // rather than crash the worker. T-213 should make this a hard signal
      // when load is the gating concern.
      await this.safeRelease(reservation.reservationId)
      return {
        result: defer({
          reasons: [`load_signal_error:${(err as Error).message}`],
        }),
      }
    }

    if (snapshot.status === 'red') {
      await this.safeRelease(reservation.reservationId)
      return {
        result: defer({
          reasons: ['load_red'],
          loadSnapshotRef: snapshotRef(snapshot),
        }),
      }
    }
    if (snapshot.status === 'yellow') {
      // Yellow does not block admission but degrades media; degraded_media is
      // signalled so the runtime can fall back to lighter media usage. Worker
      // still gets the reservation.
      return {
        result: admit({
          reasons: ['load_yellow_degraded_media'],
          loadSnapshotRef: snapshotRef(snapshot),
          degradedMedia: true,
        }),
        reservation,
      }
    }

    // green
    return {
      result: admit({
        reasons: ['load_green'],
        loadSnapshotRef: snapshotRef(snapshot),
      }),
      reservation,
    }
  }

  /**
   * Best-effort release. Swallow errors so a failed release never masks the
   * primary admission outcome — the budget service's stub is in-process and
   * can never fail; T-213 may surface transient errors that the worker can
   * recover from later via the soft-hold expiry.
   */
  private async safeRelease(reservationId: string): Promise<void> {
    try {
      await this.deps.communityBudgetService.release(reservationId)
    } catch (err) {
      console.error(
        `[CueAdmissionController] release(${reservationId}) failed: ${(err as Error).message}`,
      )
    }
  }
}

// =============================================================================
// Helpers
// =============================================================================

function resolveCommunityId(cue: PublicDiscussionCueDomain): string | null {
  if (cue.community_id) return cue.community_id
  if (cue.scope.mode === 'single' && cue.scope.community_id) {
    return cue.scope.community_id
  }
  return null
}

function snapshotRef(snapshot: { source: string }): string {
  // Stub returns `{ source: 'stub_until_t213' }`; T-213 will return a stable
  // snapshot id. Until then we surface the source string so audit logs make
  // it obvious where the load decision came from.
  return `load_signal:${snapshot.source}`
}

interface AdmitOptions {
  reasons: string[]
  loadSnapshotRef?: string
  degradedMedia?: boolean
}

function admit(opts: AdmitOptions): AdmissionResult {
  return {
    granted: true,
    decision: 'admit',
    reason_codes: opts.reasons,
    ...(opts.loadSnapshotRef ? { load_snapshot_id: opts.loadSnapshotRef } : {}),
    ...(opts.degradedMedia ? { degraded_media: true } : {}),
  }
}

interface DeferOptions {
  reasons: string[]
  recommendedNextTriggerAt?: Date
  loadSnapshotRef?: string
}

function defer(opts: DeferOptions): AdmissionResult {
  return {
    granted: false,
    decision: 'defer' satisfies AdmissionDecision,
    reason_codes: opts.reasons,
    ...(opts.recommendedNextTriggerAt
      ? {
          recommended_next_trigger_at:
            opts.recommendedNextTriggerAt.toISOString(),
        }
      : {}),
    ...(opts.loadSnapshotRef ? { load_snapshot_id: opts.loadSnapshotRef } : {}),
  }
}

function skip(reasons: string[]): AdmissionResult {
  return {
    granted: false,
    decision: 'skip',
    reason_codes: reasons,
  }
}
