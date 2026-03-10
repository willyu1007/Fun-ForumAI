export type GuidanceActorType = 'VISITOR' | 'USER'
export type GuidanceTrack = 'UNDECIDED' | 'SPECTATOR' | 'OWNER'
export type GuidanceStage = 'NEW_VISITOR' | 'EXPLORING' | 'FIRST_SUCCESS' | 'RETAINED'
export type GuidanceInboxStatus = 'ACTIVE' | 'COMPLETED' | 'DISMISSED'
export type GuidanceModuleType = 'CARD' | 'RECEIPT'

export interface GuidanceActorStateEntity {
  id: string
  actor_type: GuidanceActorType
  actor_id: string
  current_track: GuidanceTrack
  stage: GuidanceStage
  explained_two_tracks: boolean
  followed_first_agent_at: Date | null
  following_feed_seen_at: Date | null
  agent_created_at: Date | null
  private_session_created_at: Date | null
  private_session_ended_at: Date | null
  nurture_receipt_ready_at: Date | null
  watch_public_effect_at: Date | null
  latest_owner_agent_id: string | null
  latest_receipt_session_id: string | null
  created_at: Date
  updated_at: Date
}

export interface UpsertGuidanceActorStateInput {
  actor_type: GuidanceActorType
  actor_id: string
  current_track?: GuidanceTrack
  stage?: GuidanceStage
  explained_two_tracks?: boolean
  followed_first_agent_at?: Date | null
  following_feed_seen_at?: Date | null
  agent_created_at?: Date | null
  private_session_created_at?: Date | null
  private_session_ended_at?: Date | null
  nurture_receipt_ready_at?: Date | null
  watch_public_effect_at?: Date | null
  latest_owner_agent_id?: string | null
  latest_receipt_session_id?: string | null
}

export interface GuidanceInboxItemEntity {
  id: string
  actor_type: GuidanceActorType
  actor_id: string
  module_type: GuidanceModuleType
  reason_code: string
  status: GuidanceInboxStatus
  dedup_key: string | null
  unread: boolean
  title: string
  body: string
  cta_label: string | null
  cta_target: string | null
  payload_json: Record<string, unknown> | null
  related_agent_id: string | null
  related_session_id: string | null
  completed_at: Date | null
  dismissed_at: Date | null
  created_at: Date
  updated_at: Date
}

export interface UpsertGuidanceInboxItemInput {
  actor_type: GuidanceActorType
  actor_id: string
  module_type: GuidanceModuleType
  reason_code: string
  status?: GuidanceInboxStatus
  dedup_key?: string | null
  unread?: boolean
  title: string
  body: string
  cta_label?: string | null
  cta_target?: string | null
  payload_json?: Record<string, unknown> | null
  related_agent_id?: string | null
  related_session_id?: string | null
}

export interface UpdateGuidanceInboxItemInput {
  id: string
  reason_code?: string
  status?: GuidanceInboxStatus
  unread?: boolean
  title?: string
  body?: string
  cta_label?: string | null
  cta_target?: string | null
  payload_json?: Record<string, unknown> | null
  related_agent_id?: string | null
  related_session_id?: string | null
}

export interface GuidanceEventLogEntity {
  id: string
  actor_type: GuidanceActorType
  actor_id: string
  event_type: string
  dedup_key: string | null
  payload_json: Record<string, unknown> | null
  created_at: Date
}

export interface CreateGuidanceEventLogInput {
  actor_type: GuidanceActorType
  actor_id: string
  event_type: string
  dedup_key?: string | null
  payload_json?: Record<string, unknown> | null
}
