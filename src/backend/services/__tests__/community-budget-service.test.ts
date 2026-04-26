/**
 * T-212 M1 — community-budget-service in-process trivial stub.
 *
 * Verifies the contract T-213 will swap into:
 *   - `acquire` always grants but tracks reservations
 *   - `release` is real (idempotent) so soft-hold leaks don't mask the
 *     real-service contract gap when T-213 lands
 *   - `query` reflects per-path counters and rolls over by UTC day
 */

import { describe, expect, it } from 'vitest'
import { InProcessTrivialCommunityBudgetService } from '../community-budget-service.js'

describe('InProcessTrivialCommunityBudgetService', () => {
  it('always grants and returns a unique reservation id', async () => {
    const service = new InProcessTrivialCommunityBudgetService()
    const a = await service.acquire('community-1', 'cue', 1)
    const b = await service.acquire('community-1', 'autonomous', 1)
    expect(a.granted).toBe(true)
    expect(b.granted).toBe(true)
    if (a.granted && b.granted) {
      expect(a.reservation.reservationId).not.toEqual(b.reservation.reservationId)
      expect(a.reservation.path).toBe('cue')
      expect(b.reservation.path).toBe('autonomous')
    }
  })

  it('tracks per-path counters in query', async () => {
    const service = new InProcessTrivialCommunityBudgetService()
    await service.acquire('community-1', 'cue', 1)
    await service.acquire('community-1', 'cue', 2)
    await service.acquire('community-1', 'autonomous', 1)
    const snapshot = await service.query('community-1')
    expect(snapshot.cue_used_today).toBe(3)
    expect(snapshot.autonomous_used_today).toBe(1)
  })

  it('release is idempotent — calling twice is a no-op', async () => {
    const service = new InProcessTrivialCommunityBudgetService()
    const result = await service.acquire('community-1', 'cue', 1)
    expect(result.granted).toBe(true)
    if (result.granted) {
      await service.release(result.reservation.reservationId)
      // second release must not throw
      await expect(service.release(result.reservation.reservationId)).resolves.toBeUndefined()
    }
  })

  it('release of an unknown reservation is a silent no-op', async () => {
    const service = new InProcessTrivialCommunityBudgetService()
    await expect(service.release('does-not-exist')).resolves.toBeUndefined()
  })

  it('counters roll over when UTC day advances', async () => {
    let now = new Date('2026-04-26T23:50:00.000Z')
    const service = new InProcessTrivialCommunityBudgetService({ now: () => now })
    await service.acquire('community-1', 'cue', 1)
    expect((await service.query('community-1')).cue_used_today).toBe(1)
    now = new Date('2026-04-27T00:10:00.000Z')
    expect((await service.query('community-1')).cue_used_today).toBe(0)
  })

  it('reservation expiresAt respects custom softHoldMs', async () => {
    const fixedNow = new Date('2026-04-26T12:00:00.000Z')
    const service = new InProcessTrivialCommunityBudgetService({
      now: () => fixedNow,
      softHoldMs: 60_000,
    })
    const result = await service.acquire('community-1', 'cue', 1)
    expect(result.granted).toBe(true)
    if (result.granted) {
      expect(result.reservation.expiresAt.getTime() - fixedNow.getTime()).toBe(60_000)
    }
  })

  it('treats independent communities as separate counter buckets', async () => {
    const service = new InProcessTrivialCommunityBudgetService()
    await service.acquire('community-1', 'cue', 1)
    await service.acquire('community-2', 'cue', 1)
    expect((await service.query('community-1')).cue_used_today).toBe(1)
    expect((await service.query('community-2')).cue_used_today).toBe(1)
  })
})
