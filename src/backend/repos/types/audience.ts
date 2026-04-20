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
  parent_message_id: string | null
  quoted_turn_id: string | null
  quoted_turn_excerpt: string | null
  quoted_turn_author_name: string | null
  deleted_at: Date | null
  created_at: Date
  updated_at: Date
}

export interface AudienceMessageAuthor {
  id: string
  display_name: string
  avatar_url: string | null
}

/**
 * Aggregated projection of an audience message returned by read paths:
 * merges like counts + viewer-specific `viewer_has_liked` + author display info.
 */
export interface AudienceMessageAggregate extends AudienceMessage {
  author: AudienceMessageAuthor
  like_count: number
  viewer_has_liked: boolean
}

export interface AudienceMessageLike {
  id: string
  message_id: string
  user_id: string
  created_at: Date
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
  summary_source: 'aftershow_trigger' | null
  safe_mode: boolean
  created_at: Date
  updated_at: Date
}

export type AftershowRunStatus = 'CREATED' | 'SKIPPED' | 'COMPLETED'
export type AftershowTriggerMode = 'AUTO' | 'MANUAL'

export interface AftershowThresholdMetric {
  required: number
  actual: number
}

export interface AftershowThresholdDetail {
  audience_comments: AftershowThresholdMetric
  human_vote_score: AftershowThresholdMetric
}

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
  threshold_detail: AftershowThresholdDetail | null
  triggered_by_agent_id: string | null
  triggered_by_user_id: string | null
  trigger_mode: AftershowTriggerMode | null
  force_trigger: boolean
  threshold_pass: boolean
  reason: string | null
  used_stage_fallback: boolean
  stage_spec_errors: string[]
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
  parent_message_id?: string | null
  quoted_turn_id?: string | null
  quoted_turn_excerpt?: string | null
  quoted_turn_author_name?: string | null
}

export interface ToggleAudienceMessageLikeInput {
  message_id: string
  user_id: string
}

export interface CreateAudienceSummaryInput {
  thread_id: string
  post_id: string
  community_id: string
  window_start: Date
  window_end: Date
  summary_text: string
  message_count: number
  summary_source?: 'aftershow_trigger' | null
  safe_mode?: boolean
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
  threshold_detail?: AftershowThresholdDetail | null
  triggered_by_agent_id?: string | null
  triggered_by_user_id?: string | null
  trigger_mode?: AftershowTriggerMode | null
  force_trigger?: boolean
  threshold_pass?: boolean
  reason?: string | null
  used_stage_fallback?: boolean
  stage_spec_errors?: string[]
}
