import { describe, expect, it } from 'vitest'
import {
  parseRuntimeCloseoutFanoutOptions,
  resolveRuntimeCloseoutCandidateIds,
} from '../admin/runtime-closeout-fanout.js'
import {
  decodeRuntimeOperationCursor,
  encodeRuntimeOperationCursor,
  parseRuntimeOperationFilters,
} from '../admin/runtime-operation-records-filters.js'

describe('admin runtime closeout fanout helpers', () => {
  it('defaults to a single agent attempt unless fanout is explicitly enabled', () => {
    expect(parseRuntimeCloseoutFanoutOptions({})).toEqual({
      allowAgentFanout: false,
      maxAgentAttempts: 1,
    })
    expect(parseRuntimeCloseoutFanoutOptions({ max_agent_attempts: 3 })).toEqual({
      allowAgentFanout: false,
      maxAgentAttempts: 1,
    })
  })

  it('enables bounded agent fanout only when explicitly requested', () => {
    expect(parseRuntimeCloseoutFanoutOptions({
      allow_agent_fanout: true,
      max_agent_attempts: 3,
    })).toEqual({
      allowAgentFanout: true,
      maxAgentAttempts: 3,
    })
    expect(parseRuntimeCloseoutFanoutOptions({
      allow_agent_fanout: true,
      max_agent_attempts: '99',
    })).toEqual({
      allowAgentFanout: true,
      maxAgentAttempts: 5,
    })
    expect(parseRuntimeCloseoutFanoutOptions({
      allow_agent_fanout: true,
      max_agent_attempts: 0,
    })).toEqual({
      allowAgentFanout: true,
      maxAgentAttempts: 1,
    })
  })

  it('limits candidate ids to the requested max attempts', () => {
    const ids = resolveRuntimeCloseoutCandidateIds({
      agentId: '',
      activeAgentIds: ['agent-a', 'agent-b', 'agent-c'],
      options: {
        allowAgentFanout: true,
        maxAgentAttempts: 2,
      },
    })

    expect(ids).toEqual(['agent-a', 'agent-b'])
  })

  it('bypasses active-agent discovery when agent_id is provided', () => {
    const ids = resolveRuntimeCloseoutCandidateIds({
      agentId: 'agent-fixed',
      activeAgentIds: ['agent-a', 'agent-b'],
      options: {
        allowAgentFanout: true,
        maxAgentAttempts: 5,
      },
    })

    expect(ids).toEqual(['agent-fixed'])
  })
})

// T-301 admin runtime operation records helpers
describe('parseRuntimeOperationFilters', () => {
  it('parses comma-separated severity / source / status into typed arrays', () => {
    const { filters, validationErrors } = parseRuntimeOperationFilters({
      severity: 'warn,error',
      source: 'runtime_loop,agent_executor',
      status: 'failed,retried',
    })
    expect(validationErrors).toEqual([])
    expect(filters.severity).toEqual(['warn', 'error'])
    expect(filters.source).toEqual(['runtime_loop', 'agent_executor'])
    expect(filters.status).toEqual(['failed', 'retried'])
  })

  it('rejects unknown severity / source / status values without crashing', () => {
    const { filters, validationErrors } = parseRuntimeOperationFilters({
      severity: 'fatal',
      source: 'unknown_source',
      status: 'flagged',
    })
    expect(validationErrors.map((e) => e.path).sort()).toEqual(['severity', 'source', 'status'])
    expect(filters.severity).toBeUndefined()
    expect(filters.source).toBeUndefined()
    expect(filters.status).toBeUndefined()
  })

  it('parses entity filter only when both entity_type and entity_id are present', () => {
    expect(
      parseRuntimeOperationFilters({ entity_type: 'post', entity_id: 'p1' }).filters.entity,
    ).toEqual({ type: 'post', id: 'p1' })
    expect(
      parseRuntimeOperationFilters({ entity_type: 'post' }).validationErrors,
    ).toContainEqual({ path: 'entity_type', message: 'entity_type and entity_id must both be provided' })
    expect(
      parseRuntimeOperationFilters({ entity_type: 'unknown', entity_id: 'x' }).validationErrors[0]?.path,
    ).toBe('entity_type')
  })

  it('caps limit at 100 and rejects non-positive values', () => {
    expect(parseRuntimeOperationFilters({ limit: '500' }).filters.limit).toBe(100)
    expect(parseRuntimeOperationFilters({ limit: '20' }).filters.limit).toBe(20)
    const errs = parseRuntimeOperationFilters({ limit: '0' }).validationErrors
    expect(errs[0]?.path).toBe('limit')
  })

  it('parses since/until ISO timestamps', () => {
    const { filters, validationErrors } = parseRuntimeOperationFilters({
      since: '2026-04-25T00:00:00Z',
      until: '2026-04-26T00:00:00Z',
    })
    expect(validationErrors).toEqual([])
    expect(filters.since?.toISOString()).toBe('2026-04-25T00:00:00.000Z')
    expect(filters.until?.toISOString()).toBe('2026-04-26T00:00:00.000Z')
  })

  it('rejects invalid since/until timestamps', () => {
    const errs = parseRuntimeOperationFilters({ since: 'not-a-date' }).validationErrors
    expect(errs[0]?.path).toBe('since')
  })
})

describe('runtime operation cursor helpers', () => {
  it('round-trips an occurred_at + id pair through base64url', () => {
    const at = new Date('2026-04-27T12:34:56.789Z')
    const cursor = encodeRuntimeOperationCursor({ occurred_at: at, id: 'rec-1' })
    const decoded = decodeRuntimeOperationCursor(cursor)
    expect(decoded).not.toBeNull()
    expect(decoded!.occurred_at.toISOString()).toBe('2026-04-27T12:34:56.789Z')
    expect(decoded!.id).toBe('rec-1')
  })

  it('returns null for malformed cursors', () => {
    expect(decodeRuntimeOperationCursor('not-base64!!')).toBeNull()
    expect(decodeRuntimeOperationCursor(Buffer.from('garbage').toString('base64url'))).toBeNull()
    expect(
      decodeRuntimeOperationCursor(Buffer.from(JSON.stringify({ at: 'bad', id: 'x' })).toString('base64url')),
    ).toBeNull()
  })

  it('exposes the parsed cursor through parseRuntimeOperationFilters', () => {
    const cursor = encodeRuntimeOperationCursor({ occurred_at: new Date('2026-04-27T00:00:00Z'), id: 'rec-1' })
    const { filters, validationErrors } = parseRuntimeOperationFilters({ cursor })
    expect(validationErrors).toEqual([])
    expect(filters.before).toBeDefined()
    expect(filters.before!.id).toBe('rec-1')
  })
})
