import type {
  ListRuntimeOperationRecordsFilters,
  RuntimeOperationRecordRepository,
} from '../repos/runtime-operation-record-repository.js'
import type {
  CreateRuntimeOperationRecordInput,
  RuntimeOperationRecord,
  RuntimeOperationRetentionCutoffs,
  RuntimeOperationSeverity,
} from '../repos/types.js'
import {
  isSensitiveKey,
  redactSensitiveText,
} from '../lib/sensitive-redaction.js'

export { isSensitiveKey } from '../lib/sensitive-redaction.js'

/**
 * Retention windows aligned with task package T-301 (locked in 07-contract-review.md):
 * - critical/error: 90 days
 * - warn:           30 days
 * - sampled info/succeeded lifecycle markers: 7 days
 */
export const RUNTIME_OPERATION_RETENTION_DAYS = {
  errorCritical: 90,
  warn: 30,
  info: 7,
} as const

export interface RuntimeOperationRecordServiceDeps {
  repo: RuntimeOperationRecordRepository
  /**
   * Returns true if persistence is enabled. Wired from
   * `config.launch.capabilities.runtimeOperationRecordsWrite`.
   * The flag is checked at every call so live config updates take effect.
   */
  isWriteEnabled: () => boolean
  /** Override `Date.now()` for tests. */
  now?: () => Date
}

const STRING_TRUNCATE_LIMIT = 1024
const PAYLOAD_TARGET_BYTES = 16 * 1024

/** Stable shape returned alongside a redacted payload for debugging. */
export interface RedactionMeta {
  truncated_strings: number
  redacted_keys: number
  payload_truncated: boolean
}

export interface RedactedPayloadResult {
  payload: Record<string, unknown> | null
  meta: RedactionMeta
}

export class RuntimeOperationRecordService {
  private readonly deps: RuntimeOperationRecordServiceDeps

  constructor(deps: RuntimeOperationRecordServiceDeps) {
    this.deps = deps
  }

  /**
   * Persist an operation record. MUST never throw into the business path.
   * Returns the persisted record or `null` if writes are disabled or persistence failed.
   */
  async record(
    input: CreateRuntimeOperationRecordInput,
  ): Promise<RuntimeOperationRecord | null> {
    if (!this.deps.isWriteEnabled()) {
      return null
    }
    try {
      const sanitized = this.sanitize(input)
      return await this.deps.repo.create(sanitized)
    } catch (err) {
      console.warn(
        `[RuntimeOperationRecordService] failed to persist record (${input.source}/${input.operation}): ${
          sanitizeErrorMessage(err instanceof Error ? err.message : String(err), 256) ?? '[redacted]'
        }`,
      )
      return null
    }
  }

  list(filters: ListRuntimeOperationRecordsFilters = {}): Promise<RuntimeOperationRecord[]> {
    return this.deps.repo.list(filters)
  }

  getDetail(id: string): Promise<RuntimeOperationRecord | null> {
    return this.deps.repo.findById(id)
  }

  /**
   * Apply retention policy. Returns the number of deleted rows.
   * Records linked to a `RiskEventLog` are excluded from ordinary cleanup.
   */
  async cleanupExpired(now: Date = this.now()): Promise<number> {
    const cutoffs = computeRetentionCutoffs(now)
    return this.deps.repo.deleteExpired(cutoffs)
  }

  buildRetentionCutoffs(now: Date = this.now()): RuntimeOperationRetentionCutoffs {
    return computeRetentionCutoffs(now)
  }

  private now(): Date {
    return this.deps.now ? this.deps.now() : new Date()
  }

  private sanitize(input: CreateRuntimeOperationRecordInput): CreateRuntimeOperationRecordInput {
    const errorMessageRedacted = input.error_message_redacted
      ? sanitizeErrorMessage(input.error_message_redacted)
      : input.error_message_redacted ?? null
    const errorCode = input.error_code ? truncateString(input.error_code, 256) : input.error_code ?? null
    const operation = truncateString(input.operation, 256)

    const sanitizedPayload = input.payload_json !== undefined && input.payload_json !== null
      ? sanitizePayload(input.payload_json)
      : { payload: null, meta: null }

    return {
      ...input,
      operation,
      error_code: errorCode,
      error_message_redacted: errorMessageRedacted,
      payload_json: sanitizedPayload.payload,
    }
  }
}

export function computeRetentionCutoffs(now: Date): RuntimeOperationRetentionCutoffs {
  const dayMs = 86_400_000
  return {
    errorCriticalBefore: new Date(now.getTime() - RUNTIME_OPERATION_RETENTION_DAYS.errorCritical * dayMs),
    warnBefore: new Date(now.getTime() - RUNTIME_OPERATION_RETENTION_DAYS.warn * dayMs),
    infoBefore: new Date(now.getTime() - RUNTIME_OPERATION_RETENTION_DAYS.info * dayMs),
  }
}

export function retentionWindowDaysFor(severity: RuntimeOperationSeverity): number {
  if (severity === 'error' || severity === 'critical') return RUNTIME_OPERATION_RETENTION_DAYS.errorCritical
  if (severity === 'warn') return RUNTIME_OPERATION_RETENTION_DAYS.warn
  return RUNTIME_OPERATION_RETENTION_DAYS.info
}

export function truncateString(value: string, limit: number = STRING_TRUNCATE_LIMIT): string {
  if (value.length <= limit) return value
  return `${value.slice(0, Math.max(0, limit - 1))}…`
}

export function sanitizeErrorMessage(
  value: string | null | undefined,
  limit: number = STRING_TRUNCATE_LIMIT,
): string | null {
  if (value === null || value === undefined) return null
  return truncateString(redactSensitiveText(value), limit)
}

/**
 * Redact secret-like keys, truncate long strings, and bound the overall payload size.
 * Returns the sanitized payload plus a small metadata block for operator debugging.
 */
export function sanitizePayload(payload: Record<string, unknown>): RedactedPayloadResult {
  const meta: RedactionMeta = {
    truncated_strings: 0,
    redacted_keys: 0,
    payload_truncated: false,
  }

  const sanitized = sanitizeValue(payload, meta, 0) as Record<string, unknown>
  const result: Record<string, unknown> = { ...sanitized, _redaction: meta }

  let serialized = safeStringify(result)
  if (serialized.length > PAYLOAD_TARGET_BYTES) {
    meta.payload_truncated = true
    const truncated = {
      _redaction: meta,
      _payload_truncated_preview: truncateString(safeStringify(sanitized), PAYLOAD_TARGET_BYTES - 256),
    }
    serialized = safeStringify(truncated)
    return { payload: JSON.parse(serialized) as Record<string, unknown>, meta }
  }
  return { payload: JSON.parse(serialized) as Record<string, unknown>, meta }
}

function sanitizeValue(value: unknown, meta: RedactionMeta, depth: number): unknown {
  if (depth > 6) return '[truncated:depth]'
  if (value === null || value === undefined) return value
  if (typeof value === 'string') {
    if (value.length > STRING_TRUNCATE_LIMIT) {
      meta.truncated_strings += 1
      return truncateString(value)
    }
    return value
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, meta, depth + 1))
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (isSensitiveKey(key)) {
        meta.redacted_keys += 1
        out[key] = '[redacted]'
        continue
      }
      out[key] = sanitizeValue(item, meta, depth + 1)
    }
    return out
  }
  return String(value)
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? ''
  } catch {
    return '"[unserializable]"'
  }
}
