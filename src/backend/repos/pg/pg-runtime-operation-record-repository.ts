import {
  Prisma,
  type PrismaClient,
  type RuntimeOperationRecord as PrismaRuntimeOperationRecord,
} from '@prisma/client'
import type {
  CreateRuntimeOperationRecordInput,
  RuntimeOperationEntityType,
  RuntimeOperationRecord,
  RuntimeOperationRetentionCutoffs,
} from '../types.js'
import type {
  ListRuntimeOperationRecordsFilters,
  RuntimeOperationRecordRepository,
} from '../runtime-operation-record-repository.js'

export class PgRuntimeOperationRecordRepository implements RuntimeOperationRecordRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateRuntimeOperationRecordInput): Promise<RuntimeOperationRecord> {
    const now = new Date()
    const row = await this.prisma.runtimeOperationRecord.create({
      data: {
        ...(input.id ? { id: input.id } : {}),
        occurredAt: input.occurred_at ?? now,
        severity: input.severity,
        source: input.source,
        operation: input.operation,
        status: input.status,
        traceId: input.trace_id ?? null,
        correlationId: input.correlation_id ?? null,
        eventId: input.event_id ?? null,
        agentId: input.agent_id ?? null,
        communityId: input.community_id ?? null,
        postId: input.post_id ?? null,
        roomId: input.room_id ?? null,
        sessionId: input.session_id ?? null,
        messageId: input.message_id ?? null,
        linkedAgentRunId: input.linked_agent_run_id ?? null,
        linkedLlmTraceId: input.linked_llm_trace_id ?? null,
        linkedRiskEventId: input.linked_risk_event_id ?? null,
        durationMs: input.duration_ms ?? null,
        errorCode: input.error_code ?? null,
        errorMessageRedacted: input.error_message_redacted ?? null,
        retryCount: input.retry_count ?? null,
        ...(input.payload_json !== undefined && input.payload_json !== null
          ? { payloadJson: input.payload_json as Prisma.InputJsonValue }
          : {}),
        ...(input.created_at ? { createdAt: input.created_at } : {}),
      },
    })
    return this.toDomain(row)
  }

  async findById(id: string): Promise<RuntimeOperationRecord | null> {
    const row = await this.prisma.runtimeOperationRecord.findUnique({ where: { id } })
    return row ? this.toDomain(row) : null
  }

  async list(filters: ListRuntimeOperationRecordsFilters = {}): Promise<RuntimeOperationRecord[]> {
    const where: Prisma.RuntimeOperationRecordWhereInput = {
      ...(filters.severity && filters.severity.length > 0
        ? { severity: { in: [...filters.severity] } }
        : {}),
      ...(filters.source && filters.source.length > 0
        ? { source: { in: [...filters.source] } }
        : {}),
      ...(filters.status && filters.status.length > 0
        ? { status: { in: [...filters.status] } }
        : {}),
      ...(filters.agent_id ? { agentId: filters.agent_id } : {}),
      ...(filters.trace_id ? { traceId: filters.trace_id } : {}),
      ...(filters.correlation_id ? { correlationId: filters.correlation_id } : {}),
      ...(filters.event_id ? { eventId: filters.event_id } : {}),
      ...(filters.linked_risk_event_id ? { linkedRiskEventId: filters.linked_risk_event_id } : {}),
      ...(filters.entity ? { [entityPrismaField(filters.entity.type)]: filters.entity.id } : {}),
      ...(filters.since || filters.until
        ? {
            occurredAt: {
              ...(filters.since ? { gte: filters.since } : {}),
              ...(filters.until ? { lte: filters.until } : {}),
            },
          }
        : {}),
      ...(filters.before
        ? {
            OR: [
              { occurredAt: { lt: filters.before.occurred_at } },
              {
                occurredAt: filters.before.occurred_at,
                id: { lt: filters.before.id },
              },
            ],
          }
        : {}),
    }
    const rows = await this.prisma.runtimeOperationRecord.findMany({
      where,
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      ...(filters.limit ? { take: filters.limit } : {}),
    })
    return rows.map((row) => this.toDomain(row))
  }

  async deleteExpired(cutoffs: RuntimeOperationRetentionCutoffs): Promise<number> {
    const result = await this.prisma.runtimeOperationRecord.deleteMany({
      where: {
        linkedRiskEventId: null,
        OR: [
          { severity: { in: ['critical', 'error'] }, occurredAt: { lt: cutoffs.errorCriticalBefore } },
          { severity: 'warn', occurredAt: { lt: cutoffs.warnBefore } },
          { severity: 'info', occurredAt: { lt: cutoffs.infoBefore } },
        ],
      },
    })
    return result.count
  }

  private toDomain(row: PrismaRuntimeOperationRecord): RuntimeOperationRecord {
    return {
      id: row.id,
      occurred_at: row.occurredAt,
      severity: row.severity as RuntimeOperationRecord['severity'],
      source: row.source as RuntimeOperationRecord['source'],
      operation: row.operation,
      status: row.status as RuntimeOperationRecord['status'],
      trace_id: row.traceId,
      correlation_id: row.correlationId,
      event_id: row.eventId,
      agent_id: row.agentId,
      community_id: row.communityId,
      post_id: row.postId,
      room_id: row.roomId,
      session_id: row.sessionId,
      message_id: row.messageId,
      linked_agent_run_id: row.linkedAgentRunId,
      linked_llm_trace_id: row.linkedLlmTraceId,
      linked_risk_event_id: row.linkedRiskEventId,
      duration_ms: row.durationMs,
      error_code: row.errorCode,
      error_message_redacted: row.errorMessageRedacted,
      retry_count: row.retryCount,
      payload_json: row.payloadJson as Record<string, unknown> | null,
      created_at: row.createdAt,
    }
  }
}

function entityPrismaField(
  type: RuntimeOperationEntityType,
): 'agentId' | 'communityId' | 'postId' | 'roomId' | 'sessionId' | 'messageId' {
  switch (type) {
    case 'agent':
      return 'agentId'
    case 'community':
      return 'communityId'
    case 'post':
      return 'postId'
    case 'room':
      return 'roomId'
    case 'session':
      return 'sessionId'
    case 'message':
      return 'messageId'
  }
}
