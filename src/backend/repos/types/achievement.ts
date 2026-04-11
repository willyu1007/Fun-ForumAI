import type { EvidenceRef } from './common.js'

export type AchievementVisibility = 'PUBLIC' | 'OWNER_ONLY'
export type AchievementScope = 'global' | 'community' | 'peer'
export type ChronicleType = 'ACHIEVEMENT' | 'RELATION_CHANGE' | 'HIGHLIGHT' | 'PRIVATE_DIGEST' | 'MODERATION'

export interface AchievementSignalContext {
  event_id?: string | null
  thread_id?: string | null
  community_id?: string | null
  peer_agent_id?: string | null
  to_agent_id?: string | null
  previous_state?: string | null
  next_state?: string | null
  action?: string | null
  admin_user_id?: string | null
  target_type?: string | null
  result_success?: boolean | null
  new_visibility?: string | null
  new_state?: string | null
  post_id?: string | null
  artifact_id?: string | null
  publish_shape?: string | null
  session_id?: string | null
  human_message_id?: string | null
  opening_message_id?: string | null
  signal_visibility_reason?: string | null
  source_ref?: string | null
  source_event_id?: string | null
  content_kind?: string | null
  generated_at?: string | null
  snapshot_date?: string | null
  source_mode?: string | null
  shelf_id?: string | null
  storyline_id?: string | null
  dedup_key?: string | null
}

export interface AchievementAwardContext {
  trigger_kind?: string | null
  trigger_mode?: string | null
  metric_name?: string | null
  metric_value?: number | null
  threshold?: number | null
  evidence_satisfied?: boolean | null
  visibility_reason?: string | null
  dedup_key?: string | null
}

export interface ChronicleStoryContext {
  scene_label?: string | null
  emotion_before?: string | null
  emotion_after?: string | null
  reaction_sentence?: string | null
  outcome_sentence?: string | null
  next_hook?: string | null
}

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
  signal_context: AchievementSignalContext | null
  award_context: AchievementAwardContext | null
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
  scope: AchievementScope
  scope_key: string
  signal_context: AchievementSignalContext | null
  story_context: ChronicleStoryContext | null
  entry_source: string | null
  source_event_ids: string[]
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

export interface ViewerRecentSignals {
  actor_keys: string[]
  recent_storyline_ids: string[]
  recent_community_ids: string[]
  recent_note_template_ids: string[]
  recent_target_agent_ids: string[]
  explainability: string[]
}

export interface AgentSignalLog {
  id: string
  agent_id: string
  signal_kind: string
  importance_score: number
  visibility: AchievementVisibility
  scope: AchievementScope
  scope_key: string
  occurred_at: Date
  evidence: EvidenceRef[]
  signal_context: AchievementSignalContext | null
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
  signal_context?: AchievementSignalContext | null
  award_context?: AchievementAwardContext | null
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
  scope?: AchievementScope
  scope_key?: string
  signal_context?: AchievementSignalContext | null
  story_context?: ChronicleStoryContext | null
  entry_source?: string | null
  source_event_ids?: string[]
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
  scope?: AchievementScope
  scope_key?: string
  occurred_at?: Date
  evidence: EvidenceRef[]
  signal_context?: AchievementSignalContext | null
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
