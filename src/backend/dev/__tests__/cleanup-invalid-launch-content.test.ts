import { describe, expect, it, vi } from 'vitest'
import {
  ACHIEVEMENT_INVALID_PROVENANCE_SQL,
  CHRONICLE_INVALID_PROVENANCE_SQL,
  parseCleanupArgs,
  resolveCleanupCutoff,
  SIGNAL_LOG_INVALID_PROVENANCE_SQL,
} from '../cleanup-invalid-launch-content.js'

describe('cleanup-invalid-launch-content CLI helpers', () => {
  it('defaults to dry-run with derived invalidation enabled', () => {
    const opts = parseCleanupArgs([])

    expect(opts.apply).toBe(false)
    expect(opts.since).toBeNull()
    expect(opts.sampleLimit).toBe(20)
    expect(opts.skipDerived).toBe(false)
    expect(opts.auditDir).toContain('.ai/.tmp/launch-invalid-content-cleanup')
  })

  it('parses apply mode and explicit cutoff', () => {
    const opts = parseCleanupArgs([
      '--',
      '--apply',
      '--since',
      '2026-04-28T00:00:00.000Z',
      '--sample-limit=5',
      '--skip-derived',
    ])

    expect(opts.apply).toBe(true)
    expect(opts.since?.toISOString()).toBe('2026-04-28T00:00:00.000Z')
    expect(opts.sampleLimit).toBe(5)
    expect(opts.skipDerived).toBe(true)
  })

  it('rejects ambiguous apply and dry-run mode flags', () => {
    expect(() => parseCleanupArgs(['--apply', '--dry-run'])).toThrow(/choose exactly one/)
  })

  it('uses active kickoff activated_at when no explicit cutoff is provided', async () => {
    const query = vi.fn(async () => [
      {
        id: 'suite-1',
        activated_at: new Date('2026-04-20T12:00:00.000Z'),
      },
    ])

    const cutoff = await resolveCleanupCutoff({ $queryRawUnsafe: query } as never, null)

    expect(cutoff).toEqual({
      value: new Date('2026-04-20T12:00:00.000Z'),
      source: 'active_kickoff',
      kickoff_baseline_id: 'suite-1',
    })
    const firstCall = query.mock.calls.at(0) as unknown[] | undefined
    expect(String(firstCall?.[0] ?? '')).toContain('FROM warmup_suites')
  })

  it('fails closed when neither active kickoff nor --since exists', async () => {
    const query = vi.fn(async () => [])

    await expect(resolveCleanupCutoff({ $queryRawUnsafe: query } as never, null))
      .rejects
      .toThrow(/pass --since/)
  })

  it('keeps deletion predicates provenance-based and leaves keyword matching to suspect reporting', () => {
    const deletePredicates = [
      CHRONICLE_INVALID_PROVENANCE_SQL,
      ACHIEVEMENT_INVALID_PROVENANCE_SQL,
      SIGNAL_LOG_INVALID_PROVENANCE_SQL,
    ].join('\n')

    expect(deletePredicates).toContain('entry_source')
    expect(deletePredicates).toContain('dedup_key')
    expect(deletePredicates).toContain('batch_daily')
    expect(deletePredicates).not.toMatch(/mock|fixed|lazy|placeholder/)
  })
})
