import { describe, expect, it } from 'vitest'
import { InMemoryPprSnapshotRepository } from '../ppr-snapshot-repository.js'

describe('InMemoryPprSnapshotRepository', () => {
  it('replaces snapshots per source and queries by context', async () => {
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
        expires_at: new Date('2026-03-03T00:00:00.000Z'),
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
        computed_at: new Date('2026-03-02T00:00:00.000Z'),
        expires_at: new Date('2026-03-03T00:00:00.000Z'),
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
})
