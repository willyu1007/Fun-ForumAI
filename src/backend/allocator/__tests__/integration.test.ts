/**
 * Phase 3 — Integration / stress tests for the full allocator stack.
 *
 * Covers:
 *   1. Hot-spot post (100 agents, quota=5)
 *   2. Causal chain truncation (A→B→C→...→depth=5 stops)
 *   3. Concurrent dedup (same event_id never double-allocates an agent)
 *   4. Degradation + recovery lifecycle
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { EventAllocator } from '../allocator.js'
import { InMemoryAdmissionGate } from '../admission.js'
import { DefaultQuotaCalculator } from '../quota-calculator.js'
import { DefaultCandidateSelector } from '../candidate-selector.js'
import { InMemoryAllocationLock } from '../allocation-lock.js'
import { DefaultDegradationMonitor } from '../degradation.js'
import { InMemoryEventQueue } from '../event-queue.js'
import { QueueConsumer } from '../queue-consumer.js'
import { deriveFollowUpEvents } from '../chain-propagation.js'
import { DEFAULT_ALLOCATOR_CONFIG, type AllocatorConfig } from '../config.js'
import type { AgentCandidate, AgentRepository, EventPayload } from '../types.js'

// ─── Helpers ────────────────────────────────────────────────

let eventCounter = 0
function makeEvent(overrides: Partial<EventPayload> = {}): EventPayload {
  eventCounter++
  return {
    event_id: `evt-${eventCounter}`,
    event_type: 'NewPostCreated',
    idempotency_key: `idem-${eventCounter}`,
    chain_depth: 0,
    community_id: 'comm-1',
    author_agent_id: 'agent-author',
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

function makeAgent(id: string, overrides: Partial<AgentCandidate> = {}): AgentCandidate {
  return {
    agent_id: id,
    status: 'active',
    tags: [],
    community_ids: ['comm-1'],
    actions_last_hour: 0,
    tokens_last_day: 0,
    last_action_at: null,
    recent_thread_post_ids: [],
    ...overrides,
  }
}

class StubAgentRepo implements AgentRepository {
  constructor(private agents: AgentCandidate[] = []) {}
  getCandidates(): AgentCandidate[] {
    return this.agents
  }
}

function buildStack(agents: AgentCandidate[], cfgOverride?: Partial<AllocatorConfig>) {
  const cfg: AllocatorConfig = { ...DEFAULT_ALLOCATOR_CONFIG, ...cfgOverride }
  const admission = new InMemoryAdmissionGate(cfg)
  const quota = new DefaultQuotaCalculator(cfg)
  const candidates = new DefaultCandidateSelector(cfg)
  const lock = new InMemoryAllocationLock(cfg.lockTtlMs)
  const degradation = new DefaultDegradationMonitor(cfg)
  const agentRepo = new StubAgentRepo(agents)
  const allocator = new EventAllocator({
    admission, quota, candidates, lock, degradation, agentRepo,
  })
  const queue = new InMemoryEventQueue()
  const consumer = new QueueConsumer(queue, allocator, degradation, quota)
  return { queue, consumer, allocator, degradation, quota, lock, admission }
}

// ─── Phase 3 Tests ──────────────────────────────────────────

describe('[Phase 3] Hot-spot post stress test', () => {
  it('100 agents, single hot post: total allocated ≤ thread_max (20)', () => {
    const agents = Array.from({ length: 100 }, (_, i) => makeAgent(`agent-${i}`))
    const { queue, consumer } = buildStack(agents)

    const postId = 'hot-post-1'
    for (let i = 0; i < 50; i++) {
      queue.enqueue(makeEvent({ post_id: postId }))
    }

    const batch = consumer.drain()
    const totalAllocated = batch.results.reduce((sum, r) => sum + r.agents.length, 0)

    expect(totalAllocated).toBeLessThanOrEqual(DEFAULT_ALLOCATOR_CONFIG.defaultThreadMaxAgents)
    expect(totalAllocated).toBeGreaterThan(0)
  })

  it('per-event allocation never exceeds event_base quota (5)', () => {
    const agents = Array.from({ length: 100 }, (_, i) => makeAgent(`agent-${i}`))
    const { queue, consumer } = buildStack(agents)

    for (let i = 0; i < 20; i++) {
      queue.enqueue(makeEvent({ post_id: 'post-x' }))
    }

    const batch = consumer.drain()
    for (const result of batch.results) {
      expect(result.agents.length).toBeLessThanOrEqual(
        DEFAULT_ALLOCATOR_CONFIG.eventBaseQuota.NewPostCreated,
      )
    }
  })

  it('community override cap is respected', () => {
    const agents = Array.from({ length: 50 }, (_, i) => makeAgent(`agent-${i}`))
    const { queue, consumer, quota } = buildStack(agents)
    quota.setCommunityOverride('comm-1', 2)

    for (let i = 0; i < 10; i++) {
      queue.enqueue(makeEvent())
    }

    const batch = consumer.drain()
    for (const result of batch.results) {
      expect(result.agents.length).toBeLessThanOrEqual(2)
    }
  })
})

describe('[Phase 3] Causal chain truncation', () => {
  it('chain stops propagating at depth > maxChainDepth (5)', () => {
    const agents = Array.from({ length: 20 }, (_, i) => makeAgent(`agent-${i}`))
    const cfg: AllocatorConfig = {
      ...DEFAULT_ALLOCATOR_CONFIG,
      cooldownSeconds: 0,
      maxChainDepth: 5,
      eventBaseQuota: { ...DEFAULT_ALLOCATOR_CONFIG.eventBaseQuota, NewCommentCreated: 2 },
    }
    const { queue, consumer } = buildStack(agents, cfg)

    queue.enqueue(makeEvent({ chain_depth: 0, post_id: 'chain-post' }))

    let maxAllocatedDepth = 0
    let iterations = 0

    while (queue.size() > 0 && iterations < 500) {
      iterations++
      const peeked = queue.peek()
      if (!peeked) break

      const result = consumer.processOne()
      if (!result) break

      if (result.agents.length > 0) {
        maxAllocatedDepth = Math.max(maxAllocatedDepth, peeked.chain_depth)

        const followUps = deriveFollowUpEvents(peeked, result, { postId: 'chain-post' })
        for (const fu of followUps) queue.enqueue(fu)
      }
    }

    expect(maxAllocatedDepth).toBeLessThanOrEqual(cfg.maxChainDepth)
  })

  it('explicit depth=6 event is rejected at admission', () => {
    const agents = [makeAgent('a1')]
    const { allocator } = buildStack(agents)
    const result = allocator.allocate(makeEvent({ chain_depth: 6 }))
    expect(result.agents).toHaveLength(0)
    expect(result.skipped_reasons._admission).toMatch(/chain_depth/)
  })
})

describe('[Phase 3] Concurrent dedup — (event_id, agent_id) lock', () => {
  it('same event_id never allocates the same agent twice across multiple calls', () => {
    const agents = Array.from({ length: 5 }, (_, i) => makeAgent(`agent-${i}`))
    const { allocator } = buildStack(agents)

    const eventId = 'evt-dedup'
    const allAllocated: string[] = []

    for (let i = 0; i < 10; i++) {
      const result = allocator.allocate(
        makeEvent({ event_id: eventId, idempotency_key: `idem-run-${i}` }),
      )
      allAllocated.push(...result.agents.map((a) => a.agent_id))
    }

    const unique = new Set(allAllocated)
    expect(unique.size).toBe(allAllocated.length)
  })

  it('different event_ids can allocate overlapping agents', () => {
    const agents = [makeAgent('shared-agent')]
    const { allocator } = buildStack(agents)

    const r1 = allocator.allocate(makeEvent({ event_id: 'evt-A' }))
    const r2 = allocator.allocate(makeEvent({ event_id: 'evt-B' }))

    expect(r1.agents.map((a) => a.agent_id)).toContain('shared-agent')
    expect(r2.agents.map((a) => a.agent_id)).toContain('shared-agent')
  })
})

describe('[Phase 3] Degradation lifecycle', () => {
  let stack: ReturnType<typeof buildStack>
  const pool = Array.from({ length: 20 }, (_, i) => makeAgent(`agent-${i}`))

  beforeEach(() => {
    stack = buildStack(pool)
  })

  it('normal → moderate → critical → recovery', () => {
    // Normal: full quota
    const r1 = stack.allocator.allocate(makeEvent())
    expect(r1.degradation_level).toBe('normal')
    expect(r1.quota_applied).toBe(5)

    // Moderate: quota halved
    stack.degradation.reportLag(150)
    const r2 = stack.allocator.allocate(makeEvent())
    expect(r2.degradation_level).toBe('moderate')
    expect(r2.quota_applied).toBe(2) // floor(5 * 0.5)

    // Critical: quota near zero
    stack.degradation.reportLag(400)
    const r3 = stack.allocator.allocate(makeEvent())
    expect(r3.degradation_level).toBe('critical')
    expect(r3.quota_applied).toBe(0) // floor(5 * 0.1)
    expect(r3.agents).toHaveLength(0)

    // Recovery: lag drops, quota restores
    stack.degradation.reportLag(10)
    const r4 = stack.allocator.allocate(makeEvent())
    expect(r4.degradation_level).toBe('normal')
    expect(r4.quota_applied).toBe(5)
    expect(r4.agents.length).toBeGreaterThan(0)
  })

  it('queue-driven degradation: stale events trigger tightened quota', () => {
    const staleTs = new Date(Date.now() - 200_000).toISOString() // 200s old → moderate

    for (let i = 0; i < 5; i++) {
      stack.queue.enqueue(makeEvent({ created_at: staleTs }))
    }

    const batch = stack.consumer.processBatch(5)
    const moderateResults = batch.results.filter((r) => r.degradation_level === 'moderate')
    expect(moderateResults.length).toBeGreaterThan(0)

    for (const r of moderateResults) {
      expect(r.quota_applied).toBeLessThanOrEqual(2) // floor(5 * 0.5)
    }
  })

  it('critical stale events almost completely suppress allocation', () => {
    const veryStaleTs = new Date(Date.now() - 400_000).toISOString() // 400s → critical

    for (let i = 0; i < 5; i++) {
      stack.queue.enqueue(makeEvent({ created_at: veryStaleTs }))
    }

    const batch = stack.consumer.processBatch(5)
    for (const r of batch.results) {
      expect(r.agents).toHaveLength(0)
    }
  })

  it('fresh events after stale batch recover to normal', () => {
    // First: stale events
    const staleTs = new Date(Date.now() - 400_000).toISOString()
    stack.queue.enqueue(makeEvent({ created_at: staleTs }))
    stack.consumer.processOne()

    // After draining stale events, queue is empty → lag = 0
    const freshResult = stack.consumer.processOne()
    expect(freshResult).toBeNull()

    // Now the degradation should have recovered
    const state = stack.degradation.getState()
    expect(state.level).toBe('normal')

    // Fresh event should get full quota
    const r = stack.allocator.allocate(makeEvent())
    expect(r.degradation_level).toBe('normal')
    expect(r.quota_applied).toBe(5)
  })
})

describe('[Phase 3] Full pipeline chain simulation', () => {
  it('simulates A posts → agents reply → chain propagates → truncates', () => {
    const agents = Array.from({ length: 15 }, (_, i) =>
      makeAgent(`agent-${i}`),
    )
    const cfg: AllocatorConfig = {
      ...DEFAULT_ALLOCATOR_CONFIG,
      cooldownSeconds: 0,
      maxChainDepth: 3,
      eventBaseQuota: {
        ...DEFAULT_ALLOCATOR_CONFIG.eventBaseQuota,
        NewPostCreated: 3,
        NewCommentCreated: 2,
      },
    }
    const { queue, consumer } = buildStack(agents, cfg)

    queue.enqueue(makeEvent({ chain_depth: 0, post_id: 'chain-root' }))

    const allResults: { depth: number; agents: string[] }[] = []
    let safety = 0

    while (queue.size() > 0 && safety < 200) {
      safety++
      const peeked = queue.peek()
      if (!peeked) break

      const result = consumer.processOne()
      if (!result) break

      allResults.push({
        depth: peeked.chain_depth,
        agents: result.agents.map((a) => a.agent_id),
      })

      if (result.agents.length > 0) {
        const followUps = deriveFollowUpEvents(peeked, result, {
          postId: 'chain-root',
        })
        for (const fu of followUps) {
          queue.enqueue(fu)
        }
      }
    }

    expect(allResults.length).toBeGreaterThan(0)

    // No allocation should succeed at depth > maxChainDepth
    const maxAllocatedDepth = Math.max(
      ...allResults.filter((r) => r.agents.length > 0).map((r) => r.depth),
    )
    expect(maxAllocatedDepth).toBeLessThanOrEqual(cfg.maxChainDepth)

    // Events at depth > maxChainDepth should all be rejected
    const beyondMax = allResults.filter((r) => r.depth > cfg.maxChainDepth)
    for (const r of beyondMax) {
      expect(r.agents).toHaveLength(0)
    }
  })
})
