import { describe, expect, it } from 'vitest'
import { dedupeCreatePprSnapshotEntries, InMemoryPprSnapshotRepository } from '../ppr-snapshot-repository.js'

describe('InMemoryPprSnapshotRepository', () => {
  it('replaces snapshots per source and queries by context', async () => {
    const computedAt = new Date()
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const repo = new InMemoryPprSnapshotRepository()

    await repo.replaceSourceSnapshots('a0', [
      {
        source_agent_id: 'a0',
        candidate_agent_id: 'a1',
        community_id: 'c1',
        topic_key: '__all__',
        ppr_score: 0.9,
        rank: 1,
        computed_at: computedAt,
        expires_at: expiresAt,
      },
    ])

    let rows = await repo.findBySourceContext('a0', 'c1', '__all__')
    expect(rows.map((row) => row.candidate_agent_id)).toEqual(['a1'])

    await repo.replaceSourceSnapshots('a0', [
      {
        source_agent_id: 'a0',
        candidate_agent_id: 'a2',
        community_id: 'c1',
        topic_key: '__all__',
        ppr_score: 0.8,
        rank: 1,
        computed_at: computedAt,
        expires_at: expiresAt,
      },
    ])

    rows = await repo.findBySourceContext('a0', 'c1', '__all__')
    expect(rows.map((row) => row.candidate_agent_id)).toEqual(['a2'])
  })

  it('purges expired snapshots', async () => {
    const repo = new InMemoryPprSnapshotRepository()

    await repo.replaceSourceSnapshots('a0', [
      {
        source_agent_id: 'a0',
        candidate_agent_id: 'a1',
        community_id: 'c1',
        topic_key: '__all__',
        ppr_score: 0.9,
        rank: 1,
        computed_at: new Date('2026-03-02T00:00:00.000Z'),
        expires_at: new Date('2026-03-02T00:00:01.000Z'),
      },
    ])

    const removed = await repo.purgeExpired(new Date('2026-03-02T00:01:00.000Z'))
    expect(removed).toBe(1)

    const rows = await repo.listUnexpired({ now: new Date('2026-03-02T00:01:00.000Z') })
    expect(rows).toEqual([])
  })

  it('deduplicates repeated source-context candidate pairs before persistence', () => {
    const computedAt = new Date('2026-03-02T00:00:00.000Z')
    const expiresAt = new Date('2026-03-03T00:00:00.000Z')

    const deduped = dedupeCreatePprSnapshotEntries([
      {
        source_agent_id: 'a0',
        candidate_agent_id: 'a1',
        community_id: 'c1',
        topic_key: '__all__',
        ppr_score: 0.9,
        rank: 1,
        computed_at: computedAt,
        expires_at: expiresAt,
      },
      {
        source_agent_id: 'a0',
        candidate_agent_id: 'a1',
        community_id: 'c1',
        topic_key: '__all__',
        ppr_score: 0.85,
        rank: 2,
        computed_at: computedAt,
        expires_at: expiresAt,
      },
    ])

    expect(deduped).toHaveLength(1)
    expect(deduped[0]).toMatchObject({
      candidate_agent_id: 'a1',
      rank: 2,
      ppr_score: 0.85,
    })
  })
})
