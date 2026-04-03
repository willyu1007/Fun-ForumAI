import type { RenderTier, VoiceLineId } from '../../shared/agent-persona-catalog.js'
import type { PersonaObservabilitySnapshot } from './persona-observability.js'
import type { PersonaGateSnapshotV1 } from './persona-observation.js'
import type {
  PersonaEvalAttributionSummaryV1,
  PersonaRuntimeIdentityDeltaV1,
} from './persona-rollout-gate.js'

export const CORE_FAMILIES = ['hearth', 'blade', 'spark', 'sage', 'anchor'] as const
export type CoreFamily = (typeof CORE_FAMILIES)[number]

export const INFERENCE_MIGRATION_STATES = ['stable', 'candidate', 'shadow', 'blocked'] as const
export type InferenceMigrationState = (typeof INFERENCE_MIGRATION_STATES)[number]

export const INFERENCE_BLOCKED_REASONS = [
  'risk_freeze',
  'manual_lock',
  'growth_locked',
  'shadow_loss',
  'admin_block',
] as const
export type InferenceBlockedReason = (typeof INFERENCE_BLOCKED_REASONS)[number]

export const SHADOW_COMPARE_DIMENSIONS = [
  'persona_lock',
  'emotional_continuity',
  'watchability',
  'callback_fidelity',
] as const
export type ShadowCompareDimension = (typeof SHADOW_COMPARE_DIMENSIONS)[number]

export const SHADOW_REVIEW_STATUSES = [
  'running',
  'collected',
  'applied',
  'rejected',
  'superseded',
] as const
export type ShadowReviewStatus = (typeof SHADOW_REVIEW_STATUSES)[number]

export const SHADOW_REVIEW_RECOMMENDATIONS = ['approve', 'hold', 'reject'] as const
export type ShadowReviewRecommendation = (typeof SHADOW_REVIEW_RECOMMENDATIONS)[number]

export interface ShadowCompareDimensionResult {
  dimension: ShadowCompareDimension
  score: number
  status: 'pass' | 'warn' | 'fail'
  summary: string
}

export interface ShadowReviewWindowSummary {
  visibleSuccessCount: number
  visibleFailureCount: number
  hiddenSuccessCount: number
  hiddenFailureCount: number
  fallbackCount: number
  sampleWindowMinutes: number
}

export interface ShadowReviewEvidence {
  beforeObservability: PersonaObservabilitySnapshot
  afterObservability: PersonaObservabilitySnapshot
  identityWriteDelta: PersonaRuntimeIdentityDeltaV1
  costAttribution: Partial<PersonaEvalAttributionSummaryV1>
  gate: PersonaGateSnapshotV1
  window: ShadowReviewWindowSummary
  fallbackEntries: Array<{
    created_at: string
    intent: string
    visibility: string
    fallback_level: string
    provider_id: string | null
    model_id: string | null
    success: boolean
    error_code: string | null
  }>
}

export interface ShadowReviewSummary {
  recommendation: ShadowReviewRecommendation
  reasons: string[]
  compareDimensions: ShadowCompareDimensionResult[]
}

export interface TemperamentAxes {
  warmth: number
  spine: number
  spark: number
  composure: number
  depth: number
  stageAffinity: number
}

export interface InferenceSignals {
  risk: number
  initiative: number
}

export type FamilyScoreMap = Record<CoreFamily, number>

export interface InferenceProfileSnapshot {
  axes: TemperamentAxes
  signals: InferenceSignals
  familyScores: FamilyScoreMap
  stageEligible: boolean
  requestedTierFloor: RenderTier | null
}

export interface AgentInferenceProfile {
  agentId: string
  profileVersion: number
  incumbentFamily: CoreFamily
  challengerFamily: CoreFamily | null
  challengerVoiceLineId: VoiceLineId | null
  migrationState: InferenceMigrationState
  consecutiveLeadWindows: number
  challengerScoreDelta: number | null
  manualVoiceLineLock: boolean
  candidateSince: string | null
  shadowStartedAt: string | null
  effectiveAt: string | null
  blockedAt: string | null
  blockedReason: InferenceBlockedReason | null
  freezeUntil: string | null
  lastCompiledAt: string
  lastSnapshot: InferenceProfileSnapshot
  updatedAt: string
}

export interface InferenceRouteDecision {
  homeVoiceLineId: VoiceLineId
  preferredModelId?: string
  requestedTier: RenderTier
  profile: AgentInferenceProfile
  snapshot: InferenceProfileSnapshot
}

export interface OwnerPersonalityNarrative {
  summary: string
  bullets: string[]
  growthNote: string
  stageNote: string | null
  migrationNote: string | null
}

export interface AgentInferenceShadowReview {
  id: string
  agentId: string
  reviewCaseId: string | null
  incumbentFamily: CoreFamily
  incumbentVoiceLineId: VoiceLineId
  challengerFamily: CoreFamily
  challengerVoiceLineId: VoiceLineId
  status: ShadowReviewStatus
  summary: ShadowReviewSummary
  evidence: ShadowReviewEvidence
  startedAt: string
  collectedAt: string | null
  decidedAt: string | null
  decidedByUserId: string | null
  createdAt: string
  updatedAt: string
}
