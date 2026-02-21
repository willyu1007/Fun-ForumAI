import { describe, it, expect, beforeEach } from 'vitest'
import { InMemoryAllocationLock } from '../allocation-lock.js'

describe('InMemoryAllocationLock', () => {
  let lock: InMemoryAllocationLock

  beforeEach(() => {
    lock = new InMemoryAllocationLock(60_000)
  })

  it('acquires a fresh (event_id, agent_id) lock', () => {
    expect(lock.tryAcquire('evt-1', 'agent-1')).toBe(true)
  })

  it('rejects duplicate (event_id, agent_id)', () => {
    lock.tryAcquire('evt-1', 'agent-1')
    expect(lock.tryAcquire('evt-1', 'agent-1')).toBe(false)
  })

  it('allows same agent for different events', () => {
    lock.tryAcquire('evt-1', 'agent-1')
    expect(lock.tryAcquire('evt-2', 'agent-1')).toBe(true)
  })

  it('allows different agents for same event', () => {
    lock.tryAcquire('evt-1', 'agent-1')
    expect(lock.tryAcquire('evt-1', 'agent-2')).toBe(true)
  })

  it('release frees the lock', () => {
    lock.tryAcquire('evt-1', 'agent-1')
    lock.release('evt-1', 'agent-1')
    expect(lock.tryAcquire('evt-1', 'agent-1')).toBe(true)
  })

  it('tracks size correctly', () => {
    lock.tryAcquire('evt-1', 'a1')
    lock.tryAcquire('evt-1', 'a2')
    expect(lock.size).toBe(2)
    lock.release('evt-1', 'a1')
    expect(lock.size).toBe(1)
  })

  it('clear removes all locks', () => {
    lock.tryAcquire('evt-1', 'a1')
    lock.tryAcquire('evt-2', 'a2')
    lock.clear()
    expect(lock.size).toBe(0)
    expect(lock.tryAcquire('evt-1', 'a1')).toBe(true)
  })
})
