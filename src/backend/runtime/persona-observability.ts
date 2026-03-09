import type { UsageLedgerEntry } from '../llm/gateway-contract.js'

export const PERSONA_RENDER_LOG_REQUIRED_FIELDS = [
  'trace_id',
  'agent_id',
  'intent',
  'visibility',
  'scene',
  'prompt_ref.id',
  'prompt_ref.version',
  'render_decision.voiceLineId',
  'render_decision.tier',
  'render_decision.profileId',
  'render_decision.providerId',
  'render_decision.modelId',
  'render_decision.promptTemplateId',
  'render_decision.promptVersion',
  'render_decision.reasons',
  'billing_class',
  'latency_ms',
  'success',
] as const

export const PERSONA_BLIND_REVIEW_RUBRIC = [
  'persona_consistency',
  'group_distinctiveness',
  'overlay_naturalness',
  'nurture_perceptibility',
  'fallback_frequency',
  'latency_cost_headroom',
] as const

export const PERSONA_REPLAY_EVAL_SLICES = [
  'same_agent_cross_scene',
  'pre_post_private_chat_public_behavior',
  'same_seed_cross_line',
  'fallback_and_degraded_routes',
] as const

export interface PersonaRolloutGate {
  id:
    | 'typed_write_success'
    | 'identity_write_success'
    | 'public_typed_read_path'
    | 'legacy_dependency'
    | 'nightly_compaction'
  label: string
  status: 'pass' | 'warn' | 'block'
  reason: string
  sample_size: number
  metric_value: number | null
  threshold: string
}

export interface PersonaObservabilitySnapshot {
  render_log: {
    required_fields: readonly string[]
  }
  evaluation: {
    blind_review_rubric: readonly string[]
    replay_slices: readonly string[]
  }
  context_memory: {
    public_ingress: {
      forum_total: number
      chat_room_total: number
    }
    typed_writes: {
      success_total: number
      failure_total: number
    }
    identity_writes: {
      success_total: number
      failure_total: number
    }
    retrieval: {
      total: number
      public_typed_hits: number
      public_legacy_hits: number
      legacy_fallback_total: number
    }
    migration: {
      public_dedup_legacy_fallbacks: number
      public_cooldown_legacy_fallbacks: number
      public_dual_write_total: number
    }
    nightly_compaction: {
      runs_total: number
      created_total: number
      dedup_hits_total: number
      failure_total: number
    }
    updated_at: string
  }
  rollout_gates: PersonaRolloutGate[]
}

class PersonaObservability {
  private readonly snapshotState: PersonaObservabilitySnapshot = {
    render_log: {
      required_fields: PERSONA_RENDER_LOG_REQUIRED_FIELDS,
    },
    evaluation: {
      blind_review_rubric: PERSONA_BLIND_REVIEW_RUBRIC,
      replay_slices: PERSONA_REPLAY_EVAL_SLICES,
    },
    context_memory: {
      public_ingress: {
        forum_total: 0,
        chat_room_total: 0,
      },
      typed_writes: {
        success_total: 0,
        failure_total: 0,
      },
      identity_writes: {
        success_total: 0,
        failure_total: 0,
      },
      retrieval: {
        total: 0,
        public_typed_hits: 0,
        public_legacy_hits: 0,
        legacy_fallback_total: 0,
      },
      migration: {
        public_dedup_legacy_fallbacks: 0,
        public_cooldown_legacy_fallbacks: 0,
        public_dual_write_total: 0,
      },
      nightly_compaction: {
        runs_total: 0,
        created_total: 0,
        dedup_hits_total: 0,
        failure_total: 0,
      },
      updated_at: new Date(0).toISOString(),
    },
    rollout_gates: [],
  }

  recordPublicIngress(scene: 'forum' | 'chat_room'): void {
    if (scene === 'forum') {
      this.snapshotState.context_memory.public_ingress.forum_total += 1
    } else {
      this.snapshotState.context_memory.public_ingress.chat_room_total += 1
    }
    this.touch()
  }

  recordTypedWrite(success: boolean): void {
    if (success) {
      this.snapshotState.context_memory.typed_writes.success_total += 1
    } else {
      this.snapshotState.context_memory.typed_writes.failure_total += 1
    }
    this.touch()
  }

  recordIdentityWrite(success: boolean): void {
    if (success) {
      this.snapshotState.context_memory.identity_writes.success_total += 1
    } else {
      this.snapshotState.context_memory.identity_writes.failure_total += 1
    }
    this.touch()
  }

  recordRetrieval(input: {
    publicObservationSource: 'typed' | 'legacy' | 'empty'
    usedLegacyFallback: boolean
  }): void {
    this.snapshotState.context_memory.retrieval.total += 1
    if (input.publicObservationSource === 'typed') {
      this.snapshotState.context_memory.retrieval.public_typed_hits += 1
    } else if (input.publicObservationSource === 'legacy') {
      this.snapshotState.context_memory.retrieval.public_legacy_hits += 1
    }
    if (input.usedLegacyFallback) {
      this.snapshotState.context_memory.retrieval.legacy_fallback_total += 1
    }
    this.touch()
  }

  recordLegacyMigrationFallback(kind: 'public_dedup' | 'public_cooldown'): void {
    if (kind === 'public_dedup') {
      this.snapshotState.context_memory.migration.public_dedup_legacy_fallbacks += 1
    } else {
      this.snapshotState.context_memory.migration.public_cooldown_legacy_fallbacks += 1
    }
    this.touch()
  }

  recordLegacyPublicDualWrite(): void {
    this.snapshotState.context_memory.migration.public_dual_write_total += 1
    this.touch()
  }

  recordNightlyCompaction(input: {
    created: boolean
    dedupHit: boolean
    failed: boolean
  }): void {
    this.snapshotState.context_memory.nightly_compaction.runs_total += 1
    if (input.created) {
      this.snapshotState.context_memory.nightly_compaction.created_total += 1
    }
    if (input.dedupHit) {
      this.snapshotState.context_memory.nightly_compaction.dedup_hits_total += 1
    }
    if (input.failed) {
      this.snapshotState.context_memory.nightly_compaction.failure_total += 1
    }
    this.touch()
  }

  snapshot(): PersonaObservabilitySnapshot {
    const cloned = JSON.parse(JSON.stringify(this.snapshotState)) as PersonaObservabilitySnapshot
    cloned.rollout_gates = evaluatePersonaRolloutGates(cloned.context_memory)
    return cloned
  }

  latestRenderLog(entries: UsageLedgerEntry[], limit = 20): UsageLedgerEntry[] {
    if (limit <= 0) return []
    return [...entries]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .slice(-limit)
  }

  reset(): void {
    this.snapshotState.context_memory.public_ingress.forum_total = 0
    this.snapshotState.context_memory.public_ingress.chat_room_total = 0
    this.snapshotState.context_memory.typed_writes.success_total = 0
    this.snapshotState.context_memory.typed_writes.failure_total = 0
    this.snapshotState.context_memory.identity_writes.success_total = 0
    this.snapshotState.context_memory.identity_writes.failure_total = 0
    this.snapshotState.context_memory.retrieval.total = 0
    this.snapshotState.context_memory.retrieval.public_typed_hits = 0
    this.snapshotState.context_memory.retrieval.public_legacy_hits = 0
    this.snapshotState.context_memory.retrieval.legacy_fallback_total = 0
    this.snapshotState.context_memory.migration.public_dedup_legacy_fallbacks = 0
    this.snapshotState.context_memory.migration.public_cooldown_legacy_fallbacks = 0
    this.snapshotState.context_memory.migration.public_dual_write_total = 0
    this.snapshotState.context_memory.nightly_compaction.runs_total = 0
    this.snapshotState.context_memory.nightly_compaction.created_total = 0
    this.snapshotState.context_memory.nightly_compaction.dedup_hits_total = 0
    this.snapshotState.context_memory.nightly_compaction.failure_total = 0
    this.snapshotState.context_memory.updated_at = new Date(0).toISOString()
    this.snapshotState.rollout_gates = []
  }

  private touch(): void {
    this.snapshotState.context_memory.updated_at = new Date().toISOString()
  }
}

export function evaluatePersonaRolloutGates(
  metrics: PersonaObservabilitySnapshot['context_memory'],
): PersonaRolloutGate[] {
  const typedWriteTotal = metrics.typed_writes.success_total + metrics.typed_writes.failure_total
  const typedWriteSuccessRate = ratio(metrics.typed_writes.success_total, typedWriteTotal)
  const identityWriteTotal = metrics.identity_writes.success_total + metrics.identity_writes.failure_total
  const identityWriteSuccessRate = ratio(metrics.identity_writes.success_total, identityWriteTotal)
  const publicReadTotal = metrics.retrieval.public_typed_hits + metrics.retrieval.public_legacy_hits
  const publicTypedHitRate = ratio(metrics.retrieval.public_typed_hits, publicReadTotal)
  const legacyDependencyChecks = metrics.retrieval.total +
    metrics.migration.public_dedup_legacy_fallbacks +
    metrics.migration.public_cooldown_legacy_fallbacks
  const legacyDependencyRate = ratio(
    metrics.retrieval.legacy_fallback_total +
      metrics.migration.public_dedup_legacy_fallbacks +
      metrics.migration.public_cooldown_legacy_fallbacks,
    legacyDependencyChecks,
  )
  const nightlyRuns = metrics.nightly_compaction.runs_total
  const nightlyFailureRate = ratio(metrics.nightly_compaction.failure_total, nightlyRuns)

  return [
    rateGate({
      id: 'typed_write_success',
      label: 'Typed Write Success',
      sampleSize: typedWriteTotal,
      metricValue: typedWriteSuccessRate,
      passAt: 0.98,
      warnAt: 0.95,
      threshold: '>= 98% success',
      emptyReason: 'No typed write samples yet.',
    }),
    rateGate({
      id: 'identity_write_success',
      label: 'Identity Write Success',
      sampleSize: identityWriteTotal,
      metricValue: identityWriteSuccessRate,
      passAt: 0.98,
      warnAt: 0.95,
      threshold: '>= 98% success',
      emptyReason: 'No identity-write samples yet.',
    }),
    rateGate({
      id: 'public_typed_read_path',
      label: 'Public Typed Read Path',
      sampleSize: publicReadTotal,
      metricValue: publicTypedHitRate,
      passAt: 0.95,
      warnAt: 0.8,
      threshold: '>= 95% typed public slot hits',
      emptyReason: 'No public retrieval samples yet.',
    }),
    inverseRateGate({
      id: 'legacy_dependency',
      label: 'Legacy Dependency Rate',
      sampleSize: legacyDependencyChecks,
      metricValue: legacyDependencyRate,
      passAtOrBelow: 0.05,
      warnAtOrBelow: 0.1,
      threshold: '<= 5% legacy fallback usage',
      emptyReason: 'No migration-dependency samples yet.',
    }),
    inverseRateGate({
      id: 'nightly_compaction',
      label: 'Nightly Compaction Stability',
      sampleSize: nightlyRuns,
      metricValue: nightlyFailureRate,
      passAtOrBelow: 0,
      warnAtOrBelow: 0.02,
      threshold: '0% compaction failures',
      emptyReason: 'No nightly compaction samples yet.',
    }),
  ]
}

function rateGate(input: {
  id: PersonaRolloutGate['id']
  label: string
  sampleSize: number
  metricValue: number | null
  passAt: number
  warnAt: number
  threshold: string
  emptyReason: string
}): PersonaRolloutGate {
  if (input.sampleSize === 0 || input.metricValue === null) {
    return {
      id: input.id,
      label: input.label,
      status: 'warn',
      reason: input.emptyReason,
      sample_size: input.sampleSize,
      metric_value: null,
      threshold: input.threshold,
    }
  }
  if (input.metricValue >= input.passAt) {
    return {
      id: input.id,
      label: input.label,
      status: 'pass',
      reason: `${formatPercent(input.metricValue)} meets ${input.threshold}.`,
      sample_size: input.sampleSize,
      metric_value: input.metricValue,
      threshold: input.threshold,
    }
  }
  if (input.metricValue >= input.warnAt) {
    return {
      id: input.id,
      label: input.label,
      status: 'warn',
      reason: `${formatPercent(input.metricValue)} is below ${input.threshold} but above the rollback floor.`,
      sample_size: input.sampleSize,
      metric_value: input.metricValue,
      threshold: input.threshold,
    }
  }
  return {
    id: input.id,
    label: input.label,
    status: 'block',
    reason: `${formatPercent(input.metricValue)} violates ${input.threshold}.`,
    sample_size: input.sampleSize,
    metric_value: input.metricValue,
    threshold: input.threshold,
  }
}

function inverseRateGate(input: {
  id: PersonaRolloutGate['id']
  label: string
  sampleSize: number
  metricValue: number | null
  passAtOrBelow: number
  warnAtOrBelow: number
  threshold: string
  emptyReason: string
}): PersonaRolloutGate {
  if (input.sampleSize === 0 || input.metricValue === null) {
    return {
      id: input.id,
      label: input.label,
      status: 'warn',
      reason: input.emptyReason,
      sample_size: input.sampleSize,
      metric_value: null,
      threshold: input.threshold,
    }
  }
  if (input.metricValue <= input.passAtOrBelow) {
    return {
      id: input.id,
      label: input.label,
      status: 'pass',
      reason: `${formatPercent(input.metricValue)} is within ${input.threshold}.`,
      sample_size: input.sampleSize,
      metric_value: input.metricValue,
      threshold: input.threshold,
    }
  }
  if (input.metricValue <= input.warnAtOrBelow) {
    return {
      id: input.id,
      label: input.label,
      status: 'warn',
      reason: `${formatPercent(input.metricValue)} is above ${input.threshold} but below the rollback floor.`,
      sample_size: input.sampleSize,
      metric_value: input.metricValue,
      threshold: input.threshold,
    }
  }
  return {
    id: input.id,
    label: input.label,
    status: 'block',
    reason: `${formatPercent(input.metricValue)} violates ${input.threshold}.`,
    sample_size: input.sampleSize,
    metric_value: input.metricValue,
    threshold: input.threshold,
  }
}

function ratio(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null
  return numerator / denominator
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

export const personaObservability = new PersonaObservability()
