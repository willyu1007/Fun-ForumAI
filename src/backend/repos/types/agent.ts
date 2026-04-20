export interface Agent {
  id: string
  owner_id: string
  display_name: string
  avatar_url: string | null
  moments_cover_url?: string | null
  persona_version: number
  reputation_score: number
  status: 'ACTIVE' | 'LIMITED' | 'QUARANTINED' | 'BANNED' | 'DELETED'
  deleted_at?: Date | null
  created_at: Date
  updated_at: Date
}

export interface AgentConfig {
  id: string
  agent_id: string
  config_json: Record<string, unknown>
  risk_level: 'LOW' | 'HIGH'
  review_status: 'NOT_REQUIRED' | 'PENDING' | 'APPROVED' | 'REJECTED'
  review_case_id: string | null
  lint_warnings: string[]
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

export type AgentCommunityMembershipRole = 'RESIDENT' | 'GUEST'
export type AgentCommunityMembershipSource = 'MANUAL' | 'DERIVED'
export type AgentCommunityMembershipStatus = 'ACTIVE' | 'MUTED' | 'BANNED'

export interface AgentCommunityMembership {
  id: string
  agent_id: string
  community_id: string
  role: AgentCommunityMembershipRole
  source: AgentCommunityMembershipSource
  status: AgentCommunityMembershipStatus
  status_reason: string | null
  status_set_by: string | null
  status_set_at: Date | null
  joined_at: Date
  left_at: Date | null
  created_by: string | null
  created_at: Date
  updated_at: Date
}

export type AgentStageTier = 'T1' | 'T2' | 'T3' | 'T4' | 'T5'

export interface AgentStageTierSnapshot {
  id: string
  agent_id: string
  tier: AgentStageTier
  score: number
  achievement_points: number
  chronicle_points: number
  trust_penalty: number
  reasoning: Record<string, unknown>
  computed_at: Date
  updated_at: Date
}

export type StageTemplateStatus = 'launch' | 'hidden'

export interface StageTemplateManifestItem {
  id: string
  category: string
  path: string
  status: StageTemplateStatus
  binding: {
    community_slug: string
    slot?: string
    binding_type: 'core' | 'seasonal'
  } | null
}

export interface HumanUser {
  id: string
  email: string | null
  password_hash: string | null
  display_name: string
  avatar_url: string | null
  birth_date: Date | null
  phone: string | null
  wechat_open_id: string | null
  email_verified: boolean
  phone_verified: boolean
  last_login_at: Date | null
  plan_tier: 'FREE' | 'PRO' | 'ADMIN'
  status: 'ACTIVE' | 'SUSPENDED'
  invite_code_id: string | null
  created_at: Date
  updated_at: Date
}

export type AuthVerificationChannel = 'EMAIL' | 'SMS'
export type AuthVerificationPurpose =
  | 'EMAIL_SIGNUP'
  | 'EMAIL_PASSWORD_RESET'
  | 'SMS_AUTH'
  | 'EMAIL_CHANGE'
  | 'PHONE_CHANGE'

export interface AuthVerificationChallenge {
  id: string
  channel: AuthVerificationChannel
  purpose: AuthVerificationPurpose
  target: string
  code_hash: string
  payload_json: Record<string, unknown> | null
  requested_from_ip: string | null
  expires_at: Date
  consumed_at: Date | null
  attempt_count: number
  resend_count: number
  last_sent_at: Date
  created_at: Date
  updated_at: Date
}

export interface CreateHumanUserInput {
  email?: string | null
  password_hash?: string | null
  display_name: string
  avatar_url?: string | null
  phone?: string | null
  email_verified?: boolean
  phone_verified?: boolean
  invite_code_id?: string | null
}

export interface UpsertDevHumanIdentityInput {
  id: string
  email: string
  role: 'user' | 'admin'
}

export interface CreateAgentInput {
  owner_id: string
  display_name: string
  avatar_url?: string | null
}

export interface CreateAgentConfigInput {
  agent_id: string
  config_json: Record<string, unknown>
  risk_level?: 'LOW' | 'HIGH'
  review_status?: 'NOT_REQUIRED' | 'PENDING' | 'APPROVED' | 'REJECTED'
  review_case_id?: string | null
  lint_warnings?: string[]
  updated_by: string
}

export interface CreateAgentCommunityMembershipInput {
  agent_id: string
  community_id: string
  role?: AgentCommunityMembershipRole
  source?: AgentCommunityMembershipSource
  status?: AgentCommunityMembershipStatus
  status_reason?: string | null
  status_set_by?: string | null
  status_set_at?: Date | null
  joined_at?: Date
  left_at?: Date | null
  created_by?: string | null
}

export interface UpsertAgentStageTierSnapshotInput {
  agent_id: string
  tier: AgentStageTier
  score: number
  achievement_points: number
  chronicle_points: number
  trust_penalty: number
  reasoning: Record<string, unknown>
  computed_at?: Date
}
