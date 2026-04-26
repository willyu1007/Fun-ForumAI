/**
 * T-213 M2 — `LoadSnapshotRepository`.
 *
 * Persists `LoadSnapshot` rows for the cached freshness pathway. Live
 * (admission hot-path) snapshots are not persisted by `AdmissionLoadService`;
 * cached snapshots are written here by `LoadSignalService` so preview / Cue
 * Board / TriggerDetector can read recent state without re-running the live
 * counters every call.
 *
 * Schema mirror: `prisma/schema.prisma:4884` (`CommunityRuntimeLoadSnapshot`)
 * — already reserved by T-209.
 */

import type {
  LoadSnapshot,
  LoadSnapshotFreshness,
  LoadState,
} from '../programming/load/types.js'

export interface FindLatestForCommunityInput {
  communityId: string
  freshness?: LoadSnapshotFreshness
  /** Only return rows computed strictly after this instant. */
  computedAfter?: Date
}

export interface LoadSnapshotRepository {
  /**
   * Latest snapshot for `communityId`, optionally filtered by freshness and
   * recency. Returns `null` when nothing matches.
   */
  findLatestForCommunity(
    input: FindLatestForCommunityInput,
  ): Promise<LoadSnapshot | null>

  /**
   * Persist a snapshot row. Cached snapshots are appended (no upsert) so
   * historical state is preserved for the Cue Board's 30-min forward window.
   * Returns the persisted row (with the assigned id when applicable).
   */
  insert(snapshot: LoadSnapshot): Promise<LoadSnapshot>
}

// =============================================================================
// In-memory impl
// =============================================================================

let counter = 0
function localId(): string {
  return `load_snapshot_${Date.now().toString(36)}_${(++counter).toString(36)}`
}

interface StoredSnapshot extends LoadSnapshot {
  id: string
}

export class InMemoryLoadSnapshotRepository implements LoadSnapshotRepository {
  private readonly rows: StoredSnapshot[] = []

  async findLatestForCommunity(
    input: FindLatestForCommunityInput,
  ): Promise<LoadSnapshot | null> {
    const matching = this.rows
      .filter((r) => r.community_id === input.communityId)
      .filter((r) =>
        input.freshness ? r.freshness === input.freshness : true,
      )
      .filter((r) =>
        input.computedAfter
          ? r.computed_at.getTime() > input.computedAfter.getTime()
          : true,
      )
      .sort((a, b) => b.computed_at.getTime() - a.computed_at.getTime())
    const top = matching[0]
    if (!top) return null
    // Return a clone so callers don't mutate the stored row
    return { ...top }
  }

  async insert(snapshot: LoadSnapshot): Promise<LoadSnapshot> {
    const stored: StoredSnapshot = { id: localId(), ...snapshot }
    this.rows.push(stored)
    return { ...snapshot }
  }
}

// =============================================================================
// Prisma <-> domain bridges (used by Pg impl + tests)
// =============================================================================

export const LOAD_STATE_TO_DB: Record<LoadState, 'GREEN' | 'YELLOW' | 'RED'> = {
  green: 'GREEN',
  yellow: 'YELLOW',
  red: 'RED',
}
export const LOAD_STATE_FROM_DB: Record<'GREEN' | 'YELLOW' | 'RED', LoadState> = {
  GREEN: 'green',
  YELLOW: 'yellow',
  RED: 'red',
}

export const LOAD_FRESHNESS_TO_DB: Record<
  LoadSnapshotFreshness,
  'LIVE' | 'CACHED'
> = {
  live: 'LIVE',
  cached: 'CACHED',
}
export const LOAD_FRESHNESS_FROM_DB: Record<
  'LIVE' | 'CACHED',
  LoadSnapshotFreshness
> = {
  LIVE: 'live',
  CACHED: 'cached',
}
