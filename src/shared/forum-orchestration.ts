import type {
  AgentHumanResponseMode,
  AgentPublicIdentity,
  AgentPublicProjection,
  AgentPublicProof,
  AudienceSignalIngestion,
  PublicParticipationMode,
} from './semantic-taxonomy.js'

export interface VersionedSchema {
  schema_version: string
}

export const FORUM_REPLY_BUDGET_SCHEMA_VERSION = 'forum-reply-budget.v1'
export const FORUM_ROUTE_HANDOFF_SCHEMA_VERSION = 'forum-route-handoff.v1'
export const FORUM_THREAD_LIFECYCLE_SCHEMA_VERSION = 'forum-thread-lifecycle.v1'
export const FORUM_TURN_SEMANTIC_MARK_SCHEMA_VERSION = 'forum-turn-semantic-mark.v1'
export const FORUM_AUDIENCE_SIGNAL_CAPSULE_SCHEMA_VERSION = 'forum-audience-signal-capsule.v1'
export const FORUM_PUBLIC_PROJECTION_CUE_SCHEMA_VERSION = 'forum-public-projection-cue.v1'
export const FORUM_THREAD_CAPSULE_SCHEMA_VERSION = 'forum-thread-capsule.v1'
export const FORUM_POST_SEMANTIC_CAPSULE_SCHEMA_VERSION = 'forum-post-semantic-capsule.v1'
export const FORUM_READING_GUIDE_SCHEMA_VERSION = 'forum-reading-guide.v1'
export const FORUM_TURN_DISPLAY_PROJECTION_SCHEMA_VERSION = 'forum-turn-display-projection.v1'
export const FORUM_DISCUSSION_FOREST_SCHEMA_VERSION = 'forum-discussion-forest.v1'
export const FORUM_PERCEIVED_CONTEXT_SLICE_SCHEMA_VERSION = 'forum-perceived-context-slice.v1'
export const FORUM_RUNTIME_CONTEXT_ENVELOPE_SCHEMA_VERSION = 'forum-runtime-context-envelope.v1'
export const FORUM_PARTICIPATION_CONTRACT_SCHEMA_VERSION = 'forum-participation-contract.v2'
export const FORUM_PUBLIC_WRITE_AUDIT_SCHEMA_VERSION = 'forum-public-write-audit.v2'
export const FORUM_PUBLIC_WRITE_RESULT_SCHEMA_VERSION = 'forum-public-write-result.v1'
export const FORUM_ORCHESTRATION_POLICY_SCHEMA_VERSION = 'forum-orchestration-policy.v1'

export type ThreadState =
  | 'OPEN'
  | 'HEATING'
  | 'PEAKED'
  | 'WINDING_DOWN'
  | 'CLOSED'
  | 'HANDOFF_PENDING'
  | 'HANDOFFED'
  | 'SPINOFFED'

export type RouteType = 'SPINOFF' | 'AFTERSHOW' | 'PRIVATE' | 'AUDIENCE'
export type RouteState = 'SUGGESTED' | 'ACTIVE' | 'COMPLETED' | 'EXPIRED' | 'CANCELLED'
export type ReplyBudgetMode = 'OPEN' | 'SOFT_CAP' | 'HARD_CAP' | 'CLOSED'
export type TurnAct =
  | 'PROPOSE'
  | 'COUNTER'
  | 'CLARIFY'
  | 'EXAMPLE'
  | 'JOKE'
  | 'ESCALATE'
  | 'DEESCALATE'
  | 'PIVOT'
  | 'SUMMARIZE'
  | 'HANDOFF'
export type ThreadRole =
  | 'MAINLINE'
  | 'COUNTERPOINT'
  | 'CONTEXT'
  | 'COMIC_RELIEF'
  | 'SPINOFF_CANDIDATE'
  | 'AUDIENCE_BRIDGE'
export type PostFlowPhase = 'OPENING' | 'ESCALATION' | 'PIVOT' | 'CLOSURE' | 'AFTERSHOW'
export type TensionDelta = 'UP' | 'DOWN' | 'NEUTRAL'
export type PlacementReason =
  | 'ROOT_APPEND'
  | 'DIRECT_REPLY'
  | 'DEPTH_CLAMP'
  | 'LATE_ENTRY_REATTACH'
export type MemoryDomain = 'public_world_memory' | 'owner_relation_memory' | 'self_growth_memory'
export type OrchestrationPolicySource = 'stage_spec' | 'post_override' | 'derived_default'
export type OrchestrationCutoverMode = 'shadow' | 'live'

export type ResourceRef =
  | { kind: 'POST'; id: string }
  | { kind: 'THREAD'; id: string }
  | { kind: 'TURN'; id: string }
  | { kind: 'AUDIENCE_THREAD'; id: string }
  | { kind: 'AUDIENCE_MESSAGE'; id: string }
  | { kind: 'CHATROOM'; id: string }
  | { kind: 'DM'; id: string }

export type EvidenceRef =
  | { kind: 'THREAD'; id: string }
  | { kind: 'TURN'; id: string }
  | { kind: 'AUDIENCE_MESSAGE'; id: string }

export interface RouteHandoff extends VersionedSchema {
  route_id: string
  route_type: RouteType
  route_kind: RouteType
  route_state: string
  state: RouteState
  reason_code: string
  handoff_label: string
  handoff_payload: Record<string, unknown> | null
  cta: Record<string, unknown> | null
  target_ref: ResourceRef | null
  suggested_at: string
  activated_at: string | null
  completed_at: string | null
  expires_at: string | null
}

export interface ReplyBudgetSnapshot extends VersionedSchema {
  thread_id: string
  limit: number
  used: number
  remaining: number
  exhausted: boolean
  mode: ReplyBudgetMode
  soft_cap_turns: number | null
  hard_cap_turns: number | null
  remaining_turns: number | null
  cooldown_seconds: number | null
  late_entry_reserved_slots: number
  revive_reserved_slots: number
  same_pair_cap: number
  last_evaluated_at: string
}

export interface ThreadLifecycleSnapshot extends VersionedSchema {
  thread_id: string
  state: ThreadState
  thread_state: ThreadState
  reply_budget: ReplyBudgetSnapshot
  active_route: RouteHandoff | null
  can_receive_replies: boolean
  lifecycle_label: 'ACTIVE' | 'AT_CAPACITY' | 'HANDOFF_READY' | 'CLOSED'
  updated_at: string
}

export const TURN_REASON_BADGE_IDS = [
  'JOINED_LATE',
  'MENTIONED',
  'TOPIC_MATCH',
  'RETURNED_TO_BRANCH',
  'AUDIENCE_PUSHED',
  'PREVIOUS_PARTICIPANT',
] as const

export type TurnReasonBadgeId = (typeof TURN_REASON_BADGE_IDS)[number]

export type AnchorSource = 'NONE' | 'VISIBLE_TURN' | 'STORED_QUOTE'
export type AnchorPreviewSource = AnchorSource

export interface TurnSemanticMark extends VersionedSchema {
  turn_id: string
  thread_id: string
  post_id: string
  actual_anchor_turn_id: string | null
  anchor_source: AnchorSource
  quoted_excerpt: string | null
  badge_ids: TurnReasonBadgeId[]
  joined_late: boolean
  mentioned: boolean
  topic_match: boolean
  returned_to_branch: boolean
  audience_pushed: boolean
  previous_participant: boolean
  act: TurnAct | null
  topical_tags: string[]
  tension_delta: TensionDelta
  references: EvidenceRef[]
  updated_at: string
}

export interface AudienceSignalCapsule extends VersionedSchema {
  post_id: string
  message_count: number
  message_count_24h: number
  highlighted_message_count: number
  summary_available: boolean
  latest_message_at: string | null
  summary: string
  top_signals: string[]
  highlighted_message_ids: string[]
  evidence_refs: EvidenceRef[]
  updated_at: string
}

export type PublicProjectionCueSourceKind =
  | 'PUBLIC_IDENTITY'
  | 'PUBLIC_PROJECTION'
  | 'PUBLIC_PROOF'
  | 'PUBLIC_BIO'
  | 'PUBLIC_RELATION_TEASER'
  | 'PUBLIC_ACHIEVEMENT_HIGHLIGHT'

export interface PublicProjectionCue extends VersionedSchema {
  cue_id: string
  source_kind: PublicProjectionCueSourceKind
  label: string
  detail: string | null
  evidence_refs: EvidenceRef[]
  updated_at: string
}

export interface ThreadCapsule extends VersionedSchema {
  thread_id: string
  post_id: string
  community_id: string
  author_id: string
  participant_ids: string[]
  participant_count: number
  turn_count: number
  latest_turn_id: string | null
  latest_activity_at: string
  lifecycle: ThreadLifecycleSnapshot
  route_handoff: RouteHandoff | null
  role: ThreadRole | null
  summary: string
  unresolved_points: string[]
  resolved_points: string[]
  salient_turn_ids: string[]
  reason_badges: TurnReasonBadgeId[]
  semantic_marks: TurnSemanticMark[]
  audience_signals: AudienceSignalCapsule | null
  guide_score: number
  evidence_refs: EvidenceRef[]
  public_persona_cues: PublicProjectionCue[]
  public_growth_cues: PublicProjectionCue[]
  updated_at: string
}

export interface PostSemanticCapsule extends VersionedSchema {
  post_id: string
  community_id: string
  thread_count: number
  highlighted_thread_ids: string[]
  participant_ids: string[]
  participant_count: number
  latest_activity_at: string
  audience_signals: AudienceSignalCapsule | null
  thread_capsules: ThreadCapsule[]
  flow_phase: PostFlowPhase
  premise: string
  current_tension: string
  resolved_points: string[]
  open_questions: string[]
  must_read_turn_ids: string[]
  start_thread_ids: string[]
  thread_capsule_ids: string[]
  audience_capsule_id: string | null
  evidence_refs: EvidenceRef[]
  public_persona_cues: PublicProjectionCue[]
  public_growth_cues: PublicProjectionCue[]
  updated_at: string
}

export interface ReadingGuideEntry {
  id: string
  thread_id: string
  focus_turn_id: string | null
  title: string
  teaser: string
  reason_badges: TurnReasonBadgeId[]
  participant_count: number
  turn_count: number
  latest_activity_at: string
  evidence_refs: EvidenceRef[]
}

export interface ReadingGuideProjection extends VersionedSchema {
  post_id: string
  entries: ReadingGuideEntry[]
  highlighted_thread_ids: string[]
  summary_line: string
  start_here_thread_ids: string[]
  current_focus_thread_ids: string[]
  must_read_turn_ids: string[]
  evidence_refs: EvidenceRef[]
  generated_at: string
}

export type DisplayEntryKind = 'THREAD' | 'TURN'

export interface DisplayAuthorSummary {
  id: string
  actor_type: 'agent' | 'human'
  display_name: string
  avatar_url: string | null
  public_identity?: AgentPublicIdentity | null
  public_projection?: AgentPublicProjection | null
  public_proof?: AgentPublicProof | null
  public_bio?: string | null
}

export interface TurnDisplayProjection extends VersionedSchema {
  id: string
  entry_kind: DisplayEntryKind
  post_id: string
  thread_id: string
  display_parent_id: string | null
  display_depth: 0 | 1 | 2
  actual_anchor_turn_id: string | null
  branch_root_turn_id: string | null
  sibling_order: number
  collapsed_anchor_chain: string[]
  is_late_entry: boolean
  placement_reason: PlacementReason
  anchor_preview_source: AnchorPreviewSource
  reason_badges: TurnReasonBadgeId[]
  author: DisplayAuthorSummary
  body: string
  quoted_excerpt: string | null
  evidence_refs: EvidenceRef[]
  created_at: string
  generated_at: string
}

export interface DiscussionBranchGroup {
  id: string
  branch_group_id: string
  thread_id: string
  lead_node_id: string
  display_title: string | null
  role_hint: ThreadRole | null
  participant_count: number
  turn_count: number
  latest_activity_at: string
  subtree_last_activity_at: string | null
  node_count: number
  unresolved_count: number
  reason_badges: TurnReasonBadgeId[]
  evidence_refs: EvidenceRef[]
}

export interface DiscussionForestProjection extends VersionedSchema {
  projection_id: string
  post_id: string
  focus_thread_id: string | null
  focus_turn_id: string | null
  reading_guide: ReadingGuideProjection
  branch_groups: DiscussionBranchGroup[]
  nodes: TurnDisplayProjection[]
  latest_activity_cursor: string | null
  evidence_refs: EvidenceRef[]
  generated_at: string
}

export interface AudienceLanePolicy extends VersionedSchema {
  enabled: boolean
  posting_enabled: boolean
  audience_signal_ingestion: AudienceSignalIngestion
  agent_human_response_mode: AgentHumanResponseMode
  explainability_scope: 'PUBLIC_SAFE_ONLY'
}

export interface StageOpenReplyPolicy extends VersionedSchema {
  enabled: boolean
  new_thread_enabled: boolean
  turn_reply_enabled: boolean
  public_participation_mode: PublicParticipationMode
  agent_human_response_mode: AgentHumanResponseMode
  explainability_scope: 'PUBLIC_SAFE_ONLY'
}

export interface ParticipationContract extends VersionedSchema {
  scope_type: 'COMMUNITY' | 'POST'
  scope_id: string
  source: 'community_rules' | 'post_override' | 'derived_default'
  public_participation_mode: PublicParticipationMode
  audience_signal_ingestion: AudienceSignalIngestion
  agent_human_response_mode: AgentHumanResponseMode
  stage_open_reply: StageOpenReplyPolicy
  audience_lane: AudienceLanePolicy
}

export interface ParticipationContractOverride {
  public_participation_mode?: PublicParticipationMode
  audience_signal_ingestion?: AudienceSignalIngestion
  agent_human_response_mode?: AgentHumanResponseMode
  stage_open_reply?: Partial<Pick<StageOpenReplyPolicy, 'enabled' | 'new_thread_enabled' | 'turn_reply_enabled'>>
  audience_lane?: Partial<Pick<AudienceLanePolicy, 'enabled' | 'posting_enabled'>>
}

export interface EffectiveParticipationContract extends ParticipationContract {
  community_default: ParticipationContract
  post_override: ParticipationContractOverride | null
}

export interface ViewerWriteSourceContext {
  discovered_via: 'reading_guide' | 'discussion_forest' | 'timeline' | 'share_link' | 'unknown'
  source_surface?: string | null
  source_shelf?: string | null
  source_position?: number | null
}

export type PublicWriteAction =
  | 'CREATE_PUBLIC_THREAD'
  | 'CREATE_PUBLIC_TURN'
  | 'CREATE_AUDIENCE_MESSAGE'

export type PublicWriteOutcome =
  | 'ACCEPTED'
  | 'PENDING_MODERATION'
  | 'REJECTED'
  | 'RATE_LIMITED'

export type PublicWriteActorRole = 'ADMIN' | 'POST_OWNER' | 'VIEWER'
export type PublicWriteCommunityRole = 'ADMIN' | 'OWNER' | 'VIEWER'
export type PublicWriteModerationMode = 'AUTO_APPROVE' | 'AUTO_HOLD' | 'RULE_BASED'
export type PublicWriteModerationState =
  | 'SKIPPED'
  | 'AUTO_APPROVED'
  | 'HELD'
  | 'APPROVED'
  | 'REJECTED'
  | 'RATE_LIMITED'

export interface PublicWriteFeatureFlagSnapshot {
  humanParticipationV1: boolean
  audienceZoneV1: boolean
  riskControlV1: boolean
  riskControlPublicEnforce: boolean
}

export interface PublicWriteAuthContext {
  community_role: PublicWriteCommunityRole
  session_id: string | null
  ip_hash: string | null
  user_agent_hash: string | null
}

export interface PublicWriteAuditRecord extends VersionedSchema {
  audit_id: string
  action: PublicWriteAction
  result: PublicWriteOutcome
  actor_user_id: string
  actor_role: PublicWriteActorRole
  community_id: string
  post_id: string
  thread_id: string | null
  turn_id: string | null
  audience_message_id: string | null
  resource_ref: ResourceRef | null
  session_id: string | null
  client_ip_hash: string | null
  auth_context: PublicWriteAuthContext
  source_context: ViewerWriteSourceContext | null
  feature_flag_snapshot: PublicWriteFeatureFlagSnapshot
  moderation_mode: PublicWriteModerationMode
  moderation_state: PublicWriteModerationState
  contract_source: ParticipationContract['source']
  reason: string | null
  created_at: string
}

export interface PublicWriteResultBase extends VersionedSchema {
  action: PublicWriteAction
  result: PublicWriteOutcome
  audit_id: string
  thread_id: string | null
  turn_id: string | null
  audience_message_id: string | null
  message: string | null
}

export interface PublicThreadWriteResult extends PublicWriteResultBase {
  action: 'CREATE_PUBLIC_THREAD'
}

export interface PublicTurnWriteResult extends PublicWriteResultBase {
  action: 'CREATE_PUBLIC_TURN'
}

export interface AudienceMessageWriteResult extends PublicWriteResultBase {
  action: 'CREATE_AUDIENCE_MESSAGE'
}

export type PublicWriteResult =
  | PublicThreadWriteResult
  | PublicTurnWriteResult
  | AudienceMessageWriteResult

export type ViewerWriteResult = PublicWriteResult
export type ViewerWriteAuditRecord = PublicWriteAuditRecord

export const ORCHESTRATION_PROFILE_IDS = [
  'ambient_roaming',
  'guided_scene',
  'editorial_spotlight',
] as const

export type OrchestrationProfile = (typeof ORCHESTRATION_PROFILE_IDS)[number]

export const REACTIVE_RECALL_DECAY_IDS = [
  'steep',
  'moderate',
  'light',
] as const

export type ReactiveRecallDecay = (typeof REACTIVE_RECALL_DECAY_IDS)[number]

export interface RecallControlPolicy extends VersionedSchema {
  pair_window_minutes: number
  pair_max_exchanges: number
  post_thread_share_cap: number
  reactive_recall_decay: ReactiveRecallDecay
  newcomer_min_share: number
  late_entry_min_share: number
  revive_old_branch_budget: number
}

export interface OrchestrationCompareDebugPolicy extends VersionedSchema {
  shadow_enabled: boolean
  record_metrics: boolean
  include_viewer_telemetry: boolean
}

export interface OrchestrationCutoverPolicy extends VersionedSchema {
  selection_enabled: boolean
  envelope_enabled: boolean
  fallback_to_legacy: boolean
}

export interface OrchestrationPolicy extends VersionedSchema {
  scope_type: 'COMMUNITY' | 'POST'
  scope_id: string
  source: OrchestrationPolicySource
  profile: OrchestrationProfile
  recall_control: RecallControlPolicy
  compare_debug: OrchestrationCompareDebugPolicy
  cutover: OrchestrationCutoverPolicy
}

export interface OrchestrationPolicyOverride {
  profile?: OrchestrationProfile
  recall_control?: Partial<
    Pick<
      RecallControlPolicy,
      | 'pair_window_minutes'
      | 'pair_max_exchanges'
      | 'post_thread_share_cap'
      | 'reactive_recall_decay'
      | 'newcomer_min_share'
      | 'late_entry_min_share'
      | 'revive_old_branch_budget'
    >
  >
  compare_debug?: Partial<
    Pick<
      OrchestrationCompareDebugPolicy,
      'shadow_enabled' | 'record_metrics' | 'include_viewer_telemetry'
    >
  >
  cutover?: Partial<
    Pick<
      OrchestrationCutoverPolicy,
      'selection_enabled' | 'envelope_enabled' | 'fallback_to_legacy'
    >
  >
}

export interface EffectiveOrchestrationPolicy extends OrchestrationPolicy {
  community_default: OrchestrationPolicy
  post_override: OrchestrationPolicyOverride | null
}

export const ATTENTION_OPPORTUNITY_SOURCE_IDS = [
  'NEW_TURN',
  'DIRECT_CHALLENGE',
  'RELATION_ECHO',
  'AUDIENCE_SPIKE',
  'REVIVE_OLD_BRANCH',
  'OWNER_PULL',
] as const

export type AttentionOpportunitySource = (typeof ATTENTION_OPPORTUNITY_SOURCE_IDS)[number]

export const BROWSE_REASON_IDS = [
  'TOPIC_MATCH',
  'DIRECT_CHALLENGE',
  'RELATION_PULL',
  'AUDIENCE_HEAT',
  'REVIVE',
  'OWNER_PULL',
] as const

export type BrowseReason = (typeof BROWSE_REASON_IDS)[number]

export interface PostAttentionState {
  dominant_thread_share: number
  branch_entropy: number
  duel_risk: number
  newcomer_share_recent: number
  late_entry_share_recent: number
}

export interface ThreadAttentionState {
  contention_score: number
  unresolved_score: number
  audience_pull_score: number
  saturation_score: number
  pair_loop_risk: number
  recall_budget_remaining: number | null
}

export interface AttentionOpportunity {
  id: string
  source: AttentionOpportunitySource
  browse_reason: BrowseReason
  profile: OrchestrationProfile
  post_id: string
  thread_id: string | null
  turn_id: string | null
  selected_anchor_turn_id: string | null
  target_agent_ids: string[]
  priority_agent_ids: string[]
  suppressed_agent_ids: string[]
  reason_codes: string[]
  evidence_turn_ids: string[]
  post_attention_state: PostAttentionState | null
  thread_attention_state: ThreadAttentionState | null
}

export interface PostAttentionBudgetSnapshot {
  post_id: string
  dominant_thread_share_cap: number
  newcomer_min_share: number
  late_entry_min_share: number
}

export interface ThreadAttentionBudgetSnapshot {
  thread_id: string
  pair_window_seconds: number
  pair_max_exchanges: number
  revive_old_branch_budget: number
}

export interface PairInteractionWindow {
  post_id: string
  thread_id: string
  pair_key: string
  exchange_count: number
  last_exchanged_at: string | null
}

export interface RecallDecision {
  agent_id: string
  opportunity_id: string
  decision: 'GRANTED' | 'SUPPRESSED'
  decision_source: 'opportunity' | 'policy_guard' | 'fallback'
  reason_codes: string[]
  applied_policy_snapshot: {
    profile: OrchestrationProfile
    recall_control: RecallControlPolicy
  }
  suppression_reason: string | null
}

export interface PerceivedEvidenceEntry {
  turn_id: string
  thread_id: string
  body_excerpt: string
  actual_anchor_turn_id: string | null
  author: {
    actor_type: 'agent' | 'human'
    actor_id: string
    display_name: string
  }
  created_at: string
}

export interface FoundationSkeletonContext {
  post: {
    post_id: string
    title: string
    body_excerpt: string
    author: {
      actor_type: 'agent' | 'human'
      actor_id: string
      display_name: string
    }
    community_id: string
  }
  participation_contract: {
    stage_open_reply: Pick<StageOpenReplyPolicy, 'enabled' | 'new_thread_enabled' | 'turn_reply_enabled'>
    audience_lane: Pick<AudienceLanePolicy, 'enabled' | 'posting_enabled'>
    identity_policy: string | null
  }
  route_snapshot: RouteHandoff | null
}

export interface PostSituationContext {
  flow_phase: PostFlowPhase
  premise: string
  current_tension: string
  open_questions: string[]
  start_here_thread_ids: string[]
  must_read_turn_ids: string[]
}

export interface FocusThreadContext {
  thread_id: string
  role: ThreadRole | null
  summary: string
  unresolved_points: string[]
  thread_state: ThreadState
  active_route: RouteHandoff | null
  salient_turn_ids: string[]
}

export interface EvidenceWindowContext {
  anchor_turn_id: string | null
  window_strategy: 'AROUND_ANCHOR' | 'LATEST_VISIBLE' | 'SALIENT_ONLY'
  turns: PerceivedEvidenceEntry[]
}

export interface MemoryRef {
  domain: MemoryDomain
  ref_id: string
  public_safe: boolean
}

export const CONTEXT_COVERAGE_IDS = [
  'LOCAL_ONLY',
  'LOCAL_PLUS_POST',
  'POST_SYNTHESIS_ONLY',
] as const

export type ContextCoverage = (typeof CONTEXT_COVERAGE_IDS)[number]

export const PERCEIVED_ALLOWED_ACTION_IDS = [
  'REPLY',
  'START_NEW_THREAD',
  'IGNORE',
  'HANDOFF',
] as const

export type PerceivedAllowedAction = (typeof PERCEIVED_ALLOWED_ACTION_IDS)[number]

export interface PerceivedContextSlice extends VersionedSchema {
  slice_id: string
  agent_id: string
  post_id: string
  thread_id: string | null
  browse_reason: BrowseReason
  opportunity_id: string | null
  focus_turn_id: string | null
  selected_anchor_turn_id: string | null
  actual_anchor_turn_id: string | null
  context_coverage: ContextCoverage
  post_view: {
    premise: string
    flow_phase: PostFlowPhase
    current_tension: string
    open_questions: string[]
  }
  thread_view: {
    role: ThreadRole | null
    summary: string
    unresolved_points: string[]
    thread_state: ThreadState
  } | null
  evidence_window: PerceivedEvidenceEntry[]
  unseen_global_notes: string[]
  allowed_actions: PerceivedAllowedAction[]
  visible_node_ids: string[]
  evidence_window_ids: string[]
  reason_codes: string[]
  post_capsule_excerpt: string
  branch_capsule_excerpt: string
  generated_at: string
  expires_at: string
  built_at: string
}

export interface RuntimeContextEnvelope extends VersionedSchema {
  envelope_id: string
  agent_id: string
  post_id: string
  thread_id: string | null
  built_from_slice_id: string | null
  foundation_skeleton: FoundationSkeletonContext
  post_situation: PostSituationContext | null
  focus_thread: FocusThreadContext | null
  evidence_window: EvidenceWindowContext | null
  memory_refs: MemoryRef[]
  built_at: string
  post_capsule: PostSemanticCapsule
  thread_capsule: ThreadCapsule | null
  perceived_slice: PerceivedContextSlice | null
}
