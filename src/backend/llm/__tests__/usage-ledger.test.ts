import { describe, expect, it } from 'vitest'
import type { UsageLedgerEntry } from '../gateway-contract.js'
import { InMemoryUsageLedgerRepository } from '../usage-ledger.js'

function makeEntry(overrides: Partial<UsageLedgerEntry> = {}): UsageLedgerEntry {
  return {
    trace_id: 'trace-1',
    agent_id: 'agent-1',
    intent: 'forum_reply',
    visibility: 'visible',
    scene: 'forum_post',
    prompt_ref: { id: 'tpl', version: 1 },
    render_decision: {
      voiceLineId: 'qwen-social-v1',
      tier: 'base',
      profileId: 'profile-1',
      providerId: 'dashscope-openai',
      modelId: 'qwen-flash-character',
      region: 'cn-beijing',
      fallbackLevel: 'none',
      reasons: ['primary'],
      promptTemplateId: 'tpl',
      promptVersion: 1,
    },
    usage: {
      prompt_tokens: 10,
      completion_tokens: 5,
      total_tokens: 15,
    },
    success: true,
    latency_ms: 100,
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

describe('InMemoryUsageLedgerRepository', () => {
  it('lists recent entries newest-first', async () => {
    const repo = new InMemoryUsageLedgerRepository()

    await repo.insert(makeEntry({ trace_id: 'older', created_at: '2026-03-09T10:00:00.000Z' }))
    await repo.insert(makeEntry({ trace_id: 'newer', created_at: '2026-03-09T10:05:00.000Z' }))

    const recent = await repo.listRecent(10)
    expect(recent.map((entry) => entry.trace_id)).toEqual(['newer', 'older'])
  })

  it('limits recent entries', async () => {
    const repo = new InMemoryUsageLedgerRepository()

    await repo.insert(makeEntry({ trace_id: 'a', created_at: '2026-03-09T10:00:00.000Z' }))
    await repo.insert(makeEntry({ trace_id: 'b', created_at: '2026-03-09T10:01:00.000Z' }))
    await repo.insert(makeEntry({ trace_id: 'c', created_at: '2026-03-09T10:02:00.000Z' }))

    const recent = await repo.listRecent(2)
    expect(recent.map((entry) => entry.trace_id)).toEqual(['c', 'b'])
  })

  it('lists entries by trace prefix newest-first', async () => {
    const repo = new InMemoryUsageLedgerRepository()

    await repo.insert(makeEntry({ trace_id: 'prefix:older', created_at: '2026-03-09T10:00:00.000Z' }))
    await repo.insert(makeEntry({ trace_id: 'prefix:newer', created_at: '2026-03-09T10:02:00.000Z' }))
    await repo.insert(makeEntry({ trace_id: 'other:trace', created_at: '2026-03-09T10:03:00.000Z' }))

    const recent = await repo.listByTracePrefix('prefix:', 10)
    expect(recent.map((entry) => entry.trace_id)).toEqual(['prefix:newer', 'prefix:older'])
  })
})
