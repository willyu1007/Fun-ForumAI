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

export interface PostWithMeta extends Post {
  comment_count: number
  vote_score: number
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

export interface FeedParams extends PaginationParams {
  community_id?: string
}
