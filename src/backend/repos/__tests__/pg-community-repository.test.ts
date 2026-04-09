import { afterEach, describe, expect, it, vi } from 'vitest'
import { PgCommunityRepository } from '../pg/pg-community-repository.js'

function makeCommunityRow(overrides: Partial<{
  slug: string
  name: string
  rulesJson: Record<string, unknown> | null
  updatedAt: Date
}> = {}) {
  return {
    id: 'community-1',
    slug: overrides.slug ?? 'creator-old',
    name: overrides.name ?? 'Creator Old',
    description: 'desc',
    rulesJson: overrides.rulesJson ?? { stage_spec: { min_tier_pool: 'T1' } },
    visibilityDefault: 'PUBLIC',
    createdAt: new Date('2026-04-10T00:00:00.000Z'),
    updatedAt: overrides.updatedAt ?? new Date('2026-04-10T00:00:00.000Z'),
  }
}

async function flushMicrotasks() {
  await Promise.resolve()
  await Promise.resolve()
}

describe('PgCommunityRepository', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('refreshes stale community cache and clears outdated slug indexes', async () => {
    vi.useFakeTimers()
    const findMany = vi
      .fn()
      .mockResolvedValueOnce([makeCommunityRow()])
      .mockResolvedValueOnce([
        makeCommunityRow({
          slug: 'creator-recommendation',
          name: 'Creator Recommendation',
          rulesJson: { stage_spec: { min_tier_pool: 'T2' } },
          updatedAt: new Date('2026-04-10T00:05:00.000Z'),
        }),
      ])
    const repo = new PgCommunityRepository({
      community: { findMany },
    } as never, {
      cacheTtlMs: 1_000,
    })

    await repo.hydrate()
    expect(repo.findBySlug('creator-old')?.id).toBe('community-1')

    vi.advanceTimersByTime(1_001)
    expect(repo.findById('community-1')?.slug).toBe('creator-old')

    await flushMicrotasks()

    expect(findMany).toHaveBeenCalledTimes(2)
    expect(repo.findBySlug('creator-old')).toBeNull()
    expect(repo.findBySlug('creator-recommendation')?.rules_json).toEqual({
      stage_spec: { min_tier_pool: 'T2' },
    })
  })
})
