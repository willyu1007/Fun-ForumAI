import { z } from 'zod'

/**
 * Single source of truth for namespace allocation.
 * Adding a new namespace requires re-opening T-208 (frozen field).
 *
 * Existing-code parity:
 * - 'manual-cue': matches src/backend/services/chatroom-control-service.ts
 * - 'role-expired': matches src/backend/services/role-assignment-service.ts
 *
 * New cue-path namespaces are reserved for T-209+ consumers.
 */
export const IDEMPOTENCY_KEY_NAMESPACES = [
  'cue',
  'cue-change',
  'cue-execution-completed',
  'cue-execution-failed',
  'cue-execution-cancelled',
  'room-program-event',
  'manual-cue',
  'role-expired',
] as const

export type IdempotencyKeyNamespace = (typeof IDEMPOTENCY_KEY_NAMESPACES)[number]

export type IdempotencyKey = string & {
  readonly __idempotencyKeyBrand: unique symbol
}

const SEGMENT_PATTERN = /^[A-Za-z0-9._-]+$/

const NAMESPACE_SET: ReadonlySet<string> = new Set(IDEMPOTENCY_KEY_NAMESPACES)

export function buildIdempotencyKey(
  namespace: IdempotencyKeyNamespace,
  ...segments: ReadonlyArray<string | number>
): IdempotencyKey {
  if (segments.length === 0) {
    throw new Error('buildIdempotencyKey: at least one segment is required')
  }
  const stringified = segments.map((s) => String(s))
  for (const seg of stringified) {
    if (seg.length === 0 || !SEGMENT_PATTERN.test(seg)) {
      throw new Error(
        `buildIdempotencyKey: invalid segment "${seg}" (allowed characters: A-Z a-z 0-9 . _ -)`,
      )
    }
  }
  return `${namespace}:${stringified.join(':')}` as IdempotencyKey
}

export function parseIdempotencyKey(
  raw: string,
): { namespace: IdempotencyKeyNamespace; segments: string[] } | null {
  if (typeof raw !== 'string' || raw.length === 0) return null
  const parts = raw.split(':')
  if (parts.length < 2) return null
  const [ns, ...rest] = parts
  if (ns === undefined || !NAMESPACE_SET.has(ns)) return null
  for (const seg of rest) {
    if (seg.length === 0 || !SEGMENT_PATTERN.test(seg)) return null
  }
  return { namespace: ns as IdempotencyKeyNamespace, segments: rest }
}

export function isIdempotencyKey(raw: string): raw is IdempotencyKey {
  return parseIdempotencyKey(raw) !== null
}

export const IdempotencyKeyStringSchema = z
  .string()
  .min(1)
  .refine((s) => isIdempotencyKey(s), {
    message:
      'must match <registered-namespace>:<segment>(:<segment>)* with segments matching [A-Za-z0-9._-]+',
  })
