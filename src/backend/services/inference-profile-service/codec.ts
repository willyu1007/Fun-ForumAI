import type { RenderTier, VoiceLineId } from '../../../shared/agent-persona-catalog.js'
import type { PersonaObservabilitySnapshot } from '../../runtime/persona-observability.js'
import type {
  PersonaGateResultV1,
  PersonaGateSnapshotV1,
} from '../../runtime/persona-observation.js'
import {
  CORE_FAMILIES,
  type AgentInferenceProfile,
  type AgentInferenceShadowReview,
  type CoreFamily,
  type FamilyScoreMap,
  type InferenceBlockedReason,
  type InferenceMigrationState,
  type InferenceProfileSnapshot,
  type InferenceSignals,
  type ShadowCompareDimensionResult,
  type ShadowReviewEvidence,
  type ShadowReviewRecommendation,
  type ShadowReviewStatus,
  type ShadowReviewSummary,
  type TemperamentAxes,
} from '../../runtime/inference-profile-types.js'

export function serializeSnapshot(snapshot: InferenceProfileSnapshot): Record<string, unknown> {
  return {
    axes: snapshot.axes,
    signals: snapshot.signals,
    familyScores: snapshot.familyScores,
    stageEligible: snapshot.stageEligible,
    requestedTierFloor: snapshot.requestedTierFloor,
  }
}

export function toRuntimeProfile(entity: {
  agent_id: string
  profile_version: number
  incumbent_family: string
  challenger_family: string | null
  challenger_voice_line_id: string | null
  migration_state: string
  consecutive_lead_windows: number
  challenger_score_delta: number | null
  manual_voice_line_lock: boolean
  candidate_since: Date | null
  shadow_started_at: Date | null
  effective_at: Date | null
  blocked_at: Date | null
  blocked_reason: string | null
  freeze_until: Date | null
  last_compiled_at: Date
  last_snapshot_json: Record<string, unknown>
  updated_at: Date
}): AgentInferenceProfile {
  const snapshotRaw = entity.last_snapshot_json
  return {
    agentId: entity.agent_id,
    profileVersion: entity.profile_version,
    incumbentFamily: parseCoreFamily(entity.incumbent_family) ?? 'anchor',
    challengerFamily: parseCoreFamily(entity.challenger_family),
    challengerVoiceLineId: parseVoiceLine(entity.challenger_voice_line_id),
    migrationState: parseMigrationState(entity.migration_state),
    consecutiveLeadWindows: entity.consecutive_lead_windows,
    challengerScoreDelta: entity.challenger_score_delta,
    manualVoiceLineLock: entity.manual_voice_line_lock,
    candidateSince: entity.candidate_since?.toISOString() ?? null,
    shadowStartedAt: entity.shadow_started_at?.toISOString() ?? null,
    effectiveAt: entity.effective_at?.toISOString() ?? null,
    blockedAt: entity.blocked_at?.toISOString() ?? null,
    blockedReason: parseBlockedReason(entity.blocked_reason),
    freezeUntil: entity.freeze_until?.toISOString() ?? null,
    lastCompiledAt: entity.last_compiled_at.toISOString(),
    lastSnapshot: {
      axes: readAxes(snapshotRaw.axes),
      signals: readSignals(snapshotRaw.signals),
      familyScores: readFamilyScores(snapshotRaw.familyScores),
      stageEligible: snapshotRaw.stageEligible === true,
      requestedTierFloor: parseRenderTier(snapshotRaw.requestedTierFloor),
    },
    updatedAt: entity.updated_at.toISOString(),
  }
}

export function toRuntimeShadowReview(input: {
  id: string
  agent_id: string
  review_case_id: string | null
  incumbent_family: string
  incumbent_voice_line_id: string
  challenger_family: string
  challenger_voice_line_id: string
  status: string
  summary_json: Record<string, unknown>
  evidence_json: Record<string, unknown>
  started_at: Date
  collected_at: Date | null
  decided_at: Date | null
  decided_by_user_id: string | null
  created_at: Date
  updated_at: Date
}): AgentInferenceShadowReview {
  return {
    id: input.id,
    agentId: input.agent_id,
    reviewCaseId: input.review_case_id,
    incumbentFamily: parseCoreFamily(input.incumbent_family) ?? 'anchor',
    incumbentVoiceLineId: input.incumbent_voice_line_id as VoiceLineId,
    challengerFamily: parseCoreFamily(input.challenger_family) ?? 'anchor',
    challengerVoiceLineId: input.challenger_voice_line_id as VoiceLineId,
    status: parseShadowReviewStatus(input.status),
    summary: parseShadowReviewSummary(input.summary_json),
    evidence: parseShadowReviewEvidence(input.evidence_json),
    startedAt: input.started_at.toISOString(),
    collectedAt: input.collected_at?.toISOString() ?? null,
    decidedAt: input.decided_at?.toISOString() ?? null,
    decidedByUserId: input.decided_by_user_id,
    createdAt: input.created_at.toISOString(),
    updatedAt: input.updated_at.toISOString(),
  }
}

export function buildIdentityWriteDelta(
  before: PersonaObservabilitySnapshot,
  after: PersonaObservabilitySnapshot,
) {
  return {
    before_success_total: before.context_memory.identity_writes.success_total,
    before_failure_total: before.context_memory.identity_writes.failure_total,
    after_success_total: after.context_memory.identity_writes.success_total,
    after_failure_total: after.context_memory.identity_writes.failure_total,
  }
}

export function parseCoreFamily(value: string | null | undefined): CoreFamily | null {
  return CORE_FAMILIES.find((item) => item === value) ?? null
}

export function parseMigrationState(value: string): InferenceMigrationState {
  return value === 'candidate' || value === 'shadow' || value === 'blocked' ? value : 'stable'
}

export function parseBlockedReason(value: string | null): InferenceBlockedReason | null {
  return value === 'risk_freeze' ||
    value === 'manual_lock' ||
    value === 'growth_locked' ||
    value === 'shadow_loss' ||
    value === 'admin_block'
    ? value
    : null
}

export function parseVoiceLine(value: string | null): VoiceLineId | null {
  return value === 'qwen-social-v1' ||
    value === 'glm-deep-v1' ||
    value === 'qwen-director-v1' ||
    value === 'minimax-her-v1' ||
    value === 'doubao-deep-v1' ||
    value === 'kimi-deep-v1'
    ? value
    : null
}

export function parseRenderTier(value: unknown): RenderTier | null {
  return value === 'lite' || value === 'base' || value === 'premium' ? value : null
}

export function parseShadowReviewStatus(value: string): ShadowReviewStatus {
  return value === 'collected' ||
    value === 'applied' ||
    value === 'rejected' ||
    value === 'superseded'
    ? value
    : 'running'
}

export function parseShadowReviewRecommendation(value: unknown): ShadowReviewRecommendation {
  return value === 'approve' || value === 'reject' ? value : 'hold'
}

export function parseShadowReviewSummary(raw: unknown): ShadowReviewSummary {
  const record = toRecord(raw)
  const compareDimensions = Array.isArray(record.compareDimensions)
    ? record.compareDimensions
        .map((item) => {
          const entry = toRecord(item)
          const dimension = entry.dimension
          if (
            dimension !== 'persona_lock' &&
            dimension !== 'emotional_continuity' &&
            dimension !== 'watchability' &&
            dimension !== 'callback_fidelity'
          ) {
            return null
          }
          return {
            dimension,
            score: clampAxis(toNumber(entry.score, 0)),
            status:
              entry.status === 'pass' || entry.status === 'warn' || entry.status === 'fail'
                ? entry.status
                : 'warn',
            summary: typeof entry.summary === 'string' ? entry.summary : '',
          }
        })
        .filter((item): item is ShadowCompareDimensionResult => Boolean(item))
    : []

  return {
    recommendation: parseShadowReviewRecommendation(record.recommendation),
    reasons: Array.isArray(record.reasons)
      ? record.reasons.filter((item): item is string => typeof item === 'string')
      : [],
    compareDimensions,
  }
}

export function parseShadowReviewEvidence(raw: unknown): ShadowReviewEvidence {
  const record = toRecord(raw)
  const beforeObservability = readObservabilitySnapshot(record.beforeObservability)
  const afterObservability = readObservabilitySnapshot(record.afterObservability)
  return {
    beforeObservability,
    afterObservability,
    identityWriteDelta: buildIdentityWriteDelta(beforeObservability, afterObservability),
    costAttribution: toRecord(record.costAttribution),
    gate: readGateSnapshot(record.gate),
    window: readWindowSummary(record.window),
    fallbackEntries: Array.isArray(record.fallbackEntries)
      ? record.fallbackEntries
          .map((item) => {
            const entry = toRecord(item)
            return {
              created_at: typeof entry.created_at === 'string' ? entry.created_at : '',
              intent: typeof entry.intent === 'string' ? entry.intent : '',
              visibility: typeof entry.visibility === 'string' ? entry.visibility : '',
              fallback_level:
                typeof entry.fallback_level === 'string' ? entry.fallback_level : 'none',
              provider_id: typeof entry.provider_id === 'string' ? entry.provider_id : null,
              model_id: typeof entry.model_id === 'string' ? entry.model_id : null,
              success: entry.success === true,
              error_code: typeof entry.error_code === 'string' ? entry.error_code : null,
            }
          })
          .filter((item) => item.created_at.length > 0)
      : [],
  }
}

function readAxes(raw: unknown): TemperamentAxes {
  const record = toRecord(raw)
  return {
    warmth: clampAxis(toNumber(record.warmth, 50)),
    spine: clampAxis(toNumber(record.spine, 50)),
    spark: clampAxis(toNumber(record.spark, 50)),
    composure: clampAxis(toNumber(record.composure, 50)),
    depth: clampAxis(toNumber(record.depth, 50)),
    stageAffinity: clampAxis(toNumber(record.stageAffinity, 50)),
  }
}

function readSignals(raw: unknown): InferenceSignals {
  const record = toRecord(raw)
  return {
    risk: clampAxis(toNumber(record.risk, 0)),
    initiative: clampAxis(toNumber(record.initiative, 0)),
  }
}

function readFamilyScores(raw: unknown): FamilyScoreMap {
  const record = toRecord(raw)
  return {
    hearth: clampAxis(toNumber(record.hearth, 0)),
    blade: clampAxis(toNumber(record.blade, 0)),
    spark: clampAxis(toNumber(record.spark, 0)),
    sage: clampAxis(toNumber(record.sage, 0)),
    anchor: clampAxis(toNumber(record.anchor, 0)),
  }
}

function readWindowSummary(raw: unknown) {
  const record = toRecord(raw)
  return {
    visibleSuccessCount: Math.max(0, Math.round(toNumber(record.visibleSuccessCount, 0))),
    visibleFailureCount: Math.max(0, Math.round(toNumber(record.visibleFailureCount, 0))),
    hiddenSuccessCount: Math.max(0, Math.round(toNumber(record.hiddenSuccessCount, 0))),
    hiddenFailureCount: Math.max(0, Math.round(toNumber(record.hiddenFailureCount, 0))),
    fallbackCount: Math.max(0, Math.round(toNumber(record.fallbackCount, 0))),
    sampleWindowMinutes: Math.max(0, toNumber(record.sampleWindowMinutes, 0)),
  }
}

function readGateSnapshot(raw: unknown): PersonaGateSnapshotV1 {
  const record = toRecord(raw)
  return {
    version: 'persona-gate-snapshot-v1',
    generated_at:
      typeof record.generated_at === 'string' ? record.generated_at : new Date().toISOString(),
    overall_status:
      record.overall_status === 'pass' ||
      record.overall_status === 'fail' ||
      record.overall_status === 'warn'
        ? record.overall_status
        : 'not_run',
    gating_basis: 'persona-eval-v1',
    results: Array.isArray(record.results)
      ? record.results
          .map((item): PersonaGateResultV1 | null => {
            const entry = toRecord(item)
            return {
              gate_id:
                typeof entry.gate_id === 'string'
                  ? (entry.gate_id as
                      | 'render-log-completeness'
                      | 'persona-consistency'
                      | 'group-distinctiveness'
                      | 'overlay-naturalness'
                      | 'nurture-perceptibility'
                      | 'parse-success'
                      | 'identity-write-success'
                      | 'visible-fallback-frequency'
                      | 'visible-p95-latency'
                      | 'visible-render-cost')
                  : 'visible-render-cost',
              kind:
                entry.kind === 'blocking' || entry.kind === 'guardrail'
                  ? entry.kind
                  : 'guardrail',
              threshold: typeof entry.threshold === 'string' ? entry.threshold : '',
              status:
                entry.status === 'pass' ||
                entry.status === 'fail' ||
                entry.status === 'warn' ||
                entry.status === 'not_run'
                  ? entry.status
                  : 'not_run',
              actual: typeof entry.actual === 'string' ? entry.actual : null,
              note: typeof entry.note === 'string' ? entry.note : undefined,
            }
          })
          .filter((item): item is PersonaGateResultV1 => Boolean(item && item.threshold.length > 0))
      : [],
  }
}

function readObservabilitySnapshot(raw: unknown): PersonaObservabilitySnapshot {
  const record = toRecord(raw)
  const contextMemory = toRecord(record.context_memory)
  const identityWrites = toRecord(contextMemory.identity_writes)
  const typedWrites = toRecord(contextMemory.typed_writes)
  const retrieval = toRecord(contextMemory.retrieval)
  const migration = toRecord(contextMemory.migration)
  const nightly = toRecord(contextMemory.nightly_compaction)
  const publicIngress = toRecord(contextMemory.public_ingress)
  return {
    render_log: {
      required_fields: [],
    },
    evaluation: {
      blind_review_rubric: [],
      replay_slices: [],
    },
    context_memory: {
      public_ingress: {
        forum_total: Math.max(0, Math.round(toNumber(publicIngress.forum_total, 0))),
        chat_room_total: Math.max(0, Math.round(toNumber(publicIngress.chat_room_total, 0))),
      },
      typed_writes: {
        success_total: Math.max(0, Math.round(toNumber(typedWrites.success_total, 0))),
        failure_total: Math.max(0, Math.round(toNumber(typedWrites.failure_total, 0))),
      },
      identity_writes: {
        success_total: Math.max(0, Math.round(toNumber(identityWrites.success_total, 0))),
        failure_total: Math.max(0, Math.round(toNumber(identityWrites.failure_total, 0))),
      },
      retrieval: {
        total: Math.max(0, Math.round(toNumber(retrieval.total, 0))),
        public_typed_hits: Math.max(0, Math.round(toNumber(retrieval.public_typed_hits, 0))),
      },
      migration: {
        public_dual_write_total: Math.max(
          0,
          Math.round(toNumber(migration.public_dual_write_total, 0)),
        ),
      },
      nightly_compaction: {
        runs_total: Math.max(0, Math.round(toNumber(nightly.runs_total, 0))),
        created_total: Math.max(0, Math.round(toNumber(nightly.created_total, 0))),
        dedup_hits_total: Math.max(0, Math.round(toNumber(nightly.dedup_hits_total, 0))),
        failure_total: Math.max(0, Math.round(toNumber(nightly.failure_total, 0))),
      },
      updated_at:
        typeof contextMemory.updated_at === 'string'
          ? contextMemory.updated_at
          : new Date(0).toISOString(),
    },
    rollout_gates: [],
  }
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function toNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
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
