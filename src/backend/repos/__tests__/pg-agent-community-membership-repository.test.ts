import { afterEach, describe, expect, it, vi } from 'vitest'
import { PgAgentCommunityMembershipRepository } from '../pg/pg-agent-community-membership-repository.js'

function makeMembershipRow(overrides: Partial<{
  status: string
  statusReason: string | null
  statusSetBy: string | null
  statusSetAt: Date | null
  updatedAt: Date
}> = {}) {
  return {
    id: 'membership-1',
    agentId: 'agent-1',
    communityId: 'community-1',
    role: 'RESIDENT',
    source: 'MANUAL',
    status: overrides.status ?? 'ACTIVE',
    statusReason: overrides.statusReason ?? null,
    statusSetBy: overrides.statusSetBy ?? null,
    statusSetAt: overrides.statusSetAt ?? null,
    joinedAt: new Date('2026-04-10T00:00:00.000Z'),
    leftAt: null,
    createdBy: null,
    createdAt: new Date('2026-04-10T00:00:00.000Z'),
    updatedAt: overrides.updatedAt ?? new Date('2026-04-10T00:00:00.000Z'),
  }
}

async function flushMicrotasks() {
  await Promise.resolve()
  await Promise.resolve()
}

describe('PgAgentCommunityMembershipRepository', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('refreshes stale membership cache after read access', async () => {
    vi.useFakeTimers()
    const findMany = vi
      .fn()
      .mockResolvedValueOnce([makeMembershipRow()])
      .mockResolvedValueOnce([
        makeMembershipRow({
          status: 'MUTED',
          statusReason: 'policy',
          statusSetBy: 'admin-1',
          statusSetAt: new Date('2026-04-10T00:05:00.000Z'),
          updatedAt: new Date('2026-04-10T00:05:00.000Z'),
        }),
      ])
    const repo = new PgAgentCommunityMembershipRepository({
      agentCommunityMembership: { findMany },
    } as never, {
      cacheTtlMs: 1_000,
    })

    await repo.hydrate()
    expect(repo.findCurrentByCommunity('community-1')[0]?.status).toBe('ACTIVE')
    expect(repo.findActiveByCommunity('community-1')).toHaveLength(1)

    vi.advanceTimersByTime(1_001)
    expect(repo.findCurrentByCommunity('community-1')[0]?.status).toBe('ACTIVE')

    await flushMicrotasks()

    expect(findMany).toHaveBeenCalledTimes(2)
    expect(repo.findCurrentByCommunity('community-1')[0]?.status).toBe('MUTED')
    expect(repo.findActiveByCommunity('community-1')).toHaveLength(0)
  })
})
