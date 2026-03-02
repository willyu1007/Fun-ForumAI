import { describe, expect, it } from 'vitest'
import { InMemoryCommunityCultureDigestRepository } from '../community-culture-digest-repository.js'

describe('InMemoryCommunityCultureDigestRepository', () => {
  it('keeps only one active digest per community', async () => {
    const repo = new InMemoryCommunityCultureDigestRepository()

    await repo.create({
      community_id: 'c1',
      version: 1,
      digest_json: { summary: 'v1' },
      source_window_days: 30,
      expires_at: new Date('2026-03-20T00:00:00.000Z'),
      generated_at: new Date('2026-03-01T00:00:00.000Z'),
      status: 'ACTIVE',
    })

    await repo.create({
      community_id: 'c1',
      version: 2,
      digest_json: { summary: 'v2' },
      source_window_days: 30,
      expires_at: new Date('2026-03-25T00:00:00.000Z'),
      generated_at: new Date('2026-03-05T00:00:00.000Z'),
      status: 'ACTIVE',
    })

    const active = await repo.findActiveByCommunity('c1', new Date('2026-03-10T00:00:00.000Z'))
    expect(active?.version).toBe(2)

    const allActive = await repo.listActive(new Date('2026-03-10T00:00:00.000Z'))
    expect(allActive.filter((item) => item.community_id === 'c1')).toHaveLength(1)
  })
})
