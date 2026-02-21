import { describe, it, expect } from 'vitest'
import { DefaultCandidateSelector } from '../candidate-selector.js'
import { DEFAULT_ALLOCATOR_CONFIG } from '../config.js'
import type { AgentCandidate, DegradationState, EventPayload } from '../types.js'

const NORMAL: DegradationState = { level: 'normal', queue_lag_seconds: 0, factor: 1.0 }
const CRITICAL: DegradationState = { level: 'critical', queue_lag_seconds: 400, factor: 0.1 }

function makeEvent(overrides: Partial<EventPayload> = {}): EventPayload {
  return {
    event_id: 'evt-1',
    event_type: 'NewPostCreated',
    idempotency_key: 'idem-1',
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

describe('DefaultCandidateSelector', () => {
  const selector = new DefaultCandidateSelector(DEFAULT_ALLOCATOR_CONFIG)

  it('returns empty when quota is 0', () => {
    const result = selector.select(makeEvent(), [makeAgent('a1')], 0, NORMAL)
    expect(result).toHaveLength(0)
  })

  it('excludes inactive agents', () => {
    const agents = [makeAgent('a1', { status: 'banned' }), makeAgent('a2', { status: 'quarantined' })]
    const result = selector.select(makeEvent(), agents, 5, NORMAL)
    expect(result).toHaveLength(0)
  })

  it('excludes the event author (self-response prevention)', () => {
    const agents = [makeAgent('agent-author')]
    const result = selector.select(makeEvent(), agents, 5, NORMAL)
    expect(result).toHaveLength(0)
  })

  it('excludes agents exceeding actions_per_hour budget', () => {
    const agents = [makeAgent('a1', { actions_last_hour: 999 })]
    const result = selector.select(makeEvent(), agents, 5, NORMAL)
    expect(result).toHaveLength(0)
  })

  it('excludes agents exceeding tokens_per_day budget', () => {
    const agents = [makeAgent('a1', { tokens_last_day: 200_000 })]
    const result = selector.select(makeEvent(), agents, 5, NORMAL)
    expect(result).toHaveLength(0)
  })

  it('excludes agents within cooldown', () => {
    const recentAction = new Date(Date.now() - 10_000).toISOString() // 10s ago
    const agents = [makeAgent('a1', { last_action_at: recentAction })]
    const result = selector.select(makeEvent(), agents, 5, NORMAL)
    expect(result).toHaveLength(0)
  })

  it('includes agents past cooldown', () => {
    const oldAction = new Date(Date.now() - 120_000).toISOString() // 2min ago
    const agents = [makeAgent('a1', { last_action_at: oldAction })]
    const result = selector.select(makeEvent(), agents, 5, NORMAL)
    expect(result).toHaveLength(1)
  })

  it('community membership boosts score (+3)', () => {
    const member = makeAgent('a1', { community_ids: ['comm-1'] })
    const nonMember = makeAgent('a2', { community_ids: ['comm-other'] })
    const result = selector.select(makeEvent(), [member, nonMember], 5, NORMAL)
    const memberScore = result.find((r) => r.agent_id === 'a1')!.score
    const nonMemberScore = result.find((r) => r.agent_id === 'a2')!.score
    expect(memberScore).toBeGreaterThan(nonMemberScore)
  })

  it('thread repeat participation penalizes score (-1)', () => {
    const event = makeEvent({ post_id: 'post-1' })
    const repeat = makeAgent('a1', { recent_thread_post_ids: ['post-1'], community_ids: ['comm-1'] })
    const fresh = makeAgent('a2', { recent_thread_post_ids: [], community_ids: ['comm-1'] })
    const result = selector.select(event, [repeat, fresh], 5, NORMAL)
    const repeatScore = result.find((r) => r.agent_id === 'a1')!.score
    const freshScore = result.find((r) => r.agent_id === 'a2')!.score
    expect(freshScore).toBeGreaterThanOrEqual(repeatScore)
  })

  it('respects quota limit (takes top-K)', () => {
    const agents = Array.from({ length: 10 }, (_, i) => makeAgent(`a${i}`))
    const result = selector.select(makeEvent(), agents, 3, NORMAL)
    expect(result).toHaveLength(3)
  })

  it('no exploration noise in critical degradation', () => {
    const agents = [makeAgent('a1', { community_ids: [] })]
    const results = Array.from({ length: 20 }, () =>
      selector.select(makeEvent(), agents, 1, CRITICAL),
    )
    const scores = results.map((r) => r[0].score)
    const allSame = scores.every((s) => s === scores[0])
    expect(allSame).toBe(true)
  })
})
