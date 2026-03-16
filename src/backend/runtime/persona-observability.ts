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
    }
    migration: {
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

export interface PersonaObservabilityMetricDelta {
  publicIngressForumTotal?: number
  publicIngressChatRoomTotal?: number
  typedWriteSuccessTotal?: number
  typedWriteFailureTotal?: number
  identityWriteSuccessTotal?: number
  identityWriteFailureTotal?: number
  retrievalTotal?: number
  retrievalPublicTypedHits?: number
  migrationPublicDualWriteTotal?: number
  nightlyCompactionRunsTotal?: number
  nightlyCompactionCreatedTotal?: number
  nightlyCompactionDedupHitsTotal?: number
  nightlyCompactionFailureTotal?: number
}

export interface PersonaObservabilityRepository {
  increment(delta: PersonaObservabilityMetricDelta): Promise<void>
  snapshot(): Promise<PersonaObservabilitySnapshot['context_memory']>
  reset(): Promise<void>
}

class PersonaObservability {
  private readonly snapshotState: PersonaObservabilitySnapshot = createBaseSnapshot()
  private repo: PersonaObservabilityRepository | null = null

  setRepository(repo: PersonaObservabilityRepository | null): void {
    this.repo = repo
  }

  recordPublicIngress(scene: 'forum' | 'chat_room'): void {
    this.recordDelta(scene === 'forum'
      ? { publicIngressForumTotal: 1 }
      : { publicIngressChatRoomTotal: 1 })
  }

  recordTypedWrite(success: boolean): void {
    this.recordDelta(success
      ? { typedWriteSuccessTotal: 1 }
      : { typedWriteFailureTotal: 1 })
  }

  recordIdentityWrite(success: boolean): void {
    this.recordDelta(success
      ? { identityWriteSuccessTotal: 1 }
      : { identityWriteFailureTotal: 1 })
  }

  recordRetrieval(input: {
    publicObservationSource: 'typed' | 'empty'
  }): void {
    this.recordDelta({
      retrievalTotal: 1,
      retrievalPublicTypedHits: input.publicObservationSource === 'typed' ? 1 : 0,
    })
  }

  recordLegacyPublicDualWrite(): void {
    this.recordDelta({ migrationPublicDualWriteTotal: 1 })
  }

  recordNightlyCompaction(input: {
    created: boolean
    dedupHit: boolean
    failed: boolean
  }): void {
    this.recordDelta({
      nightlyCompactionRunsTotal: 1,
      nightlyCompactionCreatedTotal: input.created ? 1 : 0,
      nightlyCompactionDedupHitsTotal: input.dedupHit ? 1 : 0,
      nightlyCompactionFailureTotal: input.failed ? 1 : 0,
    })
  }

  snapshot(): PersonaObservabilitySnapshot {
    return cloneSnapshot(this.snapshotState)
  }

  async snapshotAggregated(): Promise<PersonaObservabilitySnapshot> {
    if (!this.repo) {
      return this.snapshot()
    }

    const snapshot = createBaseSnapshot()
    snapshot.context_memory = await this.repo.snapshot()
    snapshot.rollout_gates = evaluatePersonaRolloutGates(snapshot.context_memory)
    return snapshot
  }

  async resetAggregated(): Promise<void> {
    this.reset()
    if (!this.repo) return
    await this.repo.reset()
  }

  latestRenderLog(entries: UsageLedgerEntry[], limit = 20): UsageLedgerEntry[] {
    if (limit <= 0) return []
    return [...entries]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .slice(-limit)
  }

  reset(): void {
    this.snapshotState.context_memory = createEmptyContextMemoryMetrics()
    this.snapshotState.rollout_gates = []
  }

  private recordDelta(delta: PersonaObservabilityMetricDelta): void {
    applyDelta(this.snapshotState.context_memory, delta)
    this.snapshotState.rollout_gates = evaluatePersonaRolloutGates(this.snapshotState.context_memory)
    if (!this.repo) return

    this.repo.increment(delta).catch((err) => {
      console.error('[PersonaObservability] persist failed:', err)
    })
  }
}

function createBaseSnapshot(): PersonaObservabilitySnapshot {
  return {
    render_log: {
      required_fields: PERSONA_RENDER_LOG_REQUIRED_FIELDS,
    },
    evaluation: {
      blind_review_rubric: PERSONA_BLIND_REVIEW_RUBRIC,
      replay_slices: PERSONA_REPLAY_EVAL_SLICES,
    },
    context_memory: createEmptyContextMemoryMetrics(),
    rollout_gates: [],
  }
}

export function createEmptyContextMemoryMetrics(): PersonaObservabilitySnapshot['context_memory'] {
  return {
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
    },
    migration: {
      public_dual_write_total: 0,
    },
    nightly_compaction: {
      runs_total: 0,
      created_total: 0,
      dedup_hits_total: 0,
      failure_total: 0,
    },
    updated_at: new Date(0).toISOString(),
  }
}

function cloneSnapshot(snapshot: PersonaObservabilitySnapshot): PersonaObservabilitySnapshot {
  const cloned = JSON.parse(JSON.stringify(snapshot)) as PersonaObservabilitySnapshot
  cloned.rollout_gates = evaluatePersonaRolloutGates(cloned.context_memory)
  return cloned
}

function applyDelta(
  metrics: PersonaObservabilitySnapshot['context_memory'],
  delta: PersonaObservabilityMetricDelta,
): void {
  metrics.public_ingress.forum_total += delta.publicIngressForumTotal ?? 0
  metrics.public_ingress.chat_room_total += delta.publicIngressChatRoomTotal ?? 0
  metrics.typed_writes.success_total += delta.typedWriteSuccessTotal ?? 0
  metrics.typed_writes.failure_total += delta.typedWriteFailureTotal ?? 0
  metrics.identity_writes.success_total += delta.identityWriteSuccessTotal ?? 0
  metrics.identity_writes.failure_total += delta.identityWriteFailureTotal ?? 0
  metrics.retrieval.total += delta.retrievalTotal ?? 0
  metrics.retrieval.public_typed_hits += delta.retrievalPublicTypedHits ?? 0
  metrics.migration.public_dual_write_total += delta.migrationPublicDualWriteTotal ?? 0
  metrics.nightly_compaction.runs_total += delta.nightlyCompactionRunsTotal ?? 0
  metrics.nightly_compaction.created_total += delta.nightlyCompactionCreatedTotal ?? 0
  metrics.nightly_compaction.dedup_hits_total += delta.nightlyCompactionDedupHitsTotal ?? 0
  metrics.nightly_compaction.failure_total += delta.nightlyCompactionFailureTotal ?? 0
  metrics.updated_at = new Date().toISOString()
}

export function evaluatePersonaRolloutGates(
  metrics: PersonaObservabilitySnapshot['context_memory'],
): PersonaRolloutGate[] {
  const typedWriteTotal = metrics.typed_writes.success_total + metrics.typed_writes.failure_total
  const typedWriteSuccessRate = ratio(metrics.typed_writes.success_total, typedWriteTotal)
  const identityWriteTotal = metrics.identity_writes.success_total + metrics.identity_writes.failure_total
  const identityWriteSuccessRate = ratio(metrics.identity_writes.success_total, identityWriteTotal)
  const publicReadTotal = metrics.retrieval.total
  const publicTypedHitRate = ratio(metrics.retrieval.public_typed_hits, publicReadTotal)
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
