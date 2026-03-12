export interface ApiResponse<T = unknown> {
  data: T
  meta?: {
    cursor?: string
    total?: number
    range?: string
    [key: string]: unknown
  }
}

export interface ApiError {
  error: {
    code: string
    message: string
    details?: unknown
  }
}

export type GuidanceActorType = 'VISITOR' | 'USER'
export type GuidanceTrack = 'UNDECIDED' | 'SPECTATOR' | 'OWNER'
export type GuidanceStage = 'NEW_VISITOR' | 'EXPLORING' | 'FIRST_SUCCESS' | 'RETAINED'
export type GuidanceInboxStatus = 'ACTIVE' | 'COMPLETED' | 'DISMISSED'
export type GuidanceItemModuleType = 'CARD' | 'RECEIPT'
export type GuidanceSummaryModuleType = 'DUAL_ENTRY' | 'CHECKLIST' | 'CARD' | 'RECEIPT'

export interface GuidanceCta {
  label: string
  target: string
  event_name?: string
  payload?: Record<string, unknown>
}

export interface GuidanceDualEntryCard {
  track: Exclude<GuidanceTrack, 'UNDECIDED'>
  title: string
  promise: string
  entry_cta: GuidanceCta
  return_hook: string
}

export interface GuidanceDualEntryModule {
  type: 'DUAL_ENTRY'
  reason_code: string
  hero_body: string
  cards: GuidanceDualEntryCard[]
}

export interface GuidanceChecklistItem {
  reason_code: string
  title: string
  body: string
  completed: boolean
  cta: GuidanceCta | null
}

export interface GuidanceChecklistModule {
  type: 'CHECKLIST'
  title: string
  items: GuidanceChecklistItem[]
}

export interface GuidanceItemCard {
  id: string
  module_type: GuidanceItemModuleType
  reason_code: string
  title: string
  body: string
  unread: boolean
  status: GuidanceInboxStatus
  cta: GuidanceCta | null
  payload: Record<string, unknown> | null
  related_agent_id: string | null
  related_session_id: string | null
  created_at: string
  updated_at: string
}

export interface GuidanceItemModule {
  type: GuidanceItemModuleType
  item: GuidanceItemCard
}

export type GuidanceSummaryModule =
  | GuidanceDualEntryModule
  | GuidanceChecklistModule
  | GuidanceItemModule

export interface GuidanceActorState {
  actor_type: GuidanceActorType
  actor_id: string
  current_track: GuidanceTrack
  stage: GuidanceStage
  explained: {
    two_tracks: boolean
  }
  completed: {
    followed_first_agent: boolean
    used_following_feed: boolean
    created_agent: boolean
    started_private_chat: boolean
    nurture_receipt_ready: boolean
    watch_public_effect: boolean
  }
  first_success: {
    achieved: boolean
    at: string | null
  }
  reveal: {
    style: boolean
    instructions: boolean
    advanced: boolean
  }
  latest_owner_agent_id: string | null
  latest_receipt_session_id: string | null
}

export interface GuidanceSummaryData {
  actor: GuidanceActorState
  modules: GuidanceSummaryModule[]
}

export interface GuidanceInboxData {
  items: GuidanceItemCard[]
  unread_count: number
}

export type GuidanceBellData = GuidanceInboxData

export interface GuidanceRuntimeReasonMetric {
  delivered: number
  opened: number
  dismissed: number
  completed: number
}

export interface GuidanceRuntimeData {
  flags: {
    guidance_v1: boolean
    guidance_recall_v1: boolean
  }
  bell: {
    unread_count: number
    active_count: number
  }
  per_reason: Record<string, GuidanceRuntimeReasonMetric>
  avg_delivery_delay_ms: number | null
  suppression: {
    same_reason_count: number
    daily_cap_count: number
  }
  teaching_first_violation_count: number
}

export interface RuntimeFeaturesData {
  flags: Record<string, unknown>
  runtime: Record<string, unknown>
  counters: Record<string, unknown>
  persona_observability: Record<string, unknown>
  rich_communities: Record<string, unknown>
  guidance: GuidanceRuntimeData
  observability: Record<string, unknown>
}

export type ContentVisibility = 'PUBLIC' | 'GRAY' | 'QUARANTINE'
export type ContentState = 'PENDING' | 'APPROVED' | 'REJECTED'
export type ModerationVerdict = 'APPROVE' | 'FOLD' | 'QUARANTINE' | 'REJECT'
export type AgentStatus = 'ACTIVE' | 'LIMITED' | 'QUARANTINED' | 'BANNED'
export type VoteDirection = 'UP' | 'DOWN' | 'NEUTRAL'
export type IdentityContractSource = 'contract_v1' | 'legacy_persona_style' | 'legacy_default'
export type GovernanceActionType =
  | 'approve'
  | 'fold'
  | 'quarantine'
  | 'reject'
  | 'ban_agent'
  | 'unban_agent'

export interface Post {
  id: string
  community_id: string
  author_agent_id: string
  title: string
  body: string
  tags: string[]
  visibility: ContentVisibility
  state: ContentState
  created_at: string
  updated_at: string
}

export interface AuthorSummary {
  id: string
  display_name: string
  avatar_url: string | null
  badges?: Array<{ code: string; name: string; tier: 1 | 2 | 3 }>
  tagline?: string
}

export interface PostMediaItem {
  asset_id: string
  media_url: string
  mime_type: string
}

export interface PostWithMeta extends Post {
  comment_count: number
  vote_score: number
  vote_up: number
  vote_down: number
  agent_vote_score: number
  agent_vote_up: number
  agent_vote_down: number
  human_vote_score: number
  human_vote_up: number
  human_vote_down: number
  weighted_vote_score: number
  viewer_human_vote_direction: VoteDirection | null
  participant_count: number
  last_reply_at: string | null
  heat_score: number
  author: AuthorSummary
  community_slug: string
  community_name: string
  media: PostMediaItem[]
  ai_label?: string
  effective_moderation_label?: string
  aftershow_summary?: AftershowSummary | null
  aftershow_callouts?: AftershowCalloutItem[]
  audience_thread_meta?: AudienceThreadMeta | null
}

export interface AudienceThreadMeta {
  thread_id: string
  status: string
  message_count: number
  latest_message_at: string | null
}

export interface AftershowSummary {
  id: string
  status: string
  summary_text: string
  content: Record<string, unknown> | null
  published_at: string | null
  correlation_id: string | null
}

export interface AftershowCalloutItem {
  id: string
  artifact_id: string
  user_id: string
  audience_message_id: string
  reason: string
  evidence_ref: string | null
  notification_id: string | null
  invalidated_at: string | null
  meta: Record<string, unknown> | null
  created_at: string
  callout_index: number
  deep_link: string
}

export interface AftershowSnapshot {
  post_id: string
  aftershow_summary: AftershowSummary | null
  aftershow_callouts: AftershowCalloutItem[]
  audience_thread_meta: AudienceThreadMeta | null
}

export interface AudienceThread {
  id: string
  post_id: string
  community_id: string
  status: string
  created_at: string
  updated_at: string
}

export interface AudienceMessage {
  id: string
  thread_id: string
  author_user_id: string
  body: string
  created_at: string
}

export interface AudienceThreadData {
  thread: AudienceThread
  messages: AudienceMessage[]
}

export interface AudienceMessageCreateResult {
  thread: AudienceThread
  message: AudienceMessage
}

export interface AsideSeat {
  id: string
  community_id: string
  post_id: string | null
  agent_id: string
  scope: 'COMMUNITY' | 'POST'
  scope_id: string
  role: string
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED'
  assigned_by: string | null
  expires_at: string | null
  revoked_at: string | null
  meta: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface AsideSeatsData {
  post_id: string
  seats: AsideSeat[]
  stage_limits: {
    capacity: number
    cooldown_seconds: number
  }
}

export interface Comment {
  id: string
  post_id: string
  parent_comment_id: string | null
  author_agent_id: string
  body: string
  visibility: ContentVisibility
  state: ContentState
  created_at: string
  updated_at: string
  author?: AuthorSummary
  vote_score?: number
  agent_vote_score?: number
  agent_vote_up?: number
  agent_vote_down?: number
  human_vote_score?: number
  human_vote_up?: number
  human_vote_down?: number
  weighted_vote_score?: number
  viewer_human_vote_direction?: VoteDirection | null
  ai_label?: string
  effective_moderation_label?: string
}

export interface Vote {
  id: string
  voter_agent_id: string
  target_type: 'POST' | 'COMMENT' | 'MESSAGE'
  target_id: string
  direction: VoteDirection
  weight: number
  created_at: string
}

export interface Agent {
  id: string
  owner_id: string
  display_name: string
  avatar_url: string | null
  model: string
  persona_version: number
  reputation_score: number
  status: AgentStatus
  persona_seed_code?: string
  persona_seed_label?: string
  home_voice_line_id?: string
  home_voice_line_label?: string
  identity_contract?: AgentIdentityContract
  is_followed?: boolean
  created_at: string
  updated_at: string
}

export interface AgentIdentityVisiblePersona {
  name: string
  style: string
  interests: string[]
  language: string
}

export interface OwnerStylePins extends StyleSettings {
  interests?: string[]
}

export interface AgentIdentityContract {
  source: IdentityContractSource
  persona_seed_code: string
  persona_seed_label: string
  home_voice_line_id: string
  home_voice_line_label: string
  owner_style_pins: OwnerStylePins
  visible_persona: AgentIdentityVisiblePersona
}

export interface EvidenceRef {
  kind: string
  ref_id: string
  summary?: string
  url?: string
  at?: string | null
  weight?: number
}

export type AchievementVisibility = 'PUBLIC' | 'OWNER_ONLY'
export type AchievementScope = 'global' | 'community' | 'peer'
export type ChronicleType = 'ACHIEVEMENT' | 'RELATION_CHANGE' | 'HIGHLIGHT' | 'PRIVATE_DIGEST' | 'MODERATION'

export interface AgentAchievementItem {
  id: string
  agent_id: string
  code: string
  name: string
  category: string
  tier: 1 | 2 | 3
  scope: AchievementScope
  scope_key: string
  rarity: number
  visibility: AchievementVisibility
  achieved_at: string
  evidence: EvidenceRef[]
  meta: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface ChronicleEntryItem {
  id: string
  agent_id: string
  visibility: AchievementVisibility
  type: ChronicleType
  occurred_at: string
  title: string
  summary: string
  importance_score: number
  evidence: EvidenceRef[]
  actors: string[]
  location: string | null
  tags: string[]
  meta: Record<string, unknown> | null
  dedup_key: string | null
  created_at: string
  updated_at: string
}

export interface AgentHighlightsData {
  agent_id: string
  badges: Array<{ code: string; name: string; tier: 1 | 2 | 3 }>
  tagline: string | null
  top_chronicle: Array<{
    id: string
    title: string
    summary: string
    occurred_at: string
    importance_score: number
  }>
}

export interface GlobalHighlightsData {
  hot_threads: Array<{
    post_id: string
    community_id: string
    community_name: string
    title: string
    vote_score: number
    comment_count: number
    participant_count: number
    heat_score: number
    last_reply_at: string | null
    author: {
      id: string
      display_name: string
      avatar_url: string | null
    }
  }>
  featured_agents: Array<{
    agent_id: string
    display_name: string
    badges: Array<{ code: string; name: string; tier: 1 | 2 | 3 }>
    tagline: string | null
    top_chronicle: Array<{
      id: string
      title: string
      summary: string
      occurred_at: string
      importance_score: number
    }>
  }>
  controversy: Array<{
    post_id: string
    title: string
    controversy_score: number
    vote_up: number
    vote_down: number
    participant_count: number
    community_name: string
  }>
  wildcard_cameos: Array<{
    chronicle_id: string
    agent_id: string
    title: string
    summary: string
    occurred_at: string
    importance_score: number
  }>
  meta: {
    range: 'today'
    generated_at: string
    source: string
  }
}

export interface AgentSearchItem {
  id: string
  display_name: string
  avatar_url: string | null
  status: AgentStatus
  model: string
  persona_seed_code: string
  persona_seed_label: string
  home_voice_line_id: string
  home_voice_line_label: string
  identity_contract_source: IdentityContractSource
  is_followed: boolean
}

export interface FollowedAgentItem {
  id: string
  display_name: string
  avatar_url: string | null
  status: AgentStatus
  model: string
  persona_seed_code: string
  persona_seed_label: string
  home_voice_line_id: string
  home_voice_line_label: string
  identity_contract_source: IdentityContractSource
  followed_at: string
}

export interface HumanVoteSummary {
  agent_up: number
  agent_down: number
  agent_score: number
  human_up: number
  human_down: number
  human_score: number
  weighted_score: number
}

export interface HumanVoteResult {
  vote: {
    id: string
    direction: VoteDirection
    target_type: 'POST' | 'COMMENT'
    target_id: string
  }
  summary: HumanVoteSummary
}

export type InclinationAssetSourceType = 'URL' | 'UPLOAD'
export type InclinationAssetStatus = 'PENDING' | 'CONSUMED' | 'CANCELLED' | 'REPLACED' | 'FAILED'

export interface InclinationVisionSummary {
  theme: string
  scene: string
  mood: string
  discussion_points: string[]
}

export interface InclinationAsset {
  asset_id: string
  status: InclinationAssetStatus
  media_url: string
  mime_type: string
  file_size_bytes: number
  owner_note: string | null
  vision_summary: InclinationVisionSummary
  created_at: string
}

export interface InclinationAssetCurrentState {
  pending: InclinationAsset | null
  last_consumed: InclinationAsset | null
}

export interface AgentConfig {
  id: string
  agent_id: string
  config_json: Record<string, unknown>
  risk_level?: 'LOW' | 'HIGH'
  review_status?: 'NOT_REQUIRED' | 'PENDING' | 'APPROVED' | 'REJECTED'
  review_case_id?: string | null
  lint_warnings?: string[]
  updated_at: string
  effective_at: string
  updated_by: string
}

export interface AgentRun {
  id: string
  agent_id: string
  trigger_event_id: string
  input_digest: string
  output_json: Record<string, unknown> | null
  moderation_result: ModerationVerdict | null
  token_cost: number
  latency_ms: number
  created_at: string
}

export interface Community {
  id: string
  name: string
  slug: string
  description: string | null
  rules_json: Record<string, unknown> | null
  visibility_default: ContentVisibility
  created_at: string
  updated_at: string
}

export interface GovernanceResult {
  success: boolean
  action: GovernanceActionType
  target_id: string
  new_visibility?: ContentVisibility
  new_state?: ContentState
}

export interface ReviewCase {
  id: string
  case_type: 'MODERATION' | 'COMPLAINT' | 'APPEAL' | 'IDENTITY_REVIEW' | 'CONFIG_REVIEW' | 'HOT_TOPIC'
  status: 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'DISMISSED'
  priority: number
  summary_text: string | null
  opened_reason: string | null
  opened_by: string
  assigned_to_user_id: string | null
  linked_policy_snapshot_id: string | null
  linked_complaint_ticket_id: string | null
  linked_appeal_request_id: string | null
  resolution_action: string | null
  resolved_at: string | null
  created_at: string
  updated_at: string
}

export interface ReviewCaseTarget {
  id: string
  case_id: string
  target_type: string
  target_id: string
  channel: string
  community_id: string | null
  agent_id: string | null
  user_id: string | null
  room_id: string | null
  session_id: string | null
  message_id: string | null
  created_at: string
}

export interface ReviewEvidenceSnapshot {
  id: string
  case_id: string
  snapshot_type: string
  payload: Record<string, unknown>
  created_at: string
}

export interface ReviewTask {
  id: string
  case_id: string
  task_type: string
  status: 'PENDING' | 'ASSIGNED' | 'COMPLETED' | 'CANCELED'
  assignee_user_id: string | null
  due_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface ReviewCaseDetail {
  case: ReviewCase
  targets: ReviewCaseTarget[]
  evidence: ReviewEvidenceSnapshot[]
  tasks: ReviewTask[]
}

export interface IdentityVerification {
  id: string
  user_id: string
  status: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'EXPIRED'
  method: 'MANUAL_REVIEW' | 'SUPPLIER_PLACEHOLDER'
  reviewed_by_user_id: string | null
  reason: string | null
  submitted_at: string
  reviewed_at: string | null
  expires_at: string | null
  meta: Record<string, unknown> | null
}

export interface ComplaintTicket {
  id: string
  reporter_user_id: string
  target_type: string
  target_id: string
  reason_code: string
  detail_text: string | null
  status: 'OPEN' | 'LINKED' | 'RESOLVED' | 'REJECTED'
  linked_case_id: string | null
  created_at: string
  updated_at: string
}

export interface AppealRequest {
  id: string
  requester_user_id: string
  target_type: string
  target_id: string
  linked_case_id: string | null
  linked_complaint_ticket_id: string | null
  reason: string
  status: 'OPEN' | 'LINKED' | 'RESOLVED' | 'REJECTED'
  created_at: string
  updated_at: string
}

export interface HealthData {
  status: string
  timestamp: string
  uptime: number
}

export interface PaginationParams {
  cursor?: string
  limit?: number
}

export type FeedSort = 'new' | 'hot' | 'top'

export interface FeedParams extends PaginationParams {
  community_id?: string
  sort?: FeedSort
  following_only?: boolean
}

// ─── Chat types ──────────────────────────────────────────────

export type RoomStatus = 'active' | 'cooling' | 'archived'
export type ChatMessageKind = 'normal' | 'skip_feedback' | 'ambient' | 'greeting'
export type RoomSceneType =
  | 'FREE_CHAT'
  | 'TALK_SHOW'
  | 'ROUND_TABLE'
  | 'ROAST'
  | 'DEBATE'
  | 'SLICE_OF_LIFE'
  | 'STORY_LAB'
export type RoomCastRole =
  | 'HOST'
  | 'REGULAR'
  | 'FOIL'
  | 'SKEPTIC'
  | 'EXPLAINER'
  | 'WILDCARD'
  | 'CHRONICLER'
export type RoomBeatType =
  | 'OPENING'
  | 'HOOK'
  | 'EXPLAIN'
  | 'CLASH'
  | 'CALLBACK'
  | 'COOL_DOWN'
  | 'RECAP'
  | 'LANDING'
export type RoomCueType =
  | 'ADVANCE'
  | 'ASK'
  | 'CALLBACK'
  | 'SUMMARIZE'
  | 'COOL_DOWN'
  | 'CLOSE'
export type RoomHighlightKind =
  | 'CALLBACK'
  | 'PUNCHLINE'
  | 'CHARACTER_MOMENT'
  | 'SUMMARY'
  | 'CLASH'
export type SpotlightPreference = 'LOW' | 'MEDIUM' | 'HIGH'

export interface RoomWanderPolicy {
  enabled: boolean
  entry_cooldown_ms: number
  max_parallel_rooms: number
  min_discoverability_score: number
}

export interface AgentPublicProjectionView {
  id: string
  agent_id: string
  scene_affinity_json: Record<string, number>
  banter_style: string
  conflict_threshold: number
  callback_habit: number
  signature_moves_json: string[]
  disclosure_policy_json: Record<string, unknown>
  follow_targets_json: string[]
  avoid_targets_json: string[]
  role_tendency: RoomCastRole | null
  spotlight_preference: SpotlightPreference
  public_projection_hint: string
  created_at: string
  updated_at: string
}

export interface RoomSelectionLedgerEntry {
  id: string
  room_id: string
  episode_id: string | null
  beat_id: string | null
  program_event_id: string
  candidate_agent_id: string
  selected: boolean
  final_score: number
  reasons_json: Array<{
    code: string
    value: number
    message: string
  }>
  created_at: string
}

export interface RoomProgramEventRecord {
  id: string
  room_id: string
  episode_id: string | null
  beat_id: string | null
  event_type: 'RAW_MESSAGE' | 'ROOM_TICK' | 'PROGRAM_CUE'
  status: 'PENDING' | 'PLANNED' | 'EXECUTED' | 'SKIPPED' | 'FAILED'
  cue_type: RoomCueType | null
  director_goal: string | null
  selected_speaker_agent_id: string | null
  idempotency_key: string
  payload_json: Record<string, unknown> | null
  error_text: string | null
  created_at: string
  updated_at: string
  selection_reasons: RoomSelectionLedgerEntry[]
}

export interface RoomSharedMemory {
  id: string
  room_id: string
  episode_id: string | null
  memory_kind: 'CONTINUITY' | 'CAMEO' | 'CANONIZATION'
  summary_text: string
  tags: string[]
  source_message_id: string | null
  source_highlight_id: string | null
  score: number
  created_at: string
  updated_at: string
}

export interface RoomWatchabilitySummary {
  scene_type: RoomSceneType
  current_beat: RoomBeatType | null
  live_hook: string | null
  unresolved_question: string | null
  active_cast_preview: Array<{
    agent_id: string
    name: string
    role: RoomCastRole
  }>
  last_highlight_text: string | null
  energy: number
  tension: number
  continuity_summary?: string | null
  canonization_note?: string | null
  cameo_hint?: string | null
  snapshot_updated_at: string | null
}

export interface Room {
  id: string
  name: string
  slug: string
  description: string
  community_id: string | null
  created_by_agent_id: string
  max_agents: number
  status: RoomStatus
  last_message_at: string | null
  created_at: string
  updated_at: string
  viewer_can_control?: boolean
  watchability?: RoomWatchabilitySummary | null
}

export interface RoomMember {
  room_id: string
  member_id: string
  member_type: 'agent'
  display_name: string | null
  join_source: 'dispatched' | 'wandering' | 'creator'
  personal_tick_interval: number
  messages_this_hour: number
  last_spoke_at: string | null
  role_hint?: RoomCastRole | null
  wander_eligible?: boolean
  spotlight_weight?: number
  suppressed_until?: string | null
  joined_at: string
}

export interface RoomWithMembers extends Room {
  members: RoomMember[]
}

export interface RoomLiveSnapshot {
  id: string
  room_id: string
  episode_id: string | null
  scene_type: RoomSceneType
  current_beat: RoomBeatType | null
  live_hook: string | null
  unresolved_question: string | null
  recap_short: string | null
  active_cast: Array<{
    agent_id: string
    name: string
    role: RoomCastRole
    last_spoke_at: string | null
  }>
  last_highlight_text: string | null
  energy: number
  tension: number
  message_cursor_id: string | null
  continuity_summary?: string | null
  canonization_note?: string | null
  cameo_hint?: string | null
  version: number
  created_at: string
  updated_at: string
}

export interface RoomCastView {
  room_id: string
  episode_id: string | null
  cast: Array<{
    agent_id: string
    name: string
    role: RoomCastRole
    chemistry_score: number
    spotlight_weight: number
    last_spoke_at: string | null
    role_hint?: RoomCastRole | null
    wander_eligible?: boolean
    suppressed_until?: string | null
    member_spotlight_weight?: number
    projection?: AgentPublicProjectionView | null
  }>
}

export interface RoomProgramView {
  room_id: string
  enabled: boolean
  scene_type: RoomSceneType
  pacing_preset: string
  target_cast_min: number
  target_cast_max: number
  callback_window: number
  recap_every_turns: number
  max_consecutive_turns: number
  idle_cue_after_ms: number
  allow_wandering: boolean
  director_policy: Record<string, unknown>
  wander_policy: RoomWanderPolicy
  discoverability: {
    tags: string[]
    short_hook: string | null
    default_view: string
  }
  current_episode: {
    episode_id: string
    current_beat: RoomBeatType | null
    energy: number
    tension: number
    turn_count: number
    message_count: number
  } | null
}

export interface ChatMessage {
  id: string
  room_id: string
  author_id: string
  author_display_name?: string | null
  author_type: 'agent'
  episode_id: string | null
  beat_id: string | null
  program_event_id: string | null
  speaker_role: RoomCastRole | null
  cue_type: RoomCueType | null
  body: string
  message_kind: ChatMessageKind
  parent_message_id: string | null
  vote_score: number
  moderation_metadata?: Record<string, unknown> | null
  created_at: string
}

export interface RoomHighlight {
  id: string
  room_id: string
  episode_id: string | null
  beat_id: string | null
  source_message_id: string
  kind: RoomHighlightKind
  text: string
  actor_agent_ids: string[]
  score: number
  created_at: string
}

export interface AgentChatConfig {
  talkativeness: number
  allow_wandering: boolean
}

export interface RoomControlMember extends RoomMember {
  name: string
  projection: AgentPublicProjectionView | null
}

export interface RoomControlState {
  room_id: string
  room_status: RoomStatus
  program: RoomProgramView
  snapshot: RoomLiveSnapshot | null
  cast: RoomCastView['cast']
  members: RoomControlMember[]
  recent_highlights: RoomHighlight[]
  recent_program_events: RoomProgramEventRecord[]
  recent_shared_memory: RoomSharedMemory[]
  alerts: string[]
}

// ─── Agent Dashboard / XP types ─────────────────────────────

export interface AgentXpInfo {
  xp: number
  xp_per_growth_point: number
  growth_points_total: number
  growth_points_spent: number
  growth_points_available: number
}

export interface AgentBudgetInfo {
  tier: string
  daily_action_limit: number
  monthly_action_limit: number
  daily_actions_used: number
  monthly_actions_used: number
  daily_reset_at: string
  monthly_reset_at: string
}

export interface AgentCreditInfo {
  credit_score: number
  risk_level: string
  violations: number
  last_violation_at: string | null
}

export interface AgentTraitInfo {
  id: string
  trait_code: string
  category: string
  status: string
  acquired_at: string
  equipped_at: string | null
  evidence: string | null
}

export interface XpEventInfo {
  id: string
  source: string
  title: string
  description: string
  xp_delta: number
  created_at: string
}

export interface AgentDashboardData {
  agent_id: string
  xp: AgentXpInfo
  budget: AgentBudgetInfo | null
  credit: AgentCreditInfo
  traits: AgentTraitInfo[]
  recent_events: XpEventInfo[]
}

export interface CostSummary {
  total_tokens_in: number
  total_tokens_out: number
  action_count: number
  by_action_type: Record<string, { tokens_in: number; tokens_out: number; count: number }>
}

export interface BudgetTierOption {
  daily_action_limit: number
  monthly_action_limit: number
}

export interface TraitDefinition {
  code: string
  emoji: string
  name: string
  category: 'system' | 'adjustable'
  promptFragment: string
}

export interface CreditEventInfo {
  id: string
  delta: number
  reason: string
  created_at: string
}

export interface InstructionInfo {
  id: string
  name: string
  enabled: boolean
  priority: number
  trigger_type: string
  trigger_params: unknown
  body: string
  times_triggered: number
  last_triggered_at: string | null
  created_at: string
}

export interface InstructionTemplate {
  id: string
  name: string
  trigger_type: string
  trigger_params: unknown
  body: string
}

export interface StyleSettings {
  formality: number
  verbosity: number
  mood: string
  habits: string[]
  forum_activity: number
}

export interface PromptOverrides {
  forum_post?: string
  forum_comment?: string
  chat_room?: string
  room_create?: string
  global_prefix?: string
  global_suffix?: string
}

// ─── Agent Stats types ─────────────────────────────────────

export interface AgentStatsInfo {
  unspent_points: number
  granted_points_total: number
  sociability: number
  curiosity: number
  assertiveness: number
  empathy: number
  brashness: number
  cynicism: number
  stubbornness: number
  volatility: number
  memory: number
  learning: number
  version: number
  created_at: string
  updated_at: string
}

export interface AgentStateInfo {
  valence: number
  arousal: number
  confidence: number
  irritability: number
  fatigue: number
  last_updated_at: string
}

export interface AgentStatePoint {
  at: string
  valence: number
  arousal: number
  confidence: number
  irritability: number
  fatigue: number
}

export interface AgentStatEventInfo {
  id: string
  event_type: string
  source: string
  idempotency_key: string | null
  delta_json: Record<string, unknown>
  created_at: string
}

export interface DerivedKnobsInfo {
  participation: {
    participation_bias: number
    participation_multiplier: number
    exploration_noise_scale: number
    p_wander: number
    controversy_appetite: number
  }
  chat: {
    talkativeness_1_5: number
    chat_tick_multiplier: number
  }
  vote: {
    p_vote: number
    p_down_given_vote: number
  }
  relation_policy: {
    pos_multiplier: number
    neg_multiplier: number
    challenge_valence: number
    friend_on: number
    friend_off: number
    block_soft_on: number
    block_hard_on: number
    trust_on: number
    trust_off: number
  }
  memory: {
    top_k_ability: number
    budget_ability: number
    effective_top_k: number
    effective_budget: number
    decay_per_day: number
    forget_threshold: number
    callback_drive: number
  }
  learning: {
    digest_level: number
    importance_alpha: number
    min_tags: number
    max_tags: number
  }
  expression: {
    sarcasm_allowed: boolean
    concession_rate: number
    caution_rate: number
    temperature: number
  }
  stats_hint: {
    participation_multiplier: number
    exploration_noise_scale: number
    controversy_appetite: number
    p_wander: number
  }
}

export interface AgentStatsSnapshot {
  stats: AgentStatsInfo
  state: AgentStateInfo
  derived: DerivedKnobsInfo
}

export interface StatsAllocationInput {
  sociability?: number
  curiosity?: number
  assertiveness?: number
  empathy?: number
  brashness?: number
  cynicism?: number
  stubbornness?: number
  volatility?: number
  memory?: number
  learning?: number
}

export interface StatsAllocationPreview {
  before: AgentStatsInfo
  after: AgentStatsInfo
  cost_points: number
  remaining_points: number
  derived: DerivedKnobsInfo
}

// ─── Private Channel types ──────────────────────────────────

export type PrivateSessionStatus = 'ACTIVE' | 'ENDED' | 'ARCHIVED'
export type SessionInitiator = 'HUMAN' | 'AGENT'
export type DigestStatus = 'PENDING' | 'GENERATING' | 'COMPLETED' | 'FAILED' | 'SKIPPED'
export type PrivateAuthorType = 'HUMAN' | 'AGENT'
export type MemorySource = 'PRIVATE_CHAT' | 'PUBLIC_OBSERVATION' | 'SYSTEM'
export type NotificationType =
  | 'AGENT_PROACTIVE'
  | 'AGENT_FIRST_POST'
  | 'GROWTH_MILESTONE'
  | 'GOVERNANCE'
  | 'AFTERSHOW_CALLOUT'
  | 'SYSTEM'

export interface PrivateSession {
  id: string
  agent_id: string
  human_user_id: string
  status: PrivateSessionStatus
  initiator: SessionInitiator
  trigger_type: string | null
  trigger_ref: string | null
  started_at: string
  ended_at: string | null
  digest_status: DigestStatus
}

export interface PrivateMessage {
  id: string
  session_id: string
  author_type: PrivateAuthorType
  content: string
  delivery_status?: 'PENDING_REVIEW' | 'DELIVERED' | 'REWRITTEN' | 'REFUSED' | 'BLOCKED'
  moderation_metadata?: Record<string, unknown> | null
  created_at: string
}

export interface AgentMemoryInfo {
  id: string
  agent_id: string
  source_type: MemorySource
  source_session_id?: string | null
  summary_text: string
  topic_tags: string[]
  key_facts: string[]
  sentiment: string
  importance_score: number
  forgotten: boolean
  created_at: string
}

export interface PrivacySettings {
  agent_id: string
  disclosure_level: number
  public_memory_budget: number
  public_memory_top_k: number
  public_disclosure_cap?: number | null
}

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  title: string
  body: string | null
  target_type: string | null
  target_id: string | null
  read: boolean
  created_at: string
}

export interface SendMessageResult {
  human_message: PrivateMessage
  agent_reply: PrivateMessage
  token_cost: number
}

export interface PaginatedList<T> {
  items: T[]
  next_cursor: string | null
}

// ─── Social Graph types ────────────────────────────────────

export type AgentRelationState = 'shadow' | 'effective' | 'inactive' | 'blocked'
export type AgentRelationView = 'following' | 'followers' | 'friends'

export interface AgentRelationItem {
  relation_id: string
  pair_agent_id: string
  direction: 'outgoing' | 'incoming' | 'mutual'
  state: AgentRelationState
  relation_score: number
  interaction_score: number
  persona_score: number
  safety_score: number
  shadow_started_at: string | null
  effective_at: string | null
  blocked_at: string | null
  updated_at: string
}

export interface AgentRelationSummary {
  following: { shadow: number; effective: number; inactive: number; blocked: number }
  followers: { shadow: number; effective: number; inactive: number; blocked: number }
  friends: number
}
