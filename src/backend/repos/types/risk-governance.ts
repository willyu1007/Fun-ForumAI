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
export type ReviewQueue =
  | 'MODERATION'
  | 'COMPLAINT'
  | 'APPEAL'
  | 'IDENTITY_REVIEW'
  | 'CONFIG_REVIEW'
  | 'PRIVACY'
  | 'DELETION'
  | 'HOT_TOPIC'
export type ModerationTargetRelationType =
  | 'PRIMARY'
  | 'RELATED'
  | 'PARENT_THREAD'
  | 'SESSION_MEMBER'
  | 'OWNER'
  | 'AGENT'
export type ReviewTaskStatus = 'PENDING' | 'ASSIGNED' | 'COMPLETED' | 'CANCELED'
export type ComplaintStatus = 'OPEN' | 'LINKED' | 'RESOLVED' | 'REJECTED'
export type ComplaintType =
  | 'CONTENT_REPORT'
  | 'PRIVACY_REQUEST'
  | 'DELETION_REQUEST'
  | 'IMPERSONATION_REPORT'
  | 'MISLABEL_REPORT'
  | 'HARASSMENT_REPORT'
  | 'OTHER'
export type AppealStatus = 'OPEN' | 'LINKED' | 'RESOLVED' | 'REJECTED'
export type AppealType =
  | 'CONTENT_APPEAL'
  | 'ACCOUNT_LIMIT_APPEAL'
  | 'AGENT_RESTRICTION_APPEAL'
  | 'OTHER'
export type AppealRequesterType = 'USER' | 'OWNER' | 'OPERATOR'
export type ConfigReviewStatus = 'NOT_REQUIRED' | 'PENDING' | 'APPROVED' | 'REJECTED'
export type DisclosureCapScopeType = 'agent' | 'community'
export type PublicDisclosureCapOverrideStatus = 'ACTIVE' | 'RELEASED'
export type PublicDisclosureCapOverrideSource =
  | 'manual'
  | 'owner_endorsement_public'
  | 'owner_private_leak'

export interface GovernanceAttachment {
  ref: string
  type: string
}

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
  queue: ReviewQueue
  status: ReviewCaseStatus
  priority: number
  summary_text: string | null
  risk_summary: Record<string, unknown> | null
  opened_reason: string | null
  opened_by: string
  primary_target_type: string | null
  primary_target_id: string | null
  assigned_to_user_id: string | null
  sla_due_at: Date | null
  claimed_by_user_id: string | null
  claimed_at: Date | null
  linked_policy_snapshot_id: string | null
  linked_complaint_ticket_id: string | null
  linked_appeal_request_id: string | null
  resolution_action: string | null
  resolved_by_user_id: string | null
  resolution_note: string | null
  resolved_at: Date | null
  created_at: Date
  updated_at: Date
}

export interface ModerationCaseTarget {
  id: string
  case_id: string
  target_type: string
  target_id: string
  relation_type: ModerationTargetRelationType
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
  content: Record<string, unknown> | null
  context: Record<string, unknown> | null
  policy_hits: Record<string, unknown> | null
  prompt_memory: Record<string, unknown> | null
  topic_signals: Record<string, unknown> | null
  action_history: Record<string, unknown> | null
  evidence_package: Record<string, unknown> | null
  created_at: Date
}

export interface ReviewTask {
  id: string
  case_id: string
  queue: ReviewQueue
  task_type: string
  status: ReviewTaskStatus
  assignee_user_id: string | null
  claim_token: string | null
  claimed_by_user_id: string | null
  claimed_at: Date | null
  assigned_role: string | null
  due_at: Date | null
  resolution_code: string | null
  operator_note: string | null
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
  complaint_type: ComplaintType
  reason_code: string
  detail_text: string | null
  attachments: GovernanceAttachment[]
  status: ComplaintStatus
  linked_case_id: string | null
  resolution: Record<string, unknown> | null
  created_at: Date
  updated_at: Date
}

export interface AppealRequest {
  id: string
  requester_user_id: string
  requester_type: AppealRequesterType
  target_type: string
  target_id: string
  appeal_type: AppealType
  linked_case_id: string | null
  linked_complaint_ticket_id: string | null
  reason: string
  status: AppealStatus
  result: Record<string, unknown> | null
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

export interface PublicDisclosureCapOverride {
  id: string
  scope_type: DisclosureCapScopeType
  scope_id: string
  cap_level: number
  status: PublicDisclosureCapOverrideStatus
  source: PublicDisclosureCapOverrideSource
  reason: string | null
  linked_case_id: string | null
  linked_risk_event_id: string | null
  created_by_user_id: string
  released_by_user_id: string | null
  released_reason: string | null
  released_at: Date | null
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

export interface CreatePublicDisclosureCapOverrideInput {
  scope_type: DisclosureCapScopeType
  scope_id: string
  cap_level: number
  status?: PublicDisclosureCapOverrideStatus
  source: PublicDisclosureCapOverrideSource
  reason?: string | null
  linked_case_id?: string | null
  linked_risk_event_id?: string | null
  created_by_user_id: string
}

export interface ReleasePublicDisclosureCapOverrideInput {
  status?: Extract<PublicDisclosureCapOverrideStatus, 'RELEASED'>
  released_by_user_id: string
  released_reason?: string | null
  released_at?: Date | null
}

export interface ReplaceActivePublicDisclosureCapOverrideInput {
  scope_type: DisclosureCapScopeType
  scope_id: string
  next_override: CreatePublicDisclosureCapOverrideInput
  release: ReleasePublicDisclosureCapOverrideInput
  keep_existing_if_stricter_or_equal_to_cap_level?: number
}

export interface UpdateRiskEventLogInput {
  target_id?: string | null
  room_id?: string | null
  session_id?: string | null
  message_id?: string | null
  payload?: Record<string, unknown> | null
}

export interface CreateModerationCaseInput {
  case_type: ReviewCaseType
  queue?: ReviewQueue
  status?: ReviewCaseStatus
  priority?: number
  summary_text?: string | null
  risk_summary?: Record<string, unknown> | null
  opened_reason?: string | null
  opened_by?: string
  primary_target_type?: string | null
  primary_target_id?: string | null
  assigned_to_user_id?: string | null
  sla_due_at?: Date | null
  claimed_by_user_id?: string | null
  claimed_at?: Date | null
  linked_policy_snapshot_id?: string | null
  linked_complaint_ticket_id?: string | null
  linked_appeal_request_id?: string | null
  resolution_action?: string | null
  resolved_by_user_id?: string | null
  resolution_note?: string | null
  resolved_at?: Date | null
}

export interface UpdateModerationCaseInput {
  queue?: ReviewQueue
  status?: ReviewCaseStatus
  priority?: number
  summary_text?: string | null
  risk_summary?: Record<string, unknown> | null
  primary_target_type?: string | null
  primary_target_id?: string | null
  assigned_to_user_id?: string | null
  sla_due_at?: Date | null
  claimed_by_user_id?: string | null
  claimed_at?: Date | null
  linked_complaint_ticket_id?: string | null
  linked_appeal_request_id?: string | null
  resolution_action?: string | null
  resolved_by_user_id?: string | null
  resolution_note?: string | null
  resolved_at?: Date | null
}

export interface CreateModerationCaseTargetInput {
  case_id: string
  target_type: string
  target_id: string
  relation_type?: ModerationTargetRelationType
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
  relation_type?: ModerationTargetRelationType
  room_id?: string | null
  session_id?: string | null
  message_id?: string | null
}

export interface CreateModerationEvidenceSnapshotInput {
  case_id: string
  snapshot_type: string
  payload?: Record<string, unknown>
  content?: Record<string, unknown> | null
  context?: Record<string, unknown> | null
  policy_hits?: Record<string, unknown> | null
  prompt_memory?: Record<string, unknown> | null
  topic_signals?: Record<string, unknown> | null
  action_history?: Record<string, unknown> | null
  evidence_package?: Record<string, unknown> | null
}

export interface CreateReviewTaskInput {
  case_id: string
  queue?: ReviewQueue
  task_type: string
  status?: ReviewTaskStatus
  assignee_user_id?: string | null
  claim_token?: string | null
  claimed_by_user_id?: string | null
  claimed_at?: Date | null
  assigned_role?: string | null
  due_at?: Date | null
  resolution_code?: string | null
  operator_note?: string | null
  completed_at?: Date | null
}

export interface UpdateReviewTaskInput {
  queue?: ReviewQueue
  status?: ReviewTaskStatus
  assignee_user_id?: string | null
  claim_token?: string | null
  claimed_by_user_id?: string | null
  claimed_at?: Date | null
  assigned_role?: string | null
  due_at?: Date | null
  resolution_code?: string | null
  operator_note?: string | null
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
  complaint_type: ComplaintType
  reason_code: string
  detail_text?: string | null
  attachments?: GovernanceAttachment[]
  status?: ComplaintStatus
  linked_case_id?: string | null
  resolution?: Record<string, unknown> | null
}

export interface UpdateComplaintTicketInput {
  status?: ComplaintStatus
  linked_case_id?: string | null
  resolution?: Record<string, unknown> | null
}

export interface CreateAppealRequestInput {
  requester_user_id: string
  requester_type?: AppealRequesterType
  target_type: string
  target_id: string
  appeal_type: AppealType
  reason: string
  status?: AppealStatus
  linked_case_id?: string | null
  linked_complaint_ticket_id?: string | null
  result?: Record<string, unknown> | null
}

export interface UpdateAppealRequestInput {
  status?: AppealStatus
  linked_case_id?: string | null
  linked_complaint_ticket_id?: string | null
  result?: Record<string, unknown> | null
}

export interface UpsertUserIdentityVerificationInput {
  user_id: string
  status: IdentityVerificationStatus
  reviewed_by_user_id?: string | null
  reason?: string | null
  method?: IdentityVerificationMethod
  reviewed_at?: Date | null
  expires_at?: Date | null
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
