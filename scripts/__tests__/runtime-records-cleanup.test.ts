import { describe, expect, it } from 'vitest'
// @ts-expect-error mjs script without published types
import { computeRetentionCutoffs } from '../runtime-records-cleanup.mjs'

const DAY_MS = 86_400_000

describe('runtime-records-cleanup CLI helpers', () => {
  it('computes 90/30/7-day cutoffs from `now`', () => {
    const now = new Date('2026-04-30T00:00:00Z')
    const cutoffs = computeRetentionCutoffs(now) as {
      errorCriticalBefore: Date
      warnBefore: Date
      infoBefore: Date
    }
    expect(now.getTime() - cutoffs.errorCriticalBefore.getTime()).toBe(90 * DAY_MS)
    expect(now.getTime() - cutoffs.warnBefore.getTime()).toBe(30 * DAY_MS)
    expect(now.getTime() - cutoffs.infoBefore.getTime()).toBe(7 * DAY_MS)
  })

  it('produces stable ISO timestamps for any input now', () => {
    const cutoffs = computeRetentionCutoffs(new Date('2030-01-15T10:11:12.345Z')) as {
      errorCriticalBefore: Date
      warnBefore: Date
      infoBefore: Date
    }
    expect(cutoffs.errorCriticalBefore.toISOString()).toBe('2029-10-17T10:11:12.345Z')
    expect(cutoffs.warnBefore.toISOString()).toBe('2029-12-16T10:11:12.345Z')
    expect(cutoffs.infoBefore.toISOString()).toBe('2030-01-08T10:11:12.345Z')
  })
})
