import type { ModerationResult } from '../../moderation/types.js'
import type {
  OrchestrationPolicyOverride,
  ParticipationContractOverride,
} from '../../../shared/forum-orchestration.js'

export type PolicyGatewayAction = 'allow' | 'rewrite' | 'block'
export type HotTopicDistributionState = 'NORMAL' | 'NO_RECOMMEND' | 'BLOCKED'
export type HotTopicMode = 'NORMAL' | 'MANUAL_REVIEW_ONLY' | 'DISABLED'

export interface ModerationSamplingMetrics {
  post_thread_turn_count: number
  room_message_count_hour: number
  report_count_24h: number
}

export interface ModerationTopicSignals {
  topic_domain: string
  hot_topic_flag: boolean
  topic_confidence: number
  drift_risk_score: number
  drift_detected: boolean
  distribution_state: HotTopicDistributionState
  enforcement_reason: string
  matched_keywords: string[]
  allowed_matches: string[]
  sensitive_matches: string[]
  context_matches: string[]
  allowed_domains: string[]
  kill_switch_mode: HotTopicMode
  kill_switch_source: string
  scene_key: string | null
  room_no_recommend: boolean
  policy_shadowed: boolean
  sampled_review_required: boolean
  sampling_metrics: ModerationSamplingMetrics
  gray_keyword_matches: string[]
  deny_keyword_matches: string[]
}

export interface ModerationHotTopicSnapshot {
  allowed: boolean
  domain: string
  topic_domain: string
  hot_topic_flag: boolean
  topic_confidence: number
  drift_risk_score: number
  drift_detected: boolean
  matched_keywords: string[]
  allowed_matches: string[]
  sensitive_matches: string[]
  context_matches: string[]
  distribution_state: HotTopicDistributionState
  reason: string
  enforcement_reason: string
  sampled_review_required: boolean
  sampling_metrics: ModerationSamplingMetrics
  gray_keyword_matches: string[]
  deny_keyword_matches: string[]
}

export interface ModerationSpillover {
  category: 'owner_endorsement_public' | 'owner_private_leak'
  matched_pattern: string
  reason: string
}

export interface ModerationKillSwitchHit {
  source: 'room_override' | 'community_scene_override' | 'community_mode' | 'agent_status'
  mode: HotTopicMode
  detail: string
}

export interface ModerationKillSwitch {
  effective_mode: HotTopicMode
  effective_source: string
  hits: ModerationKillSwitchHit[]
  room_no_recommend?: boolean
}

export interface PostTrustContext {
  job_id: string
  grant_id: string | null
  source_bundle_count?: number
  source_bundle_ids?: string[]
  citation_urls: string[]
  redaction_profile: string | null
}

export interface AdminDistributionOverride {
  state: 'NORMAL' | 'NO_RECOMMEND'
  actor_user_id: string
  reason: string | null
  updated_at: string
}

export interface PostModerationMetadata {
  topic_signals?: ModerationTopicSignals | null
  distribution_state?: HotTopicDistributionState
  policy_action?: PolicyGatewayAction | null
  policy_reason?: string | null
  policy_case_id?: string | null
  kill_switch?: ModerationKillSwitch | null
  stage_spec_fallback?: boolean
  stage_runtime_role?: string | null
  stage_runtime_tier?: string | null
  trust_context?: PostTrustContext | null
  participation_contract_override_v1?: ParticipationContractOverride | null
  forum_orchestration_override_v1?: OrchestrationPolicyOverride | null
  admin_distribution_override?: AdminDistributionOverride | null
}

export interface MessageModerationMetadata {
  moderation?: ModerationResult | null
  hot_topic?: ModerationHotTopicSnapshot | null
  topic_signals?: ModerationTopicSignals | null
  distribution_state?: HotTopicDistributionState
  room_no_recommend?: boolean
  policy_action?: PolicyGatewayAction | null
  policy_enforced?: boolean
  policy_shadowed?: boolean
  rewrite_cause?: string | null
  spillover?: ModerationSpillover | null
  kill_switch?: ModerationKillSwitch | null
  governance_action?: string | null
  governance_reason?: string | null
  governance_updated_at?: string | null
}

export interface PrivateMessageModerationMetadata extends MessageModerationMetadata {
  failure_message?: string | null
}
