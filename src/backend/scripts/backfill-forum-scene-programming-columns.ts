/**
 * T-215 B-M3 — backfill `forum_scene_metadata.programming_*` columns.
 *
 * The dual-write at `services/public-scene-runtime.ts` populates the
 * five promoted columns on every NEW write. Existing rows still have
 * the columns NULL until this backfill runs.
 *
 * Behavior:
 *   - Walks `forum_scene_metadata` rows in batches.
 *   - For each row whose promoted columns are all NULL **and** whose
 *     `payload_json.programming` block parses cleanly, populates the
 *     5 columns from the JSON.
 *   - Rows missing `payload_json.programming` are left alone (they
 *     predate T-212 and have no cue refs to recover).
 *   - Rows where any promoted column is already non-NULL are skipped
 *     (idempotency: re-running produces no diffs).
 *
 * The Prisma client + cursor pagination keep the working set bounded.
 * The function returns counts (`scanned`, `updated`, `skippedNoProgramming`,
 * `skippedAlreadyBackfilled`) so the caller can verify progress.
 *
 * Wire this into a CLI runner (e.g. `scripts/backfill-forum-scene-
 * programming-columns.mjs`) for ops; the unit test exercises the
 * logic against an in-memory shim.
 */

import type {
  ForumSceneProductionPath,
} from '../repos/types/forum-scene.js'

export interface BackfillRow {
  id: string
  payload_json: unknown
  programming_production_path: string | null
  programming_cue_id: string | null
  programming_attempt_id: string | null
  programming_schedule_id: string | null
  programming_source_type: string | null
}

export interface BackfillUpdate {
  programming_production_path: ForumSceneProductionPath | null
  programming_cue_id: string | null
  programming_attempt_id: string | null
  programming_schedule_id: string | null
  programming_source_type: string | null
}

export interface BackfillDriver {
  /** Walk rows in stable order; the caller decides batch size + pagination. */
  listBatch(input: { afterId: string | null; limit: number }): Promise<BackfillRow[]>
  /** Apply the update to a row. Implementations return false if the row no longer matches the precondition (race). */
  updateRow(id: string, patch: BackfillUpdate): Promise<boolean>
}

export interface BackfillResult {
  scanned: number
  updated: number
  skippedNoProgramming: number
  skippedAlreadyBackfilled: number
  failures: number
}

const DEFAULT_BATCH_LIMIT = 200

/**
 * Walks every row exactly once. The caller can pass `dryRun: true` to
 * count without writing.
 */
export async function backfillForumSceneProgrammingColumns(input: {
  driver: BackfillDriver
  batchLimit?: number
  dryRun?: boolean
  onError?: (rowId: string, err: unknown) => void
}): Promise<BackfillResult> {
  const limit = input.batchLimit ?? DEFAULT_BATCH_LIMIT
  const dryRun = input.dryRun === true
  const counts: BackfillResult = {
    scanned: 0,
    updated: 0,
    skippedNoProgramming: 0,
    skippedAlreadyBackfilled: 0,
    failures: 0,
  }

  let cursor: string | null = null
  while (true) {
    const batch = await input.driver.listBatch({ afterId: cursor, limit })
    if (batch.length === 0) break

    for (const row of batch) {
      counts.scanned += 1
      try {
        const decision = decideBackfill(row)
        if (decision.kind === 'skip_no_programming') {
          counts.skippedNoProgramming += 1
          continue
        }
        if (decision.kind === 'skip_already_backfilled') {
          counts.skippedAlreadyBackfilled += 1
          continue
        }
        if (dryRun) {
          counts.updated += 1
          continue
        }
        const ok = await input.driver.updateRow(row.id, decision.patch)
        if (ok) counts.updated += 1
        else counts.skippedAlreadyBackfilled += 1
      } catch (err) {
        counts.failures += 1
        if (input.onError) input.onError(row.id, err)
      }
    }

    cursor = batch[batch.length - 1]!.id
    if (batch.length < limit) break
  }

  return counts
}

type Decision =
  | { kind: 'skip_no_programming' }
  | { kind: 'skip_already_backfilled' }
  | { kind: 'apply'; patch: BackfillUpdate }

export function decideBackfill(row: BackfillRow): Decision {
  // If any promoted column is already set, treat as already-backfilled.
  if (
    row.programming_production_path !== null
    || row.programming_cue_id !== null
    || row.programming_attempt_id !== null
    || row.programming_schedule_id !== null
    || row.programming_source_type !== null
  ) {
    return { kind: 'skip_already_backfilled' }
  }
  const programming = readProgramming(row.payload_json)
  if (!programming) {
    return { kind: 'skip_no_programming' }
  }
  return {
    kind: 'apply',
    patch: {
      programming_production_path: programming.production_path,
      programming_cue_id: programming.cue?.cue_id ?? null,
      programming_attempt_id: programming.cue?.attempt_id ?? null,
      programming_schedule_id: programming.cue?.schedule_id ?? null,
      programming_source_type: programming.cue?.source_type ?? null,
    },
  }
}

interface ParsedProgramming {
  production_path: ForumSceneProductionPath
  cue?: {
    cue_id?: string
    attempt_id?: string
    schedule_id?: string
    source_type?: string
  }
}

function readProgramming(payload: unknown): ParsedProgramming | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null
  const programming = (payload as Record<string, unknown>).programming
  if (!programming || typeof programming !== 'object' || Array.isArray(programming)) return null
  const productionPath = (programming as Record<string, unknown>).production_path
  if (productionPath !== 'autonomous' && productionPath !== 'cue') return null

  const result: ParsedProgramming = { production_path: productionPath }
  if (productionPath === 'cue') {
    const cue = (programming as Record<string, unknown>).cue
    if (cue && typeof cue === 'object' && !Array.isArray(cue)) {
      const cueRecord = cue as Record<string, unknown>
      result.cue = {
        ...(typeof cueRecord.cue_id === 'string' ? { cue_id: cueRecord.cue_id } : {}),
        ...(typeof cueRecord.attempt_id === 'string' ? { attempt_id: cueRecord.attempt_id } : {}),
        ...(typeof cueRecord.schedule_id === 'string' ? { schedule_id: cueRecord.schedule_id } : {}),
        ...(typeof cueRecord.source_type === 'string' ? { source_type: cueRecord.source_type } : {}),
      }
    }
  }
  return result
}
