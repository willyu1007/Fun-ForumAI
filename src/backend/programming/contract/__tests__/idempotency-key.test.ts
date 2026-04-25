import { describe, it, expect } from 'vitest'
import {
  IDEMPOTENCY_KEY_NAMESPACES,
  buildIdempotencyKey,
  parseIdempotencyKey,
  isIdempotencyKey,
  IdempotencyKeyStringSchema,
} from '../idempotency-key.js'

describe('buildIdempotencyKey', () => {
  it('builds a cue-path key from string and number segments', () => {
    const key = buildIdempotencyKey('cue', 'sched_1', 'cue_42', 1)
    expect(key).toBe('cue:sched_1:cue_42:1')
  })

  it('coerces numbers to strings', () => {
    const key = buildIdempotencyKey('cue-execution-completed', 12345)
    expect(key).toBe('cue-execution-completed:12345')
  })

  it('throws when no segments provided', () => {
    expect(() => buildIdempotencyKey('cue')).toThrow(/at least one segment/)
  })

  it('throws on segment with disallowed characters (colon)', () => {
    expect(() => buildIdempotencyKey('cue', 'a:b')).toThrow(/invalid segment/)
  })

  it('throws on empty-string segment', () => {
    expect(() => buildIdempotencyKey('cue', '')).toThrow(/invalid segment/)
  })

  it('throws on segment with whitespace', () => {
    expect(() => buildIdempotencyKey('cue', 'has space')).toThrow(/invalid segment/)
  })
})

describe('parseIdempotencyKey', () => {
  it('round-trips a built key', () => {
    const key = buildIdempotencyKey('cue', 'sched_1', 'cue_42', 7)
    const parsed = parseIdempotencyKey(key)
    expect(parsed).toEqual({
      namespace: 'cue',
      segments: ['sched_1', 'cue_42', '7'],
    })
  })

  it('parses parity namespace manual-cue', () => {
    // matches the pattern in src/backend/services/chatroom-control-service.ts
    const raw = `manual-cue:room_abc:${Date.now()}:start_episode`
    const parsed = parseIdempotencyKey(raw)
    expect(parsed?.namespace).toBe('manual-cue')
    expect(parsed?.segments).toHaveLength(3)
  })

  it('returns null for unregistered namespace', () => {
    expect(parseIdempotencyKey('made-up:abc:1')).toBeNull()
  })

  it('returns null for missing segments', () => {
    expect(parseIdempotencyKey('cue')).toBeNull()
    expect(parseIdempotencyKey('cue:')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(parseIdempotencyKey('')).toBeNull()
  })

  it('returns null for malformed segment', () => {
    expect(parseIdempotencyKey('cue:has space:1')).toBeNull()
  })
})

describe('isIdempotencyKey', () => {
  it('matches a built key', () => {
    const key = buildIdempotencyKey('cue', 'a', 'b', 1)
    expect(isIdempotencyKey(key)).toBe(true)
  })

  it('rejects unregistered namespace', () => {
    expect(isIdempotencyKey('made-up:x:1')).toBe(false)
  })
})

describe('IdempotencyKeyStringSchema', () => {
  it('accepts a built key', () => {
    const key = buildIdempotencyKey('cue-change', 'cue_1', 'create_cue', 1)
    expect(() => IdempotencyKeyStringSchema.parse(key)).not.toThrow()
  })

  it('rejects unregistered namespace', () => {
    expect(() => IdempotencyKeyStringSchema.parse('foo:bar:1')).toThrow()
  })

  it('rejects empty string', () => {
    expect(() => IdempotencyKeyStringSchema.parse('')).toThrow()
  })
})

describe('IDEMPOTENCY_KEY_NAMESPACES registry', () => {
  it('includes all cue-path namespaces required by T-209+', () => {
    const required = [
      'cue',
      'cue-change',
      'cue-execution-completed',
      'cue-execution-failed',
      'cue-execution-cancelled',
    ]
    for (const ns of required) {
      expect(IDEMPOTENCY_KEY_NAMESPACES).toContain(ns)
    }
  })

  it('includes parity namespaces with existing call sites', () => {
    expect(IDEMPOTENCY_KEY_NAMESPACES).toContain('room-program-event')
    expect(IDEMPOTENCY_KEY_NAMESPACES).toContain('manual-cue')
    expect(IDEMPOTENCY_KEY_NAMESPACES).toContain('role-expired')
  })
})
