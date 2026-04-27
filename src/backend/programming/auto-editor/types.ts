/**
 * T-214 cue-auto-editor — shared types.
 *
 * The auto-editor pipeline is `TriggerDetector → LoadGate → AutoCueEditor →
 * RiskClassifier → AutoPatchInbox`. The deterministic prefix, LLM call,
 * validator, risk classifier, and admin routes are all part of the closed
 * T-214 surface.
 *
 * `TriggerEvent` is the persistence-friendly handoff record. The gate
 * decision and editor output ride alongside it as derived fields rather
 * than as additional event records (one trigger → one gate output → at
 * most one editor output).
 */

import type { CueChangeType } from '../../repos/cue-repository.js'
import type { LoadState } from '../load/types.js'

/**
 * Trigger taxonomy (overview §29). Additive: new entries may land in later
 * auto-editor milestones
 * without breaking existing schemas. Detector code MUST switch
 * exhaustively over this union — adding a member is intentionally a
 * compile error in the detector to force a per-trigger handler.
 */
export type AutoEditorTriggerType =
  | 'COMMUNITY_LULL'
  | 'SUPPLY_FLOOR_GAP'
  | 'EVENING_DISCUSSION_GAP'
  | 'FATIGUE_HIGH'
  | 'MEDIA_OPPORTUNITY'
  | 'GLOBAL_RUNTIME_IDLE'

export type AutoEditorTriggerSeverity = 'low' | 'standard' | 'high'

export type AutoEditorTriggerSource = 'scan' | 'event'

export interface AutoEditorTriggerEvidence {
  /** Free-form structured evidence; detector sets shape per trigger type. */
  [key: string]: unknown
}

/**
 * Persisted trigger event row. `id` and `created_at` come from the repo;
 * the detector composes the rest.
 */
export interface AutoEditorTriggerEventDomain {
  id: string
  community_id: string | null
  trigger_type: AutoEditorTriggerType
  severity: AutoEditorTriggerSeverity
  source: AutoEditorTriggerSource
  evidence: AutoEditorTriggerEvidence
  /**
   * Stable key used to suppress duplicate emissions inside a window.
   * Detector composes this from `(trigger_type, community_id, window_id)`
   * so multiple ticks within the same window resolve to a single row.
   */
  dedup_key: string
  detected_at: Date
  created_at: Date
}

export interface RecordAutoEditorTriggerEventInput {
  community_id?: string | null
  trigger_type: AutoEditorTriggerType
  severity: AutoEditorTriggerSeverity
  source: AutoEditorTriggerSource
  evidence: AutoEditorTriggerEvidence
  dedup_key: string
  detected_at?: Date
}

/**
 * Output of the `LoadGate.evaluate()` decision. Mirrors the
 * `AutoEditorAllowedActions` SSOT row plus the load context that the
 * downstream LLM call needs to reason. Always synchronous — gate is
 * purely deterministic.
 */
export interface LoadGateDecision {
  load_state: LoadState
  load_signal_source: string
  community_id: string | null
  allowed_actions: ReadonlyArray<CueChangeType>
  propose_only: boolean
  /**
   * True iff `allowed_actions` is empty AND `propose_only` is true. The
   * detector + scheduler short-circuit the LLM call entirely in this case
   * (load is critical, no shape is admissible).
   */
  short_circuit: boolean
  /**
   * Human-readable reason for observability. Stable values so
   * dashboards can group / count without parsing free text.
   */
  reason_code:
    | 'green_full_surface'
    | 'yellow_triage_only'
    | 'red_propose_only'
    | 'red_short_circuit'
}

/**
 * Risk envelope pinned at output of the AutoCueEditor LLM call (M2).
 * Defined here so M1 components can already type the future contract.
 */
export type AutoEditorRiskLevel = 'low' | 'standard' | 'high'

/**
 * AutoCueEditor structured output (M2). Defined here so the validator
 * (M2) and inbox routes (M3) share one source of truth.
 */
export interface AutoCueEditorOutput {
  action: CueChangeType
  reason: string
  risk_level: AutoEditorRiskLevel
  target_cue_id?: string | null
  patch_json: unknown
  confidence: number
  requires_review: boolean
}
