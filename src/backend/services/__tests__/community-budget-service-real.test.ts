/**
 * T-213 M3 — `RealInProcessCommunityBudgetService` unit tests.
 *
 * Validates:
 *   - feature flag default-off behaves like the trivial stub (always grants)
 *   - daily cap enforcement under both paths combined
 *   - sliding-window enforcement (60-min default)
 *   - release rolls back counters + frees a window slot
 *   - soft-hold sweep auto-releases expired reservations on next acquire
 *   - UTC-midnight rollover resets daily counters but preserves window
 *   - I-4: autonomous + cue compete for the same caps; per-path counts split
 *   - per-cap denial reasons (`budget_exhausted` vs `rate_limited`) + retry hints
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RealInProcessCommunityBudgetService } from '../community-budget-service-real.js'

const COMMUNITY = 'c-budget-test'

describe('RealInProcessCommunityBudgetService — feature flag default off', () => {
  it('always grants when enforced=false (mirrors trivial stub)', async () => {
    const svc = new RealInProcessCommunityBudgetService({ dailyCap: 1, windowCap: 1 })
    for (let i = 0; i < 5; i++) {
      const r = await svc.acquire(COMMUNITY, 'cue', 1)
      expect(r.granted).toBe(true)
    }
    const snap = await svc.query(COMMUNITY)
    expect(snap.daily_remaining).toBe(Number.POSITIVE_INFINITY)
    expect(snap.window_remaining).toBe(Number.POSITIVE_INFINITY)
    expect(snap.cue_used_today).toBe(5)
  })
})

describe('RealInProcessCommunityBudgetService — enforced caps', () => {
  const FIXED_NOW = new Date('2026-04-26T12:00:00Z')

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(FIXED_NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('enforces daily cap across both paths', async () => {
    const svc = new RealInProcessCommunityBudgetService({
      enforced: true,
      dailyCap: 3,
      windowCap: 100,
      now: () => new Date(),
    })
    expect((await svc.acquire(COMMUNITY, 'autonomous', 1)).granted).toBe(true)
    expect((await svc.acquire(COMMUNITY, 'cue', 1)).granted).toBe(true)
    expect((await svc.acquire(COMMUNITY, 'autonomous', 1)).granted).toBe(true)
    const denied = await svc.acquire(COMMUNITY, 'cue', 1)
    expect(denied.granted).toBe(false)
    if (!denied.granted) {
      expect(denied.reason).toBe('budget_exhausted')
      expect(denied.retry_after_ms).toBeGreaterThan(0)
    }
    const snap = await svc.query(COMMUNITY)
    expect(snap.autonomous_used_today).toBe(2)
    expect(snap.cue_used_today).toBe(1)
    expect(snap.daily_remaining).toBe(0)
  })

  it('enforces sliding window across both paths', async () => {
    const svc = new RealInProcessCommunityBudgetService({
      enforced: true,
      dailyCap: 100,
      windowCap: 2,
      windowMs: 60 * 60 * 1000,
      now: () => new Date(),
    })
    expect((await svc.acquire(COMMUNITY, 'autonomous', 1)).granted).toBe(true)
    expect((await svc.acquire(COMMUNITY, 'cue', 1)).granted).toBe(true)
    const denied = await svc.acquire(COMMUNITY, 'cue', 1)
    expect(denied.granted).toBe(false)
    if (!denied.granted) {
      expect(denied.reason).toBe('rate_limited')
      // windowMs has not elapsed; retry_after_ms positive
      expect(denied.retry_after_ms).toBeGreaterThan(0)
      expect(denied.retry_after_ms).toBeLessThanOrEqual(60 * 60 * 1000)
    }
  })

  it('shifts window entries out after windowMs elapses', async () => {
    const svc = new RealInProcessCommunityBudgetService({
      enforced: true,
      dailyCap: 100,
      windowCap: 1,
      windowMs: 30_000,
      now: () => new Date(),
    })
    expect((await svc.acquire(COMMUNITY, 'cue', 1)).granted).toBe(true)
    expect((await svc.acquire(COMMUNITY, 'cue', 1)).granted).toBe(false)

    vi.setSystemTime(new Date(FIXED_NOW.getTime() + 31_000))
    expect((await svc.acquire(COMMUNITY, 'cue', 1)).granted).toBe(true)
  })

  it('release rolls back daily + window counters', async () => {
    const svc = new RealInProcessCommunityBudgetService({
      enforced: true,
      dailyCap: 1,
      windowCap: 1,
      now: () => new Date(),
    })
    const granted = await svc.acquire(COMMUNITY, 'autonomous', 1)
    expect(granted.granted).toBe(true)
    if (!granted.granted) return
    expect((await svc.acquire(COMMUNITY, 'cue', 1)).granted).toBe(false)
    await svc.release(granted.reservation.reservationId)
    // Both counters back to zero — next acquire should succeed.
    const next = await svc.acquire(COMMUNITY, 'cue', 1)
    expect(next.granted).toBe(true)
    const snap = await svc.query(COMMUNITY)
    expect(snap.autonomous_used_today).toBe(0)
    expect(snap.cue_used_today).toBe(1)
  })

  it('release is idempotent', async () => {
    const svc = new RealInProcessCommunityBudgetService({
      enforced: true,
      dailyCap: 1,
      windowCap: 5,
      now: () => new Date(),
    })
    const granted = await svc.acquire(COMMUNITY, 'autonomous', 1)
    if (!granted.granted) throw new Error('expected grant')
    await svc.release(granted.reservation.reservationId)
    await svc.release(granted.reservation.reservationId)
    const snap = await svc.query(COMMUNITY)
    expect(snap.autonomous_used_today).toBe(0)
  })

  it('lazily sweeps expired soft holds on next acquire', async () => {
    const svc = new RealInProcessCommunityBudgetService({
      enforced: true,
      dailyCap: 1,
      windowCap: 5,
      softHoldMs: 60_000,
      now: () => new Date(),
    })
    const granted = await svc.acquire(COMMUNITY, 'cue', 1)
    expect(granted.granted).toBe(true)
    expect((await svc.acquire(COMMUNITY, 'cue', 1)).granted).toBe(false)

    // Advance past softHoldMs without anyone calling release.
    vi.setSystemTime(new Date(FIXED_NOW.getTime() + 61_000))
    const next = await svc.acquire(COMMUNITY, 'cue', 1)
    expect(next.granted).toBe(true)
  })

  it('UTC midnight rollover resets daily counters', async () => {
    const svc = new RealInProcessCommunityBudgetService({
      enforced: true,
      dailyCap: 1,
      windowCap: 100,
      now: () => new Date(),
    })
    expect((await svc.acquire(COMMUNITY, 'cue', 1)).granted).toBe(true)
    expect((await svc.acquire(COMMUNITY, 'cue', 1)).granted).toBe(false)

    // Advance to next UTC day.
    vi.setSystemTime(new Date('2026-04-27T00:00:01Z'))
    const next = await svc.acquire(COMMUNITY, 'cue', 1)
    expect(next.granted).toBe(true)
  })

  it('I-4 — autonomous + cue compete for the last quota unit', async () => {
    const svc = new RealInProcessCommunityBudgetService({
      enforced: true,
      dailyCap: 1,
      windowCap: 5,
      now: () => new Date(),
    })
    const cue = await svc.acquire(COMMUNITY, 'cue', 1)
    expect(cue.granted).toBe(true)
    const autonomous = await svc.acquire(COMMUNITY, 'autonomous', 1)
    expect(autonomous.granted).toBe(false)
    if (!autonomous.granted) {
      expect(autonomous.reason).toBe('budget_exhausted')
    }
  })

  it('snapshot exposes per-path counts separately (I-8 metric track separation)', async () => {
    const svc = new RealInProcessCommunityBudgetService({
      enforced: true,
      dailyCap: 100,
      windowCap: 100,
      now: () => new Date(),
    })
    await svc.acquire(COMMUNITY, 'autonomous', 1)
    await svc.acquire(COMMUNITY, 'cue', 1)
    await svc.acquire(COMMUNITY, 'cue', 1)
    const snap = await svc.query(COMMUNITY)
    expect(snap.autonomous_used_today).toBe(1)
    expect(snap.cue_used_today).toBe(2)
  })
})
