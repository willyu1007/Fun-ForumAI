import { describe, it, expect, beforeEach } from 'vitest'
import { InMemoryAgentRepository, InMemoryAgentConfigRepository } from '../agent-repository.js'

describe('InMemoryAgentRepository', () => {
  let repo: InMemoryAgentRepository

  beforeEach(() => {
    repo = new InMemoryAgentRepository()
  })

  it('creates an agent with defaults', () => {
    const a = repo.create({ owner_id: 'u1', display_name: 'Bot Alpha' })
    expect(a.id).toBeTruthy()
    expect(a.status).toBe('ACTIVE')
    expect(a.reputation_score).toBe(0)
    expect(a.model).toBe('gpt-4o')
  })

  it('findById returns the agent', () => {
    const a = repo.create({ owner_id: 'u1', display_name: 'Bot' })
    expect(repo.findById(a.id)).toEqual(a)
    expect(repo.findById('nope')).toBeNull()
  })

  it('findActive returns only ACTIVE agents', () => {
    repo.create({ owner_id: 'u1', display_name: 'Active' })
    const banned = repo.create({ owner_id: 'u1', display_name: 'Banned' })
    repo.updateStatus(banned.id, 'BANNED')

    const result = repo.findActive({ limit: 10 })
    expect(result.items).toHaveLength(1)
    expect(result.items[0].display_name).toBe('Active')
  })

  it('updateStatus changes agent status', () => {
    const a = repo.create({ owner_id: 'u1', display_name: 'Bot' })
    expect(repo.updateStatus(a.id, 'LIMITED')?.status).toBe('LIMITED')
    expect(repo.updateStatus('nope', 'BANNED')).toBeNull()
  })

  it('updateReputation adjusts score', () => {
    const a = repo.create({ owner_id: 'u1', display_name: 'Bot' })
    repo.updateReputation(a.id, 5)
    repo.updateReputation(a.id, -2)
    expect(repo.findById(a.id)?.reputation_score).toBe(3)
    expect(repo.updateReputation('nope', 1)).toBeNull()
  })
})

describe('InMemoryAgentConfigRepository', () => {
  let repo: InMemoryAgentConfigRepository

  beforeEach(() => {
    repo = new InMemoryAgentConfigRepository()
  })

  it('creates a config and retrieves the latest', () => {
    repo.create({ agent_id: 'a1', config_json: { v: 1 }, updated_by: 'admin' })
    const c2 = repo.create({ agent_id: 'a1', config_json: { v: 2 }, updated_by: 'admin' })
    const latest = repo.findLatest('a1')
    expect(latest?.id).toBe(c2.id)
    expect(latest?.config_json).toEqual({ v: 2 })
  })

  it('returns null for unknown agent', () => {
    expect(repo.findLatest('unknown')).toBeNull()
  })
})
