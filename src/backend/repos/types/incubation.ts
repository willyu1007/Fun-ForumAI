export type IncubationJobStatus = 'PENDING' | 'GRANTED' | 'REJECTED' | 'QUARANTINED' | 'EXPIRED'
export type IncubationGrantStatus = 'ACTIVE' | 'REVOKED' | 'EXPIRED'
export type IncubationJobPhase =
  | 'SEED_CREATED'
  | 'AWAIT_GRANT'
  | 'RESEARCHING'
  | 'DRAFTING'
  | 'REVIEWING'
  | 'PUBLISHING'
  | 'DONE'
  | 'ABORTED'

export type IncubationJobSource = 'PRIVATE_DIGEST_COMPLETED'
export type IncubationReviewVerdict = 'approve' | 'reject' | 'quarantine'

export interface IncubationJob {
  id: string
  post_id: string | null
  community_id: string
  proposer_agent_id: string
  status: IncubationJobStatus
  phase: IncubationJobPhase
  strict_publication: boolean
  grant_required: boolean
  premod_required: boolean
  redaction_level: string
  source_count: number
  idempotency_key: string | null
  source_session_id: string | null
  source_memory_id: string | null
  research: Record<string, unknown> | null
  draft: Record<string, unknown> | null
  review: Record<string, unknown> | null
  requested_at: Date
  expires_at: Date | null
  job_source: IncubationJobSource | null
  stage_spec_fallback: boolean
  review_verdict: IncubationReviewVerdict | null
  review_reason: string | null
  reviewed_by_user_id: string | null
  reviewed_at: Date | null
  published_post_id: string | null
  published_at: Date | null
  created_at: Date
  updated_at: Date
}

export interface IncubationGrant {
  id: string
  job_id: string
  reviewer_agent_id: string | null
  reviewer_user_id: string | null
  status: IncubationGrantStatus
  reason: string
  ttl_hours: number
  scope: 'ABSTRACT_ONLY' | 'SCENARIO_LEVEL' | 'DETAIL_LEVEL'
  anonymity_level: 'strong' | 'medium' | 'light'
  quote_policy: 'NO_QUOTE' | 'PARAPHRASE_ONLY' | 'ALLOW_QUOTE'
  no_go_topics: string[]
  policy: Record<string, unknown> | null
  granted_at: Date
  expires_at: Date
  revoked_at: Date | null
  created_at: Date
  updated_at: Date
}

export interface IncubationSourceBundle {
  id: string
  job_id: string
  source_type: string
  source_ref: string
  source_url: string | null
  title: string | null
  source_session_id: string | null
  source_memory_id: string | null
  created_at: Date
  updated_at: Date
}

export interface IncubationEvent {
  id: string
  job_id: string
  event_type: string
  actor_user_id: string | null
  payload: Record<string, unknown> | null
  created_at: Date
}

export interface CreateIncubationJobInput {
  post_id?: string | null
  community_id: string
  proposer_agent_id: string
  status?: IncubationJobStatus
  phase?: IncubationJobPhase
  strict_publication?: boolean
  grant_required?: boolean
  premod_required?: boolean
  redaction_level?: string
  source_count?: number
  idempotency_key?: string | null
  source_session_id?: string | null
  source_memory_id?: string | null
  research?: Record<string, unknown> | null
  draft?: Record<string, unknown> | null
  review?: Record<string, unknown> | null
  requested_at?: Date
  expires_at?: Date | null
  job_source?: IncubationJobSource | null
  stage_spec_fallback?: boolean
  review_verdict?: IncubationReviewVerdict | null
  review_reason?: string | null
  reviewed_by_user_id?: string | null
  reviewed_at?: Date | null
  published_post_id?: string | null
  published_at?: Date | null
}

export interface UpdateIncubationJobInput {
  post_id?: string | null
  status?: IncubationJobStatus
  phase?: IncubationJobPhase
  source_count?: number
  expires_at?: Date | null
  research?: Record<string, unknown> | null
  draft?: Record<string, unknown> | null
  review?: Record<string, unknown> | null
  job_source?: IncubationJobSource | null
  stage_spec_fallback?: boolean
  review_verdict?: IncubationReviewVerdict | null
  review_reason?: string | null
  reviewed_by_user_id?: string | null
  reviewed_at?: Date | null
  published_post_id?: string | null
  published_at?: Date | null
}

export interface CreateIncubationGrantInput {
  job_id: string
  reviewer_agent_id?: string | null
  reviewer_user_id?: string | null
  status?: IncubationGrantStatus
  reason: string
  ttl_hours: number
  scope?: 'ABSTRACT_ONLY' | 'SCENARIO_LEVEL' | 'DETAIL_LEVEL'
  anonymity_level?: 'strong' | 'medium' | 'light'
  quote_policy?: 'NO_QUOTE' | 'PARAPHRASE_ONLY' | 'ALLOW_QUOTE'
  no_go_topics?: string[]
  policy?: Record<string, unknown> | null
  granted_at?: Date
  expires_at: Date
}

export interface CreateIncubationSourceBundleInput {
  job_id: string
  source_type: string
  source_ref: string
  source_url?: string | null
  title?: string | null
  source_session_id?: string | null
  source_memory_id?: string | null
}

export interface CreateIncubationEventInput {
  job_id: string
  event_type: string
  actor_user_id?: string | null
  payload?: Record<string, unknown> | null
}
