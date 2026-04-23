export const FORUM_TARGET_REF_IDS = [
  'event_post',
  'event_thread',
  'event_turn',
  'focus_turn',
  'reply_thread',
] as const

export type ForumTargetRef = (typeof FORUM_TARGET_REF_IDS)[number]

export const FORUM_VOTE_TARGET_REF_IDS = [
  'event_post',
  'event_thread',
  'event_turn',
  'focus_turn',
] as const

export type ForumVoteTargetRef = (typeof FORUM_VOTE_TARGET_REF_IDS)[number]

export const RUNTIME_ACTION_PLAN_RATIONALE_CODE_IDS = [
  'agree',
  'disagree',
  'interesting',
  'well_argued',
  'weak_reasoning',
  'provocative',
] as const

export type RuntimeActionPlanRationaleCode =
  (typeof RUNTIME_ACTION_PLAN_RATIONALE_CODE_IDS)[number]

export interface RuntimeVoteActionPlanItem {
  kind: 'vote'
  target_ref: ForumVoteTargetRef
  direction: 'UP' | 'DOWN' | 'NEUTRAL'
  confidence?: number
  rationale_code?: RuntimeActionPlanRationaleCode
}

export interface RuntimeOpenThreadActionPlanItem {
  kind: 'open_thread'
}

export interface RuntimeAddThreadTurnActionPlanItem {
  kind: 'add_thread_turn'
  target_ref: 'reply_thread' | 'focus_turn'
}

export interface RuntimeNoWriteActionPlanItem {
  kind: 'no_write'
  reason: string
}

export type RuntimeActionPlanItem =
  | RuntimeVoteActionPlanItem
  | RuntimeOpenThreadActionPlanItem
  | RuntimeAddThreadTurnActionPlanItem
  | RuntimeNoWriteActionPlanItem

export interface RuntimeActionPlanV1 {
  version: 'v1'
  actions: RuntimeActionPlanItem[]
}

export type VoteGuardrailDecision =
  | {
      outcome: 'allow'
      normalized_transition: 'CAST_UP' | 'CAST_DOWN' | 'CLEAR_UP' | 'CLEAR_DOWN'
      existing_vote_direction?: 'UP' | 'DOWN'
    }
  | {
      outcome: 'noop'
      reason: 'same_direction_repeat' | 'clear_without_existing_vote'
      existing_vote_direction?: 'UP' | 'DOWN'
    }
  | {
      outcome: 'reject'
      reason:
        | 'self_vote'
        | 'target_not_visible'
        | 'down_confidence_too_low'
        | 'down_propensity_too_low'
        | 'down_rate_limited'
        | 'flip_cooldown'
    }

export function isForumTargetRef(value: unknown): value is ForumTargetRef {
  return typeof value === 'string' && FORUM_TARGET_REF_IDS.includes(value as ForumTargetRef)
}

export function isForumVoteTargetRef(value: unknown): value is ForumVoteTargetRef {
  return typeof value === 'string' && FORUM_VOTE_TARGET_REF_IDS.includes(value as ForumVoteTargetRef)
}

export function isRuntimeActionPlanRationaleCode(
  value: unknown,
): value is RuntimeActionPlanRationaleCode {
  return (
    typeof value === 'string'
    && RUNTIME_ACTION_PLAN_RATIONALE_CODE_IDS.includes(value as RuntimeActionPlanRationaleCode)
  )
}
