import { describe, it, expect } from 'vitest'
import { deriveFollowUpEvents } from '../chain-propagation.js'
import type { AllocationResult, EventPayload } from '../types.js'

function makeEvent(overrides: Partial<EventPayload> = {}): EventPayload {
  return {
    event_id: 'evt-root',
    event_type: 'NewPostCreated',
    idempotency_key: 'idem-root',
    chain_depth: 0,
    community_id: 'comm-1',
    post_id: 'post-1',
    author_agent_id: 'agent-author',
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

function makeAllocation(agents: string[]): AllocationResult {
  return {
    event_id: 'evt-root',
    quota_applied: agents.length,
    degradation_level: 'normal',
    agents: agents.map((id, i) => ({ agent_id: id, score: 5 - i, priority: i + 1 })),
    skipped_reasons: {},
  }
}

describe('deriveFollowUpEvents', () => {
  it('generates one follow-up per allocated agent', () => {
    const event = makeEvent()
    const allocation = makeAllocation(['a1', 'a2', 'a3'])
    const followUps = deriveFollowUpEvents(event, allocation)
    expect(followUps).toHaveLength(3)
  })

  it('increments chain_depth by 1', () => {
    const event = makeEvent({ chain_depth: 2 })
    const allocation = makeAllocation(['a1'])
    const followUps = deriveFollowUpEvents(event, allocation)
    expect(followUps[0].chain_depth).toBe(3)
  })

  it('sets author_agent_id to the allocated agent', () => {
    const event = makeEvent()
    const allocation = makeAllocation(['a1', 'a2'])
    const followUps = deriveFollowUpEvents(event, allocation)
    expect(followUps[0].author_agent_id).toBe('a1')
    expect(followUps[1].author_agent_id).toBe('a2')
  })

  it('preserves community_id and post_id', () => {
    const event = makeEvent({ community_id: 'c-x', post_id: 'p-y' })
    const allocation = makeAllocation(['a1'])
    const followUps = deriveFollowUpEvents(event, allocation)
    expect(followUps[0].community_id).toBe('c-x')
    expect(followUps[0].post_id).toBe('p-y')
  })

  it('defaults follow-up type to NewCommentCreated', () => {
    const followUps = deriveFollowUpEvents(makeEvent(), makeAllocation(['a1']))
    expect(followUps[0].event_type).toBe('NewCommentCreated')
  })

  it('allows custom follow-up event type', () => {
    const followUps = deriveFollowUpEvents(makeEvent(), makeAllocation(['a1']), {
      followUpEventType: 'NewPostCreated',
    })
    expect(followUps[0].event_type).toBe('NewPostCreated')
  })

  it('generates unique idempotency_keys per agent', () => {
    const allocation = makeAllocation(['a1', 'a2', 'a3'])
    const followUps = deriveFollowUpEvents(makeEvent(), allocation)
    const keys = followUps.map((f) => f.idempotency_key)
    expect(new Set(keys).size).toBe(3)
  })

  it('returns empty array when no agents allocated', () => {
    const followUps = deriveFollowUpEvents(makeEvent(), makeAllocation([]))
    expect(followUps).toHaveLength(0)
  })
})
