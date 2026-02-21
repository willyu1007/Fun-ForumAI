import { describe, it, expect, beforeEach } from 'vitest'
import { InMemoryAdmissionGate } from '../admission.js'
import { DEFAULT_ALLOCATOR_CONFIG } from '../config.js'
import type { EventPayload } from '../types.js'

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

describe('InMemoryAdmissionGate', () => {
  let gate: InMemoryAdmissionGate

  beforeEach(() => {
    gate = new InMemoryAdmissionGate(DEFAULT_ALLOCATOR_CONFIG)
  })

  it('admits a valid event', () => {
    const v = gate.check(makeEvent())
    expect(v.admitted).toBe(true)
  })

  it('rejects missing event_id', () => {
    const v = gate.check(makeEvent({ event_id: '' }))
    expect(v.admitted).toBe(false)
    if (!v.admitted) expect(v.reason).toMatch(/event_id/)
  })

  it('rejects unknown event_type', () => {
    const v = gate.check(makeEvent({ event_type: 'BadType' as never }))
    expect(v.admitted).toBe(false)
    if (!v.admitted) expect(v.reason).toMatch(/event_type/)
  })

  it('rejects missing idempotency_key', () => {
    const v = gate.check(makeEvent({ idempotency_key: '' }))
    expect(v.admitted).toBe(false)
    if (!v.admitted) expect(v.reason).toMatch(/idempotency_key/)
  })

  it('rejects missing community_id', () => {
    const v = gate.check(makeEvent({ community_id: '' }))
    expect(v.admitted).toBe(false)
  })

  it('rejects missing author_agent_id', () => {
    const v = gate.check(makeEvent({ author_agent_id: '' }))
    expect(v.admitted).toBe(false)
  })

  it('rejects chain_depth exceeding max (default 5)', () => {
    const v = gate.check(makeEvent({ chain_depth: 6 }))
    expect(v.admitted).toBe(false)
    if (!v.admitted) expect(v.reason).toMatch(/chain_depth/)
  })

  it('admits chain_depth exactly at max', () => {
    const v = gate.check(makeEvent({ chain_depth: 5 }))
    expect(v.admitted).toBe(true)
  })

  it('rejects duplicate idempotency_key after markSeen', () => {
    const event = makeEvent()
    expect(gate.check(event).admitted).toBe(true)
    gate.markSeen(event.idempotency_key)
    const v = gate.check(event)
    expect(v.admitted).toBe(false)
    if (!v.admitted) expect(v.reason).toMatch(/duplicate/)
  })

  it('allows different idempotency_keys', () => {
    gate.markSeen('key-a')
    const v = gate.check(makeEvent({ idempotency_key: 'key-b' }))
    expect(v.admitted).toBe(true)
  })
})
