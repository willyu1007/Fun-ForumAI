import type { Request } from 'express'
import {
  RUNTIME_OPERATION_SEVERITIES,
  RUNTIME_OPERATION_SOURCES,
  RUNTIME_OPERATION_STATUSES,
  type RuntimeOperationEntityType,
  type RuntimeOperationSeverity,
  type RuntimeOperationSource,
  type RuntimeOperationStatus,
} from '../../repos/types.js'
import type { ListRuntimeOperationRecordsFilters } from '../../repos/runtime-operation-record-repository.js'

export const RUNTIME_OPERATION_RECORDS_LIST_LIMIT_CAP = 100
export const RUNTIME_OPERATION_RECORDS_DEFAULT_LIMIT = 50

export const RUNTIME_OPERATION_ENTITY_TYPES: ReadonlyArray<RuntimeOperationEntityType> = [
  'agent',
  'community',
  'post',
  'room',
  'session',
  'message',
]

export interface ParsedRuntimeOperationFilters {
  filters: ListRuntimeOperationRecordsFilters
  validationErrors: Array<{ path: string; message: string }>
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function parseDate(value: unknown): Date | null {
  const raw = asString(value)
  if (!raw) return null
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function parseCsvList(value: unknown): string[] {
  if (typeof value !== 'string' || value.length === 0) return []
  return value.split(',').map((entry) => entry.trim()).filter((entry) => entry.length > 0)
}

function intersectAllowed<T extends string>(
  raw: string[],
  allowed: ReadonlyArray<T>,
): { values: T[]; invalid: string[] } {
  const allowedSet = new Set<string>(allowed)
  const invalid: string[] = []
  const values: T[] = []
  for (const entry of raw) {
    if (allowedSet.has(entry)) {
      values.push(entry as T)
    } else {
      invalid.push(entry)
    }
  }
  return { values, invalid }
}

export function parseRuntimeOperationFilters(
  query: Request['query'] | Record<string, unknown>,
): ParsedRuntimeOperationFilters {
  const errors: Array<{ path: string; message: string }> = []

  const severityRaw = parseCsvList(query.severity)
  const severity = intersectAllowed<RuntimeOperationSeverity>(severityRaw, RUNTIME_OPERATION_SEVERITIES)
  if (severity.invalid.length > 0) {
    errors.push({ path: 'severity', message: `unknown severity values: ${severity.invalid.join(',')}` })
  }

  const sourceRaw = parseCsvList(query.source)
  const source = intersectAllowed<RuntimeOperationSource>(sourceRaw, RUNTIME_OPERATION_SOURCES)
  if (source.invalid.length > 0) {
    errors.push({ path: 'source', message: `unknown source values: ${source.invalid.join(',')}` })
  }

  const statusRaw = parseCsvList(query.status)
  const status = intersectAllowed<RuntimeOperationStatus>(statusRaw, RUNTIME_OPERATION_STATUSES)
  if (status.invalid.length > 0) {
    errors.push({ path: 'status', message: `unknown status values: ${status.invalid.join(',')}` })
  }

  const since = query.since !== undefined ? parseDate(query.since) : null
  if (query.since !== undefined && since === null) {
    errors.push({ path: 'since', message: 'invalid ISO timestamp' })
  }
  const until = query.until !== undefined ? parseDate(query.until) : null
  if (query.until !== undefined && until === null) {
    errors.push({ path: 'until', message: 'invalid ISO timestamp' })
  }

  let limit = RUNTIME_OPERATION_RECORDS_DEFAULT_LIMIT
  const limitRaw = asString(query.limit)
  if (limitRaw !== undefined) {
    const parsed = Number.parseInt(limitRaw, 10)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      errors.push({ path: 'limit', message: 'limit must be a positive integer' })
    } else {
      limit = Math.min(parsed, RUNTIME_OPERATION_RECORDS_LIST_LIMIT_CAP)
    }
  }

  let entity: ListRuntimeOperationRecordsFilters['entity']
  const entityType = asString(query.entity_type)
  const entityId = asString(query.entity_id)
  if (entityType !== undefined || entityId !== undefined) {
    if (!entityType || !entityId) {
      errors.push({
        path: 'entity_type',
        message: 'entity_type and entity_id must both be provided',
      })
    } else if (!RUNTIME_OPERATION_ENTITY_TYPES.includes(entityType as RuntimeOperationEntityType)) {
      errors.push({ path: 'entity_type', message: `unknown entity_type ${entityType}` })
    } else {
      entity = { type: entityType as RuntimeOperationEntityType, id: entityId }
    }
  }

  let before: ListRuntimeOperationRecordsFilters['before']
  const cursor = asString(query.cursor)
  if (cursor !== undefined) {
    const decoded = decodeRuntimeOperationCursor(cursor)
    if (!decoded) {
      errors.push({ path: 'cursor', message: 'invalid cursor format' })
    } else {
      before = decoded
    }
  }

  const filters: ListRuntimeOperationRecordsFilters = {
    ...(severity.values.length > 0 ? { severity: severity.values } : {}),
    ...(source.values.length > 0 ? { source: source.values } : {}),
    ...(status.values.length > 0 ? { status: status.values } : {}),
    ...(asString(query.agent_id) !== undefined ? { agent_id: asString(query.agent_id) } : {}),
    ...(asString(query.trace_id) !== undefined ? { trace_id: asString(query.trace_id) } : {}),
    ...(asString(query.correlation_id) !== undefined
      ? { correlation_id: asString(query.correlation_id) }
      : {}),
    ...(asString(query.event_id) !== undefined ? { event_id: asString(query.event_id) } : {}),
    ...(asString(query.linked_risk_event_id) !== undefined
      ? { linked_risk_event_id: asString(query.linked_risk_event_id) }
      : {}),
    ...(entity ? { entity } : {}),
    ...(since ? { since } : {}),
    ...(until ? { until } : {}),
    ...(before ? { before } : {}),
    limit,
  }

  return { filters, validationErrors: errors }
}

export function encodeRuntimeOperationCursor(input: { occurred_at: Date; id: string }): string {
  return Buffer.from(JSON.stringify({ at: input.occurred_at.toISOString(), id: input.id })).toString(
    'base64url',
  )
}

export function decodeRuntimeOperationCursor(value: string): { occurred_at: Date; id: string } | null {
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as {
      at?: string
      id?: string
    }
    if (typeof parsed.at !== 'string' || typeof parsed.id !== 'string') return null
    const at = new Date(parsed.at)
    if (Number.isNaN(at.getTime())) return null
    return { occurred_at: at, id: parsed.id }
  } catch {
    return null
  }
}
