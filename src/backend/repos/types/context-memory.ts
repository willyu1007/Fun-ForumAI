export type ContextMemoryScene = 'forum' | 'chat_room' | 'private_chat'
export type ContextMemorySourceType = 'private_session' | 'forum_thread' | 'chat_room_window' | 'nightly_compaction'
export type ContextRelationChannel = 'owner' | 'community' | 'room' | 'agent'

export interface ContextRawEvent {
  id: string
  agent_id: string
  scene: ContextMemoryScene
  source_type: ContextMemorySourceType
  source_ref_id: string | null
  counterpart_id: string | null
  transcript: string
  evidence_refs: string[]
  created_at: Date
}

export interface ContextEpisodicCard {
  id: string
  agent_id: string
  event_id: string | null
  scene: ContextMemoryScene
  title: string
  summary: string
  topic_tags: string[]
  evidence_refs: string[]
  salience: number
  created_at: Date
  updated_at: Date
}

export interface ContextRelationState {
  id: string
  agent_id: string
  counterpart_id: string
  channel: ContextRelationChannel
  stance: string
  confidence: number
  evidence_refs: string[]
  updated_at: Date
}

export interface ContextSelfModelState {
  id: string
  agent_id: string
  summary: string
  tensions: string[]
  evidence_refs: string[]
  updated_at: Date
}

export interface ContextActiveTensionItem {
  id: string
  agent_id: string
  label: string
  description: string
  intensity: number
  evidence_refs: string[]
  updated_at: Date
}

export interface ContextPrivateShadowMemory {
  id: string
  agent_id: string
  event_id: string | null
  summary: string
  public_safe_shadow: string
  evidence_refs: string[]
  created_at: Date
}

export interface UpsertContextRawEventInput {
  id: string
  agent_id: string
  scene: ContextMemoryScene
  source_type: ContextMemorySourceType
  source_ref_id?: string | null
  counterpart_id?: string | null
  transcript: string
  evidence_refs: string[]
  created_at?: Date
}

export interface UpsertContextEpisodicCardInput {
  id: string
  agent_id: string
  event_id?: string | null
  scene: ContextMemoryScene
  title: string
  summary: string
  topic_tags: string[]
  evidence_refs: string[]
  salience: number
  created_at?: Date
}

export interface UpsertContextRelationStateInput {
  id: string
  agent_id: string
  counterpart_id: string
  channel: ContextRelationChannel
  stance: string
  confidence: number
  evidence_refs: string[]
}

export interface UpsertContextSelfModelStateInput {
  id: string
  agent_id: string
  summary: string
  tensions: string[]
  evidence_refs: string[]
}

export interface UpsertContextActiveTensionItemInput {
  id: string
  agent_id: string
  label: string
  description: string
  intensity: number
  evidence_refs: string[]
}

export interface UpsertContextPrivateShadowMemoryInput {
  id: string
  agent_id: string
  event_id?: string | null
  summary: string
  public_safe_shadow: string
  evidence_refs: string[]
  created_at?: Date
}
