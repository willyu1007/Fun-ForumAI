import { describe, expect, it } from 'vitest'
import { InMemoryAgentBioRepository } from '../agent-bio-repository.js'
import type { CommitAgentBioRefreshInput } from '../types/agent-bio.js'

function baseInput(overrides: {
  agent_id?: string
  dedup_key: string
  refreshed_at: Date
  render_fingerprint?: string
  public_bio?: string | null
  public_persisted?: boolean
  public_bio_snapshot?: string | null
  status?: CommitAgentBioRefreshInput['render_log']['status']
  worldview_version?: number
  phase_revision?: number
}): CommitAgentBioRefreshInput {
  const agentId = overrides.agent_id ?? 'agent-1'
  const renderFp = overrides.render_fingerprint ?? 'render-fp-a'
  const worldviewVersion = overrides.worldview_version ?? 1
  const phaseRevision = overrides.phase_revision ?? 1
  return {
    worldview: {
      agent_id: agentId,
      worldview_version: worldviewVersion,
      phase_revision: phaseRevision,
      source_fingerprint: 'src-fp',
      refresh_reason: 'test',
      presence_bucket: 'steady',
      worldview_json: {},
      last_major_refreshed_at: overrides.refreshed_at,
      last_minor_refreshed_at: null,
      last_compiled_at: overrides.refreshed_at,
    },
    projection: {
      agent_id: agentId,
      worldview_version: worldviewVersion,
      phase_revision: phaseRevision,
      public_bio: overrides.public_bio ?? null,
      owner_bio: null,
      private_header_bio: null,
      presence_note: null,
      render_fingerprint: renderFp,
      render_policy_json: {},
      refreshed_at: overrides.refreshed_at,
    },
    render_log: {
      agent_id: agentId,
      refresh_kind: 'major',
      refresh_reason: 'test',
      dedup_key: overrides.dedup_key,
      worldview_version: worldviewVersion,
      phase_revision: phaseRevision,
      source_fingerprint: 'src-fp',
      render_fingerprint: renderFp,
      status: overrides.status ?? 'rendered',
      public_persisted: overrides.public_persisted ?? true,
      public_bio_snapshot:
        'public_bio_snapshot' in overrides
          ? overrides.public_bio_snapshot ?? null
          : overrides.public_bio ?? null,
    },
  }
}

describe('InMemoryAgentBioRepository.listRecentPublicBioSnapshots', () => {
  it('returns the most recent snapshots in descending order, deduped by render_fingerprint', async () => {
    const repo = new InMemoryAgentBioRepository()
    await repo.commitRefresh(baseInput({
      dedup_key: 'a',
      render_fingerprint: 'fp-a',
      refreshed_at: new Date('2026-04-01T00:00:00.000Z'),
      public_bio: '阿澈在旧地图里找入口。',
      worldview_version: 1,
    }))
    await repo.commitRefresh(baseInput({
      dedup_key: 'b',
      render_fingerprint: 'fp-b',
      refreshed_at: new Date('2026-04-05T00:00:00.000Z'),
      public_bio: '阿澈把一次误读讲成新动线。',
      worldview_version: 2,
    }))
    // Duplicate render_fingerprint with later time: should take the newer row but still count once.
    await repo.commitRefresh(baseInput({
      dedup_key: 'c',
      render_fingerprint: 'fp-b',
      refreshed_at: new Date('2026-04-10T00:00:00.000Z'),
      public_bio: '阿澈把一次误读讲成新动线。',
      worldview_version: 3,
    }))
    await repo.commitRefresh(baseInput({
      dedup_key: 'd',
      render_fingerprint: 'fp-c',
      refreshed_at: new Date('2026-04-15T00:00:00.000Z'),
      public_bio: '阿澈回到那张桌边继续讲。',
      worldview_version: 4,
    }))

    const results = await repo.listRecentPublicBioSnapshots('agent-1', { limit: 3 })
    expect(results).toHaveLength(3)
    expect(results.map((r) => r.text)).toEqual([
      '阿澈回到那张桌边继续讲。',
      '阿澈把一次误读讲成新动线。',
      '阿澈在旧地图里找入口。',
    ])
    expect(results.map((r) => r.refreshed_at.toISOString())).toEqual([
      '2026-04-15T00:00:00.000Z',
      '2026-04-10T00:00:00.000Z',
      '2026-04-01T00:00:00.000Z',
    ])
  })

  it('ignores rows that are privacy_blocked, not persisted, or missing a snapshot', async () => {
    const repo = new InMemoryAgentBioRepository()
    await repo.commitRefresh(baseInput({
      dedup_key: 'a',
      render_fingerprint: 'fp-ok',
      refreshed_at: new Date('2026-04-01T00:00:00.000Z'),
      public_bio: '可见自述。',
    }))
    await repo.commitRefresh(baseInput({
      dedup_key: 'b',
      render_fingerprint: 'fp-blocked',
      refreshed_at: new Date('2026-04-02T00:00:00.000Z'),
      public_bio: '被隐私拦截的自述。',
      public_persisted: false,
      status: 'privacy_blocked',
      public_bio_snapshot: null,
    }))
    await repo.commitRefresh(baseInput({
      dedup_key: 'c',
      render_fingerprint: 'fp-no-snapshot',
      refreshed_at: new Date('2026-04-03T00:00:00.000Z'),
      public_bio: '未快照的自述。',
      public_bio_snapshot: null,
    }))

    const results = await repo.listRecentPublicBioSnapshots('agent-1', { limit: 5 })
    expect(results).toHaveLength(1)
    expect(results[0]?.text).toBe('可见自述。')
  })

  it('returns empty when limit is 0 or there is no data', async () => {
    const repo = new InMemoryAgentBioRepository()
    expect(await repo.listRecentPublicBioSnapshots('missing', { limit: 3 })).toEqual([])
    await repo.commitRefresh(baseInput({
      dedup_key: 'a',
      render_fingerprint: 'fp',
      refreshed_at: new Date(),
      public_bio: 'anything',
    }))
    expect(await repo.listRecentPublicBioSnapshots('agent-1', { limit: 0 })).toEqual([])
  })
})
