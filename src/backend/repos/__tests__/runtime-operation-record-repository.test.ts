import { beforeEach, describe, expect, it } from 'vitest'
import {
  InMemoryRuntimeOperationRecordRepository,
  type RuntimeOperationRecordRepository,
} from '../runtime-operation-record-repository.js'
import type {
  CreateRuntimeOperationRecordInput,
  RuntimeOperationRetentionCutoffs,
} from '../types.js'

function baseInput(
  overrides: Partial<CreateRuntimeOperationRecordInput> = {},
): CreateRuntimeOperationRecordInput {
  return {
    severity: 'error',
    source: 'runtime_loop',
    operation: 'tick',
    status: 'failed',
    ...overrides,
  }
}

async function seed(
  repo: RuntimeOperationRecordRepository,
  inputs: CreateRuntimeOperationRecordInput[],
): Promise<void> {
  for (const input of inputs) {
    await repo.create(input)
  }
}

describe('InMemoryRuntimeOperationRecordRepository', () => {
  let repo: InMemoryRuntimeOperationRecordRepository

  beforeEach(() => {
    repo = new InMemoryRuntimeOperationRecordRepository()
  })

  it('creates a record with defaults and returns it via findById', async () => {
    const created = await repo.create(baseInput({ trace_id: 't1', agent_id: 'a1' }))

    expect(created.id).toBeDefined()
    expect(created.severity).toBe('error')
    expect(created.source).toBe('runtime_loop')
    expect(created.status).toBe('failed')
    expect(created.trace_id).toBe('t1')
    expect(created.agent_id).toBe('a1')
    expect(created.payload_json).toBeNull()
    expect(created.linked_risk_event_id).toBeNull()

    const fetched = await repo.findById(created.id)
    expect(fetched?.id).toBe(created.id)
  })

  it('returns null for findById when missing', async () => {
    const fetched = await repo.findById('missing')
    expect(fetched).toBeNull()
  })

  it('orders list by occurred_at desc, id desc and supports cursor pagination', async () => {
    const t1 = new Date('2026-04-25T00:00:00Z')
    const t2 = new Date('2026-04-26T00:00:00Z')
    const t3 = new Date('2026-04-27T00:00:00Z')

    await seed(repo, [
      baseInput({ id: 'r-old', occurred_at: t1, operation: 'old' }),
      baseInput({ id: 'r-mid-a', occurred_at: t2, operation: 'mid-a' }),
      baseInput({ id: 'r-mid-b', occurred_at: t2, operation: 'mid-b' }),
      baseInput({ id: 'r-new', occurred_at: t3, operation: 'new' }),
    ])

    const firstPage = await repo.list({ limit: 2 })
    expect(firstPage.map((row) => row.id)).toEqual(['r-new', 'r-mid-b'])

    const last = firstPage[firstPage.length - 1]!
    const secondPage = await repo.list({
      limit: 2,
      before: { occurred_at: last.occurred_at, id: last.id },
    })
    expect(secondPage.map((row) => row.id)).toEqual(['r-mid-a', 'r-old'])
  })

  it('filters by severity, source, status, trace, correlation, event, agent, risk-link', async () => {
    await seed(repo, [
      baseInput({ id: 'a', severity: 'warn', trace_id: 'tx' }),
      baseInput({ id: 'b', severity: 'error', source: 'agent_executor', status: 'retried' }),
      baseInput({ id: 'c', severity: 'critical', source: 'event_queue', status: 'dead_lettered', correlation_id: 'cx' }),
      baseInput({ id: 'd', event_id: 'ev1', agent_id: 'agentX', linked_risk_event_id: 'risk1' }),
    ])

    expect((await repo.list({ severity: ['warn'] })).map((r) => r.id)).toEqual(['a'])
    expect((await repo.list({ severity: ['warn', 'critical'] })).map((r) => r.id).sort()).toEqual([
      'a',
      'c',
    ])
    expect((await repo.list({ source: ['agent_executor'] })).map((r) => r.id)).toEqual(['b'])
    expect((await repo.list({ status: ['dead_lettered'] })).map((r) => r.id)).toEqual(['c'])
    expect((await repo.list({ trace_id: 'tx' })).map((r) => r.id)).toEqual(['a'])
    expect((await repo.list({ correlation_id: 'cx' })).map((r) => r.id)).toEqual(['c'])
    expect((await repo.list({ event_id: 'ev1' })).map((r) => r.id)).toEqual(['d'])
    expect((await repo.list({ agent_id: 'agentX' })).map((r) => r.id)).toEqual(['d'])
    expect((await repo.list({ linked_risk_event_id: 'risk1' })).map((r) => r.id)).toEqual(['d'])
  })

  it('filters by entity type/id', async () => {
    await seed(repo, [
      baseInput({ id: 'a', post_id: 'p1' }),
      baseInput({ id: 'b', room_id: 'r1' }),
      baseInput({ id: 'c', post_id: 'p2' }),
    ])
    const rows = await repo.list({ entity: { type: 'post', id: 'p1' } })
    expect(rows.map((r) => r.id)).toEqual(['a'])
  })

  it('filters by since/until window', async () => {
    const early = new Date('2026-04-20T00:00:00Z')
    const middle = new Date('2026-04-25T00:00:00Z')
    const late = new Date('2026-04-30T00:00:00Z')
    await seed(repo, [
      baseInput({ id: 'early', occurred_at: early }),
      baseInput({ id: 'middle', occurred_at: middle }),
      baseInput({ id: 'late', occurred_at: late }),
    ])
    const rows = await repo.list({
      since: new Date('2026-04-22T00:00:00Z'),
      until: new Date('2026-04-28T00:00:00Z'),
    })
    expect(rows.map((r) => r.id)).toEqual(['middle'])
  })

  it('deleteExpired enforces severity-specific cutoffs', async () => {
    const now = new Date('2026-04-30T00:00:00Z')
    const cutoffs: RuntimeOperationRetentionCutoffs = {
      errorCriticalBefore: new Date(now.getTime() - 90 * 86_400_000),
      warnBefore: new Date(now.getTime() - 30 * 86_400_000),
      infoBefore: new Date(now.getTime() - 7 * 86_400_000),
    }

    await seed(repo, [
      // Old error/critical: outside 90d cutoff -> delete.
      baseInput({
        id: 'old-error',
        severity: 'error',
        occurred_at: new Date(cutoffs.errorCriticalBefore.getTime() - 86_400_000),
      }),
      baseInput({
        id: 'old-critical',
        severity: 'critical',
        occurred_at: new Date(cutoffs.errorCriticalBefore.getTime() - 86_400_000),
      }),
      // Old warn: outside 30d cutoff -> delete.
      baseInput({
        id: 'old-warn',
        severity: 'warn',
        occurred_at: new Date(cutoffs.warnBefore.getTime() - 86_400_000),
      }),
      // Old info: outside 7d cutoff -> delete.
      baseInput({
        id: 'old-info',
        severity: 'info',
        status: 'succeeded',
        occurred_at: new Date(cutoffs.infoBefore.getTime() - 86_400_000),
      }),
      // Recent error within 90d: keep.
      baseInput({
        id: 'recent-error',
        severity: 'error',
        occurred_at: new Date(cutoffs.errorCriticalBefore.getTime() + 86_400_000),
      }),
      // Old error but governance-linked: keep.
      baseInput({
        id: 'governance-old-error',
        severity: 'error',
        occurred_at: new Date(cutoffs.errorCriticalBefore.getTime() - 86_400_000),
        linked_risk_event_id: 'risk-1',
      }),
    ])

    const deleted = await repo.deleteExpired(cutoffs)
    expect(deleted).toBe(4)

    const ids = (await repo.list()).map((r) => r.id).sort()
    expect(ids).toEqual(['governance-old-error', 'recent-error'])
  })
})
