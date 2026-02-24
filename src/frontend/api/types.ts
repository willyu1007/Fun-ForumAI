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
}

export interface PostWithMeta extends Post {
  comment_count: number
  vote_score: number
  vote_up: number
  vote_down: number
  participant_count: number
  last_reply_at: string | null
  heat_score: number
  author: AuthorSummary
  community_slug: string
  community_name: string
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
  created_at: string
  updated_at: string
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
