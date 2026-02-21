import type {
  DecisionEngine,
  RiskLevel,
  RiskCategory,
  ContentVisibility,
  ContentState,
  ModerationVerdict,
  FilterResult,
  CommunityThresholds,
} from './types.js'

/**
 * Stage 3: Decision engine.
 *
 * Maps (risk_score + community thresholds + filter result) → visibility + state.
 *
 * | Condition                        | Visibility  | State    | Verdict    |
 * |----------------------------------|-------------|----------|------------|
 * | Filter blocked                   | QUARANTINE  | REJECTED | REJECT     |
 * | score > auto_reject              | QUARANTINE  | REJECTED | REJECT     |
 * | score > medium_max (high risk)   | QUARANTINE  | PENDING  | QUARANTINE |
 * | score > low_max (medium risk)    | GRAY        | APPROVED | FOLD       |
 * | score <= low_max (low risk)      | PUBLIC      | APPROVED | APPROVE    |
 */
export class DefaultDecisionEngine implements DecisionEngine {
  decide(
    score: number,
    categories: RiskCategory[],
    filterResult: FilterResult,
    thresholds: CommunityThresholds,
  ): {
    risk_level: RiskLevel
    visibility: ContentVisibility
    state: ContentState
    verdict: ModerationVerdict
    reason: string
  } {
    if (!filterResult.passed) {
      const blocked = filterResult.matched_rules
        .filter((r) => r.severity === 'block')
        .map((r) => `${r.rule_type}:${r.pattern}`)
      return {
        risk_level: 'high',
        visibility: 'QUARANTINE',
        state: 'REJECTED',
        verdict: 'REJECT',
        reason: `rule_filter_blocked: ${blocked.join(', ')}`,
      }
    }

    if (score > thresholds.auto_reject_score) {
      return {
        risk_level: 'high',
        visibility: 'QUARANTINE',
        state: 'REJECTED',
        verdict: 'REJECT',
        reason: `score ${score.toFixed(2)} > auto_reject ${thresholds.auto_reject_score}`,
      }
    }

    if (score > thresholds.medium_max_score) {
      return {
        risk_level: 'high',
        visibility: 'QUARANTINE',
        state: 'PENDING',
        verdict: 'QUARANTINE',
        reason: `score ${score.toFixed(2)} > medium_max ${thresholds.medium_max_score} (categories: ${categories.join(', ')})`,
      }
    }

    if (score > thresholds.low_max_score) {
      return {
        risk_level: 'medium',
        visibility: 'GRAY',
        state: 'APPROVED',
        verdict: 'FOLD',
        reason: `score ${score.toFixed(2)} > low_max ${thresholds.low_max_score} (categories: ${categories.join(', ')})`,
      }
    }

    return {
      risk_level: 'low',
      visibility: 'PUBLIC',
      state: 'APPROVED',
      verdict: 'APPROVE',
      reason: `score ${score.toFixed(2)} <= low_max ${thresholds.low_max_score}`,
    }
  }
}
