import type { ConfigRiskLevel } from './governance.js'

export type IdentityVerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED' | 'EXPIRED'
export type IdentityVerificationMethod = 'MANUAL_REVIEW' | 'SUPPLIER_PLACEHOLDER'
export type MessageDeliveryStatus =
  | 'PENDING_REVIEW'
  | 'DELIVERED'
  | 'REWRITTEN'
  | 'REFUSED'
  | 'BLOCKED'
export type ReviewCaseType =
  | 'MODERATION'
  | 'COMPLAINT'
  | 'APPEAL'
  | 'IDENTITY_REVIEW'
  | 'CONFIG_REVIEW'
  | 'HOT_TOPIC'
export type ReviewCaseStatus = 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'DISMISSED'
export type ReviewTaskStatus = 'PENDING' | 'ASSIGNED' | 'COMPLETED' | 'CANCELED'
export type ComplaintStatus = 'OPEN' | 'LINKED' | 'RESOLVED' | 'REJECTED'
export type AppealStatus = 'OPEN' | 'LINKED' | 'RESOLVED' | 'REJECTED'
export type ConfigReviewStatus = 'NOT_REQUIRED' | 'PENDING' | 'APPROVED' | 'REJECTED'

export interface UserIdentityVerification {
  id: string
  user_id: string
  status: IdentityVerificationStatus
  method: IdentityVerificationMethod
  reviewed_by_user_id: string | null
  reason: string | null
  submitted_at: Date
  reviewed_at: Date | null
  expires_at: Date | null
  meta: Record<string, unknown> | null
}

export interface PolicySnapshot {
  id: string
  content_hash: string
  channel: string
  target_type: string
  target_id: string | null
  community_id: string | null
  agent_id: string | null
  user_id: string | null
  scene: string | null
  normalized_text: string
  moderation: Record<string, unknown>
  decision: Record<string, unknown>
  created_at: Date
}

export interface ModerationCase {
  id: string
  case_type: ReviewCaseType
  status: ReviewCaseStatus
  priority: number
  summary_text: string | null
  opened_reason: string | null
  opened_by: string
  assigned_to_user_id: string | null
  linked_policy_snapshot_id: string | null
  linked_complaint_ticket_id: string | null
  linked_appeal_request_id: string | null
  resolution_action: string | null
  resolved_at: Date | null
  created_at: Date
  updated_at: Date
}

export interface ModerationCaseTarget {
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
  created_at: Date
}

export interface ModerationEvidenceSnapshot {
  id: string
  case_id: string
  snapshot_type: string
  payload: Record<string, unknown>
  created_at: Date
}

export interface ReviewTask {
  id: string
  case_id: string
  task_type: string
  status: ReviewTaskStatus
  assignee_user_id: string | null
  due_at: Date | null
  completed_at: Date | null
  created_at: Date
  updated_at: Date
}

export interface GovernanceActionLog {
  id: string
  case_id: string | null
  action: string
  target_type: string
  target_id: string
  actor_user_id: string
  reason: string | null
  result: Record<string, unknown> | null
  created_at: Date
}

export interface ComplaintTicket {
  id: string
  reporter_user_id: string
  target_type: string
  target_id: string
  reason_code: string
  detail_text: string | null
  status: ComplaintStatus
  linked_case_id: string | null
  created_at: Date
  updated_at: Date
}

export interface AppealRequest {
  id: string
  requester_user_id: string
  target_type: string
  target_id: string
  linked_case_id: string | null
  linked_complaint_ticket_id: string | null
  reason: string
  status: AppealStatus
  created_at: Date
  updated_at: Date
}

export interface RiskEventLog {
  id: string
  policy_snapshot_id: string | null
  case_id: string | null
  channel: string
  event_type: string
  action: string
  risk_level: string | null
  risk_score: number | null
  risk_categories: string[]
  target_type: string | null
  target_id: string | null
  community_id: string | null
  agent_id: string | null
  user_id: string | null
  room_id: string | null
  session_id: string | null
  message_id: string | null
  detail_text: string | null
  payload: Record<string, unknown> | null
  created_at: Date
}

export interface CreatePolicySnapshotInput {
  content_hash: string
  channel: string
  target_type: string
  target_id?: string | null
  community_id?: string | null
  agent_id?: string | null
  user_id?: string | null
  scene?: string | null
  normalized_text: string
  moderation: Record<string, unknown>
  decision: Record<string, unknown>
}

export interface UpdatePolicySnapshotInput {
  target_id?: string | null
}

export interface CreateRiskEventLogInput {
  policy_snapshot_id?: string | null
  case_id?: string | null
  channel: string
  event_type: string
  action: string
  risk_level?: string | null
  risk_score?: number | null
  risk_categories?: string[]
  target_type?: string | null
  target_id?: string | null
  community_id?: string | null
  agent_id?: string | null
  user_id?: string | null
  room_id?: string | null
  session_id?: string | null
  message_id?: string | null
  detail_text?: string | null
  payload?: Record<string, unknown> | null
}

export interface UpdateRiskEventLogInput {
  target_id?: string | null
  room_id?: string | null
  session_id?: string | null
  message_id?: string | null
}

export interface CreateModerationCaseInput {
  case_type: ReviewCaseType
  status?: ReviewCaseStatus
  priority?: number
  summary_text?: string | null
  opened_reason?: string | null
  opened_by?: string
  assigned_to_user_id?: string | null
  linked_policy_snapshot_id?: string | null
  linked_complaint_ticket_id?: string | null
  linked_appeal_request_id?: string | null
  resolution_action?: string | null
  resolved_at?: Date | null
}

export interface UpdateModerationCaseInput {
  status?: ReviewCaseStatus
  priority?: number
  summary_text?: string | null
  assigned_to_user_id?: string | null
  linked_complaint_ticket_id?: string | null
  linked_appeal_request_id?: string | null
  resolution_action?: string | null
  resolved_at?: Date | null
}

export interface CreateModerationCaseTargetInput {
  case_id: string
  target_type: string
  target_id: string
  channel: string
  community_id?: string | null
  agent_id?: string | null
  user_id?: string | null
  room_id?: string | null
  session_id?: string | null
  message_id?: string | null
}

export interface UpdateModerationCaseTargetInput {
  target_id?: string
  room_id?: string | null
  session_id?: string | null
  message_id?: string | null
}

export interface CreateModerationEvidenceSnapshotInput {
  case_id: string
  snapshot_type: string
  payload: Record<string, unknown>
}

export interface CreateReviewTaskInput {
  case_id: string
  task_type: string
  status?: ReviewTaskStatus
  assignee_user_id?: string | null
  due_at?: Date | null
  completed_at?: Date | null
}

export interface UpdateReviewTaskInput {
  status?: ReviewTaskStatus
  assignee_user_id?: string | null
  due_at?: Date | null
  completed_at?: Date | null
}

export interface CreateGovernanceActionLogInput {
  case_id?: string | null
  action: string
  target_type: string
  target_id: string
  actor_user_id: string
  reason?: string | null
  result?: Record<string, unknown> | null
}

export interface CreateComplaintTicketInput {
  reporter_user_id: string
  target_type: string
  target_id: string
  reason_code: string
  detail_text?: string | null
  status?: ComplaintStatus
  linked_case_id?: string | null
}

export interface UpdateComplaintTicketInput {
  status?: ComplaintStatus
  linked_case_id?: string | null
}

export interface CreateAppealRequestInput {
  requester_user_id: string
  target_type: string
  target_id: string
  reason: string
  status?: AppealStatus
  linked_case_id?: string | null
  linked_complaint_ticket_id?: string | null
}

export interface UpdateAppealRequestInput {
  status?: AppealStatus
  linked_case_id?: string | null
  linked_complaint_ticket_id?: string | null
}

export interface UpsertUserIdentityVerificationInput {
  user_id: string
  status: IdentityVerificationStatus
  reviewed_by_user_id?: string | null
  reason?: string | null
  method?: IdentityVerificationMethod
  reviewed_at?: Date | null
  expires_at?: Date | null
  meta?: Record<string, unknown> | null
}

export interface IdentityReviewSummary {
  latest: UserIdentityVerification | null
  effective_status: IdentityVerificationStatus | 'UNVERIFIED'
}

export interface AgentConfigReview {
  risk_level: ConfigRiskLevel
  review_status: ConfigReviewStatus
  review_case_id: string | null
  lint_warnings: string[]
}
