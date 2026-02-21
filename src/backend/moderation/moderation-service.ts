import type {
  ModerationInput,
  ModerationResult,
  RuleFilter,
  RiskClassifier,
  DecisionEngine,
  CommunityThresholds,
} from './types.js'
import { DEFAULT_THRESHOLDS } from './config.js'

export interface ModerationServiceDeps {
  ruleFilter: RuleFilter
  classifier: RiskClassifier
  decisionEngine: DecisionEngine
}

/**
 * Orchestrates the three-stage moderation pipeline.
 *
 *   1. Rule filter   → immediate block on hard matches
 *   2. Risk classifier → risk_score + categories
 *   3. Decision engine → visibility + state
 *
 * **Fail-closed**: if any stage throws, content is treated as medium/high risk.
 */
export class ModerationService {
  constructor(private readonly deps: ModerationServiceDeps) {}

  evaluate(input: ModerationInput): ModerationResult {
    const thresholds: CommunityThresholds =
      input.community_thresholds ?? DEFAULT_THRESHOLDS

    try {
      return this.pipeline(input.text, thresholds)
    } catch {
      return this.failClosedResult(input.text)
    }
  }

  private pipeline(text: string, thresholds: CommunityThresholds): ModerationResult {
    const filterResult = this.deps.ruleFilter.check(text)

    const { score, categories } = this.deps.classifier.classify(text)

    const decision = this.deps.decisionEngine.decide(
      score,
      categories,
      filterResult,
      thresholds,
    )

    return {
      risk_level: decision.risk_level,
      risk_score: score,
      risk_categories: categories,
      visibility: decision.visibility,
      state: decision.state,
      verdict: decision.verdict,
      details: {
        rule_filter: filterResult,
        classifier_score: score,
        classifier_categories: categories,
        decision_reason: decision.reason,
        fail_closed: false,
      },
    }
  }

  /**
   * Fail-closed: when the pipeline errors, default to GRAY/PENDING.
   * Content is not lost — it enters the review queue for manual inspection.
   */
  private failClosedResult(text: string): ModerationResult {
    return {
      risk_level: 'medium',
      risk_score: -1,
      risk_categories: ['clean'],
      visibility: 'GRAY',
      state: 'PENDING',
      verdict: 'FOLD',
      details: {
        rule_filter: { passed: true, matched_rules: [] },
        classifier_score: -1,
        classifier_categories: ['clean'],
        decision_reason: `fail-closed: pipeline error on text length=${text.length}`,
        fail_closed: true,
      },
    }
  }
}
