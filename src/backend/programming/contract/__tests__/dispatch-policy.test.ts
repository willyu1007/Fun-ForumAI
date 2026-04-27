import { describe, it, expect } from 'vitest'
import {
  DispatchPolicySchema,
  type DispatchPolicy,
} from '../dispatch-policy.js'

function validPolicy(overrides: Partial<DispatchPolicy> = {}): DispatchPolicy {
  return {
    trigger_at: '2026-04-25T20:30:00+08:00',
    timezone: 'Asia/Shanghai',
    dispatch_mode: 'graceful',
    grace_seconds: 60,
    priority: 60,
    lane: 'standard',
    misfire_policy: 'delay',
    max_attempts: 3,
    retry_backoff_seconds: 30,
    ...overrides,
  }
}

describe('DispatchPolicySchema', () => {
  it('accepts a fully valid policy', () => {
    const value = validPolicy()
    const parsed = DispatchPolicySchema.parse(value)
    expect(parsed).toEqual(value)
  })

  it('accepts optional not_before_at and deadline_at when consistent with trigger_at', () => {
    const value = validPolicy({
      not_before_at: '2026-04-25T20:25:00+08:00',
      deadline_at: '2026-04-25T20:45:00+08:00',
    })
    expect(() => DispatchPolicySchema.parse(value)).not.toThrow()
  })

  it('rejects unknown extra keys (strict)', () => {
    const value = { ...validPolicy(), unknown_field: 'x' }
    expect(() => DispatchPolicySchema.parse(value)).toThrow()
  })

  it('rejects unknown enum value for dispatch_mode', () => {
    expect(() =>
      DispatchPolicySchema.parse({ ...validPolicy(), dispatch_mode: 'unknown' as never }),
    ).toThrow()
  })

  it('rejects priority > 100', () => {
    expect(() =>
      DispatchPolicySchema.parse(validPolicy({ priority: 101 })),
    ).toThrow()
  })

  it('rejects priority < 0', () => {
    expect(() =>
      DispatchPolicySchema.parse(validPolicy({ priority: -1 })),
    ).toThrow()
  })

  it('rejects max_attempts < 1', () => {
    expect(() =>
      DispatchPolicySchema.parse(validPolicy({ max_attempts: 0 })),
    ).toThrow()
  })

  it('rejects deadline_at <= trigger_at', () => {
    expect(() =>
      DispatchPolicySchema.parse(
        validPolicy({ deadline_at: '2026-04-25T20:30:00+08:00' }),
      ),
    ).toThrow(/deadline_at must be > trigger_at/)
  })

  it('rejects not_before_at > trigger_at', () => {
    expect(() =>
      DispatchPolicySchema.parse(
        validPolicy({ not_before_at: '2026-04-25T20:31:00+08:00' }),
      ),
    ).toThrow(/not_before_at must be <= trigger_at/)
  })

  it('accepts not_before_at == trigger_at as a boundary case', () => {
    const value = validPolicy({ not_before_at: '2026-04-25T20:30:00+08:00' })
    expect(() => DispatchPolicySchema.parse(value)).not.toThrow()
  })

  it('rejects malformed ISO datetime in trigger_at', () => {
    expect(() =>
      DispatchPolicySchema.parse(validPolicy({ trigger_at: 'not-a-date' })),
    ).toThrow()
  })

  it('rejects empty timezone', () => {
    expect(() =>
      DispatchPolicySchema.parse(validPolicy({ timezone: '' })),
    ).toThrow()
  })
})
