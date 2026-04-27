import type {
  CreateRuntimeOperationRecordInput,
  RuntimeOperationEntityType,
  RuntimeOperationRecord,
  RuntimeOperationRetentionCutoffs,
  RuntimeOperationSeverity,
  RuntimeOperationSource,
  RuntimeOperationStatus,
} from './types.js'

export interface RuntimeOperationRecordCursor {
  occurred_at: Date
  id: string
}

export interface ListRuntimeOperationRecordsFilters {
  severity?: ReadonlyArray<RuntimeOperationSeverity>
  source?: ReadonlyArray<RuntimeOperationSource>
  status?: ReadonlyArray<RuntimeOperationStatus>
  agent_id?: string
  trace_id?: string
  correlation_id?: string
  event_id?: string
  linked_risk_event_id?: string
  entity?: {
    type: RuntimeOperationEntityType
    id: string
  }
  since?: Date
  until?: Date
  before?: RuntimeOperationRecordCursor
  limit?: number
}

export interface RuntimeOperationRecordRepository {
  create(input: CreateRuntimeOperationRecordInput): Promise<RuntimeOperationRecord>
  findById(id: string): Promise<RuntimeOperationRecord | null>
  list(filters?: ListRuntimeOperationRecordsFilters): Promise<RuntimeOperationRecord[]>
  /**
   * Delete operation records that fall outside their severity-based retention window.
   * Records linked to a `RiskEventLog` are excluded from ordinary cleanup.
   * Returns the number of deleted rows.
   */
  deleteExpired(cutoffs: RuntimeOperationRetentionCutoffs): Promise<number>
}

let counter = 0
function cuid(): string {
  return `runtime_operation_record_${Date.now()}_${String(++counter).padStart(8, '0')}`
}

function entityFieldOf(type: RuntimeOperationEntityType): keyof RuntimeOperationRecord {
  switch (type) {
    case 'agent':
      return 'agent_id'
    case 'community':
      return 'community_id'
    case 'post':
      return 'post_id'
    case 'room':
      return 'room_id'
    case 'session':
      return 'session_id'
    case 'message':
      return 'message_id'
  }
}

export class InMemoryRuntimeOperationRecordRepository implements RuntimeOperationRecordRepository {
  private readonly store = new Map<string, RuntimeOperationRecord>()

  async create(input: CreateRuntimeOperationRecordInput): Promise<RuntimeOperationRecord> {
    const now = new Date()
    const record: RuntimeOperationRecord = {
      id: input.id ?? cuid(),
      occurred_at: input.occurred_at ?? now,
      severity: input.severity,
      source: input.source,
      operation: input.operation,
      status: input.status,
      trace_id: input.trace_id ?? null,
      correlation_id: input.correlation_id ?? null,
      event_id: input.event_id ?? null,
      agent_id: input.agent_id ?? null,
      community_id: input.community_id ?? null,
      post_id: input.post_id ?? null,
      room_id: input.room_id ?? null,
      session_id: input.session_id ?? null,
      message_id: input.message_id ?? null,
      linked_agent_run_id: input.linked_agent_run_id ?? null,
      linked_llm_trace_id: input.linked_llm_trace_id ?? null,
      linked_risk_event_id: input.linked_risk_event_id ?? null,
      duration_ms: input.duration_ms ?? null,
      error_code: input.error_code ?? null,
      error_message_redacted: input.error_message_redacted ?? null,
      retry_count: input.retry_count ?? null,
      payload_json: input.payload_json ?? null,
      created_at: input.created_at ?? now,
    }
    this.store.set(record.id, record)
    return record
  }

  async findById(id: string): Promise<RuntimeOperationRecord | null> {
    return this.store.get(id) ?? null
  }

  async list(filters: ListRuntimeOperationRecordsFilters = {}): Promise<RuntimeOperationRecord[]> {
    const severitySet = filters.severity ? new Set(filters.severity) : null
    const sourceSet = filters.source ? new Set(filters.source) : null
    const statusSet = filters.status ? new Set(filters.status) : null

    return Array.from(this.store.values())
      .filter((row) => (severitySet ? severitySet.has(row.severity) : true))
      .filter((row) => (sourceSet ? sourceSet.has(row.source) : true))
      .filter((row) => (statusSet ? statusSet.has(row.status) : true))
      .filter((row) => (filters.agent_id ? row.agent_id === filters.agent_id : true))
      .filter((row) => (filters.trace_id ? row.trace_id === filters.trace_id : true))
      .filter((row) => (filters.correlation_id ? row.correlation_id === filters.correlation_id : true))
      .filter((row) => (filters.event_id ? row.event_id === filters.event_id : true))
      .filter((row) =>
        filters.linked_risk_event_id
          ? row.linked_risk_event_id === filters.linked_risk_event_id
          : true,
      )
      .filter((row) => {
        if (!filters.entity) return true
        const field = entityFieldOf(filters.entity.type)
        return row[field] === filters.entity.id
      })
      .filter((row) => (filters.since ? row.occurred_at.getTime() >= filters.since.getTime() : true))
      .filter((row) => (filters.until ? row.occurred_at.getTime() <= filters.until.getTime() : true))
      .filter((row) => {
        if (!filters.before) return true
        const rowTime = row.occurred_at.getTime()
        const beforeTime = filters.before.occurred_at.getTime()
        return rowTime < beforeTime || (rowTime === beforeTime && row.id < filters.before.id)
      })
      .sort((left, right) =>
        right.occurred_at.getTime() - left.occurred_at.getTime()
        || right.id.localeCompare(left.id))
      .slice(0, filters.limit ?? Number.MAX_SAFE_INTEGER)
  }

  async deleteExpired(cutoffs: RuntimeOperationRetentionCutoffs): Promise<number> {
    let deleted = 0
    for (const [id, row] of this.store) {
      if (row.linked_risk_event_id) continue
      const cutoff = severityCutoff(row.severity, cutoffs)
      if (row.occurred_at.getTime() < cutoff.getTime()) {
        this.store.delete(id)
        deleted += 1
      }
    }
    return deleted
  }
}

function severityCutoff(
  severity: RuntimeOperationSeverity,
  cutoffs: RuntimeOperationRetentionCutoffs,
): Date {
  switch (severity) {
    case 'critical':
    case 'error':
      return cutoffs.errorCriticalBefore
    case 'warn':
      return cutoffs.warnBefore
    case 'info':
      return cutoffs.infoBefore
  }
}
