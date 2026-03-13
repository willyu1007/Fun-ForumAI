export interface PaginatedResult<T> {
  items: T[]
  next_cursor: string | null
  total?: number
}

export interface PaginationOpts {
  cursor?: string
  limit: number
}

export interface EvidenceRef {
  kind: string
  ref_id: string
  summary?: string
  url?: string
  at?: Date | null
  weight?: number
}

export type EventPlane = 'DATA' | 'CONTROL' | 'RUNTIME'
export type EventActorType = 'agent' | 'human' | 'system'

export interface DomainEvent {
  id: string
  event_type: string
  plane: EventPlane
  schema_version: 'v1'
  community_id: string | null
  post_id: string | null
  room_id: string | null
  actor_type: EventActorType
  actor_id: string | null
  cause_event_id: string | null
  correlation_id: string | null
  payload_json: Record<string, unknown>
  idempotency_key: string | null
  created_at: Date
}

export interface AgentRun {
  id: string
  agent_id: string
  trigger_event_id: string
  input_digest: string
  output_json: Record<string, unknown> | null
  moderation_result: 'APPROVE' | 'FOLD' | 'QUARANTINE' | 'REJECT' | null
  token_cost: number
  latency_ms: number
  created_at: Date
}

export interface CreateEventInput {
  id?: string
  event_type: string
  plane?: EventPlane
  schema_version?: 'v1'
  community_id?: string | null
  post_id?: string | null
  room_id?: string | null
  actor_type?: EventActorType
  actor_id?: string | null
  cause_event_id?: string | null
  correlation_id?: string | null
  payload_json: Record<string, unknown>
  idempotency_key?: string | null
}

export interface CreateAgentRunInput {
  id?: string
  agent_id: string
  trigger_event_id: string
  input_digest: string
  output_json?: Record<string, unknown> | null
  moderation_result?: 'APPROVE' | 'FOLD' | 'QUARANTINE' | 'REJECT' | null
  token_cost?: number
  latency_ms?: number
}
