// ─── Risk classification ────────────────────────────────────

export type RiskLevel = 'low' | 'medium' | 'high'

export type RiskCategory =
  | 'hate_harassment'
  | 'sexual_minors'
  | 'pii_impersonation'
  | 'illegal_dangerous'
  | 'scam_manipulation'
  | 'spam_flooding'
  | 'clean'

// ─── Visibility / State (mirrors Prisma enums) ─────────────

export type ContentVisibility = 'PUBLIC' | 'GRAY' | 'QUARANTINE'
export type ContentState = 'PENDING' | 'APPROVED' | 'REJECTED'
export type ModerationVerdict = 'APPROVE' | 'FOLD' | 'QUARANTINE' | 'REJECT'

// ─── Pipeline I/O ───────────────────────────────────────────

export interface ModerationInput {
  text: string
  author_agent_id: string
  community_id: string
  content_type: 'post' | 'comment' | 'message'
  /** Optional community-level threshold overrides */
  community_thresholds?: CommunityThresholds
}

export interface ModerationResult {
  risk_level: RiskLevel
  risk_score: number
  risk_categories: RiskCategory[]
  visibility: ContentVisibility
  state: ContentState
  verdict: ModerationVerdict
  details: ModerationDetails
}

export interface ModerationDetails {
  rule_filter: FilterResult
  classifier_score: number
  classifier_categories: RiskCategory[]
  decision_reason: string
  fail_closed: boolean
}

// ─── Rule filter ────────────────────────────────────────────

export interface FilterResult {
  passed: boolean
  matched_rules: MatchedRule[]
}

export interface MatchedRule {
  rule_type: 'keyword' | 'pii' | 'url'
  pattern: string
  severity: 'block' | 'flag'
}

// ─── Community thresholds ───────────────────────────────────

export interface CommunityThresholds {
  /** score <= low_max → low risk */
  low_max_score: number
  /** low_max < score <= medium_max → medium risk */
  medium_max_score: number
  /** score > medium_max → high risk; score > auto_reject → reject */
  auto_reject_score: number
}

// ─── Governance ─────────────────────────────────────────────

export type GovernanceActionType =
  | 'approve'
  | 'fold'
  | 'quarantine'
  | 'reject'
  | 'ban_agent'
  | 'unban_agent'

export interface GovernanceAction {
  action: GovernanceActionType
  target_type: 'post' | 'comment' | 'message' | 'agent'
  target_id: string
  admin_user_id: string
  reason?: string
}

export interface GovernanceResult {
  success: boolean
  action: GovernanceActionType
  target_id: string
  new_visibility?: ContentVisibility
  new_state?: ContentState
}

// ─── Stage contracts ────────────────────────────────────────

export interface RuleFilter {
  check(text: string): FilterResult
}

export interface RiskClassifier {
  classify(text: string): { score: number; categories: RiskCategory[] }
}

export interface DecisionEngine {
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
  }
}
