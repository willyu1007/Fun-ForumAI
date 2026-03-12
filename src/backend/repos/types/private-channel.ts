import type { MessageDeliveryStatus } from './risk-governance.js'

export type PrivateSessionStatus = 'ACTIVE' | 'ENDED' | 'ARCHIVED'
export type SessionInitiator = 'HUMAN' | 'AGENT'
export type DigestStatus = 'PENDING' | 'GENERATING' | 'COMPLETED' | 'FAILED' | 'SKIPPED'
export type PrivateAuthorType = 'HUMAN' | 'AGENT'
export type MemorySource = 'PRIVATE_CHAT' | 'PUBLIC_OBSERVATION' | 'SYSTEM'
export type NotificationType = 'AGENT_PROACTIVE' | 'AGENT_FIRST_POST' | 'GROWTH_MILESTONE' | 'GOVERNANCE' | 'AFTERSHOW_CALLOUT'

export interface PrivateSession {
  id: string
  agent_id: string
  human_user_id: string
  status: PrivateSessionStatus
  initiator: SessionInitiator
  trigger_type: string | null
  trigger_ref: string | null
  started_at: Date
  ended_at: Date | null
  digest_status: DigestStatus
}

export interface PrivateMessage {
  id: string
  session_id: string
  author_type: PrivateAuthorType
  content: string
  delivery_status: MessageDeliveryStatus
  moderation_metadata: Record<string, unknown> | null
  created_at: Date
}

export interface AgentMemory {
  id: string
  agent_id: string
  source_type: MemorySource
  source_session_id: string | null
  source_ref_type: string | null
  source_ref_id: string | null
  source_event_id: string | null
  summary_text: string
  topic_tags: string[]
  key_facts: string[]
  sentiment: string | null
  importance_score: number
  privacy_floor: number
  access_count: number
  forgotten: boolean
  created_at: Date
  last_accessed_at: Date | null
}

export interface AgentPrivacySettingsEntity {
  agent_id: string
  disclosure_level: number
  public_memory_budget: number
  public_memory_top_k: number
  public_disclosure_cap: number | null
  updated_at: Date
  updated_by: string
}

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  title: string
  body: string | null
  target_type: string | null
  target_id: string | null
  read: boolean
  created_at: Date
}

export interface CreatePrivateSessionInput {
  agent_id: string
  human_user_id: string
  initiator?: SessionInitiator
  trigger_type?: string | null
  trigger_ref?: string | null
}

export interface CreatePrivateMessageInput {
  session_id: string
  author_type: PrivateAuthorType
  content: string
  delivery_status?: MessageDeliveryStatus
  moderation_metadata?: Record<string, unknown> | null
}

export interface CreateAgentMemoryInput {
  agent_id: string
  source_type: MemorySource
  source_session_id?: string | null
  source_ref_type?: string | null
  source_ref_id?: string | null
  source_event_id?: string | null
  summary_text: string
  topic_tags: string[]
  key_facts: string[]
  sentiment?: string | null
  importance_score: number
  privacy_floor?: number
}

export interface UpsertPrivacySettingsInput {
  agent_id: string
  disclosure_level?: number
  public_memory_budget?: number
  public_memory_top_k?: number
  public_disclosure_cap?: number | null
  updated_by: string
}

export interface CreateNotificationInput {
  user_id: string
  type: NotificationType
  title: string
  body?: string | null
  target_type?: string | null
  target_id?: string | null
}
