import { describe, it, expect, beforeEach } from 'vitest'
import { InMemoryEventRepository, InMemoryAgentRunRepository } from '../event-repository.js'

describe('InMemoryEventRepository', () => {
  let repo: InMemoryEventRepository

  beforeEach(() => {
    repo = new InMemoryEventRepository()
  })

  it('creates an event', () => {
    const e = repo.create({ event_type: 'POST_CREATED', payload_json: { id: 'p1' } })
    expect(e.id).toBeTruthy()
    expect(e.event_type).toBe('POST_CREATED')
  })

  it('findById returns the event', () => {
    const e = repo.create({ event_type: 'TEST', payload_json: {} })
    expect(repo.findById(e.id)).toEqual(e)
    expect(repo.findById('nope')).toBeNull()
  })

  it('idempotency key prevents duplicate creation', () => {
    const e1 = repo.create({
      event_type: 'TEST',
      payload_json: { v: 1 },
      idempotency_key: 'key-1',
    })
    const e2 = repo.create({
      event_type: 'TEST',
      payload_json: { v: 2 },
      idempotency_key: 'key-1',
    })
    expect(e2.id).toBe(e1.id)
    expect(e2.payload_json).toEqual({ v: 1 })
  })

  it('findByIdempotencyKey returns the event', () => {
    repo.create({ event_type: 'TEST', payload_json: {}, idempotency_key: 'k1' })
    expect(repo.findByIdempotencyKey('k1')).toBeTruthy()
    expect(repo.findByIdempotencyKey('k2')).toBeNull()
  })
})

describe('InMemoryAgentRunRepository', () => {
  let repo: InMemoryAgentRunRepository

  beforeEach(() => {
    repo = new InMemoryAgentRunRepository()
  })

  it('creates a run', () => {
    const r = repo.create({
      agent_id: 'a1',
      trigger_event_id: 'e1',
      input_digest: 'sha256:abc',
    })
    expect(r.id).toBeTruthy()
    expect(r.token_cost).toBe(0)
    expect(r.moderation_result).toBeNull()
  })

  it('findByAgent returns runs for the agent', () => {
    repo.create({ agent_id: 'a1', trigger_event_id: 'e1', input_digest: 'd1' })
    repo.create({ agent_id: 'a2', trigger_event_id: 'e2', input_digest: 'd2' })
    repo.create({ agent_id: 'a1', trigger_event_id: 'e3', input_digest: 'd3' })

    const result = repo.findByAgent('a1', { limit: 10 })
    expect(result.items).toHaveLength(2)
  })

  it('findByEvent returns all runs for the event', () => {
    repo.create({ agent_id: 'a1', trigger_event_id: 'e1', input_digest: 'd1' })
    repo.create({ agent_id: 'a2', trigger_event_id: 'e1', input_digest: 'd2' })

    const runs = repo.findByEvent('e1')
    expect(runs).toHaveLength(2)
  })

  it('findByAgent paginates', () => {
    for (let i = 0; i < 5; i++) {
      repo.create({ agent_id: 'a1', trigger_event_id: `e${i}`, input_digest: `d${i}` })
    }
    const page1 = repo.findByAgent('a1', { limit: 2 })
    expect(page1.items).toHaveLength(2)
    expect(page1.next_cursor).toBeTruthy()
  })
})
