import { describe, expect, it } from 'vitest'
import { InMemoryLeaderElector, RedisLeaderElector } from '../leader-elector.js'

class StubRedis {
  public setResponses: Array<'OK' | null> = []
  public evalResponses: number[] = []
  public setCalls: Array<{ key: string, value: string, mode: string, px: number, nx: string }> = []
  public evalCalls: Array<{ script: string, numberOfKeys: number, args: string[] }> = []

  async set(key: string, value: string, mode: string, px: number, nx: string): Promise<'OK' | null> {
    this.setCalls.push({ key, value, mode, px, nx })
    return this.setResponses.shift() ?? null
  }

  async eval(script: string, numberOfKeys: number, ...args: string[]): Promise<number> {
    this.evalCalls.push({ script, numberOfKeys, args })
    return this.evalResponses.shift() ?? 0
  }
}

describe('InMemoryLeaderElector', () => {
  it('is always leader', async () => {
    const elector = new InMemoryLeaderElector()
    expect(await elector.ensureLeadership()).toBe(true)
    expect(elector.isLeader).toBe(true)
  })
})

describe('RedisLeaderElector', () => {
  it('acquires lease and renews it when already leader', async () => {
    const redis = new StubRedis()
    redis.setResponses.push('OK')
    redis.evalResponses.push(1)

    const elector = new RedisLeaderElector(redis, {
      key: 'runtime:leader',
      ttlMs: 5000,
      token: 'token-1',
    })

    expect(await elector.ensureLeadership()).toBe(true)
    expect(elector.isLeader).toBe(true)

    expect(await elector.ensureLeadership()).toBe(true)
    expect(redis.setCalls).toHaveLength(1)
    expect(redis.evalCalls).toHaveLength(1)
  })

  it('marks leadership lost when renew fails', async () => {
    const redis = new StubRedis()
    redis.setResponses.push('OK')
    redis.evalResponses.push(0)

    const elector = new RedisLeaderElector(redis, {
      key: 'runtime:leader',
      ttlMs: 5000,
      token: 'token-1',
    })

    expect(await elector.ensureLeadership()).toBe(true)
    expect(await elector.ensureLeadership()).toBe(false)
    expect(elector.isLeader).toBe(false)
  })

  it('releases lease only when current instance is leader', async () => {
    const redis = new StubRedis()
    redis.setResponses.push('OK')
    redis.evalResponses.push(1)

    const elector = new RedisLeaderElector(redis, {
      key: 'runtime:leader',
      ttlMs: 5000,
      token: 'token-1',
    })

    await elector.ensureLeadership()
    await elector.releaseLeadership()

    expect(redis.evalCalls).toHaveLength(1)
    expect(elector.isLeader).toBe(false)
  })
})
