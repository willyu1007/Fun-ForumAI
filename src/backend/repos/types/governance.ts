import type {
  AudienceSignalIngestion,
  CommunityFamily,
  PublicationReviewProfileId,
  PublicParticipationMode,
  AgentHumanResponseMode,
} from '../../../shared/semantic-taxonomy.js'

export type ConfigRiskLevel = 'LOW' | 'HIGH'
export type ConfigVersionStatus = 'ACTIVE' | 'ROLLED_BACK' | 'RETIRED'
export type ConfigPatchStatus = 'PROPOSED' | 'VALIDATED' | 'APPROVED' | 'SCHEDULED' | 'APPLIED' | 'REJECTED' | 'ROLLED_BACK'
export type ConfigApprovalDecision = 'APPROVED' | 'REJECTED'
export const COMMUNITY_LIFECYCLE_STATES = [
  'launch_core',
  'launch_support',
  'seasonal_active',
  'incubating_gray',
  'dormant',
  'merged',
  'archived',
] as const
export type CommunityLifecycleState = (typeof COMMUNITY_LIFECYCLE_STATES)[number]

export const COMMUNITY_INCUBATION_VISIBILITY_MODES = ['GRAY', 'WHITELIST_ONLY'] as const
export type CommunityIncubationVisibilityMode = (typeof COMMUNITY_INCUBATION_VISIBILITY_MODES)[number]

export const COMMUNITY_PROPOSAL_STATUSES = [
  'SUBMITTED',
  'REJECTED',
  'INCUBATING',
  'SEASONAL',
  'ACTIVATED',
  'MERGED',
  'ARCHIVED',
] as const
export type CommunityProposalStatus = (typeof COMMUNITY_PROPOSAL_STATUSES)[number]

export const COMMUNITY_PROPOSAL_ACTIONS = [
  'reject',
  'merge',
  'incubate',
  'seasonal_slot',
  'activate',
  'archive',
] as const
export type CommunityProposalAction = (typeof COMMUNITY_PROPOSAL_ACTIONS)[number]

export interface CommunityProposal {
  id: string
  submitted_by_user_id: string
  name: string
  slug_candidate: string
  description: string
  premise_text: string
  target_audience: string | null
  scene_types: string[]
  proposed_community_family: CommunityFamily
  publication_review_profile_id: PublicationReviewProfileId
  launch_wave: string | null
  public_participation_mode: PublicParticipationMode
  audience_signal_ingestion: AudienceSignalIngestion
  agent_human_response_mode: AgentHumanResponseMode
  t4_candidate: boolean
  source_community_id: string | null
  status: CommunityProposalStatus
  incubation_visibility_mode: CommunityIncubationVisibilityMode | null
  resulting_community_id: string | null
  merged_into_community_id: string | null
  reviewed_by_user_id: string | null
  reviewed_at: Date | null
  meta: Record<string, unknown> | null
  created_at: Date
  updated_at: Date
}

export interface CommunityMergeRecommendation {
  id: string
  proposal_id: string
  duplicate_of_community_id: string | null
  recommended_as_lane_community_id: string | null
  recommended_as_seasonal: boolean
  incubation_visibility_mode: CommunityIncubationVisibilityMode
  recommended_visibility: CommunityIncubationVisibilityMode
  overlap_score: number
  rationale: string[]
  meta: Record<string, unknown> | null
  created_at: Date
  updated_at: Date
}

export interface CommunityProposalEvent {
  id: string
  proposal_id: string
  actor_type: 'human' | 'system'
  actor_id: string
  event_type: string
  payload_json: Record<string, unknown> | null
  created_at: Date
}

export interface CreateCommunityProposalInput {
  submitted_by_user_id: string
  name: string
  slug_candidate: string
  description: string
  premise_text: string
  target_audience?: string | null
  scene_types?: string[]
  proposed_community_family: CommunityFamily
  publication_review_profile_id: PublicationReviewProfileId
  launch_wave?: string | null
  public_participation_mode?: PublicParticipationMode
  audience_signal_ingestion?: AudienceSignalIngestion
  agent_human_response_mode?: AgentHumanResponseMode
  t4_candidate?: boolean
  source_community_id?: string | null
  status?: CommunityProposalStatus
  incubation_visibility_mode?: CommunityIncubationVisibilityMode | null
  resulting_community_id?: string | null
  merged_into_community_id?: string | null
  reviewed_by_user_id?: string | null
  reviewed_at?: Date | null
  meta?: Record<string, unknown> | null
}

export interface UpdateCommunityProposalInput {
  status?: CommunityProposalStatus
  proposed_community_family?: CommunityFamily
  publication_review_profile_id?: PublicationReviewProfileId
  launch_wave?: string | null
  public_participation_mode?: PublicParticipationMode
  audience_signal_ingestion?: AudienceSignalIngestion
  agent_human_response_mode?: AgentHumanResponseMode
  incubation_visibility_mode?: CommunityIncubationVisibilityMode | null
  resulting_community_id?: string | null
  merged_into_community_id?: string | null
  reviewed_by_user_id?: string | null
  reviewed_at?: Date | null
  meta?: Record<string, unknown> | null
}

export interface UpsertCommunityMergeRecommendationInput {
  proposal_id: string
  duplicate_of_community_id?: string | null
  recommended_as_lane_community_id?: string | null
  recommended_as_seasonal?: boolean
  incubation_visibility_mode?: CommunityIncubationVisibilityMode
  recommended_visibility?: CommunityIncubationVisibilityMode
  overlap_score?: number
  rationale?: string[]
  meta?: Record<string, unknown> | null
}

export interface CreateCommunityProposalEventInput {
  proposal_id: string
  actor_type: 'human' | 'system'
  actor_id: string
  event_type: string
  payload_json?: Record<string, unknown> | null
}

export interface CommunityConfigVersion {
  id: string
  community_id: string
  version: number
  rules_json: Record<string, unknown>
  source_patch_id: string | null
  status: ConfigVersionStatus
  risk_level: ConfigRiskLevel
  created_by_user_id: string | null
  rollback_from_version_id: string | null
  effective_at: Date | null
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
  effective_at: Date | null
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
  status?: ConfigVersionStatus
  risk_level?: ConfigRiskLevel
  created_by_user_id?: string | null
  rollback_from_version_id?: string | null
  effective_at?: Date | null
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
  effective_at?: Date | null
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
  effective_at?: Date | null
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
  expected_status?: RoleAssignmentStatus
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
