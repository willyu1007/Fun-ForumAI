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
