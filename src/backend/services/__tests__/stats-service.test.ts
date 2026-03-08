import { describe, it, expect } from 'vitest'
import { InMemoryAgentRepository, InMemoryAgentConfigRepository } from '../../repos/agent-repository.js'
import { InMemoryAgentRunRepository } from '../../repos/event-repository.js'
import { InMemoryStatsRepository } from '../../repos/stats-repository.js'
import { AgentService } from '../agent-service.js'
import { StatsService } from '../stats-service.js'

function createCtx() {
  const agentRepo = new InMemoryAgentRepository()
  const agentConfigRepo = new InMemoryAgentConfigRepository()
  const agentRunRepo = new InMemoryAgentRunRepository()
  const statsRepo = new InMemoryStatsRepository()

  const agentService = new AgentService({
    agentRepo,
    agentConfigRepo,
    agentRunRepo,
  })

  const statsService = new StatsService({
    statsRepo,
    agentRepo,
    agentService,
  })

  const agent = agentService.createAgent({
    owner_id: 'u1',
    display_name: 'Stats Tester',
  })

  return { agent, agentService, statsRepo, statsService }
}

async function grantUnspentPoints(statsRepo: InMemoryStatsRepository, agentId: string, points: number): Promise<void> {
  const base = await statsRepo.getOrCreateStats(agentId)
  await statsRepo.saveStats({
    agent_id: agentId,
    granted_points_total: base.granted_points_total,
    unspent_points: points,
    sociability: base.sociability,
    curiosity: base.curiosity,
    assertiveness: base.assertiveness,
    empathy: base.empathy,
    brashness: base.brashness,
    cynicism: base.cynicism,
    stubbornness: base.stubbornness,
    volatility: base.volatility,
    memory: base.memory,
    learning: base.learning,
    expected_version: base.version,
  })
}

describe('StatsService', () => {
  it('applies segmented 4/3/1 steps in preview + allocate', async () => {
    const ctx = createCtx()
    const base = await ctx.statsRepo.getOrCreateStats(ctx.agent.id)

    await ctx.statsRepo.saveStats({
      agent_id: ctx.agent.id,
      granted_points_total: base.granted_points_total,
      unspent_points: 5,
      sociability: base.sociability,
      curiosity: base.curiosity,
      assertiveness: base.assertiveness,
      empathy: base.empathy,
      brashness: base.brashness,
      cynicism: base.cynicism,
      stubbornness: base.stubbornness,
      volatility: base.volatility,
      memory: base.memory,
      learning: base.learning,
      expected_version: base.version,
    })

    const snapshot = await ctx.statsService.getSnapshot(ctx.agent.id)
    const preview = await ctx.statsService.previewAllocation(ctx.agent.id, {
      version: snapshot.stats.version,
      allocation: { sociability: 2 },
    })

    expect(preview.after.sociability).toBe(8)
    expect(preview.cost_points).toBe(2)

    const allocated = await ctx.statsService.allocate(ctx.agent.id, {
      version: snapshot.stats.version,
      allocation: { sociability: 2 },
      confirm_no_respec: true,
      idempotency_key: 'k1',
    })

    expect(allocated.spent_points).toBe(2)
    expect(allocated.remaining_points).toBe(3)
    expect(allocated.stats.sociability).toBe(8)
  })

  it('rejects allocate when confirm_no_respec=false', async () => {
    const ctx = createCtx()
    const base = await ctx.statsRepo.getOrCreateStats(ctx.agent.id)

    await ctx.statsRepo.saveStats({
      agent_id: ctx.agent.id,
      granted_points_total: base.granted_points_total,
      unspent_points: 3,
      sociability: base.sociability,
      curiosity: base.curiosity,
      assertiveness: base.assertiveness,
      empathy: base.empathy,
      brashness: base.brashness,
      cynicism: base.cynicism,
      stubbornness: base.stubbornness,
      volatility: base.volatility,
      memory: base.memory,
      learning: base.learning,
      expected_version: base.version,
    })

    await expect(
      ctx.statsService.allocate(ctx.agent.id, {
        allocation: { memory: 1 },
        confirm_no_respec: false,
        idempotency_key: 'k2',
      }),
    ).rejects.toThrow('confirm_no_respec must be true')
  })

  it('dedupes by idempotency_key', async () => {
    const ctx = createCtx()
    const base = await ctx.statsRepo.getOrCreateStats(ctx.agent.id)

    await ctx.statsRepo.saveStats({
      agent_id: ctx.agent.id,
      granted_points_total: base.granted_points_total,
      unspent_points: 4,
      sociability: base.sociability,
      curiosity: base.curiosity,
      assertiveness: base.assertiveness,
      empathy: base.empathy,
      brashness: base.brashness,
      cynicism: base.cynicism,
      stubbornness: base.stubbornness,
      volatility: base.volatility,
      memory: base.memory,
      learning: base.learning,
      expected_version: base.version,
    })

    const snap = await ctx.statsService.getSnapshot(ctx.agent.id)

    const first = await ctx.statsService.allocate(ctx.agent.id, {
      version: snap.stats.version,
      allocation: { learning: 1 },
      confirm_no_respec: true,
      idempotency_key: 'same-key',
    })

    const second = await ctx.statsService.allocate(ctx.agent.id, {
      allocation: { learning: 1 },
      confirm_no_respec: true,
      idempotency_key: 'same-key',
    })

    expect(first.deduped).toBe(false)
    expect(second.deduped).toBe(true)
    expect(second.stats.learning).toBe(first.stats.learning)
    expect(second.remaining_points).toBe(first.remaining_points)

    const events = await ctx.statsService.getEvents(ctx.agent.id, { limit: 20 })
    const spentEvents = events.items.filter((event) => event.event_type === 'POINTS_SPENT' && event.idempotency_key === 'same-key')
    expect(spentEvents).toHaveLength(1)
  })

  it('scopes idempotency_key per agent', async () => {
    const ctx = createCtx()
    const other = ctx.agentService.createAgent({
      owner_id: 'u1',
      display_name: 'Stats Tester 2',
    })

    await grantUnspentPoints(ctx.statsRepo, ctx.agent.id, 3)
    await grantUnspentPoints(ctx.statsRepo, other.id, 3)

    const [firstSnap, secondSnap] = await Promise.all([
      ctx.statsService.getSnapshot(ctx.agent.id),
      ctx.statsService.getSnapshot(other.id),
    ])

    const key = 'cross-agent-key'
    const first = await ctx.statsService.allocate(ctx.agent.id, {
      version: firstSnap.stats.version,
      allocation: { memory: 1 },
      confirm_no_respec: true,
      idempotency_key: key,
    })
    const second = await ctx.statsService.allocate(other.id, {
      version: secondSnap.stats.version,
      allocation: { memory: 1 },
      confirm_no_respec: true,
      idempotency_key: key,
    })

    expect(first.deduped).toBe(false)
    expect(second.deduped).toBe(false)

    const [firstEvents, secondEvents] = await Promise.all([
      ctx.statsService.getEvents(ctx.agent.id, { limit: 20 }),
      ctx.statsService.getEvents(other.id, { limit: 20 }),
    ])

    expect(firstEvents.items.some((event) => event.event_type === 'POINTS_SPENT' && event.idempotency_key === key)).toBe(true)
    expect(secondEvents.items.some((event) => event.event_type === 'POINTS_SPENT' && event.idempotency_key === key)).toBe(true)
  })
})
