import { describe, it, expect } from 'vitest'
import { AdmissionResultSchema } from '../admission-result.js'

describe('AdmissionResultSchema', () => {
  it('accepts granted=true with decision=admit', () => {
    const value = {
      granted: true,
      decision: 'admit' as const,
      reason_codes: ['LOAD_GREEN', 'BUDGET_OK'],
    }
    expect(AdmissionResultSchema.parse(value)).toEqual(value)
  })

  it('accepts granted=false with decision=defer (and recommended_next_trigger_at)', () => {
    const value = {
      granted: false,
      decision: 'defer' as const,
      reason_codes: ['COMMUNITY_OVERLOAD'],
      recommended_next_trigger_at: '2026-04-25T20:42:00+08:00',
    }
    expect(AdmissionResultSchema.parse(value)).toEqual(value)
  })

  it('accepts granted=false with decision in {skip, merge, require_review}', () => {
    for (const decision of ['skip', 'merge', 'require_review'] as const) {
      const value = {
        granted: false,
        decision,
        reason_codes: ['REASON'],
      }
      expect(() => AdmissionResultSchema.parse(value)).not.toThrow()
    }
  })

  it('accepts optional load_snapshot_id and degraded_media', () => {
    const value = {
      granted: true,
      decision: 'admit' as const,
      reason_codes: ['OK'],
      load_snapshot_id: 'snap_123',
      degraded_media: false,
    }
    expect(() => AdmissionResultSchema.parse(value)).not.toThrow()
  })

  it('rejects granted=true with decision != admit', () => {
    expect(() =>
      AdmissionResultSchema.parse({
        granted: true,
        decision: 'defer',
        reason_codes: [],
      }),
    ).toThrow(/granted=true requires decision=admit/)
  })

  it('rejects granted=false with decision=admit', () => {
    expect(() =>
      AdmissionResultSchema.parse({
        granted: false,
        decision: 'admit',
        reason_codes: ['x'],
      }),
    ).toThrow(/granted=false requires a non-admit decision/)
  })

  it('rejects unknown decision enum', () => {
    expect(() =>
      AdmissionResultSchema.parse({
        granted: false,
        decision: 'unknown',
        reason_codes: [],
      }),
    ).toThrow()
  })

  it('rejects unknown extra keys (strict)', () => {
    expect(() =>
      AdmissionResultSchema.parse({
        granted: true,
        decision: 'admit',
        reason_codes: [],
        extra: 'nope',
      }),
    ).toThrow()
  })

  it('rejects empty string in reason_codes', () => {
    expect(() =>
      AdmissionResultSchema.parse({
        granted: true,
        decision: 'admit',
        reason_codes: [''],
      }),
    ).toThrow()
  })

  it('rejects malformed recommended_next_trigger_at', () => {
    expect(() =>
      AdmissionResultSchema.parse({
        granted: false,
        decision: 'defer',
        reason_codes: ['x'],
        recommended_next_trigger_at: 'not-a-date',
      }),
    ).toThrow()
  })
})
