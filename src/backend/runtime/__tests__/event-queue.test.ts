import { beforeEach, describe, expect, it } from 'vitest'
import type { EventPayload } from '../../allocator/types.js'
import { InMemoryRuntimeEventQueue, RedisStreamRuntimeEventQueue } from '../event-queue.js'

function makeEvent(id: string): EventPayload {
  return {
    event_id: id,
    event_type: 'NewPostCreated',
    idempotency_key: `idem-${id}`,
    chain_depth: 0,
    community_id: 'comm-1',
    author_agent_id: 'agent-1',
    created_at: new Date().toISOString(),
  }
}

class StubRedis {
  public streamRows: Array<[string, string[]]> = []
  public reclaimedRows: Array<[string, string[]]> = []
  public xaddCalls: Array<{ key: string, id: string, args: string[] }> = []
  public xackCalls: Array<{ key: string, group: string, id: string }> = []
  public xdelCalls: Array<{ key: string, ids: string[] }> = []
  public delCalls: string[][] = []
  public xgroupCreated = 0

  async call(command: string, ..._args: Array<string | number>): Promise<unknown> {
    if (command === 'XGROUP') {
      this.xgroupCreated += 1
      return 'OK'
    }
    if (command === 'XAUTOCLAIM') {
      const row = this.reclaimedRows.shift()
      return ['0-0', row ? [row] : [], []]
    }
    if (command === 'XREADGROUP') {
      const row = this.streamRows.shift()
      if (!row) return null
      return [['stream', [row]]]
    }
    throw new Error(`Unsupported command in test stub: ${command}`)
  }

  async xadd(key: string, id: string, ...args: string[]): Promise<string> {
    this.xaddCalls.push({ key, id, args })
    return `${Date.now()}-0`
  }

  async xlen(_key: string): Promise<number> {
    return this.streamRows.length
  }

  async xrange(_key: string, _start: string, _end: string, _countToken?: string, _count?: number): Promise<Array<[string, string[]]>> {
    return this.streamRows.length ? [this.streamRows[0]] : []
  }

  async xack(key: string, group: string, id: string): Promise<number> {
    this.xackCalls.push({ key, group, id })
    return 1
  }

  async xdel(key: string, ...ids: string[]): Promise<number> {
    this.xdelCalls.push({ key, ids })
    return ids.length
  }

  async del(...keys: string[]): Promise<number> {
    this.delCalls.push(keys)
    return keys.length
  }
}

describe('InMemoryRuntimeEventQueue', () => {
  let queue: InMemoryRuntimeEventQueue

  beforeEach(() => {
    queue = new InMemoryRuntimeEventQueue()
  })

  it('supports ack and retry semantics', async () => {
    const event = makeEvent('evt-1')
    await queue.enqueue(event)

    const first = await queue.dequeue()
    expect(first?.event.event_id).toBe('evt-1')
    await first?.retry('test')

    const second = await queue.dequeue()
    expect(second?.event.event_id).toBe('evt-1')
    await second?.ack()
    expect(await queue.size()).toBe(0)
  })
})

describe('RedisStreamRuntimeEventQueue', () => {
  let redis: StubRedis

  beforeEach(() => {
    redis = new StubRedis()
  })

  it('acknowledges and deletes consumed messages', async () => {
    redis.streamRows.push([
      '1000-1',
      ['event', JSON.stringify(makeEvent('evt-1')), 'retry_count', '0'],
    ])

    const queue = new RedisStreamRuntimeEventQueue(redis, {
      streamKey: 'runtime:events',
      deadLetterStreamKey: 'runtime:events:dlq',
      consumerGroup: 'runtime-loop',
      consumerName: 'test-consumer',
      maxRetries: 3,
      pollTimeoutMs: 1,
      visibilityTimeoutMs: 1000,
    })

    const handle = await queue.dequeue({ timeoutMs: 1 })
    expect(handle?.event.event_id).toBe('evt-1')
    await handle?.ack()

    expect(redis.xackCalls).toEqual([
      { key: 'runtime:events', group: 'runtime-loop', id: '1000-1' },
    ])
    expect(redis.xdelCalls).toEqual([
      { key: 'runtime:events', ids: ['1000-1'] },
    ])
  })

  it('re-enqueues message with incremented retry count before max retry limit', async () => {
    redis.streamRows.push([
      '1000-2',
      ['event', JSON.stringify(makeEvent('evt-2')), 'retry_count', '0'],
    ])

    const queue = new RedisStreamRuntimeEventQueue(redis, {
      streamKey: 'runtime:events',
      deadLetterStreamKey: 'runtime:events:dlq',
      consumerGroup: 'runtime-loop',
      consumerName: 'test-consumer',
      maxRetries: 3,
      pollTimeoutMs: 1,
      visibilityTimeoutMs: 1000,
    })

    const handle = await queue.dequeue({ timeoutMs: 1 })
    await handle?.retry('temporary failure')

    const requeueCall = redis.xaddCalls.find((c) => c.key === 'runtime:events')
    expect(requeueCall).toBeDefined()
    expect(requeueCall?.args).toContain('retry_count')
    expect(requeueCall?.args).toContain('1')
  })

  it('moves message to dead letter stream after retry limit', async () => {
    redis.streamRows.push([
      '1000-3',
      ['event', JSON.stringify(makeEvent('evt-3')), 'retry_count', '1'],
    ])

    const queue = new RedisStreamRuntimeEventQueue(redis, {
      streamKey: 'runtime:events',
      deadLetterStreamKey: 'runtime:events:dlq',
      consumerGroup: 'runtime-loop',
      consumerName: 'test-consumer',
      maxRetries: 1,
      pollTimeoutMs: 1,
      visibilityTimeoutMs: 1000,
    })

    const handle = await queue.dequeue({ timeoutMs: 1 })
    await handle?.retry('fatal')

    const dlqCall = redis.xaddCalls.find((c) => c.key === 'runtime:events:dlq')
    expect(dlqCall).toBeDefined()
    expect(dlqCall?.args).toContain('reason')
    expect(dlqCall?.args).toContain('fatal')
  })
})
