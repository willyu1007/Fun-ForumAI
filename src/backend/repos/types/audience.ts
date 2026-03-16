export type AudienceThreadStatus = 'OPEN' | 'CLOSED'

export interface AudienceThread {
  id: string
  post_id: string
  community_id: string
  status: AudienceThreadStatus
  created_at: Date
  updated_at: Date
}

export interface AudienceMessage {
  id: string
  thread_id: string
  author_user_id: string
  body: string
  created_at: Date
  updated_at: Date
}

export interface AudienceSummary {
  id: string
  thread_id: string
  post_id: string
  community_id: string
  window_start: Date
  window_end: Date
  summary_text: string
  message_count: number
  meta: Record<string, unknown> | null
  created_at: Date
  updated_at: Date
}

export type AftershowRunStatus = 'CREATED' | 'SKIPPED' | 'COMPLETED'

export interface AftershowRun {
  id: string
  post_id: string
  community_id: string
  mode: 'OFF' | 'THRESHOLD' | 'PERIODIC' | 'MANUAL'
  status: AftershowRunStatus
  threshold_min_audience_comments: number
  threshold_min_human_vote_score: number
  comments_at_trigger: number
  audience_message_count_at_trigger: number
  human_vote_score_at_trigger: number
  audience_summary_ref: string | null
  threshold_detail: Record<string, unknown> | null
  triggered_by_agent_id: string | null
  triggered_by_user_id: string | null
  meta: Record<string, unknown> | null
  created_at: Date
  updated_at: Date
}

export interface CreateAudienceThreadInput {
  post_id: string
  community_id: string
  status?: AudienceThreadStatus
}

export interface CreateAudienceMessageInput {
  thread_id: string
  author_user_id: string
  body: string
}

export interface CreateAudienceSummaryInput {
  thread_id: string
  post_id: string
  community_id: string
  window_start: Date
  window_end: Date
  summary_text: string
  message_count: number
  meta?: Record<string, unknown> | null
}

export interface CreateAftershowRunInput {
  post_id: string
  community_id: string
  mode: 'OFF' | 'THRESHOLD' | 'PERIODIC' | 'MANUAL'
  status?: AftershowRunStatus
  threshold_min_audience_comments?: number
  threshold_min_human_vote_score?: number
  comments_at_trigger?: number
  audience_message_count_at_trigger?: number
  human_vote_score_at_trigger?: number
  audience_summary_ref?: string | null
  threshold_detail?: Record<string, unknown> | null
  triggered_by_agent_id?: string | null
  triggered_by_user_id?: string | null
  meta?: Record<string, unknown> | null
}
