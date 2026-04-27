export type RuntimeOperationSeverity = 'info' | 'warn' | 'error' | 'critical'

export type RuntimeOperationSource =
  | 'runtime_loop'
  | 'event_queue'
  | 'agent_executor'
  | 'post_scheduler'
  | 'proactive_interaction'
  | 'llm_gateway'
  | 'media_worker'
  | 'guidance_worker'
  | 'db_diagnostic'
  | 'system'

export type RuntimeOperationStatus =
  | 'started'
  | 'succeeded'
  | 'failed'
  | 'retried'
  | 'dead_lettered'
  | 'skipped'

export const RUNTIME_OPERATION_SEVERITIES: ReadonlyArray<RuntimeOperationSeverity> = [
  'info',
  'warn',
  'error',
  'critical',
]

export const RUNTIME_OPERATION_SOURCES: ReadonlyArray<RuntimeOperationSource> = [
  'runtime_loop',
  'event_queue',
  'agent_executor',
  'post_scheduler',
  'proactive_interaction',
  'llm_gateway',
  'media_worker',
  'guidance_worker',
  'db_diagnostic',
  'system',
]

export const RUNTIME_OPERATION_STATUSES: ReadonlyArray<RuntimeOperationStatus> = [
  'started',
  'succeeded',
  'failed',
  'retried',
  'dead_lettered',
  'skipped',
]

export interface RuntimeOperationRecord {
  id: string
  occurred_at: Date
  severity: RuntimeOperationSeverity
  source: RuntimeOperationSource
  operation: string
  status: RuntimeOperationStatus
  trace_id: string | null
  correlation_id: string | null
  event_id: string | null
  agent_id: string | null
  community_id: string | null
  post_id: string | null
  room_id: string | null
  session_id: string | null
  message_id: string | null
  linked_agent_run_id: string | null
  linked_llm_trace_id: string | null
  linked_risk_event_id: string | null
  duration_ms: number | null
  error_code: string | null
  error_message_redacted: string | null
  retry_count: number | null
  payload_json: Record<string, unknown> | null
  created_at: Date
}

export interface CreateRuntimeOperationRecordInput {
  id?: string
  occurred_at?: Date
  severity: RuntimeOperationSeverity
  source: RuntimeOperationSource
  operation: string
  status: RuntimeOperationStatus
  trace_id?: string | null
  correlation_id?: string | null
  event_id?: string | null
  agent_id?: string | null
  community_id?: string | null
  post_id?: string | null
  room_id?: string | null
  session_id?: string | null
  message_id?: string | null
  linked_agent_run_id?: string | null
  linked_llm_trace_id?: string | null
  linked_risk_event_id?: string | null
  duration_ms?: number | null
  error_code?: string | null
  error_message_redacted?: string | null
  retry_count?: number | null
  payload_json?: Record<string, unknown> | null
  created_at?: Date
}

export type RuntimeOperationEntityType =
  | 'agent'
  | 'community'
  | 'post'
  | 'room'
  | 'session'
  | 'message'

export interface RuntimeOperationRetentionCutoffs {
  /** Cutoff for `severity in ('error', 'critical')`; rows with `occurred_at < cutoff` are deleted. */
  errorCriticalBefore: Date
  /** Cutoff for `severity = 'warn'`. */
  warnBefore: Date
  /** Cutoff for `severity in ('info', 'succeeded')` lifecycle markers. */
  infoBefore: Date
}
