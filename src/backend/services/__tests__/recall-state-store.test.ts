import { describe, expect, it } from 'vitest'
import type { RecallGrantAttemptInput } from '../recall-state-store.js'
import { RedisRecallStateStore } from '../recall-state-store.js'

describe('RedisRecallStateStore', () => {
  it('enforces pair-window caps atomically across concurrent store instances', async () => {
    const backend = new FakeRedisEvalBackend()
    const storeA = new RedisRecallStateStore(backend, { keyPrefix: 'test:recall:atomic' })
    const storeB = new RedisRecallStateStore(backend, { keyPrefix: 'test:recall:atomic' })

    const attempts = await Promise.all([
      storeA.attemptGrant(makeInput()),
      storeB.attemptGrant(makeInput()),
      storeA.attemptGrant(makeInput()),
    ])

    expect(attempts.filter((attempt) => attempt.granted)).toHaveLength(1)
    expect(attempts.filter((attempt) => !attempt.granted)).toEqual([
      expect.objectContaining({ suppression_reason: 'pair_window_cap' }),
      expect.objectContaining({ suppression_reason: 'pair_window_cap' }),
    ])
    expect(backend.scriptChecks).toBeGreaterThan(0)
  })

  it('shares revive-old-branch budgets across store instances', async () => {
    const backend = new FakeRedisEvalBackend()
    const storeA = new RedisRecallStateStore(backend, { keyPrefix: 'test:recall:revive' })
    const storeB = new RedisRecallStateStore(backend, { keyPrefix: 'test:recall:revive' })

    const first = await storeA.attemptGrant(
      makeInput({
        candidate_agent_id: 'agent-target-a',
        is_revive_branch: true,
      }),
    )
    const second = await storeB.attemptGrant(
      makeInput({
        candidate_agent_id: 'agent-target-b',
        is_revive_branch: true,
      }),
    )

    expect(first).toMatchObject({
      granted: true,
      revive_count_before: 0,
      revive_count_after: 1,
    })
    expect(second).toMatchObject({
      granted: false,
      suppression_reason: 'revive_budget_exhausted',
      revive_count_before: 1,
      revive_count_after: 1,
    })
  })

  it('expires pair-window counters after the Lua TTL elapses', async () => {
    const backend = new FakeRedisEvalBackend()
    const store = new RedisRecallStateStore(backend, { keyPrefix: 'test:recall:ttl' })

    const first = await store.attemptGrant(
      makeInput({
        pair_window_seconds: 1,
      }),
    )
    const blocked = await store.attemptGrant(
      makeInput({
        pair_window_seconds: 1,
      }),
    )

    backend.advance(1_100)

    const afterExpiry = await store.attemptGrant(
      makeInput({
        pair_window_seconds: 1,
      }),
    )

    expect(first.granted).toBe(true)
    expect(blocked.suppression_reason).toBe('pair_window_cap')
    expect(afterExpiry).toMatchObject({
      granted: true,
      pair_count_before: 0,
      pair_count_after: 1,
    })
  })
})

function makeInput(overrides: Partial<RecallGrantAttemptInput> = {}): RecallGrantAttemptInput {
  return {
    thread_id: 'thread-1',
    event_author_key: 'agent-author',
    candidate_agent_id: 'agent-target',
    pair_window_seconds: 30,
    pair_max_exchanges: 1,
    quota_kind: 'neutral',
    reactive_recall_decay: 'moderate',
    is_revive_branch: false,
    revive_old_branch_budget: 1,
    ...overrides,
  }
}

type CounterWindow = {
  count: number
  expiresAt: number
}

class FakeRedisEvalBackend {
  private readonly pairWindows = new Map<string, CounterWindow>()
  private readonly reviveWindows = new Map<string, CounterWindow>()
  private now = 0
  scriptChecks = 0

  async eval(script: string, numKeys: number, ...args: string[]): Promise<unknown> {
    this.validateLuaContract(script, numKeys, args)

    const [pairKey, reviveKey, pairMaxRaw, pairTtlMsRaw, isIncumbentRaw, decayMode, isReviveRaw, reviveBudgetRaw, reviveTtlMsRaw] = args
    const pairMax = Number(pairMaxRaw)
    const pairTtlMs = Number(pairTtlMsRaw)
    const isIncumbent = isIncumbentRaw === '1'
    const isRevive = isReviveRaw === '1'
    const reviveBudget = Number(reviveBudgetRaw)
    const reviveTtlMs = Number(reviveTtlMsRaw)

    const pairCount = this.readWindow(this.pairWindows, pairKey)
    const reviveCount = isRevive ? this.readWindow(this.reviveWindows, reviveKey) : 0
    const decayStage = resolveDecayStage(pairCount)

    if (isRevive && reviveCount >= reviveBudget) {
      return [0, pairCount, pairCount, reviveCount, reviveCount, 'revive_budget_exhausted', decayStage]
    }

    if (shouldSuppressForDecay(isIncumbent, decayMode, pairCount)) {
      return [0, pairCount, pairCount, reviveCount, reviveCount, 'reactive_recall_decay', decayStage]
    }

    if (pairCount >= pairMax) {
      return [0, pairCount, pairCount, reviveCount, reviveCount, 'pair_window_cap', decayStage]
    }

    const nextPairCount = pairCount + 1
    this.writeWindow(this.pairWindows, pairKey, nextPairCount, pairTtlMs)

    let nextReviveCount = reviveCount
    if (isRevive) {
      nextReviveCount += 1
      this.writeWindow(this.reviveWindows, reviveKey, nextReviveCount, reviveTtlMs)
    }

    return [1, pairCount, nextPairCount, reviveCount, nextReviveCount, '', decayStage]
  }

  advance(ms: number) {
    this.now += ms
  }

  private validateLuaContract(script: string, numKeys: number, args: string[]) {
    expect(numKeys).toBe(2)
    expect(args).toHaveLength(9)
    expect(script).toContain('local pairKey = KEYS[1]')
    expect(script).toContain('local reviveKey = KEYS[2]')
    expect(script).toContain('redis.call("GET", pairKey)')
    expect(script).toContain('redis.call("SET", pairKey, tostring(nextPairCount), "PX", pairTtlMs)')
    expect(script).toContain('redis.call("SET", reviveKey, tostring(nextReviveCount), "PX", reviveTtlMs)')
    this.scriptChecks += 1
  }

  private readWindow(store: Map<string, CounterWindow>, key: string): number {
    const window = store.get(key)
    if (!window || window.expiresAt <= this.now) {
      store.delete(key)
      return 0
    }
    return window.count
  }

  private writeWindow(store: Map<string, CounterWindow>, key: string, count: number, ttlMs: number) {
    store.set(key, {
      count,
      expiresAt: this.now + ttlMs,
    })
  }
}

function resolveDecayStage(pairCount: number): 'fresh' | 'repeat' | 'decayed' {
  if (pairCount === 1) return 'repeat'
  if (pairCount >= 2) return 'decayed'
  return 'fresh'
}

function shouldSuppressForDecay(isIncumbent: boolean, decayMode: string, pairCount: number) {
  if (!isIncumbent) {
    return false
  }
  if (decayMode === 'steep') {
    return pairCount >= 1
  }
  if (decayMode === 'moderate') {
    return pairCount >= 2
  }
  if (decayMode === 'light') {
    return pairCount >= 3
  }
  return false
}
