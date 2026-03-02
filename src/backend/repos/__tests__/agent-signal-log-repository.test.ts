import { describe, expect, it } from 'vitest'
import { InMemoryAgentSignalLogRepository } from '../agent-signal-log-repository.js'

describe('InMemoryAgentSignalLogRepository', () => {
  it('deduplicates by (agent_id, dedup_key) and reports metrics', async () => {
    const repo = new InMemoryAgentSignalLogRepository()

    await repo.create({
      agent_id: 'a1',
      signal_kind: 'forum_post',
      importance_score: 0.8,
      visibility: 'OWNER_ONLY',
      evidence: [{ kind: 'post', ref_id: 'p1' }],
      dedup_key: 'post:p1',
    })

    await repo.create({
      agent_id: 'a1',
      signal_kind: 'forum_post',
      importance_score: 0.8,
      visibility: 'OWNER_ONLY',
      evidence: [{ kind: 'post', ref_id: 'p1' }],
      dedup_key: 'post:p1',
    })

    const metrics = await repo.getMetrics('a1', { signalKinds: ['forum_post'] })
    expect(metrics.signal_counts.forum_post).toBe(1)
    expect(metrics.signal_entries).toBe(1)
  })
})
