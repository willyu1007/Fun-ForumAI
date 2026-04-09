import { afterEach, describe, expect, it, vi } from 'vitest'
import { PgAgentStageTierSnapshotRepository } from '../pg/pg-agent-stage-tier-snapshot-repository.js'

function makeStageTierRow(overrides: Partial<{
  tier: string
  score: number
  achievementPoints: number
  chroniclePoints: number
  trustPenalty: number
  computedAt: Date
  updatedAt: Date
}> = {}) {
  return {
    id: 'tier-1',
    agentId: 'agent-1',
    tier: overrides.tier ?? 'T1',
    score: overrides.score ?? 0,
    achievementPoints: overrides.achievementPoints ?? 0,
    chroniclePoints: overrides.chroniclePoints ?? 0,
    trustPenalty: overrides.trustPenalty ?? 0,
    reasoningJson: { source: 'test' },
    computedAt: overrides.computedAt ?? new Date('2026-04-10T00:00:00.000Z'),
    updatedAt: overrides.updatedAt ?? new Date('2026-04-10T00:00:00.000Z'),
  }
}

async function flushMicrotasks() {
  await Promise.resolve()
  await Promise.resolve()
}

describe('PgAgentStageTierSnapshotRepository', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('refreshes stale stage tier snapshots after read access', async () => {
    vi.useFakeTimers()
    const findMany = vi
      .fn()
      .mockResolvedValueOnce([makeStageTierRow()])
      .mockResolvedValueOnce([
        makeStageTierRow({
          tier: 'T2',
          score: 18,
          achievementPoints: 12,
          chroniclePoints: 9,
          computedAt: new Date('2026-04-10T00:05:00.000Z'),
          updatedAt: new Date('2026-04-10T00:05:00.000Z'),
        }),
      ])
    const repo = new PgAgentStageTierSnapshotRepository({
      agentStageTierSnapshot: { findMany },
    } as never, {
      cacheTtlMs: 1_000,
    })

    await repo.hydrate()
    expect(repo.findLatestByAgent('agent-1')?.tier).toBe('T1')

    vi.advanceTimersByTime(1_001)
    expect(repo.findLatestByAgent('agent-1')?.tier).toBe('T1')

    await flushMicrotasks()

    expect(findMany).toHaveBeenCalledTimes(2)
    expect(repo.findLatestByAgent('agent-1')?.tier).toBe('T2')
  })
})
