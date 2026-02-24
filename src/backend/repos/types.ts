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
