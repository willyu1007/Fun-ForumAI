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

  return { agent, statsRepo, statsService }
}

describe('StatsService', () => {
  it('applies segmented 4/3/1 steps in preview + allocate', async () => {
    const ctx = createCtx()
    const base = await ctx.statsRepo.getOrCreateStats(ctx.agent.id)

    await ctx.statsRepo.saveStats({
      agent_id: ctx.agent.id,
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
  })
})
