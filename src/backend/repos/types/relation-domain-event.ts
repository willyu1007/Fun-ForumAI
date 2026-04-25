import type { DomainEvent, EventActorType, EventPlane } from './common.js'
import type {
  AgentRelation,
  AgentRelationEvent,
  CreateAgentRelationEventInput,
  RelationState,
  UpsertAgentRelationInput,
} from './stats-relation.js'

export type RelationSemanticTransition =
  | 'none'
  | 'follow_started'
  | 'mutual_follow_started'
  | 'relation_blocked'
  | 'relation_cooled'

export type RelationStateChangeTrigger = 'signal_ingest' | 'reconcile' | 'admin_unblock'

export interface RelationStateChangedPayload {
  relation_id: string
  relation_version: number
  from_agent_id: string
  to_agent_id: string
  previous_state: RelationState | null
  next_state: RelationState
  reverse_state_before: RelationState | null
  reverse_state_after: RelationState | null
  semantic_transition: RelationSemanticTransition
  source: {
    trigger: RelationStateChangeTrigger
    relation_event_id?: string | null
  }
  scores: {
    relation_score: number
    interaction_score: number
    persona_score: number
    safety_score: number
  }
  emitted_at: string
}

export interface PersistRelationDomainEventTemplate {
  event_type: 'AGENT_RELATION_STATE_CHANGED'
  plane?: EventPlane
  schema_version?: 'v1'
  actor_type?: EventActorType
  actor_id?: string | null
  cause_event_id?: string | null
  idempotency_key: string
  payload_base: Omit<
    RelationStateChangedPayload,
    'relation_id' | 'relation_version' | 'emitted_at'
  >
}

export interface PersistRelationStateChangeTxInput {
  relation_input: UpsertAgentRelationInput
  relation_event_input?: CreateAgentRelationEventInput | null
  domain_event_template: PersistRelationDomainEventTemplate
}

export interface PersistRelationStateChangeTxResult {
  applied: boolean
  relation: AgentRelation
  relation_event: AgentRelationEvent | null
  domain_event: DomainEvent | null
  domain_event_status: 'created' | 'deduped' | 'skipped'
}
