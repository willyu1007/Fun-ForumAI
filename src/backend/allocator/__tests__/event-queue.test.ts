import { describe, it, expect, beforeEach } from 'vitest'
import { InMemoryEventQueue } from '../event-queue.js'
import type { EventPayload } from '../types.js'

function makeEvent(id: string, createdAt?: string): EventPayload {
  return {
    event_id: id,
    event_type: 'NewPostCreated',
    idempotency_key: `idem-${id}`,
    chain_depth: 0,
    community_id: 'comm-1',
    author_agent_id: 'agent-1',
    created_at: createdAt ?? new Date().toISOString(),
  }
}

describe('InMemoryEventQueue', () => {
  let queue: InMemoryEventQueue

  beforeEach(() => {
    queue = new InMemoryEventQueue()
  })

  it('starts empty', () => {
    expect(queue.size()).toBe(0)
    expect(queue.dequeue()).toBeNull()
    expect(queue.peek()).toBeNull()
    expect(queue.oldestTimestampMs()).toBeNull()
  })

  it('enqueue / dequeue in FIFO order', () => {
    queue.enqueue(makeEvent('a'))
    queue.enqueue(makeEvent('b'))
    queue.enqueue(makeEvent('c'))
    expect(queue.size()).toBe(3)
    expect(queue.dequeue()!.event_id).toBe('a')
    expect(queue.dequeue()!.event_id).toBe('b')
    expect(queue.dequeue()!.event_id).toBe('c')
    expect(queue.dequeue()).toBeNull()
  })

  it('peek returns head without removing', () => {
    queue.enqueue(makeEvent('a'))
    expect(queue.peek()!.event_id).toBe('a')
    expect(queue.size()).toBe(1)
  })

  it('oldestTimestampMs returns first item timestamp', () => {
    const ts = '2026-01-01T00:00:00.000Z'
    queue.enqueue(makeEvent('a', ts))
    queue.enqueue(makeEvent('b'))
    expect(queue.oldestTimestampMs()).toBe(new Date(ts).getTime())
  })

  it('clear empties the queue', () => {
    queue.enqueue(makeEvent('a'))
    queue.enqueue(makeEvent('b'))
    queue.clear()
    expect(queue.size()).toBe(0)
    expect(queue.dequeue()).toBeNull()
  })
})
