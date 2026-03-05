export type ConfigRiskLevel = 'LOW' | 'HIGH'
export type ConfigPatchStatus = 'DRAFT' | 'VALIDATED' | 'APPROVED' | 'APPLIED' | 'REJECTED' | 'ROLLED_BACK'
export type ConfigApprovalDecision = 'APPROVED' | 'REJECTED'

export interface CommunityConfigVersion {
  id: string
  community_id: string
  version: number
  rules_json: Record<string, unknown>
  source_patch_id: string | null
  risk_level: ConfigRiskLevel
  created_by_user_id: string | null
  rollback_from_version_id: string | null
  applied_at: Date | null
  rolled_back_at: Date | null
  meta: Record<string, unknown> | null
  created_at: Date
  updated_at: Date
}

export interface CommunityConfigPatch {
  id: string
  community_id: string
  base_version_id: string | null
  status: ConfigPatchStatus
  risk_level: ConfigRiskLevel
  patch_json: Record<string, unknown>
  proposed_rules_json: Record<string, unknown> | null
  summary: string | null
  reason: string | null
  proposed_by_user_id: string
  validated_by_user_id: string | null
  approved_by_user_id: string | null
  applied_version_id: string | null
  rejected_reason: string | null
  validated_at: Date | null
  approved_at: Date | null
  applied_at: Date | null
  rolled_back_at: Date | null
  meta: Record<string, unknown> | null
  created_at: Date
  updated_at: Date
}

export interface CommunityConfigApproval {
  id: string
  patch_id: string
  actor_user_id: string
  decision: ConfigApprovalDecision
  reason: string | null
  created_at: Date
}

export interface CreateCommunityConfigVersionInput {
  community_id: string
  version: number
  rules_json: Record<string, unknown>
  source_patch_id?: string | null
  risk_level?: ConfigRiskLevel
  created_by_user_id?: string | null
  rollback_from_version_id?: string | null
  applied_at?: Date | null
  rolled_back_at?: Date | null
  meta?: Record<string, unknown> | null
}

export interface CreateCommunityConfigPatchInput {
  community_id: string
  base_version_id?: string | null
  status?: ConfigPatchStatus
  risk_level?: ConfigRiskLevel
  patch_json: Record<string, unknown>
  proposed_rules_json?: Record<string, unknown> | null
  summary?: string | null
  reason?: string | null
  proposed_by_user_id: string
  validated_by_user_id?: string | null
  approved_by_user_id?: string | null
  applied_version_id?: string | null
  rejected_reason?: string | null
  validated_at?: Date | null
  approved_at?: Date | null
  applied_at?: Date | null
  rolled_back_at?: Date | null
  meta?: Record<string, unknown> | null
}

export interface UpdateCommunityConfigPatchInput {
  status?: ConfigPatchStatus
  risk_level?: ConfigRiskLevel
  proposed_rules_json?: Record<string, unknown> | null
  validated_by_user_id?: string | null
  approved_by_user_id?: string | null
  applied_version_id?: string | null
  rejected_reason?: string | null
  validated_at?: Date | null
  approved_at?: Date | null
  applied_at?: Date | null
  rolled_back_at?: Date | null
  meta?: Record<string, unknown> | null
}

export interface CreateCommunityConfigApprovalInput {
  patch_id: string
  actor_user_id: string
  decision: ConfigApprovalDecision
  reason?: string | null
}

export type RoleAssignmentScope = 'COMMUNITY' | 'POST'
export type RoleAssignmentStatus = 'ACTIVE' | 'REVOKED' | 'EXPIRED'

export interface RoleAssignment {
  id: string
  community_id: string
  post_id: string | null
  agent_id: string
  scope: RoleAssignmentScope
  scope_id: string
  role: string
  status: RoleAssignmentStatus
  assigned_by: string | null
  expires_at: Date | null
  revoked_at: Date | null
  meta: Record<string, unknown> | null
  created_at: Date
  updated_at: Date
}

export interface CreateRoleAssignmentInput {
  community_id: string
  post_id?: string | null
  agent_id: string
  scope: RoleAssignmentScope
  scope_id: string
  role: string
  status?: RoleAssignmentStatus
  assigned_by?: string | null
  expires_at?: Date | null
  revoked_at?: Date | null
  meta?: Record<string, unknown> | null
}

export interface UpdateRoleAssignmentInput {
  role?: string
  status?: RoleAssignmentStatus
  expires_at?: Date | null
  revoked_at?: Date | null
  meta?: Record<string, unknown> | null
}

export type AftershowArtifactStatus = 'DUE' | 'SNAPSHOT_CREATED' | 'COMPOSED' | 'PUBLISHED' | 'ABORTED'

export interface AftershowArtifact {
  id: string
  run_id: string | null
  post_id: string
  community_id: string
  status: AftershowArtifactStatus
  window_start: Date
  window_end: Date
  summary_text: string
  content: Record<string, unknown> | null
  audience_summary_ref: string | null
  correlation_id: string | null
  cause_event_id: string | null
  idempotency_key: string | null
  published_at: Date | null
  meta: Record<string, unknown> | null
  created_at: Date
  updated_at: Date
}

export interface CreateAftershowArtifactInput {
  run_id?: string | null
  post_id: string
  community_id: string
  status?: AftershowArtifactStatus
  window_start: Date
  window_end: Date
  summary_text: string
  content?: Record<string, unknown> | null
  audience_summary_ref?: string | null
  correlation_id?: string | null
  cause_event_id?: string | null
  idempotency_key?: string | null
  published_at?: Date | null
  meta?: Record<string, unknown> | null
}

export interface UpdateAftershowArtifactInput {
  status?: AftershowArtifactStatus
  summary_text?: string
  content?: Record<string, unknown> | null
  audience_summary_ref?: string | null
  published_at?: Date | null
  meta?: Record<string, unknown> | null
}

export interface AftershowCallout {
  id: string
  artifact_id: string
  user_id: string
  audience_message_id: string
  reason: string
  evidence_ref: string | null
  notification_id: string | null
  invalidated_at: Date | null
  meta: Record<string, unknown> | null
  created_at: Date
}

export interface CreateAftershowCalloutInput {
  artifact_id: string
  user_id: string
  audience_message_id: string
  reason: string
  evidence_ref?: string | null
  notification_id?: string | null
  invalidated_at?: Date | null
  meta?: Record<string, unknown> | null
}

export interface UpdateAftershowCalloutInput {
  notification_id?: string | null
  invalidated_at?: Date | null
  meta?: Record<string, unknown> | null
}
