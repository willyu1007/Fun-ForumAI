export type RelationState = 'shadow' | 'effective' | 'inactive' | 'blocked'
export type RelationView = 'following' | 'followers' | 'friends'
export type RelationEventSeverity = 'info' | 'warning' | 'severe'
export type RelationEventType =
  | 'co_presence'
  | 'reciprocal_reply'
  | 'forum_reply'
  | 'room_message'
  | 'safety_warning'
  | 'safety_severe'
  | 'manual_unblock'

export type AgentStatsScene = 'forum' | 'chat' | 'relation' | 'vote' | 'memory'
export type AgentStatEventType =
  | 'POINTS_GRANTED'
  | 'POINTS_SPENT'
  | 'STATE_UPDATED'
  | 'SYSTEM_SEED'

export interface AgentStats {
  agent_id: string
  unspent_points: number
  granted_points_total: number
  sociability: number
  curiosity: number
  assertiveness: number
  empathy: number
  brashness: number
  cynicism: number
  stubbornness: number
  volatility: number
  memory: number
  learning: number
  version: number
  created_at: Date
  updated_at: Date
}

export interface AgentState {
  agent_id: string
  valence: number
  arousal: number
  confidence: number
  irritability: number
  fatigue: number
  last_updated_at: Date
}

export interface AgentStatEvent {
  id: string
  agent_id: string
  event_type: AgentStatEventType | string
  source: string
  idempotency_key: string | null
  delta_json: Record<string, unknown>
  created_at: Date
}

export interface AgentStatePoint {
  at: Date
  valence: number
  arousal: number
  confidence: number
  irritability: number
  fatigue: number
}

export interface AgentRelation {
  id: string
  from_agent_id: string
  to_agent_id: string
  state: RelationState
  relation_score: number
  interaction_score: number
  persona_score: number
  safety_score: number
  shadow_started_at: Date | null
  effective_at: Date | null
  inactive_at: Date | null
  blocked_at: Date | null
  below_threshold_since: Date | null
  last_signal_at: Date | null
  last_interaction_at: Date | null
  last_evaluated_at: Date | null
  last_state_changed_at: Date | null
  version: number
  created_at: Date
  updated_at: Date
}

export interface AgentRelationEvent {
  id: string
  from_agent_id: string
  to_agent_id: string
  event_type: RelationEventType
  severity: RelationEventSeverity
  source_type: string
  source_ref_id: string | null
  idempotency_key: string
  payload: Record<string, unknown> | null
  created_at: Date
}

export interface CreateAgentStatEventInput {
  agent_id: string
  event_type: AgentStatEventType | string
  source: string
  idempotency_key?: string | null
  delta_json: Record<string, unknown>
}

export interface SaveAgentStatsInput {
  agent_id: string
  unspent_points: number
  granted_points_total: number
  sociability: number
  curiosity: number
  assertiveness: number
  empathy: number
  brashness: number
  cynicism: number
  stubbornness: number
  volatility: number
  memory: number
  learning: number
  expected_version: number
}

export interface SaveAgentStateInput {
  agent_id: string
  valence: number
  arousal: number
  confidence: number
  irritability: number
  fatigue: number
}

export interface CreateAgentRelationEventInput {
  from_agent_id: string
  to_agent_id: string
  event_type: RelationEventType
  severity?: RelationEventSeverity
  source_type: string
  source_ref_id?: string | null
  idempotency_key: string
  payload?: Record<string, unknown> | null
}

export interface UpsertAgentRelationInput {
  from_agent_id: string
  to_agent_id: string
  state: RelationState
  relation_score: number
  interaction_score: number
  persona_score: number
  safety_score: number
  shadow_started_at?: Date | null
  effective_at?: Date | null
  inactive_at?: Date | null
  blocked_at?: Date | null
  below_threshold_since?: Date | null
  last_signal_at?: Date | null
  last_interaction_at?: Date | null
  last_evaluated_at?: Date | null
  last_state_changed_at?: Date | null
  expected_version?: number
}
