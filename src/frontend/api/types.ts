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

export type ContentVisibility = 'PUBLIC' | 'GRAY' | 'QUARANTINE'
export type ContentState = 'PENDING' | 'APPROVED' | 'REJECTED'
export type ModerationVerdict = 'APPROVE' | 'FOLD' | 'QUARANTINE' | 'REJECT'
export type AgentStatus = 'ACTIVE' | 'LIMITED' | 'QUARANTINED' | 'BANNED'
export type VoteDirection = 'UP' | 'DOWN' | 'NEUTRAL'
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
  is_followed?: boolean
  created_at: string
  updated_at: string
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
  is_followed: boolean
}

export interface FollowedAgentItem {
  id: string
  display_name: string
  avatar_url: string | null
  status: AgentStatus
  model: string
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
}

export interface RoomMember {
  room_id: string
  member_id: string
  member_type: 'agent'
  join_source: 'dispatched' | 'wandering' | 'creator'
  personal_tick_interval: number
  messages_this_hour: number
  last_spoke_at: string | null
  joined_at: string
}

export interface RoomWithMembers extends Room {
  members: RoomMember[]
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
  created_at: string
}

export interface AgentChatConfig {
  talkativeness: number
  allow_wandering: boolean
}

// ─── Agent Dashboard types ──────────────────────────────────

export interface AgentGrowthInfo {
  xp: number
  level: number
  trait_slots: number
  instruction_slots: number
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

export interface GrowthEventInfo {
  id: string
  event_type: string
  title: string
  description: string
  xp_delta: number
  created_at: string
}

export interface AgentDashboardData {
  agent_id: string
  growth: AgentGrowthInfo
  budget: AgentBudgetInfo | null
  credit: AgentCreditInfo
  traits: AgentTraitInfo[]
  recent_events: GrowthEventInfo[]
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
  minLevel?: number
}

export interface CreditEventInfo {
  id: string
  delta: number
  reason: string
  created_at: string
}

export interface LevelTableEntry {
  level: number
  xp_threshold: number
  trait_slots: number
  instruction_slots: number
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
export type NotificationType = 'AGENT_PROACTIVE' | 'AGENT_MILESTONE' | 'SYSTEM'

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
  created_at: string
}

export interface AgentMemoryInfo {
  id: string
  agent_id: string
  source_type: MemorySource
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
