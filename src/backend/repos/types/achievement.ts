import type { EvidenceRef } from './common.js'

export type AchievementVisibility = 'PUBLIC' | 'OWNER_ONLY'
export type AchievementScope = 'global' | 'community' | 'peer'
export type ChronicleType = 'ACHIEVEMENT' | 'RELATION_CHANGE' | 'HIGHLIGHT' | 'PRIVATE_DIGEST' | 'MODERATION'

export interface AgentAchievement {
  id: string
  agent_id: string
  code: string
  name: string
  category: string
  tier: 1 | 2 | 3
  scope: AchievementScope
  scope_key: string
  rarity: number
  visibility: AchievementVisibility
  achieved_at: Date
  evidence: EvidenceRef[]
  meta: Record<string, unknown> | null
  created_at: Date
  updated_at: Date
}

export interface ChronicleEntry {
  id: string
  agent_id: string
  visibility: AchievementVisibility
  type: ChronicleType
  occurred_at: Date
  title: string
  summary: string
  importance_score: number
  evidence: EvidenceRef[]
  actors: string[]
  location: string | null
  tags: string[]
  meta: Record<string, unknown> | null
  dedup_key: string | null
  created_at: Date
  updated_at: Date
}

export interface PprSnapshot {
  id: string
  source_agent_id: string
  candidate_agent_id: string
  community_id: string
  topic_key: string
  ppr_score: number
  rank: number
  computed_at: Date
  expires_at: Date
  created_at: Date
  updated_at: Date
}

export interface AgentSignalLog {
  id: string
  agent_id: string
  signal_kind: string
  importance_score: number
  visibility: AchievementVisibility
  occurred_at: Date
  evidence: EvidenceRef[]
  meta: Record<string, unknown> | null
  dedup_key: string | null
  created_at: Date
}

export type CommunityCultureDigestStatus = 'ACTIVE' | 'EXPIRED' | 'DISABLED'

export interface CommunityCultureDigest {
  id: string
  community_id: string
  version: number
  digest_json: Record<string, unknown>
  source_window_days: number
  expires_at: Date
  generated_at: Date
  status: CommunityCultureDigestStatus
  created_at: Date
  updated_at: Date
}

export interface CreateAgentAchievementInput {
  agent_id: string
  code: string
  name: string
  category: string
  tier: 1 | 2 | 3
  scope: AchievementScope
  scope_key: string
  rarity?: number
  visibility: AchievementVisibility
  achieved_at?: Date
  evidence: EvidenceRef[]
  meta?: Record<string, unknown> | null
}

export interface CreateChronicleEntryInput {
  agent_id: string
  visibility: AchievementVisibility
  type: ChronicleType
  occurred_at?: Date
  title: string
  summary: string
  importance_score: number
  evidence: EvidenceRef[]
  actors?: string[]
  location?: string | null
  tags?: string[]
  meta?: Record<string, unknown> | null
  dedup_key?: string | null
}

export interface CreatePprSnapshotInput {
  source_agent_id: string
  candidate_agent_id: string
  community_id: string
  topic_key: string
  ppr_score: number
  rank: number
  computed_at: Date
  expires_at: Date
}

export interface CreateAgentSignalLogInput {
  agent_id: string
  signal_kind: string
  importance_score: number
  visibility: AchievementVisibility
  occurred_at?: Date
  evidence: EvidenceRef[]
  meta?: Record<string, unknown> | null
  dedup_key?: string | null
}

export interface CreateCommunityCultureDigestInput {
  community_id: string
  version: number
  digest_json: Record<string, unknown>
  source_window_days: number
  expires_at: Date
  generated_at?: Date
  status?: CommunityCultureDigestStatus
}
