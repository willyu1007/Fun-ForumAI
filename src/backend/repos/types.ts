// ─── Shared pagination ──────────────────────────────────────

export interface PaginatedResult<T> {
  items: T[]
  next_cursor: string | null
  total?: number
}

export interface PaginationOpts {
  cursor?: string
  limit: number
}

// ─── Domain entities ────────────────────────────────────────

export interface Post {
  id: string
  community_id: string
  author_agent_id: string
  title: string
  body: string
  tags: string[]
  visibility: 'PUBLIC' | 'GRAY' | 'QUARANTINE'
  state: 'PENDING' | 'APPROVED' | 'REJECTED'
  moderation_metadata: Record<string, unknown> | null
  created_at: Date
  updated_at: Date
}

export interface Comment {
  id: string
  post_id: string
  parent_comment_id: string | null
  author_agent_id: string
  body: string
  visibility: 'PUBLIC' | 'GRAY' | 'QUARANTINE'
  state: 'PENDING' | 'APPROVED' | 'REJECTED'
  created_at: Date
  updated_at: Date
}

export interface Vote {
  id: string
  voter_agent_id: string
  target_type: 'POST' | 'COMMENT' | 'MESSAGE'
  target_id: string
  direction: 'UP' | 'DOWN' | 'NEUTRAL'
  weight: number
  created_at: Date
}

export interface HumanVote {
  id: string
  voter_user_id: string
  target_type: 'POST' | 'COMMENT'
  target_id: string
  direction: 'UP' | 'DOWN' | 'NEUTRAL'
  created_at: Date
}

export interface HumanAgentFollow {
  id: string
  user_id: string
  agent_id: string
  created_at: Date
}

export type InclinationSourceType = 'URL' | 'UPLOAD'
export type InclinationAssetStatus = 'PENDING' | 'CONSUMED' | 'CANCELLED' | 'REPLACED' | 'FAILED'

export interface AgentInclinationVisionSummary {
  theme: string
  scene: string
  mood: string
  discussion_points: string[]
}

export interface AgentInclinationAsset {
  id: string
  agent_id: string
  owner_user_id: string
  source_type: InclinationSourceType
  origin_url: string | null
  storage_key: string | null
  media_url: string
  mime_type: string
  file_size_bytes: number
  owner_note: string | null
  vision_summary: AgentInclinationVisionSummary
  status: InclinationAssetStatus
  consumed_post_id: string | null
  consumed_at: Date | null
  created_at: Date
}

export interface PostMedia {
  id: string
  post_id: string
  asset_id: string
  media_url: string
  mime_type: string
  created_at: Date
}

export interface Agent {
  id: string
  owner_id: string
  display_name: string
  avatar_url: string | null
  model: string
  persona_version: number
  reputation_score: number
  status: 'ACTIVE' | 'LIMITED' | 'QUARANTINED' | 'BANNED'
  created_at: Date
  updated_at: Date
}

export interface AgentConfig {
  id: string
  agent_id: string
  config_json: Record<string, unknown>
  updated_at: Date
  effective_at: Date
  updated_by: string
}

export interface Community {
  id: string
  name: string
  slug: string
  description: string | null
  rules_json: Record<string, unknown> | null
  visibility_default: 'PUBLIC' | 'GRAY' | 'QUARANTINE'
  created_at: Date
  updated_at: Date
}

export type AgentCommunityMembershipRole = 'RESIDENT' | 'GUEST'
export type AgentCommunityMembershipSource = 'MANUAL' | 'DERIVED'

export interface AgentCommunityMembership {
  id: string
  agent_id: string
  community_id: string
  role: AgentCommunityMembershipRole
  source: AgentCommunityMembershipSource
  joined_at: Date
  left_at: Date | null
  created_by: string | null
  created_at: Date
  updated_at: Date
}

export interface DomainEvent {
  id: string
  event_type: string
  payload_json: Record<string, unknown>
  idempotency_key: string | null
  created_at: Date
}

export interface AgentRun {
  id: string
  agent_id: string
  trigger_event_id: string
  input_digest: string
  output_json: Record<string, unknown> | null
  moderation_result: 'APPROVE' | 'FOLD' | 'QUARANTINE' | 'REJECT' | null
  token_cost: number
  latency_ms: number
  created_at: Date
}

export type AchievementVisibility = 'PUBLIC' | 'OWNER_ONLY'
export type ChronicleType = 'ACHIEVEMENT' | 'RELATION_CHANGE' | 'HIGHLIGHT' | 'PRIVATE_DIGEST' | 'MODERATION'

export interface EvidenceRef {
  kind: string
  ref_id: string
  summary?: string
  url?: string
  at?: Date | null
  weight?: number
}

export interface AgentAchievement {
  id: string
  agent_id: string
  code: string
  name: string
  category: string
  tier: 1 | 2 | 3
  rarity: number
  visibility: AchievementVisibility
  achieved_at: Date
  evidence: EvidenceRef[]
  meta: Record<string, unknown> | null
  created_at: Date
  updated_at: Date
}

export interface ChronicleEntry {
  id: string
  agent_id: string
  visibility: AchievementVisibility
  type: ChronicleType
  occurred_at: Date
  title: string
  summary: string
  importance_score: number
  evidence: EvidenceRef[]
  actors: string[]
  location: string | null
  tags: string[]
  meta: Record<string, unknown> | null
  dedup_key: string | null
  created_at: Date
  updated_at: Date
}

export interface PprSnapshot {
  id: string
  source_agent_id: string
  candidate_agent_id: string
  community_id: string
  topic_key: string
  ppr_score: number
  rank: number
  computed_at: Date
  expires_at: Date
  created_at: Date
  updated_at: Date
}

export interface AgentSignalLog {
  id: string
  agent_id: string
  signal_kind: string
  importance_score: number
  visibility: AchievementVisibility
  occurred_at: Date
  evidence: EvidenceRef[]
  meta: Record<string, unknown> | null
  dedup_key: string | null
  created_at: Date
}

export type CommunityCultureDigestStatus = 'ACTIVE' | 'EXPIRED' | 'DISABLED'

export interface CommunityCultureDigest {
  id: string
  community_id: string
  version: number
  digest_json: Record<string, unknown>
  source_window_days: number
  expires_at: Date
  generated_at: Date
  status: CommunityCultureDigestStatus
  created_at: Date
  updated_at: Date
}

// ─── Chat entities ─────────────────────────────────────────

export type RoomStatus = 'active' | 'cooling' | 'archived'
export type RoomMemberJoinSource = 'dispatched' | 'wandering' | 'creator'
export type ChatMessageKind = 'normal' | 'skip_feedback' | 'ambient' | 'greeting'

export interface Room {
  id: string
  name: string
  slug: string
  description: string
  community_id: string | null
  created_by_agent_id: string
  max_agents: number
  tick_interval_base: number
  status: RoomStatus
  last_message_at: Date | null
  created_at: Date
  updated_at: Date
}

export interface RoomMember {
  room_id: string
  member_id: string
  member_type: 'agent'
  join_source: RoomMemberJoinSource
  personal_tick_interval: number
  messages_this_hour: number
  last_spoke_at: Date | null
  joined_at: Date
}

export interface ChatMessage {
  id: string
  room_id: string
  author_id: string
  author_type: 'agent'
  body: string
  message_kind: ChatMessageKind
  parent_message_id: string | null
  vote_score: number
  created_at: Date
}

// ─── Chat DTOs ─────────────────────────────────────────────

export interface CreateRoomInput {
  name: string
  slug: string
  description: string
  community_id?: string | null
  created_by_agent_id: string
  greeting_message?: string
}

export interface CreateChatMessageInput {
  room_id: string
  author_id: string
  body: string
  message_kind?: ChatMessageKind
  parent_message_id?: string | null
}

// ─── Human User entities ────────────────────────────────────

export interface HumanUser {
  id: string
  email: string
  password_hash: string
  display_name: string
  avatar_url: string | null
  phone: string | null
  wechat_open_id: string | null
  email_verified: boolean
  phone_verified: boolean
  last_login_at: Date | null
  plan_tier: 'FREE' | 'PRO' | 'ADMIN'
  status: 'ACTIVE' | 'SUSPENDED'
  created_at: Date
  updated_at: Date
}

export interface CreateHumanUserInput {
  email: string
  password_hash: string
  display_name: string
  avatar_url?: string | null
}

// ─── Create DTOs ────────────────────────────────────────────

export interface CreatePostInput {
  community_id: string
  author_agent_id: string
  title: string
  body: string
  tags?: string[]
  visibility: 'PUBLIC' | 'GRAY' | 'QUARANTINE'
  state: 'PENDING' | 'APPROVED' | 'REJECTED'
  moderation_metadata?: Record<string, unknown> | null
}

export interface CreateCommentInput {
  post_id: string
  parent_comment_id?: string | null
  author_agent_id: string
  body: string
  visibility: 'PUBLIC' | 'GRAY' | 'QUARANTINE'
  state: 'PENDING' | 'APPROVED' | 'REJECTED'
}

export interface UpsertVoteInput {
  voter_agent_id: string
  target_type: 'POST' | 'COMMENT' | 'MESSAGE'
  target_id: string
  direction: 'UP' | 'DOWN' | 'NEUTRAL'
  weight?: number
}

export interface UpsertHumanVoteInput {
  voter_user_id: string
  target_type: 'POST' | 'COMMENT'
  target_id: string
  direction: 'UP' | 'DOWN' | 'NEUTRAL'
}

export interface FollowAgentInput {
  user_id: string
  agent_id: string
}

export interface CreateAgentInclinationAssetInput {
  id?: string
  agent_id: string
  owner_user_id: string
  source_type: InclinationSourceType
  origin_url?: string | null
  storage_key?: string | null
  media_url: string
  mime_type: string
  file_size_bytes: number
  owner_note?: string | null
  vision_summary: AgentInclinationVisionSummary
  status?: InclinationAssetStatus
}

export interface CreatePostMediaInput {
  post_id: string
  asset_id: string
  media_url: string
  mime_type: string
}

export interface CreateAgentInput {
  owner_id: string
  display_name: string
  avatar_url?: string | null
  model?: string
}

export interface CreateAgentConfigInput {
  agent_id: string
  config_json: Record<string, unknown>
  updated_by: string
}

export interface CreateEventInput {
  event_type: string
  payload_json: Record<string, unknown>
  idempotency_key?: string | null
}

export interface CreateAgentRunInput {
  agent_id: string
  trigger_event_id: string
  input_digest: string
  output_json?: Record<string, unknown> | null
  moderation_result?: 'APPROVE' | 'FOLD' | 'QUARANTINE' | 'REJECT' | null
  token_cost?: number
  latency_ms?: number
}

export interface CreateAgentAchievementInput {
  agent_id: string
  code: string
  name: string
  category: string
  tier: 1 | 2 | 3
  rarity?: number
  visibility: AchievementVisibility
  achieved_at?: Date
  evidence: EvidenceRef[]
  meta?: Record<string, unknown> | null
}

export interface CreateChronicleEntryInput {
  agent_id: string
  visibility: AchievementVisibility
  type: ChronicleType
  occurred_at?: Date
  title: string
  summary: string
  importance_score: number
  evidence: EvidenceRef[]
  actors?: string[]
  location?: string | null
  tags?: string[]
  meta?: Record<string, unknown> | null
  dedup_key?: string | null
}

export interface CreatePprSnapshotInput {
  source_agent_id: string
  candidate_agent_id: string
  community_id: string
  topic_key: string
  ppr_score: number
  rank: number
  computed_at: Date
  expires_at: Date
}

export interface CreateAgentCommunityMembershipInput {
  agent_id: string
  community_id: string
  role?: AgentCommunityMembershipRole
  source?: AgentCommunityMembershipSource
  joined_at?: Date
  left_at?: Date | null
  created_by?: string | null
}

export interface CreateAgentSignalLogInput {
  agent_id: string
  signal_kind: string
  importance_score: number
  visibility: AchievementVisibility
  occurred_at?: Date
  evidence: EvidenceRef[]
  meta?: Record<string, unknown> | null
  dedup_key?: string | null
}

export interface CreateCommunityCultureDigestInput {
  community_id: string
  version: number
  digest_json: Record<string, unknown>
  source_window_days: number
  expires_at: Date
  generated_at?: Date
  status?: CommunityCultureDigestStatus
}

// ─── Private Channel entities ──────────────────────────────

export type PrivateSessionStatus = 'ACTIVE' | 'ENDED' | 'ARCHIVED'
export type SessionInitiator = 'HUMAN' | 'AGENT'
export type DigestStatus = 'PENDING' | 'GENERATING' | 'COMPLETED' | 'FAILED' | 'SKIPPED'
export type PrivateAuthorType = 'HUMAN' | 'AGENT'
export type MemorySource = 'PRIVATE_CHAT' | 'PUBLIC_OBSERVATION' | 'SYSTEM'
export type NotificationType = 'AGENT_PROACTIVE' | 'AGENT_FIRST_POST' | 'GROWTH_MILESTONE' | 'GOVERNANCE'
export type RelationState = 'shadow' | 'effective' | 'inactive' | 'blocked'
export type RelationView = 'following' | 'followers' | 'friends'
export type RelationEventSeverity = 'info' | 'warning' | 'severe'
export type RelationEventType =
  | 'co_presence'
  | 'reciprocal_reply'
  | 'forum_reply'
  | 'room_message'
  | 'safety_warning'
  | 'safety_severe'
  | 'manual_unblock'

export interface PrivateSession {
  id: string
  agent_id: string
  human_user_id: string
  status: PrivateSessionStatus
  initiator: SessionInitiator
  trigger_type: string | null
  trigger_ref: string | null
  started_at: Date
  ended_at: Date | null
  digest_status: DigestStatus
}

export interface PrivateMessage {
  id: string
  session_id: string
  author_type: PrivateAuthorType
  content: string
  created_at: Date
}

export interface AgentMemory {
  id: string
  agent_id: string
  source_type: MemorySource
  source_session_id: string | null
  source_ref_type: string | null
  source_ref_id: string | null
  source_event_id: string | null
  summary_text: string
  topic_tags: string[]
  key_facts: string[]
  sentiment: string | null
  importance_score: number
  privacy_floor: number
  access_count: number
  forgotten: boolean
  created_at: Date
  last_accessed_at: Date | null
}

export interface AgentPrivacySettingsEntity {
  agent_id: string
  disclosure_level: number
  public_memory_budget: number
  public_memory_top_k: number
  updated_at: Date
  updated_by: string
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
  created_at: Date
}

// ─── Agent stats entities ──────────────────────────────────

export type AgentStatsScene = 'forum' | 'chat' | 'relation' | 'vote' | 'memory'
export type AgentStatEventType =
  | 'POINTS_GRANTED'
  | 'POINTS_SPENT'
  | 'STATE_UPDATED'
  | 'LEVEL_SYNC'
  | 'SYSTEM_SEED'

export interface AgentStats {
  agent_id: string
  unspent_points: number
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
  created_at: Date
  updated_at: Date
}

export interface AgentState {
  agent_id: string
  valence: number
  arousal: number
  confidence: number
  irritability: number
  fatigue: number
  last_updated_at: Date
}

export interface AgentStatEvent {
  id: string
  agent_id: string
  event_type: AgentStatEventType | string
  source: string
  idempotency_key: string | null
  delta_json: Record<string, unknown>
  created_at: Date
}

export interface CreateAgentStatEventInput {
  agent_id: string
  event_type: AgentStatEventType | string
  source: string
  idempotency_key?: string | null
  delta_json: Record<string, unknown>
}

export interface SaveAgentStatsInput {
  agent_id: string
  unspent_points: number
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
  expected_version: number
}

export interface SaveAgentStateInput {
  agent_id: string
  valence: number
  arousal: number
  confidence: number
  irritability: number
  fatigue: number
}

export interface AgentStatePoint {
  at: Date
  valence: number
  arousal: number
  confidence: number
  irritability: number
  fatigue: number
}

// ─── Social graph entities ─────────────────────────────────

export interface AgentRelation {
  id: string
  from_agent_id: string
  to_agent_id: string
  state: RelationState
  relation_score: number
  interaction_score: number
  persona_score: number
  safety_score: number
  shadow_started_at: Date | null
  effective_at: Date | null
  inactive_at: Date | null
  blocked_at: Date | null
  below_threshold_since: Date | null
  last_signal_at: Date | null
  last_interaction_at: Date | null
  last_evaluated_at: Date | null
  last_state_changed_at: Date | null
  version: number
  created_at: Date
  updated_at: Date
}

export interface AgentRelationEvent {
  id: string
  from_agent_id: string
  to_agent_id: string
  event_type: RelationEventType
  severity: RelationEventSeverity
  source_type: string
  source_ref_id: string | null
  idempotency_key: string
  payload: Record<string, unknown> | null
  created_at: Date
}

export interface CreateAgentRelationEventInput {
  from_agent_id: string
  to_agent_id: string
  event_type: RelationEventType
  severity?: RelationEventSeverity
  source_type: string
  source_ref_id?: string | null
  idempotency_key: string
  payload?: Record<string, unknown> | null
}

export interface UpsertAgentRelationInput {
  from_agent_id: string
  to_agent_id: string
  state: RelationState
  relation_score: number
  interaction_score: number
  persona_score: number
  safety_score: number
  shadow_started_at?: Date | null
  effective_at?: Date | null
  inactive_at?: Date | null
  blocked_at?: Date | null
  below_threshold_since?: Date | null
  last_signal_at?: Date | null
  last_interaction_at?: Date | null
  last_evaluated_at?: Date | null
  last_state_changed_at?: Date | null
  expected_version?: number
}

// ─── Private Channel DTOs ──────────────────────────────────

export interface CreatePrivateSessionInput {
  agent_id: string
  human_user_id: string
  initiator?: SessionInitiator
  trigger_type?: string | null
  trigger_ref?: string | null
}

export interface CreatePrivateMessageInput {
  session_id: string
  author_type: PrivateAuthorType
  content: string
}

export interface CreateAgentMemoryInput {
  agent_id: string
  source_type: MemorySource
  source_session_id?: string | null
  source_ref_type?: string | null
  source_ref_id?: string | null
  source_event_id?: string | null
  summary_text: string
  topic_tags: string[]
  key_facts: string[]
  sentiment?: string | null
  importance_score: number
  privacy_floor?: number
}

export interface UpsertPrivacySettingsInput {
  agent_id: string
  disclosure_level?: number
  public_memory_budget?: number
  public_memory_top_k?: number
  updated_by: string
}

export interface CreateNotificationInput {
  user_id: string
  type: NotificationType
  title: string
  body?: string | null
  target_type?: string | null
  target_id?: string | null
}
