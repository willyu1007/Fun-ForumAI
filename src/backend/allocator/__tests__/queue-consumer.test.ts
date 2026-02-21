import { describe, it, expect, beforeEach } from 'vitest'
import { QueueConsumer } from '../queue-consumer.js'
import { EventAllocator } from '../allocator.js'
import { InMemoryAdmissionGate } from '../admission.js'
import { DefaultQuotaCalculator } from '../quota-calculator.js'
import { DefaultCandidateSelector } from '../candidate-selector.js'
import { InMemoryAllocationLock } from '../allocation-lock.js'
import { DefaultDegradationMonitor } from '../degradation.js'
import { InMemoryEventQueue } from '../event-queue.js'
import { DEFAULT_ALLOCATOR_CONFIG } from '../config.js'
import type { AgentCandidate, AgentRepository, EventPayload } from '../types.js'

function makeEvent(overrides: Partial<EventPayload> = {}): EventPayload {
  return {
    event_id: `evt-${Math.random().toString(36).slice(2, 8)}`,
    event_type: 'NewPostCreated',
    idempotency_key: `idem-${Math.random().toString(36).slice(2, 8)}`,
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

function buildStack(agents: AgentCandidate[]) {
  const cfg = DEFAULT_ALLOCATOR_CONFIG
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
  return { queue, consumer, degradation, quota, lock, admission }
}

describe('QueueConsumer', () => {
  const pool = Array.from({ length: 10 }, (_, i) => makeAgent(`agent-${i}`))
  let stack: ReturnType<typeof buildStack>

  beforeEach(() => {
    stack = buildStack(pool)
  })

  it('processOne returns null on empty queue', () => {
    expect(stack.consumer.processOne()).toBeNull()
  })

  it('processOne consumes one event and returns result', () => {
    stack.queue.enqueue(makeEvent())
    const result = stack.consumer.processOne()
    expect(result).not.toBeNull()
    expect(result!.agents.length).toBeGreaterThan(0)
    expect(stack.queue.size()).toBe(0)
  })

  it('processBatch handles multiple events', () => {
    for (let i = 0; i < 5; i++) stack.queue.enqueue(makeEvent())
    const batch = stack.consumer.processBatch(5)
    expect(batch.stats.processed).toBe(5)
    expect(batch.results).toHaveLength(5)
    expect(stack.queue.size()).toBe(0)
  })

  it('processBatch stops when queue is empty', () => {
    stack.queue.enqueue(makeEvent())
    stack.queue.enqueue(makeEvent())
    const batch = stack.consumer.processBatch(100)
    expect(batch.stats.processed).toBe(2)
  })

  it('drain processes all remaining events', () => {
    for (let i = 0; i < 8; i++) stack.queue.enqueue(makeEvent())
    const batch = stack.consumer.drain()
    expect(batch.stats.processed).toBe(8)
    expect(stack.queue.size()).toBe(0)
  })

  it('tracks thread quota across batch', () => {
    const postId = 'hot-post'
    for (let i = 0; i < 10; i++) {
      stack.queue.enqueue(makeEvent({ post_id: postId }))
    }
    const batch = stack.consumer.drain()
    const totalAllocated = batch.stats.allocated_agents
    expect(totalAllocated).toBeLessThanOrEqual(DEFAULT_ALLOCATOR_CONFIG.defaultThreadMaxAgents)
  })

  describe('lag-driven degradation', () => {
    it('reports lag based on oldest event timestamp', () => {
      const old = new Date(Date.now() - 200_000).toISOString()
      stack.queue.enqueue(makeEvent({ created_at: old }))
      stack.consumer.processOne()
      const state = stack.degradation.getState()
      expect(state.level).toBe('normal')
    })

    it('triggers moderate degradation for stale events', () => {
      const stale = new Date(Date.now() - 150_000).toISOString()
      for (let i = 0; i < 5; i++) {
        stack.queue.enqueue(makeEvent({ created_at: stale }))
      }

      // First processOne will updateLag before dequeue
      // The oldest event is ~150s old → moderate
      const result = stack.consumer.processOne()
      expect(result).not.toBeNull()
      // Quota should have been tightened during this call
      expect(result!.quota_applied).toBeLessThanOrEqual(
        Math.floor(DEFAULT_ALLOCATOR_CONFIG.eventBaseQuota.NewPostCreated * 0.5),
      )
    })
  })
})
