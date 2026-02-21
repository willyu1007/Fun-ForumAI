import { describe, it, expect, beforeEach } from 'vitest'
import { DefaultQuotaCalculator } from '../quota-calculator.js'
import { DEFAULT_ALLOCATOR_CONFIG, type AllocatorConfig } from '../config.js'
import type { DegradationState, QuotaContext } from '../types.js'

const NORMAL: DegradationState = { level: 'normal', queue_lag_seconds: 0, factor: 1.0 }
const MODERATE: DegradationState = { level: 'moderate', queue_lag_seconds: 150, factor: 0.5 }
const CRITICAL: DegradationState = { level: 'critical', queue_lag_seconds: 400, factor: 0.1 }

function ctx(overrides: Partial<QuotaContext> = {}): QuotaContext {
  return {
    event_type: 'NewPostCreated',
    community_id: 'comm-1',
    ...overrides,
  }
}

describe('DefaultQuotaCalculator', () => {
  let calc: DefaultQuotaCalculator

  beforeEach(() => {
    calc = new DefaultQuotaCalculator(DEFAULT_ALLOCATOR_CONFIG)
  })

  it('returns event_base (5) when it is the minimum', () => {
    expect(calc.calculate(ctx(), NORMAL)).toBe(5)
  })

  it('returns 0 for VoteCast (event_base = 0)', () => {
    expect(calc.calculate(ctx({ event_type: 'VoteCast' }), NORMAL)).toBe(0)
  })

  it('takes community override when it is smallest', () => {
    calc.setCommunityOverride('comm-1', 2)
    expect(calc.calculate(ctx(), NORMAL)).toBe(2)
  })

  it('takes remaining thread quota when it is smallest', () => {
    calc.recordThreadAllocation('post-1', 18)
    expect(calc.calculate(ctx({ post_id: 'post-1' }), NORMAL)).toBe(2)
  })

  it('thread quota floors at 0 when fully used', () => {
    calc.recordThreadAllocation('post-1', 25)
    expect(calc.calculate(ctx({ post_id: 'post-1' }), NORMAL)).toBe(0)
  })

  it('applies moderate degradation factor (×0.5)', () => {
    // base=5, ×0.5 = 2 (floor)
    expect(calc.calculate(ctx(), MODERATE)).toBe(2)
  })

  it('applies critical degradation factor (×0.1)', () => {
    // base=5, ×0.1 = 0 (floor)
    expect(calc.calculate(ctx(), CRITICAL)).toBe(0)
  })

  it('quota = min(global, community, thread, event_base) formula', () => {
    const tightCfg: AllocatorConfig = {
      ...DEFAULT_ALLOCATOR_CONFIG,
      globalMaxAgentsPerEvent: 3,
      defaultCommunityMaxAgents: 4,
      defaultThreadMaxAgents: 6,
      eventBaseQuota: { ...DEFAULT_ALLOCATOR_CONFIG.eventBaseQuota, NewPostCreated: 7 },
    }
    const tightCalc = new DefaultQuotaCalculator(tightCfg)
    expect(tightCalc.calculate(ctx(), NORMAL)).toBe(3)
  })

  it('resetThreadCounters clears usage', () => {
    calc.recordThreadAllocation('post-1', 20)
    expect(calc.calculate(ctx({ post_id: 'post-1' }), NORMAL)).toBe(0)
    calc.resetThreadCounters()
    expect(calc.calculate(ctx({ post_id: 'post-1' }), NORMAL)).toBe(5)
  })
})
