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
import type { LoadSignalService } from '../../services/load-signal-service.js'
import type {
  AdmissionDecision,
  AdmissionResult,
} from '../contract/index.js'
import type { PublicDiscussionCueDomain } from './types.js'
import { lookupAdmissionAction } from '../load/admission-decisions.js'

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
  /**
   * Default backoff (in seconds) for growth-gate / load defers — these
   * conditions are typically operational gates that need minutes to flip,
   * so we don't want the worker to re-claim on every 10s tick (would
   * create a busy-loop of CueExecutionFailed events). Defaults to 300s
   * (5min). T-213's load service can supply finer-grained recommendations
   * via the load snapshot if desired.
   */
  defaultOpsRetryBackoffSeconds?: number
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
  private readonly defaultOpsRetryBackoffSeconds: number

  constructor(private readonly deps: CueAdmissionControllerDeps) {
    this.cost = deps.cuePathCost ?? 1
    this.defaultRetryBackoffSeconds = deps.defaultBudgetRetryBackoffSeconds ?? 60
    this.defaultOpsRetryBackoffSeconds = deps.defaultOpsRetryBackoffSeconds ?? 300
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
      // T-212 dynamic-bug fix: growth-gate denials need a backoff window so
      // the worker doesn't re-claim on every 10s tick (busy-loop). Operations
      // gates flip on the order of minutes, so a 5-min default is right.
      return {
        result: defer({
          reasons:
            growth.reasons.length > 0
              ? growth.reasons.map((r) => `growth_gate:${r}`)
              : ['growth_gate:blocked'],
          recommendedNextTriggerAt: new Date(
            now.getTime() + this.defaultOpsRetryBackoffSeconds * 1000,
          ),
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
      // rather than crash the worker. Post-T-213 M1 the live path is the
      // `AdmissionLoadService` adapter (4 parallel DB count queries) — a
      // throw here typically indicates a transient DB hiccup; the ops
      // backoff window gives the system time to recover.
      await this.safeRelease(reservation.reservationId)
      return {
        result: defer({
          reasons: [`load_signal_error:${(err as Error).message}`],
          recommendedNextTriggerAt: new Date(
            now.getTime() + this.defaultOpsRetryBackoffSeconds * 1000,
          ),
        }),
      }
    }

    // T-213 M5 — decision-table SSOT replaces the old hard-coded
    // `red→defer / yellow→admit-degraded / green→admit` flow. The matrix in
    // `programming/load/admission-decisions.ts` is shared with T-214's
    // LoadGate so cue and trigger detector make consistent calls.
    const action = lookupAdmissionAction({
      loadState: snapshot.status,
      cueLane: cue.lane,
      cuePriority: cue.priority,
    })
    const reasonTag = `load_${snapshot.status}:${action}`

    switch (action) {
      case 'admit':
        // Yellow keeps the legacy `degraded_media` flag so the runtime falls
        // back to lighter media usage even when the lane / priority cell
        // grants admission.
        return {
          result: admit({
            reasons: [reasonTag],
            loadSnapshotRef: snapshotRef(snapshot),
            degradedMedia: snapshot.status === 'yellow',
          }),
          reservation,
        }
      case 'skip':
        await this.safeRelease(reservation.reservationId)
        return { result: skip([reasonTag]) }
      case 'defer':
        await this.safeRelease(reservation.reservationId)
        return {
          result: defer({
            reasons: [reasonTag],
            loadSnapshotRef: snapshotRef(snapshot),
            recommendedNextTriggerAt: new Date(
              now.getTime() + this.defaultOpsRetryBackoffSeconds * 1000,
            ),
          }),
        }
      case 'merge':
      case 'require_review':
        // Reserved for T-214 cue coalescing (`merge`) and T-216 M3 high-risk
        // review queue (`require_review`). Emit a console warning so an
        // operator who flips one of these into the table sees that this
        // path doesn't actually wire the action yet, then fall back to a
        // safe `defer`. T-214 / T-216 M3 will replace this branch with
        // dedicated handling and remove the warning.
        console.warn(
          `[CueAdmissionController] action='${action}' is reserved for ` +
            'T-214 / T-216 M3 and is not yet wired; falling back to defer ' +
            `(load=${snapshot.status}, lane=${cue.lane}, priority=${cue.priority}).`,
        )
        await this.safeRelease(reservation.reservationId)
        return {
          result: defer({
            reasons: [reasonTag, 'unsupported_action_fallback'],
            loadSnapshotRef: snapshotRef(snapshot),
            recommendedNextTriggerAt: new Date(
              now.getTime() + this.defaultOpsRetryBackoffSeconds * 1000,
            ),
          }),
        }
      default: {
        // Exhaustiveness guard — if a new action value is added to
        // `AdmissionAction` without updating this switch, TS catches it at
        // compile time. Runtime branch is defensive only.
        const _exhaustive: never = action
        void _exhaustive
        await this.safeRelease(reservation.reservationId)
        return {
          result: defer({
            reasons: [reasonTag, 'unknown_action'],
            loadSnapshotRef: snapshotRef(snapshot),
            recommendedNextTriggerAt: new Date(
              now.getTime() + this.defaultOpsRetryBackoffSeconds * 1000,
            ),
          }),
        }
      }
    }
  }

  /**
   * Best-effort release. Swallow errors so a failed release never masks the
   * primary admission outcome — both budget service impls (trivial + real)
   * are in-process and can't fail today, but the soft-hold sweep on the
   * real impl auto-releases stuck reservations after `softHoldMs` so a
   * dropped release just delays the rollback by a few minutes.
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
  // Surface the snapshot's `source` tag so audit logs make it obvious
  // where the load decision came from. Today the only sources reaching
  // this controller in production are `admission_load_service:live`
  // (admission hot path) and the stub `stub_until_t213` (test fixtures);
  // T-215 may upgrade `source` to a stable snapshot id when the cached
  // path persists rows for the public projection.
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
