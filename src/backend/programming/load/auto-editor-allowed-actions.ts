/**
 * T-214 A-M1 — auto-editor allowed-actions SSOT.
 *
 * Sister table to `admission-decisions.ts`. Different question, different
 * dimensions:
 *
 *   - `admission-decisions.ts` answers: *given a cue is ready to execute,
 *     does the load state allow it through?* Keyed by
 *     (LoadState, CueLane, CuePriorityBucket).
 *   - `auto-editor-allowed-actions.ts` answers: *given the load state right
 *     now, which patch shapes is the auto-editor allowed to propose?*
 *     Keyed by `LoadState` only — there is no cue yet to bucket because
 *     the auto-editor runs *before* the cue exists (`create_cue`) or
 *     against a hypothetical edit (`defer_cue`, `cancel_cue`, etc.).
 *
 * Drift between the two tables is structural — admission talks about
 * existing cues' execution windows; LoadGate talks about which mutations
 * the editor can propose for review. Tests pin the LoadGate table so a
 * silent drift becomes a visible regression.
 *
 * `propose_only` semantics (umbrella §2 / overview §34): when true, the
 * LLM call must include a directive that no patch may carry
 * `requires_review=false`. Risk classifier downgrades to `require_review`
 * regardless of the model's confidence vote. Empty `allowed_actions` +
 * `propose_only=true` short-circuits the LLM call entirely (the editor
 * has nothing to do under crushing load).
 */

import type { CueChangeType } from '../../repos/cue-repository.js'
import type { LoadState } from './types.js'

export interface AutoEditorAllowedActions {
  allowed_actions: ReadonlyArray<CueChangeType>
  /**
   * When true, every output patch must surface to the inbox with
   * `requires_review = true`; the auto-editor is denied any "auto_applied"
   * approval status path.
   */
  propose_only: boolean
}

const ALL_ACTIONS_GREEN: ReadonlyArray<CueChangeType> = [
  'create_cue',
  'update_cue',
  'cancel_cue',
  'defer_cue',
  'merge_into_existing_cue',
  'split_cue',
  'attach_media',
  'remove_media',
  'update_dispatch_policy',
  'update_risk_level',
] as const

const SAFE_ACTIONS_YELLOW: ReadonlyArray<CueChangeType> = [
  'cancel_cue',
  'defer_cue',
  'merge_into_existing_cue',
  'remove_media',
  'update_risk_level',
] as const

const TRIAGE_ACTIONS_RED: ReadonlyArray<CueChangeType> = [
  'cancel_cue',
  'defer_cue',
  'merge_into_existing_cue',
] as const

/**
 * Decision table keyed by `LoadState` only.
 *
 *   - `green` — full editor surface; every supported `CueChangeType` may
 *     be proposed. `propose_only=false` means low-risk patches can ride
 *     auto-apply if (and only if) the risk classifier agrees and the
 *     downstream feature flag is on (MVP keeps zero auto-apply per D-12,
 *     so this still routes to the inbox).
 *   - `yellow` — heavy-edit shapes (`create_cue`,
 *     `update_dispatch_policy`, `attach_media`) are blocked. Triage
 *     shapes (`cancel`, `defer`, `merge`, `remove_media`,
 *     `update_risk_level`) remain allowed. `propose_only=false` because
 *     yellow-state edits are still reviewable as normal-risk decisions.
 *   - `red` — only triage shapes; new content / dispatch / risk changes
 *     are blocked. `propose_only=true` because the editor must not
 *     pretend to be authoritative when the system is under stress.
 */
export const AUTO_EDITOR_ALLOWED_ACTIONS: Readonly<
  Record<LoadState, AutoEditorAllowedActions>
> = {
  green: {
    allowed_actions: ALL_ACTIONS_GREEN,
    propose_only: false,
  },
  yellow: {
    allowed_actions: SAFE_ACTIONS_YELLOW,
    propose_only: false,
  },
  red: {
    allowed_actions: TRIAGE_ACTIONS_RED,
    propose_only: true,
  },
}

/**
 * Convenience accessor; returns a fresh tuple per call so callers can
 * mutate the array safely (the underlying constant is read-only).
 */
export function lookupAutoEditorAllowedActions(
  loadState: LoadState,
): AutoEditorAllowedActions {
  const row = AUTO_EDITOR_ALLOWED_ACTIONS[loadState]
  return {
    allowed_actions: [...row.allowed_actions],
    propose_only: row.propose_only,
  }
}

export const AUTO_EDITOR_LOAD_STATES: ReadonlyArray<LoadState> = [
  'green',
  'yellow',
  'red',
]
