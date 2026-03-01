import type { AgentRelation, RelationState } from '../repos/types.js'

const SHADOW_TO_EFFECTIVE_MS = 7 * 24 * 60 * 60 * 1000
const NON_BLOCKED_STATE_COOLDOWN_MS = 24 * 60 * 60 * 1000
const LOW_SCORE_THRESHOLD = 0.35
const LOW_SCORE_WINDOW_MS = 72 * 60 * 60 * 1000
const INACTIVE_NO_INTERACTION_MS = 30 * 24 * 60 * 60 * 1000
const ADMISSION_SCORE_THRESHOLD = 0.6

export interface RelationPairStats {
  co_presence_count: number
  reciprocal_reply_count: number
  interaction_count_7d: number
  warning_count_24h: number
  warning_count_7d: number
  severe_count_7d: number
  last_interaction_at: Date | null
}

export interface RelationEvaluationInput {
  existing: AgentRelation | null
  stats: RelationPairStats
  persona_score: number
  safety_score: number
  capacity_allowed: boolean
  now: Date
}

export interface RelationEvaluationResult {
  should_persist: boolean
  next_state: RelationState
  relation_score: number
  interaction_score: number
  persona_score: number
  safety_score: number
  shadow_started_at: Date | null
  effective_at: Date | null
  inactive_at: Date | null
  blocked_at: Date | null
  below_threshold_since: Date | null
  last_interaction_at: Date | null
  last_state_changed_at: Date | null
  reason_codes: string[]
}

export class RelationEngine {
  evaluate(input: RelationEvaluationInput): RelationEvaluationResult {
    const reasons: string[] = []

    const interactionScore = this.computeInteractionScore(input.stats)
    const personaScore = clamp01(input.persona_score)

    const severeHit = input.stats.severe_count_7d > 0 || input.stats.warning_count_24h >= 3
    if (severeHit) {
      reasons.push('safety_hard_block')
    }

    const safetyScore = severeHit
      ? 0
      : clamp01(Math.min(input.safety_score, 1 - input.stats.warning_count_7d * 0.25))

    const relationScore = clamp01(interactionScore * 0.45 + personaScore * 0.35 + safetyScore * 0.20)

    const admissionGate =
      input.stats.co_presence_count >= 3 &&
      input.stats.reciprocal_reply_count >= 2 &&
      relationScore >= ADMISSION_SCORE_THRESHOLD

    const eligible = admissionGate && input.capacity_allowed
    if (!input.capacity_allowed) {
      reasons.push('capacity_rejected')
    }

    const existing = input.existing
    const currentState = existing?.state

    let nextState: RelationState
    let shadowStartedAt = existing?.shadow_started_at ?? null
    let effectiveAt = existing?.effective_at ?? null
    let inactiveAt = existing?.inactive_at ?? null
    let blockedAt = existing?.blocked_at ?? null
    let belowThresholdSince = existing?.below_threshold_since ?? null
    let lastStateChangedAt = existing?.last_state_changed_at ?? null

    const nowMs = input.now.getTime()

    if (severeHit) {
      nextState = 'blocked'
      blockedAt = input.now
      reasons.push('transition:blocked')
    } else if (currentState === 'blocked') {
      nextState = 'blocked'
      reasons.push('blocked_sticky')
    } else if (!existing) {
      if (eligible) {
        nextState = 'shadow'
        shadowStartedAt = input.now
        reasons.push('transition:new_shadow')
      } else {
        nextState = 'inactive'
        reasons.push('no_relation_created')
      }
    } else if (currentState === 'shadow') {
      if (!eligible) {
        nextState = 'inactive'
        inactiveAt = input.now
        reasons.push('transition:shadow_to_inactive')
      } else if ((shadowStartedAt ?? input.now).getTime() <= nowMs - SHADOW_TO_EFFECTIVE_MS) {
        nextState = 'effective'
        effectiveAt = input.now
        reasons.push('transition:shadow_to_effective')
      } else {
        nextState = 'shadow'
        reasons.push('shadow_waiting_period')
      }
    } else if (currentState === 'effective') {
      if (relationScore < LOW_SCORE_THRESHOLD) {
        if (!belowThresholdSince) {
          belowThresholdSince = input.now
        }

        if (belowThresholdSince.getTime() <= nowMs - LOW_SCORE_WINDOW_MS) {
          nextState = 'inactive'
          inactiveAt = input.now
          reasons.push('transition:effective_to_inactive_low_score')
        } else {
          nextState = 'effective'
          reasons.push('effective_low_score_observing')
        }
      } else if (
        input.stats.last_interaction_at &&
        input.stats.last_interaction_at.getTime() <= nowMs - INACTIVE_NO_INTERACTION_MS
      ) {
        nextState = 'inactive'
        inactiveAt = input.now
        reasons.push('transition:effective_to_inactive_no_interaction')
      } else {
        nextState = 'effective'
        belowThresholdSince = null
        reasons.push('effective_stable')
      }
    } else {
      // inactive state
      if (eligible) {
        nextState = 'shadow'
        shadowStartedAt = input.now
        reasons.push('transition:inactive_to_shadow')
      } else {
        nextState = 'inactive'
        reasons.push('inactive_stable')
      }
    }

    const stateChanged = currentState !== nextState
    if (stateChanged && nextState !== 'blocked' && existing && lastStateChangedAt) {
      if (lastStateChangedAt.getTime() > nowMs - NON_BLOCKED_STATE_COOLDOWN_MS) {
        nextState = currentState ?? 'inactive'
        reasons.push('state_change_cooldown_applied')
      }
    }

    if (stateChanged && currentState !== nextState) {
      lastStateChangedAt = input.now
    }

    const shouldPersist = Boolean(existing) || nextState !== 'inactive' || severeHit

    return {
      should_persist: shouldPersist,
      next_state: nextState,
      relation_score: relationScore,
      interaction_score: interactionScore,
      persona_score: personaScore,
      safety_score: safetyScore,
      shadow_started_at: shadowStartedAt,
      effective_at: effectiveAt,
      inactive_at: inactiveAt,
      blocked_at: blockedAt,
      below_threshold_since: belowThresholdSince,
      last_interaction_at: input.stats.last_interaction_at,
      last_state_changed_at: lastStateChangedAt,
      reason_codes: reasons,
    }
  }

  private computeInteractionScore(stats: RelationPairStats): number {
    const coPresence = clamp01(stats.co_presence_count / 10)
    const reciprocal = clamp01(stats.reciprocal_reply_count / 6)
    const volume = clamp01(stats.interaction_count_7d / 20)
    return clamp01(coPresence * 0.4 + reciprocal * 0.4 + volume * 0.2)
  }
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  if (value <= 0) return 0
  if (value >= 1) return 1
  return value
}
