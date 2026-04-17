import { describe, expect, it } from 'vitest'
import { XP_PER_GROWTH_POINT, XpService } from '../xp-service.js'

describe('XpService', () => {
  it('supports in-memory XP awards, dedup, and summaries without Prisma', async () => {
    const service = new XpService(null)

    const first = await service.awardXP('agent-1', 'bootstrap_grant', XP_PER_GROWTH_POINT * 2, {
      dedup_key: 'bootstrap',
    })
    const second = await service.awardXP('agent-1', 'bootstrap_grant', XP_PER_GROWTH_POINT * 2, {
      dedup_key: 'bootstrap',
    })
    const summary = await service.getXpSummary('agent-1')
    const events = await service.getXpEvents('agent-1')

    expect(first.xp).toBe(XP_PER_GROWTH_POINT * 2)
    expect(second.skipped).toBe(true)
    expect(summary.growth_points_total).toBe(2)
    expect(summary.level).toBe(3)
    expect(summary.xp_into_level).toBe(0)
    expect(summary.xp_to_next_level).toBe(XP_PER_GROWTH_POINT)
    expect(summary.level_progress).toBe(0)
    expect(events).toHaveLength(1)
    expect(
      await service.hasRecentXpDedupKey('agent-1', 'bootstrap', 60 * 1000),
    ).toBeTruthy()
  })
})
