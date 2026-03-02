import { describe, expect, it } from 'vitest'
import { SnapshotGraphRelevanceProvider } from '../graph-relevance-provider.js'

describe('SnapshotGraphRelevanceProvider', () => {
  it('returns exact context snapshot first', () => {
    const provider = new SnapshotGraphRelevanceProvider()
    provider.hydrate([
      {
        source_agent_id: 'a0',
        candidate_agent_id: 'a1',
        community_id: 'c1',
        topic_key: 'ai',
        ppr_score: 0.8,
        rank: 1,
        computed_at: new Date('2026-03-02T00:00:00.000Z'),
        expires_at: new Date('2026-03-03T00:00:00.000Z'),
      },
      {
        source_agent_id: 'a0',
        candidate_agent_id: 'a2',
        community_id: 'c1',
        topic_key: '__all__',
        ppr_score: 0.6,
        rank: 1,
        computed_at: new Date('2026-03-02T00:00:00.000Z'),
        expires_at: new Date('2026-03-03T00:00:00.000Z'),
      },
    ])

    const rows = provider.getSnapshot({
      source_agent_id: 'a0',
      community_id: 'c1',
      topic_key: 'ai',
      now: new Date('2026-03-02T12:00:00.000Z'),
    })

    expect(rows).toHaveLength(1)
    expect(rows[0].candidate_agent_id).toBe('a1')
  })

  it('falls back to community __all__ and drops expired rows', () => {
    const provider = new SnapshotGraphRelevanceProvider()
    provider.hydrate([
      {
        source_agent_id: 'a0',
        candidate_agent_id: 'a1',
        community_id: 'c1',
        topic_key: 'ai',
        ppr_score: 0.8,
        rank: 1,
        computed_at: new Date('2026-03-02T00:00:00.000Z'),
        expires_at: new Date('2026-03-02T00:01:00.000Z'),
      },
      {
        source_agent_id: 'a0',
        candidate_agent_id: 'a2',
        community_id: 'c1',
        topic_key: '__all__',
        ppr_score: 0.6,
        rank: 1,
        computed_at: new Date('2026-03-02T00:00:00.000Z'),
        expires_at: new Date('2026-03-03T00:00:00.000Z'),
      },
    ])

    const rows = provider.getSnapshot({
      source_agent_id: 'a0',
      community_id: 'c1',
      topic_key: 'ai',
      now: new Date('2026-03-02T12:00:00.000Z'),
    })

    expect(rows).toHaveLength(1)
    expect(rows[0].candidate_agent_id).toBe('a2')
  })

  it('replaces snapshots by source', () => {
    const provider = new SnapshotGraphRelevanceProvider()
    provider.hydrate([
      {
        source_agent_id: 'a0',
        candidate_agent_id: 'a1',
        community_id: 'c1',
        topic_key: '__all__',
        ppr_score: 0.8,
        rank: 1,
        computed_at: new Date('2026-03-02T00:00:00.000Z'),
        expires_at: new Date('2026-03-03T00:00:00.000Z'),
      },
    ])

    provider.replaceSourceSnapshots('a0', [
      {
        source_agent_id: 'a0',
        candidate_agent_id: 'a2',
        community_id: 'c1',
        topic_key: '__all__',
        ppr_score: 0.9,
        rank: 1,
        computed_at: new Date('2026-03-02T00:00:00.000Z'),
        expires_at: new Date('2026-03-03T00:00:00.000Z'),
      },
    ])

    const rows = provider.getSnapshot({
      source_agent_id: 'a0',
      community_id: 'c1',
      topic_key: '__all__',
      now: new Date('2026-03-02T12:00:00.000Z'),
    })

    expect(rows).toHaveLength(1)
    expect(rows[0].candidate_agent_id).toBe('a2')
  })
})
