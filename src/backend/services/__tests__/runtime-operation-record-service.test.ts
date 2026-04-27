import { describe, expect, it, vi } from 'vitest'
import { InMemoryRuntimeOperationRecordRepository } from '../../repos/runtime-operation-record-repository.js'
import {
  RuntimeOperationRecordService,
  computeRetentionCutoffs,
  isSensitiveKey,
  sanitizePayload,
  truncateString,
} from '../runtime-operation-record-service.js'

function makeService(opts: {
  enabled?: boolean
  now?: Date
  repo?: InMemoryRuntimeOperationRecordRepository
} = {}): {
  service: RuntimeOperationRecordService
  repo: InMemoryRuntimeOperationRecordRepository
} {
  const repo = opts.repo ?? new InMemoryRuntimeOperationRecordRepository()
  const service = new RuntimeOperationRecordService({
    repo,
    isWriteEnabled: () => opts.enabled ?? true,
    now: opts.now ? () => opts.now! : undefined,
  })
  return { service, repo }
}

describe('RuntimeOperationRecordService.record', () => {
  it('persists when write flag is enabled and returns the row', async () => {
    const { service, repo } = makeService()
    const record = await service.record({
      severity: 'error',
      source: 'agent_executor',
      operation: 'execute',
      status: 'failed',
      error_code: 'parse_failed',
      error_message_redacted: 'parse failed: scene block missing',
    })
    expect(record).not.toBeNull()
    const fetched = await repo.findById(record!.id)
    expect(fetched?.error_code).toBe('parse_failed')
  })

  it('returns null without persisting when write flag is disabled', async () => {
    const { service, repo } = makeService({ enabled: false })
    const result = await service.record({
      severity: 'error',
      source: 'runtime_loop',
      operation: 'tick',
      status: 'failed',
    })
    expect(result).toBeNull()
    expect(await repo.list()).toEqual([])
  })

  it('swallows persistence errors and returns null without throwing', async () => {
    const failingRepo = {
      create: vi.fn().mockRejectedValue(new Error('db down')),
      findById: vi.fn(),
      list: vi.fn(),
      deleteExpired: vi.fn(),
    }
    const service = new RuntimeOperationRecordService({
      repo: failingRepo as never,
      isWriteEnabled: () => true,
    })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = await service.record({
      severity: 'critical',
      source: 'event_queue',
      operation: 'enqueue',
      status: 'failed',
    })
    expect(result).toBeNull()
    expect(warn).toHaveBeenCalledOnce()
    warn.mockRestore()
  })

  it('redacts sensitive keys and truncates long strings in payload', async () => {
    const { service, repo } = makeService()
    const longValue = 'x'.repeat(2000)
    const record = await service.record({
      severity: 'error',
      source: 'llm_gateway',
      operation: 'invoke',
      status: 'failed',
      payload_json: {
        provider: 'openai',
        api_key: 'sk-secret',
        access_key: 'sensitive',
        nested: { password: 'p', notes: longValue },
        prompt_text: 'should be redacted',
      },
    })
    const stored = await repo.findById(record!.id)
    const payload = stored!.payload_json as Record<string, unknown>
    expect(payload.api_key).toBe('[redacted]')
    expect(payload.access_key).toBe('[redacted]')
    expect((payload.nested as Record<string, unknown>).password).toBe('[redacted]')
    expect((payload.nested as Record<string, unknown>).notes).toMatch(/x{1023}…$/)
    expect(payload.prompt_text).toBe('[redacted]')
    expect(payload.provider).toBe('openai')
    expect((payload._redaction as Record<string, unknown>).redacted_keys).toBeGreaterThanOrEqual(3)
    expect((payload._redaction as Record<string, unknown>).truncated_strings).toBeGreaterThanOrEqual(1)
  })

  it('caps overall payload size and marks truncation flag', async () => {
    const huge: Record<string, string> = {}
    for (let i = 0; i < 200; i += 1) {
      huge[`field_${i}`] = 'a'.repeat(500)
    }
    const result = sanitizePayload(huge)
    expect(result.meta.payload_truncated).toBe(true)
  })

  it('truncates the operation field', async () => {
    const { service, repo } = makeService()
    const record = await service.record({
      severity: 'warn',
      source: 'system',
      operation: 'op-' + 'x'.repeat(400),
      status: 'failed',
    })
    expect(record!.operation.length).toBeLessThanOrEqual(256)
    const fetched = await repo.findById(record!.id)
    expect(fetched!.operation.length).toBeLessThanOrEqual(256)
  })

  it('redacts secret-like values from freeform error messages before persistence', async () => {
    const { service, repo } = makeService()
    const record = await service.record({
      severity: 'error',
      source: 'llm_gateway',
      operation: 'invoke',
      status: 'failed',
      error_message_redacted:
        'provider failed Authorization: Bearer abc.def.ghi api_key=sk-secret-token postgres://user:pass@localhost/db raw_prompt: hello',
    })

    const fetched = await repo.findById(record!.id)
    expect(fetched!.error_message_redacted).not.toContain('abc.def.ghi')
    expect(fetched!.error_message_redacted).not.toContain('sk-secret-token')
    expect(fetched!.error_message_redacted).not.toContain('user:pass')
    expect(fetched!.error_message_redacted).not.toContain('hello')
    expect(fetched!.error_message_redacted).toContain('[redacted]')
  })
})

describe('RuntimeOperationRecordService.cleanupExpired', () => {
  it('deletes rows past their severity cutoff and skips governance-linked rows', async () => {
    const fixedNow = new Date('2026-04-30T00:00:00Z')
    const { service, repo } = makeService({ now: fixedNow })
    const cutoffs = computeRetentionCutoffs(fixedNow)

    await repo.create({
      id: 'old-error',
      severity: 'error',
      source: 'system',
      operation: 'old',
      status: 'failed',
      occurred_at: new Date(cutoffs.errorCriticalBefore.getTime() - 86_400_000),
    })
    await repo.create({
      id: 'old-warn',
      severity: 'warn',
      source: 'system',
      operation: 'old',
      status: 'failed',
      occurred_at: new Date(cutoffs.warnBefore.getTime() - 86_400_000),
    })
    await repo.create({
      id: 'recent-error',
      severity: 'error',
      source: 'system',
      operation: 'recent',
      status: 'failed',
      occurred_at: new Date(cutoffs.errorCriticalBefore.getTime() + 86_400_000),
    })
    await repo.create({
      id: 'governance-old-error',
      severity: 'error',
      source: 'system',
      operation: 'old-gov',
      status: 'failed',
      occurred_at: new Date(cutoffs.errorCriticalBefore.getTime() - 86_400_000),
      linked_risk_event_id: 'risk-1',
    })

    const deleted = await service.cleanupExpired()
    expect(deleted).toBe(2)
    expect((await repo.list()).map((r) => r.id).sort()).toEqual([
      'governance-old-error',
      'recent-error',
    ])
  })
})

describe('helpers', () => {
  it('isSensitiveKey matches common secret-like patterns', () => {
    expect(isSensitiveKey('api_key')).toBe(true)
    expect(isSensitiveKey('apiKey')).toBe(true)
    expect(isSensitiveKey('rawPrompt')).toBe(true)
    expect(isSensitiveKey('private_message')).toBe(true)
    expect(isSensitiveKey('cookie')).toBe(true)
    expect(isSensitiveKey('Authorization')).toBe(true)
    expect(isSensitiveKey('agent_id')).toBe(false)
    expect(isSensitiveKey('latency_ms')).toBe(false)
  })

  it('truncateString respects its limit', () => {
    expect(truncateString('hello').length).toBe(5)
    expect(truncateString('a'.repeat(2000)).endsWith('…')).toBe(true)
    expect(truncateString('a'.repeat(2000)).length).toBeLessThanOrEqual(1024)
  })

  it('computeRetentionCutoffs returns 90/30/7-day windows', () => {
    const now = new Date('2026-04-30T00:00:00Z')
    const cutoffs = computeRetentionCutoffs(now)
    const dayMs = 86_400_000
    expect(now.getTime() - cutoffs.errorCriticalBefore.getTime()).toBe(90 * dayMs)
    expect(now.getTime() - cutoffs.warnBefore.getTime()).toBe(30 * dayMs)
    expect(now.getTime() - cutoffs.infoBefore.getTime()).toBe(7 * dayMs)
  })
})
