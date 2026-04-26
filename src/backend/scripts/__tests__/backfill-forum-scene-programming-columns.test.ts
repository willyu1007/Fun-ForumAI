import { describe, expect, it, vi } from 'vitest'
import {
  backfillForumSceneProgrammingColumns,
  decideBackfill,
  type BackfillDriver,
  type BackfillRow,
} from '../backfill-forum-scene-programming-columns.js'

function buildRow(overrides: Partial<BackfillRow> = {}): BackfillRow {
  return {
    id: 'row-1',
    payload_json: {
      programming: {
        production_path: 'cue',
        cue: {
          cue_id: 'cue-1',
          attempt_id: 'attempt-1',
          schedule_id: 'sched-1',
          source_type: 'manual',
        },
      },
    },
    programming_production_path: null,
    programming_cue_id: null,
    programming_attempt_id: null,
    programming_schedule_id: null,
    programming_source_type: null,
    ...overrides,
  }
}

describe('decideBackfill', () => {
  it('apply: extracts cue refs from payload_json.programming', () => {
    const decision = decideBackfill(buildRow())
    expect(decision.kind).toBe('apply')
    if (decision.kind === 'apply') {
      expect(decision.patch.programming_production_path).toBe('cue')
      expect(decision.patch.programming_cue_id).toBe('cue-1')
      expect(decision.patch.programming_attempt_id).toBe('attempt-1')
      expect(decision.patch.programming_schedule_id).toBe('sched-1')
      expect(decision.patch.programming_source_type).toBe('manual')
    }
  })

  it('apply: autonomous production_path → cue refs all null', () => {
    const decision = decideBackfill(buildRow({
      payload_json: { programming: { production_path: 'autonomous' } },
    }))
    expect(decision.kind).toBe('apply')
    if (decision.kind === 'apply') {
      expect(decision.patch.programming_production_path).toBe('autonomous')
      expect(decision.patch.programming_cue_id).toBeNull()
      expect(decision.patch.programming_attempt_id).toBeNull()
      expect(decision.patch.programming_schedule_id).toBeNull()
      expect(decision.patch.programming_source_type).toBeNull()
    }
  })

  it('skip_already_backfilled: any promoted column non-null short-circuits', () => {
    expect(decideBackfill(buildRow({ programming_cue_id: 'pre-existing' })).kind).toBe('skip_already_backfilled')
    expect(decideBackfill(buildRow({ programming_production_path: 'cue' })).kind).toBe('skip_already_backfilled')
    expect(decideBackfill(buildRow({ programming_source_type: 'manual' })).kind).toBe('skip_already_backfilled')
  })

  it('skip_no_programming: payload missing programming block', () => {
    expect(decideBackfill(buildRow({ payload_json: {} })).kind).toBe('skip_no_programming')
    expect(decideBackfill(buildRow({ payload_json: null })).kind).toBe('skip_no_programming')
  })

  it('skip_no_programming: malformed programming block (production_path missing/invalid)', () => {
    expect(
      decideBackfill(buildRow({ payload_json: { programming: { production_path: 'invalid' } } })).kind,
    ).toBe('skip_no_programming')
    expect(
      decideBackfill(buildRow({ payload_json: { programming: {} } })).kind,
    ).toBe('skip_no_programming')
  })
})

describe('backfillForumSceneProgrammingColumns — driver loop', () => {
  function buildDriver(rows: BackfillRow[]): BackfillDriver {
    const updated = new Map<string, unknown>()
    return {
      async listBatch({ afterId, limit }) {
        const startIdx = afterId
          ? rows.findIndex((r) => r.id === afterId) + 1
          : 0
        return rows.slice(startIdx, startIdx + limit)
      },
      async updateRow(id, patch) {
        updated.set(id, patch)
        const row = rows.find((r) => r.id === id)
        if (row) {
          row.programming_production_path = patch.programming_production_path
          row.programming_cue_id = patch.programming_cue_id
          row.programming_attempt_id = patch.programming_attempt_id
          row.programming_schedule_id = patch.programming_schedule_id
          row.programming_source_type = patch.programming_source_type
        }
        return true
      },
    }
  }

  it('updates cue rows, skips backfilled and missing-programming rows', async () => {
    const rows: BackfillRow[] = [
      buildRow({ id: 'r1' }), // apply
      buildRow({ id: 'r2', programming_cue_id: 'pre' }), // already backfilled
      buildRow({ id: 'r3', payload_json: {} }), // no programming
      buildRow({
        id: 'r4',
        payload_json: { programming: { production_path: 'autonomous' } },
      }), // autonomous apply
    ]
    const driver = buildDriver(rows)
    const result = await backfillForumSceneProgrammingColumns({ driver, batchLimit: 2 })
    expect(result.scanned).toBe(4)
    expect(result.updated).toBe(2)
    expect(result.skippedAlreadyBackfilled).toBe(1)
    expect(result.skippedNoProgramming).toBe(1)
    expect(result.failures).toBe(0)
  })

  it('idempotent: re-run produces no further updates', async () => {
    const rows: BackfillRow[] = [buildRow({ id: 'r1' })]
    const driver = buildDriver(rows)
    const first = await backfillForumSceneProgrammingColumns({ driver })
    expect(first.updated).toBe(1)
    const second = await backfillForumSceneProgrammingColumns({ driver })
    expect(second.updated).toBe(0)
    expect(second.skippedAlreadyBackfilled).toBe(1)
  })

  it('dryRun does not call updateRow', async () => {
    const rows: BackfillRow[] = [buildRow({ id: 'r1' }), buildRow({ id: 'r2' })]
    const driver = buildDriver(rows)
    const updateSpy = vi.spyOn(driver, 'updateRow')
    const result = await backfillForumSceneProgrammingColumns({ driver, dryRun: true })
    expect(result.updated).toBe(2)
    expect(updateSpy).not.toHaveBeenCalled()
  })

  it('isolates row failures via onError', async () => {
    const rows: BackfillRow[] = [buildRow({ id: 'r1' }), buildRow({ id: 'r2' })]
    const driver: BackfillDriver = {
      async listBatch({ afterId, limit }) {
        const startIdx = afterId ? rows.findIndex((r) => r.id === afterId) + 1 : 0
        return rows.slice(startIdx, startIdx + limit)
      },
      async updateRow(id) {
        if (id === 'r1') throw new Error('row r1 boom')
        return true
      },
    }
    const onError = vi.fn()
    const result = await backfillForumSceneProgrammingColumns({ driver, onError })
    expect(result.failures).toBe(1)
    expect(result.updated).toBe(1)
    expect(onError).toHaveBeenCalledWith('r1', expect.any(Error))
  })
})
