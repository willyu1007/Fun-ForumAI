/**
 * T-214 A-M2 — `AutoCueEditor`.
 *
 * Pipeline orchestrator that:
 *   1. Builds the structured prompt input from `(trigger, gate, schedule
 *      summary, media candidates, target cue if any)`.
 *   2. Calls a thin `AutoCueEditorLlmClient.generateJson(...)` (in
 *      production this wraps `LLMGateway.generateHiddenArtifact` with
 *      `responseMode: 'json_object'`; in tests, callers pass a mock).
 *   3. Parses + validates the JSON via `AutoCueEditorValidator`.
 *   4. On validator failure, retries with reduced temperature up to
 *      `maxRetries` (default 2) before giving up.
 *   5. Reconciles the LLM-reported risk with the deterministic
 *      classifier baseline; the inbox row carries the max.
 *
 * The editor never writes a CueChange itself — that's the scheduler's
 * job once it has the validated output. The editor is pure:
 * `(input) → result` with no side effects beyond the LLM call. This
 * keeps testing tractable and the orchestration loop pluggable.
 */

import type { CueChangeType } from '../../repos/cue-repository.js'
import type {
  PublicDiscussionCueDomain,
} from '../cue/types.js'
import {
  AutoCueEditorValidator,
  type AutoCueEditorValidationContext,
  type AutoCueEditorValidationFailure,
} from './auto-cue-editor-validator.js'
import {
  chooseFinalRisk,
  classifyRisk,
  readLaneFromCue,
  type RiskClassification,
} from './risk-classifier.js'
import type {
  AutoCueEditorOutput,
  AutoEditorTriggerEventDomain,
  LoadGateDecision,
} from './types.js'

/**
 * Thin abstraction over the production LLM call. The default container
 * binding wraps `LLMGateway.generateHiddenArtifact` with
 * `responseMode: 'json_object'` and the registered `cue-auto-editor`
 * prompt template; tests pass a mock that returns a canned JSON
 * string so the editor's orchestration logic can be exercised
 * deterministically.
 */
export interface AutoCueEditorLlmClient {
  /**
   * Generate a JSON-mode response for the given structured prompt.
   * `temperatureBias` is hint, not requirement: `negative` means
   * "be more conservative on retry"; the gateway implementation
   * may downshift the actual model temperature accordingly.
   * Returns the raw response string; the editor parses + validates.
   */
  generateJson(input: {
    promptInput: AutoCueEditorPromptInput
    temperatureBias: 'normal' | 'negative'
    traceId: string
  }): Promise<{ rawJson: string }>
}

export interface AutoCueEditorMediaCandidate {
  asset_id: string
  /** Editor-facing label so the LLM can reason about the asset semantically. */
  label: string
  role: string
}

export interface AutoCueEditorPromptInput {
  trigger: {
    id: string
    type: AutoEditorTriggerEventDomain['trigger_type']
    severity: AutoEditorTriggerEventDomain['severity']
    community_id: string | null
    evidence: AutoEditorTriggerEventDomain['evidence']
  }
  gate: {
    load_state: LoadGateDecision['load_state']
    allowed_actions: ReadonlyArray<CueChangeType>
    propose_only: boolean
    reason_code: LoadGateDecision['reason_code']
  }
  /** Optional reference to the cue being edited (null for create_cue). */
  target_cue?: {
    id: string
    lane: PublicDiscussionCueDomain['lane']
    status: PublicDiscussionCueDomain['status']
    locked_fields: ReadonlyArray<string>
  } | null
  /** Pre-filtered candidates the editor may reference. */
  media_candidates: ReadonlyArray<AutoCueEditorMediaCandidate>
}

export interface AutoCueEditorRunInput {
  trigger: AutoEditorTriggerEventDomain
  gate: LoadGateDecision
  /** Cue being edited (omit / null for `create_cue`). */
  targetCue?: PublicDiscussionCueDomain | null
  /** Pre-filtered media candidates. Empty array means "no media available". */
  mediaCandidates: ReadonlyArray<AutoCueEditorMediaCandidate>
  /** Whether the trigger's wall-clock falls in prime hours. */
  inPrimeWindow: boolean
  /**
   * Caller passes a stable trace id so retries are correlated. When
   * omitted, the editor composes one from `(trigger.id)`.
   */
  traceId?: string
}

export type AutoCueEditorRunResult =
  | {
      ok: true
      output: AutoCueEditorOutput
      risk: RiskClassification
      attempts: number
    }
  | {
      ok: false
      reason: 'validator_failed' | 'short_circuit' | 'no_action'
      failures?: AutoCueEditorValidationFailure[]
      attempts: number
    }

export interface AutoCueEditorConfig {
  maxRetries?: number
}

const DEFAULT_MAX_RETRIES = 2

export class AutoCueEditor {
  private readonly validator: AutoCueEditorValidator
  private readonly maxRetries: number

  constructor(
    private readonly deps: { llmClient: AutoCueEditorLlmClient },
    config: AutoCueEditorConfig = {},
  ) {
    this.validator = new AutoCueEditorValidator()
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES
  }

  async run(input: AutoCueEditorRunInput): Promise<AutoCueEditorRunResult> {
    // Short-circuit: the gate has already declared no action is allowed.
    if (input.gate.short_circuit) {
      return { ok: false, reason: 'short_circuit', attempts: 0 }
    }
    if (input.gate.allowed_actions.length === 0) {
      return { ok: false, reason: 'no_action', attempts: 0 }
    }

    const promptInput = buildPromptInput(input)
    const context: AutoCueEditorValidationContext = {
      authorizedMediaAssetIds: input.mediaCandidates.map((m) => m.asset_id),
      allowedActions: input.gate.allowed_actions,
      lockedFields: input.targetCue?.locked_fields ?? [],
    }
    const traceId = input.traceId ?? `auto-cue-editor:${input.trigger.id}`

    let attempts = 0
    let lastFailures: AutoCueEditorValidationFailure[] = []

    for (let i = 0; i <= this.maxRetries; i += 1) {
      attempts += 1
      const bias = i === 0 ? 'normal' : 'negative'
      const { rawJson } = await this.deps.llmClient.generateJson({
        promptInput,
        temperatureBias: bias,
        traceId: i === 0 ? traceId : `${traceId}:retry:${i}`,
      })

      let parsed: unknown
      try {
        parsed = JSON.parse(rawJson)
      } catch (err) {
        lastFailures = [{
          code: 'off_schema',
          message: `JSON.parse failed: ${(err as Error).message}`,
        }]
        continue
      }

      const validation = this.validator.validate(parsed, context)
      if (validation.ok) {
        const baseline = classifyRisk({
          action: validation.output.action,
          targetLane:
            validation.output.action === 'create_cue'
              ? readLaneInPatch(validation.output) ?? 'standard'
              : readLaneFromCue(input.targetCue),
          inPrimeWindow: input.inPrimeWindow,
          proposeOnly: input.gate.propose_only,
        })
        const risk = chooseFinalRisk({
          classifier: baseline,
          llmReported: validation.output.risk_level,
        })
        return { ok: true, output: validation.output, risk, attempts }
      }
      lastFailures = validation.failures
    }

    return {
      ok: false,
      reason: 'validator_failed',
      failures: lastFailures,
      attempts,
    }
  }
}

function buildPromptInput(input: AutoCueEditorRunInput): AutoCueEditorPromptInput {
  return {
    trigger: {
      id: input.trigger.id,
      type: input.trigger.trigger_type,
      severity: input.trigger.severity,
      community_id: input.trigger.community_id,
      evidence: input.trigger.evidence,
    },
    gate: {
      load_state: input.gate.load_state,
      allowed_actions: input.gate.allowed_actions,
      propose_only: input.gate.propose_only,
      reason_code: input.gate.reason_code,
    },
    target_cue: input.targetCue
      ? {
          id: input.targetCue.id,
          lane: input.targetCue.lane,
          status: input.targetCue.status,
          locked_fields: input.targetCue.locked_fields,
        }
      : null,
    media_candidates: input.mediaCandidates,
  }
}

function readLaneInPatch(
  output: AutoCueEditorOutput,
): PublicDiscussionCueDomain['lane'] | undefined {
  const partial = (output.patch_json as { partial?: { lane?: unknown } } | null)
    ?.partial
  const lane = partial?.lane
  if (lane === 'prime' || lane === 'standard' || lane === 'background') return lane
  return undefined
}
