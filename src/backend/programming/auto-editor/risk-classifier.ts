/**
 * T-214 A-M2 — `RiskClassifier`.
 *
 * Deterministic pre-LLM step that maps `(action, target_state)` to a
 * baseline risk band (low / standard / high). The auto-editor's
 * `risk_level` output is allowed to *upgrade* the band (e.g., LLM
 * decides standard → high because of sensitive context) but never
 * downgrade. Final risk lands on the inbox row so admins can sort by
 * urgency.
 *
 * Bands (overview §40-42):
 *   - **low**: grace adjustment, defer background cue, remove invalid
 *     media, runtime-only media attach.
 *   - **standard**: new normal cue, theme-intent change, scene-family
 *     change.
 *   - **high**: real hot-topic, sensitive public issue, public-display
 *     media, prime-cue cancel, large evening structure change.
 *
 * The classifier reasons over signals it can compute deterministically:
 *   - action type (CueChangeType)
 *   - target lane (read off the cue, when one exists)
 *   - prime-window membership (read off the trigger event evidence)
 *   - propose_only flag from LoadGate (forces high under stress)
 *
 * The LLM-side `risk_level` output is reconciled by `chooseFinalRisk`:
 *   - if classifier says low and LLM says high → use high (LLM saw
 *     content the classifier doesn't have access to)
 *   - if classifier says high and LLM says low → use high (always
 *     trust the classifier's structural signals)
 */

import type { CueChangeType } from '../../repos/cue-repository.js'
import type {
  CueLane,
  PublicDiscussionCueDomain,
} from '../cue/types.js'
import type { AutoEditorRiskLevel } from './types.js'

const RISK_ORDER: Record<AutoEditorRiskLevel, number> = {
  low: 0,
  standard: 1,
  high: 2,
}

export interface RiskClassifierInput {
  action: CueChangeType
  /**
   * Lane of the targeted cue. For `create_cue` the classifier reads the
   * lane the LLM proposed in the patch; the caller passes that through.
   */
  targetLane: CueLane
  /**
   * True when the cue runs (or would run) in the configured prime
   * window. Caller derives this from the trigger evidence + cue's
   * trigger_at; the classifier only treats it as a structural signal.
   */
  inPrimeWindow: boolean
  /** LoadGate flag that forces every patch to inbox-review. */
  proposeOnly: boolean
  /**
   * `true` when the action targets a **publicly displayed** asset (not
   * just runtime context). Caller infers this from the brief / patch
   * media policy. Conservative default: `false` — the classifier
   * doesn't fabricate display intent.
   */
  publicDisplayMediaInvolved?: boolean
}

export interface RiskClassification {
  band: AutoEditorRiskLevel
  /**
   * Reason codes that contributed to the band. Stable strings so
   * dashboards can group / count without parsing free text.
   */
  reason_codes: ReadonlyArray<string>
}

/**
 * Compute the deterministic baseline risk for an auto-editor proposal.
 * Multiple signals can apply; the band is the *max* across all signals.
 */
export function classifyRisk(input: RiskClassifierInput): RiskClassification {
  const reasons: string[] = []
  let band: AutoEditorRiskLevel = 'low'

  const bump = (next: AutoEditorRiskLevel, reason: string) => {
    if (RISK_ORDER[next] > RISK_ORDER[band]) {
      band = next
    }
    if (!reasons.includes(reason)) reasons.push(reason)
  }

  // Action-specific bumps
  switch (input.action) {
    case 'create_cue':
      bump('standard', 'create_cue_baseline')
      break
    case 'update_cue':
      bump('standard', 'update_cue_baseline')
      break
    case 'cancel_cue':
      bump('standard', 'cancel_cue_baseline')
      break
    case 'defer_cue':
      bump('low', 'defer_cue_baseline')
      break
    case 'merge_into_existing_cue':
      bump('standard', 'merge_baseline')
      break
    case 'split_cue':
      bump('standard', 'split_baseline')
      break
    case 'attach_media':
      bump('low', 'attach_media_runtime_only_baseline')
      break
    case 'remove_media':
      bump('low', 'remove_media_baseline')
      break
    case 'update_dispatch_policy':
      bump('high', 'update_dispatch_policy_baseline')
      break
    case 'update_risk_level':
      bump('high', 'update_risk_level_baseline')
      break
    case 'publish_schedule':
    case 'rollback_schedule':
      bump('high', 'schedule_lifecycle_change')
      break
    default:
      // Exhaustive switch: a new CueChangeType lands here as a compile
      // error in strict mode, forcing the classifier author to assign
      // a baseline.
      ((_value: never) => _value)(input.action)
  }

  // Lane-specific bumps
  if (input.targetLane === 'prime' && input.action === 'cancel_cue') {
    bump('high', 'prime_lane_cancel')
  }
  if (input.targetLane === 'prime' && input.action === 'update_cue') {
    bump('high', 'prime_lane_update')
  }

  // Prime-window structural bump for any structural mutation
  if (
    input.inPrimeWindow
    && (input.action === 'create_cue'
      || input.action === 'update_cue'
      || input.action === 'cancel_cue'
      || input.action === 'merge_into_existing_cue'
      || input.action === 'split_cue')
  ) {
    bump('high', 'prime_window_structural_change')
  }

  // Public-display media → always high (user-visible asset)
  if (input.publicDisplayMediaInvolved === true) {
    bump('high', 'public_display_media')
  }

  // LoadGate propose_only forces high — under stress, every patch is
  // human-reviewed regardless of structural risk.
  if (input.proposeOnly) {
    bump('high', 'load_gate_propose_only')
  }

  return { band, reason_codes: reasons }
}

/**
 * Reconcile the deterministic baseline with the LLM's self-reported
 * risk. The auto-editor pipeline always uses `max(baseline, llm)` so
 * the LLM can escalate but never downgrade. The reason codes the
 * classifier returned ride along.
 */
export function chooseFinalRisk(input: {
  classifier: RiskClassification
  llmReported: AutoEditorRiskLevel
}): RiskClassification {
  const llmRank = RISK_ORDER[input.llmReported]
  const classifierRank = RISK_ORDER[input.classifier.band]
  if (llmRank > classifierRank) {
    return {
      band: input.llmReported,
      reason_codes: [...input.classifier.reason_codes, 'llm_self_escalated'],
    }
  }
  return input.classifier
}

/**
 * Helper: derive `targetLane` from a cue domain object. For
 * `create_cue` the cue doesn't exist yet — caller should pass the
 * lane proposed in the patch via the `RiskClassifierInput.targetLane`
 * directly.
 */
export function readLaneFromCue(
  cue: PublicDiscussionCueDomain | null | undefined,
): CueLane {
  return cue?.lane ?? 'standard'
}
