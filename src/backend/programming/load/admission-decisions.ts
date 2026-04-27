/**
 * T-213 M1 — admission decision table SSOT.
 *
 * Maps `(LoadState, CueLane, CuePriorityBucket)` → `AdmissionAction`. This
 * file is the single source of truth for both:
 *   - T-213 `CueAdmissionController` step 3 (cue path admission, M5 swap)
 *   - T-214 `TriggerDetector` LoadGate (auto-editor side)
 *
 * Drift is prevented by:
 *   - typed config (compile-time exhaustiveness on the enum axes)
 *   - snapshot test in `__tests__/admission-decisions.test.ts` covering the
 *     full 3 × 3 × 3 matrix
 *
 * `AdmissionAction` semantics (mirrors `AdmissionResult.decision`):
 *   - `admit`   → cue may execute now
 *   - `defer`   → reschedule to a later trigger window
 *   - `skip`    → drop this attempt without rescheduling (cue moves to skipped)
 *   - `merge`   → reserved for T-214 cue coalescing (M1 emits no merges)
 *   - `require_review` → reserved for high-risk auto-patches (T-214/T-216 M3)
 *
 * Reading the matrix:
 *
 *   Higher priority overrides lane to keep critical cues flowing under stress;
 *   `prime` lane gets the most leeway because it is reserved for stage-tier
 *   programming. `background` lane is the first to drop because it carries
 *   nice-to-have nurture / observability cues (T-211 §A.4).
 */

import type {
  AdmissionAction,
  CueLane,
  CuePriorityBucket,
  LoadState,
} from './types.js'
import { bucketPriority } from './types.js'

export type AdmissionDecisionMatrix = Readonly<
  Record<LoadState, Readonly<Record<CueLane, Readonly<Record<CuePriorityBucket, AdmissionAction>>>>>
>

/**
 * Default admission matrix. Conservative under stress: prime+high never drops
 * below `defer` even at red; background+low gets `skip` as soon as load goes
 * yellow.
 */
export const ADMISSION_DECISIONS: AdmissionDecisionMatrix = {
  green: {
    prime: { high: 'admit', normal: 'admit', low: 'admit' },
    standard: { high: 'admit', normal: 'admit', low: 'admit' },
    background: { high: 'admit', normal: 'admit', low: 'admit' },
  },
  yellow: {
    prime: { high: 'admit', normal: 'admit', low: 'admit' },
    standard: { high: 'admit', normal: 'admit', low: 'defer' },
    background: { high: 'defer', normal: 'defer', low: 'skip' },
  },
  red: {
    prime: { high: 'admit', normal: 'defer', low: 'defer' },
    standard: { high: 'defer', normal: 'defer', low: 'skip' },
    background: { high: 'defer', normal: 'skip', low: 'skip' },
  },
}

export interface LookupAdmissionInput {
  loadState: LoadState
  cueLane: CueLane
  cuePriority: number
}

/** Convenience accessor that buckets the raw priority and reads the table. */
export function lookupAdmissionAction(
  input: LookupAdmissionInput,
): AdmissionAction {
  return ADMISSION_DECISIONS[input.loadState][input.cueLane][
    bucketPriority(input.cuePriority)
  ]
}

/** Used by the snapshot test to assert no enum value is missing from the table. */
export const LOAD_STATES_ORDERED: ReadonlyArray<LoadState> = [
  'green',
  'yellow',
  'red',
]
export const CUE_LANES_ORDERED: ReadonlyArray<CueLane> = [
  'prime',
  'standard',
  'background',
]
export const PRIORITY_BUCKETS_ORDERED: ReadonlyArray<CuePriorityBucket> = [
  'high',
  'normal',
  'low',
]
