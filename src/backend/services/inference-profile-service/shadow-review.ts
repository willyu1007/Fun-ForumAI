import type { UsageLedgerEntry } from '../../llm/gateway-contract.js'
import { collectFallbackOrDegradedEntries } from '../../runtime/rollout-evidence-collector.js'
import type {
  AgentInferenceProfile,
  InferenceProfileSnapshot,
  ShadowCompareDimensionResult,
  ShadowReviewEvidence,
  ShadowReviewRecommendation,
  ShadowReviewSummary,
} from '../../runtime/inference-profile-types.js'
import {
  PERSONA_BLIND_REVIEW_RUBRIC,
  PERSONA_RENDER_LOG_REQUIRED_FIELDS,
  PERSONA_REPLAY_EVAL_SLICES,
  createEmptyContextMemoryMetrics,
  evaluatePersonaRolloutGates,
  type PersonaObservabilitySnapshot,
} from '../../runtime/persona-observability.js'
import type { PersonaGateSnapshotV1 } from '../../runtime/persona-observation.js'
import { buildIdentityWriteDelta } from './codec.js'

export function buildRunningShadowReviewSummary(): ShadowReviewSummary {
  return {
    recommendation: 'hold',
    reasons: ['waiting_for_shadow_evidence_window'],
    compareDimensions: [],
  }
}

export function buildRunningShadowReviewEvidence(
  baseline: PersonaObservabilitySnapshot,
): ShadowReviewEvidence {
  return {
    beforeObservability: baseline,
    afterObservability: baseline,
    identityWriteDelta: buildIdentityWriteDelta(baseline, baseline),
    costAttribution: {},
    gate: buildNotRunGateSnapshot(),
    window: {
      visibleSuccessCount: 0,
      visibleFailureCount: 0,
      hiddenSuccessCount: 0,
      hiddenFailureCount: 0,
      fallbackCount: 0,
      sampleWindowMinutes: 0,
    },
    fallbackEntries: [],
  }
}

export function buildAgentScopedObservabilitySnapshot(
  entries: UsageLedgerEntry[],
): PersonaObservabilitySnapshot {
  const contextMemory = createEmptyContextMemoryMetrics()
  const sortedEntries = [...entries].sort((a, b) => a.created_at.localeCompare(b.created_at))

  for (const entry of sortedEntries) {
    if (entry.intent === 'identity_write' || entry.visibility === 'identity_write') {
      if (entry.success) {
        contextMemory.identity_writes.success_total += 1
      } else {
        contextMemory.identity_writes.failure_total += 1
      }
      contextMemory.updated_at = entry.created_at
    }
  }

  return {
    render_log: {
      required_fields: PERSONA_RENDER_LOG_REQUIRED_FIELDS,
    },
    evaluation: {
      blind_review_rubric: PERSONA_BLIND_REVIEW_RUBRIC,
      replay_slices: PERSONA_REPLAY_EVAL_SLICES,
    },
    context_memory: contextMemory,
    rollout_gates: evaluatePersonaRolloutGates(contextMemory),
  }
}

export function buildNotRunGateSnapshot(): PersonaGateSnapshotV1 {
  return {
    version: 'persona-gate-snapshot-v1',
    generated_at: new Date().toISOString(),
    overall_status: 'not_run',
    gating_basis: 'persona-eval-v1',
    results: [],
  }
}

export function summarizeWindow(entries: UsageLedgerEntry[], startedAt: Date) {
  const windowEntries = entries.filter((entry) => new Date(entry.created_at) >= startedAt)
  const visibleSuccessCount = windowEntries.filter(
    (entry) => entry.visibility === 'visible' && entry.success,
  ).length
  const visibleFailureCount = windowEntries.filter(
    (entry) => entry.visibility === 'visible' && !entry.success,
  ).length
  const hiddenSuccessCount = windowEntries.filter(
    (entry) => entry.visibility !== 'visible' && entry.success,
  ).length
  const hiddenFailureCount = windowEntries.filter(
    (entry) => entry.visibility !== 'visible' && !entry.success,
  ).length
  const fallbackCount = collectFallbackOrDegradedEntries(windowEntries).length
  return {
    visibleSuccessCount,
    visibleFailureCount,
    hiddenSuccessCount,
    hiddenFailureCount,
    fallbackCount,
    sampleWindowMinutes: round2(Math.max(0, Date.now() - startedAt.getTime()) / (60 * 1000)),
  }
}

export function buildShadowCompareDimensions(input: {
  profile: AgentInferenceProfile
  snapshot: InferenceProfileSnapshot
  identityWriteDelta: ReturnType<typeof buildIdentityWriteDelta>
  gate: ReturnType<typeof buildNotRunGateSnapshot>
  window: ReturnType<typeof summarizeWindow>
}): ShadowCompareDimensionResult[] {
  const visibleSamples = input.window.visibleSuccessCount + input.window.visibleFailureCount
  const failureRate = visibleSamples > 0 ? input.window.visibleFailureCount / visibleSamples : 1
  const fallbackRate = visibleSamples > 0 ? input.window.fallbackCount / visibleSamples : 1
  const identitySuccessDelta =
    input.identityWriteDelta.after_success_total - input.identityWriteDelta.before_success_total
  const identityFailureDelta =
    input.identityWriteDelta.after_failure_total - input.identityWriteDelta.before_failure_total

  const personaLockScore = clampAxis(
    45 +
      (input.profile.migrationState === 'shadow' ? 20 : -25) +
      Math.min(18, input.profile.consecutiveLeadWindows * 3) +
      Math.min(12, Math.max(input.profile.challengerScoreDelta ?? 0, 0)) -
      0.2 * input.snapshot.signals.risk -
      fallbackRate * 22,
  )
  const emotionalContinuityScore = clampAxis(
    20 +
      0.45 * input.snapshot.axes.composure +
      0.15 * input.snapshot.axes.warmth +
      0.1 * input.snapshot.axes.depth -
      0.25 * input.snapshot.signals.risk -
      failureRate * 25 -
      Math.max(0, identityFailureDelta) * 5,
  )
  const watchabilityScore = clampAxis(
    45 +
      0.2 * input.snapshot.signals.initiative +
      (input.snapshot.stageEligible ? 12 : 0) +
      Math.min(18, input.window.visibleSuccessCount * 4) -
      fallbackRate * 22 -
      failureRate * 18,
  )
  const callbackFidelityScore = clampAxis(
    60 +
      Math.min(18, Math.max(identitySuccessDelta, 0) * 6) -
      Math.max(0, identityFailureDelta) * 8 -
      failureRate * 20 -
      (input.gate.overall_status === 'pass' ? 0 : 10),
  )

  return [
    toCompareDimensionResult(
      'persona_lock',
      personaLockScore,
      `lead=${input.profile.consecutiveLeadWindows}, delta=${input.profile.challengerScoreDelta ?? 0}, risk=${round2(input.snapshot.signals.risk)}`,
    ),
    toCompareDimensionResult(
      'emotional_continuity',
      emotionalContinuityScore,
      `composure=${round2(input.snapshot.axes.composure)}, visible_failure_rate=${round2(failureRate * 100)}%`,
    ),
    toCompareDimensionResult(
      'watchability',
      watchabilityScore,
      `visible_success=${input.window.visibleSuccessCount}, stage=${input.snapshot.stageEligible ? 'yes' : 'no'}, initiative=${round2(input.snapshot.signals.initiative)}`,
    ),
    toCompareDimensionResult(
      'callback_fidelity',
      callbackFidelityScore,
      `identity_success_delta=${identitySuccessDelta}, identity_failure_delta=${identityFailureDelta}, gate=${input.gate.overall_status}`,
    ),
  ]
}

export function buildCollectedShadowReviewSummary(
  compareDimensions: ShadowCompareDimensionResult[],
  window: ReturnType<typeof summarizeWindow>,
): ShadowReviewSummary {
  const failCount = compareDimensions.filter((item) => item.status === 'fail').length
  const reasons: string[] = []

  let recommendation: ShadowReviewRecommendation
  if (failCount > 0) {
    recommendation = 'reject'
    reasons.push('one_or_more_compare_dimensions_failed')
  } else if (window.visibleSuccessCount < 3) {
    recommendation = 'hold'
    reasons.push('insufficient_visible_evidence_for_reanchor')
  } else {
    recommendation = 'approve'
    reasons.push('shadow_compare_dimensions_met')
  }

  if (window.fallbackCount > 0) {
    reasons.push('fallback_observed_in_window')
  }

  return {
    recommendation,
    reasons,
    compareDimensions,
  }
}

export function toShadowReviewFallbackEntry(entry: UsageLedgerEntry) {
  return {
    created_at: entry.created_at,
    intent: entry.intent,
    visibility: entry.visibility,
    fallback_level: entry.render_decision.fallbackLevel,
    provider_id: entry.provider_id ?? null,
    model_id: entry.model_id ?? null,
    success: entry.success,
    error_code: entry.error_code ?? null,
  }
}

export function serializeShadowReviewSummary(value: ShadowReviewSummary): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>
}

export function serializeShadowReviewEvidence(
  value: ShadowReviewEvidence,
): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>
}

function toCompareDimensionResult(
  dimension: ShadowCompareDimensionResult['dimension'],
  score: number,
  summary: string,
): ShadowCompareDimensionResult {
  return {
    dimension,
    score: round2(score),
    status: score >= 70 ? 'pass' : score >= 55 ? 'warn' : 'fail',
    summary,
  }
}

function clampAxis(value: number): number {
  return round2(clamp(value, 0, 100))
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}
