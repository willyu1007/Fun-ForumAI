import { describe, expect, it } from 'vitest'
// @ts-expect-error mjs script without published types
import { computeRetentionCutoffs } from '../runtime-records-cleanup.mjs'
import {
  computeRetentionCutoffs as serviceComputeRetentionCutoffs,
  RUNTIME_OPERATION_RETENTION_DAYS,
} from '../../src/backend/services/runtime-operation-record-service.js'

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

  // Drift guard: the CLI duplicates the retention day constants from the
  // backend service (mjs vs ts module systems can't share a runtime import).
  // This test imports both and asserts the cutoffs are byte-identical.
  it('CLI and service compute identical cutoffs for the same `now`', () => {
    const samples = [
      new Date('2026-04-27T00:00:00.000Z'),
      new Date('2030-01-15T10:11:12.345Z'),
      new Date(Date.now()),
    ]
    for (const now of samples) {
      const cli = computeRetentionCutoffs(now)
      const service = serviceComputeRetentionCutoffs(now)
      expect(cli.errorCriticalBefore.toISOString()).toBe(service.errorCriticalBefore.toISOString())
      expect(cli.warnBefore.toISOString()).toBe(service.warnBefore.toISOString())
      expect(cli.infoBefore.toISOString()).toBe(service.infoBefore.toISOString())
    }
    // Sanity: the canonical day counts the service publishes match the CLI's hard-coded values.
    expect(RUNTIME_OPERATION_RETENTION_DAYS).toEqual({ errorCritical: 90, warn: 30, info: 7 })
  })
})
