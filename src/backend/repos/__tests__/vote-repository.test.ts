import { describe, it, expect, beforeEach } from 'vitest'
import { InMemoryVoteRepository } from '../vote-repository.js'

describe('InMemoryVoteRepository', () => {
  let repo: InMemoryVoteRepository

  beforeEach(() => {
    repo = new InMemoryVoteRepository()
  })

  it('creates a vote', () => {
    const v = repo.upsert({
      voter_agent_id: 'a1',
      target_type: 'POST',
      target_id: 'p1',
      direction: 'UP',
    })
    expect(v.id).toBeTruthy()
    expect(v.direction).toBe('UP')
    expect(v.weight).toBe(1)
  })

  it('upsert replaces an existing vote from the same voter on the same target', () => {
    const v1 = repo.upsert({
      voter_agent_id: 'a1',
      target_type: 'POST',
      target_id: 'p1',
      direction: 'UP',
    })
    const v2 = repo.upsert({
      voter_agent_id: 'a1',
      target_type: 'POST',
      target_id: 'p1',
      direction: 'DOWN',
    })
    expect(v2.id).toBe(v1.id)
    expect(v2.direction).toBe('DOWN')
  })

  it('different voters create separate votes', () => {
    repo.upsert({ voter_agent_id: 'a1', target_type: 'POST', target_id: 'p1', direction: 'UP' })
    repo.upsert({ voter_agent_id: 'a2', target_type: 'POST', target_id: 'p1', direction: 'DOWN' })
    const votes = repo.findByTarget('POST', 'p1')
    expect(votes).toHaveLength(2)
  })

  it('countByTarget computes score correctly', () => {
    repo.upsert({ voter_agent_id: 'a1', target_type: 'POST', target_id: 'p1', direction: 'UP' })
    repo.upsert({ voter_agent_id: 'a2', target_type: 'POST', target_id: 'p1', direction: 'UP', weight: 2 })
    repo.upsert({ voter_agent_id: 'a3', target_type: 'POST', target_id: 'p1', direction: 'DOWN' })

    const counts = repo.countByTarget('POST', 'p1')
    expect(counts.up).toBe(3)
    expect(counts.down).toBe(1)
    expect(counts.score).toBe(2)
  })

  it('NEUTRAL votes count as neither up nor down', () => {
    repo.upsert({ voter_agent_id: 'a1', target_type: 'POST', target_id: 'p1', direction: 'NEUTRAL' })
    const counts = repo.countByTarget('POST', 'p1')
    expect(counts.up).toBe(0)
    expect(counts.down).toBe(0)
    expect(counts.score).toBe(0)
  })

  it('findByVoterAndTarget returns the exact vote', () => {
    repo.upsert({ voter_agent_id: 'a1', target_type: 'POST', target_id: 'p1', direction: 'UP' })
    expect(repo.findByVoterAndTarget('a1', 'POST', 'p1')).toBeTruthy()
    expect(repo.findByVoterAndTarget('a1', 'POST', 'p2')).toBeNull()
    expect(repo.findByVoterAndTarget('a2', 'POST', 'p1')).toBeNull()
  })
})
