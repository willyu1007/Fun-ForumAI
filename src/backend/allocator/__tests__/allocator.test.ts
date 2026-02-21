import { describe, it, expect } from 'vitest'
import { EventAllocator } from '../allocator.js'
import { InMemoryAdmissionGate } from '../admission.js'
import { DefaultQuotaCalculator } from '../quota-calculator.js'
import { DefaultCandidateSelector } from '../candidate-selector.js'
import { InMemoryAllocationLock } from '../allocation-lock.js'
import { DefaultDegradationMonitor } from '../degradation.js'
import { DEFAULT_ALLOCATOR_CONFIG, type AllocatorConfig } from '../config.js'
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
  getCandidates(_community_id: string): AgentCandidate[] {
    return this.agents
  }
  setAgents(agents: AgentCandidate[]) {
    this.agents = agents
  }
}

function buildAllocator(
  agents: AgentCandidate[],
  cfgOverride?: Partial<AllocatorConfig>,
) {
  const cfg = { ...DEFAULT_ALLOCATOR_CONFIG, ...cfgOverride }
  const admission = new InMemoryAdmissionGate(cfg)
  const quota = new DefaultQuotaCalculator(cfg)
  const candidates = new DefaultCandidateSelector(cfg)
  const lock = new InMemoryAllocationLock(cfg.lockTtlMs)
  const degradation = new DefaultDegradationMonitor(cfg)
  const agentRepo = new StubAgentRepo(agents)
  const allocator = new EventAllocator({
    admission,
    quota,
    candidates,
    lock,
    degradation,
    agentRepo,
  })
  return { allocator, admission, quota, lock, degradation, agentRepo }
}

describe('EventAllocator — full pipeline', () => {
  const pool = Array.from({ length: 10 }, (_, i) => makeAgent(`agent-${i}`))

  it('allocates up to event_base quota (NewPostCreated=5)', () => {
    const { allocator } = buildAllocator(pool)
    const result = allocator.allocate(makeEvent())
    expect(result.agents.length).toBeLessThanOrEqual(5)
    expect(result.agents.length).toBeGreaterThan(0)
    expect(result.quota_applied).toBe(5)
  })

  it('assigns sequential priorities starting from 1', () => {
    const { allocator } = buildAllocator(pool)
    const result = allocator.allocate(makeEvent())
    result.agents.forEach((a, idx) => {
      expect(a.priority).toBe(idx + 1)
    })
  })

  it('returns 0 agents for VoteCast (base quota = 0)', () => {
    const { allocator } = buildAllocator(pool)
    const result = allocator.allocate(makeEvent({ event_type: 'VoteCast' }))
    expect(result.agents).toHaveLength(0)
    expect(result.quota_applied).toBe(0)
  })

  it('rejects duplicate idempotency_key', () => {
    const { allocator } = buildAllocator(pool)
    const event = makeEvent()
    const r1 = allocator.allocate(event)
    expect(r1.agents.length).toBeGreaterThan(0)

    const r2 = allocator.allocate(event)
    expect(r2.agents).toHaveLength(0)
    expect(r2.skipped_reasons._admission).toMatch(/duplicate/)
  })

  it('rejects chain_depth > max', () => {
    const { allocator } = buildAllocator(pool)
    const result = allocator.allocate(makeEvent({ chain_depth: 6 }))
    expect(result.agents).toHaveLength(0)
    expect(result.skipped_reasons._admission).toMatch(/chain_depth/)
  })

  it('prevents same (event_id, agent_id) double allocation', () => {
    const twoAgents = [makeAgent('a1'), makeAgent('a2')]
    const { allocator, lock } = buildAllocator(twoAgents)

    const event = makeEvent()
    const r1 = allocator.allocate(event)
    const allocated1 = r1.agents.map((a) => a.agent_id)

    // Second allocation with *different* idempotency but same event_id
    const event2 = { ...event, idempotency_key: 'different-idem' }
    const r2 = allocator.allocate(event2)

    // Agents already locked for this event should be skipped
    for (const a of r2.agents) {
      expect(allocated1).not.toContain(a.agent_id)
    }

    lock.clear()
  })

  it('excludes over-budget agents', () => {
    const agents = [
      makeAgent('rich', { actions_last_hour: 0 }),
      makeAgent('broke', { actions_last_hour: 999 }),
    ]
    const { allocator } = buildAllocator(agents)
    const result = allocator.allocate(makeEvent())
    expect(result.agents.map((a) => a.agent_id)).toContain('rich')
    expect(result.agents.map((a) => a.agent_id)).not.toContain('broke')
  })

  it('excludes agents in cooldown', () => {
    const agents = [
      makeAgent('cool', { last_action_at: null }),
      makeAgent('hot', { last_action_at: new Date(Date.now() - 5_000).toISOString() }),
    ]
    const { allocator } = buildAllocator(agents)
    const result = allocator.allocate(makeEvent())
    expect(result.agents.map((a) => a.agent_id)).toContain('cool')
    expect(result.agents.map((a) => a.agent_id)).not.toContain('hot')
  })

  it('excludes the event author from allocation', () => {
    const agents = [makeAgent('agent-author'), makeAgent('other')]
    const { allocator } = buildAllocator(agents)
    const result = allocator.allocate(makeEvent({ author_agent_id: 'agent-author' }))
    expect(result.agents.map((a) => a.agent_id)).not.toContain('agent-author')
  })
})

describe('EventAllocator — degradation', () => {
  const pool = Array.from({ length: 10 }, (_, i) => makeAgent(`agent-${i}`))

  it('moderate degradation tightens quota by 50%', () => {
    const { allocator, degradation } = buildAllocator(pool)
    degradation.reportLag(150)
    const result = allocator.allocate(makeEvent())
    expect(result.degradation_level).toBe('moderate')
    expect(result.quota_applied).toBe(2) // floor(5 * 0.5)
    expect(result.agents.length).toBeLessThanOrEqual(2)
  })

  it('critical degradation reduces quota drastically', () => {
    const { allocator, degradation } = buildAllocator(pool)
    degradation.reportLag(400)
    const result = allocator.allocate(makeEvent())
    expect(result.degradation_level).toBe('critical')
    expect(result.quota_applied).toBe(0) // floor(5 * 0.1) = 0
    expect(result.agents).toHaveLength(0)
  })

  it('recovers to normal when lag drops', () => {
    const { allocator, degradation } = buildAllocator(pool)
    degradation.reportLag(400)
    const r1 = allocator.allocate(makeEvent())
    expect(r1.degradation_level).toBe('critical')

    degradation.reportLag(0)
    const r2 = allocator.allocate(makeEvent())
    expect(r2.degradation_level).toBe('normal')
    expect(r2.quota_applied).toBe(5)
    expect(r2.agents.length).toBeGreaterThan(0)
  })
})

describe('EventAllocator — hot-spot thread cap', () => {
  it('stops allocating when thread quota exhausted', () => {
    const pool = Array.from({ length: 25 }, (_, i) => makeAgent(`agent-${i}`))
    const cfg: AllocatorConfig = {
      ...DEFAULT_ALLOCATOR_CONFIG,
      defaultThreadMaxAgents: 8,
      eventBaseQuota: { ...DEFAULT_ALLOCATOR_CONFIG.eventBaseQuota, NewPostCreated: 10 },
    }
    const admission = new InMemoryAdmissionGate(cfg)
    const quota = new DefaultQuotaCalculator(cfg)
    const candidates = new DefaultCandidateSelector(cfg)
    const lock = new InMemoryAllocationLock(cfg.lockTtlMs)
    const degradation = new DefaultDegradationMonitor(cfg)
    const agentRepo = new StubAgentRepo(pool)
    const allocator = new EventAllocator({ admission, quota, candidates, lock, degradation, agentRepo })

    let totalAllocated = 0
    for (let i = 0; i < 5; i++) {
      const event = makeEvent({ post_id: 'hot-post' })
      const result = allocator.allocate(event)
      totalAllocated += result.agents.length
      quota.recordThreadAllocation('hot-post', result.agents.length)
    }

    expect(totalAllocated).toBeLessThanOrEqual(8)
  })
})
