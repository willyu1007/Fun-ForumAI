/**
 * T-213 M1 — canonical load types.
 *
 * Single source of truth for `LoadState`, `LoadSnapshot`, and the priority
 * bucketing used by the admission decision table. The T-212 stub at
 * `services/__stubs__/load-signal-service-stub.ts` re-exports `LoadState`
 * from here so the M2 swap (stub deletion) is a single-import-line change in
 * downstream consumers.
 *
 * `LoadSnapshot` mirrors the Prisma `CommunityRuntimeLoadSnapshot` shape
 * (reserved by T-209 at `prisma/schema.prisma:4884`) with snake_case domain
 * field names. Field semantics:
 *   - `state` / `global_state` — green/yellow/red derived from the raw
 *     counters via thresholds in `admission-load-service.ts`
 *   - `freshness` — `'live'` rows are computed on demand inside the admission
 *     hot path and not persisted unless the caller passes `keep=true`;
 *     `'cached'` rows are written by `LoadSignalService` (T-213 M2)
 *   - the per-counter columns capture the raw signals that fed the state
 *     computation; M1 populates only the cue-side counters (scheduled / due /
 *     executing cue count, recent root post count). LLM/media queue depth and
 *     provider queue pressure remain null until later milestones wire them
 *     up from existing observability counters.
 */

import type { CueLane } from '../cue/types.js'

export type LoadState = 'green' | 'yellow' | 'red'

export type LoadSnapshotFreshness = 'live' | 'cached'

/**
 * Bucketed view of the cue priority axis (raw priority is `0-100`). Buckets
 * collapse the matrix from 101 columns to 3, which keeps the decision table
 * readable while preserving the obvious gradient.
 */
export type CuePriorityBucket = 'low' | 'normal' | 'high'

/**
 * Decision-table outcome for `(LoadState, CueLane, CuePriorityBucket)`.
 * `merge` and `require_review` are reserved for T-214 LoadGate / future cue
 * coalescing; T-213 admission only emits `admit | defer | skip`.
 */
export type AdmissionAction =
  | 'admit'
  | 'defer'
  | 'skip'
  | 'merge'
  | 'require_review'

/**
 * Map raw cue priority (0-100) to a bucket. Thresholds chosen so the default
 * priority of `50` (`createCue` default in `cue-repository.ts`) lands in
 * `normal`; high stakes (`>= 80`) tilt admission toward grant under stress;
 * low (`< 40`) drops first.
 */
export const PRIORITY_BUCKET_HIGH_MIN = 80
export const PRIORITY_BUCKET_NORMAL_MIN = 40

export function bucketPriority(priority: number): CuePriorityBucket {
  if (priority >= PRIORITY_BUCKET_HIGH_MIN) return 'high'
  if (priority >= PRIORITY_BUCKET_NORMAL_MIN) return 'normal'
  return 'low'
}

export interface LoadSnapshot {
  community_id: string
  window_start: Date
  window_end: Date
  freshness: LoadSnapshotFreshness
  state: LoadState
  global_state: LoadState
  scheduled_cue_count: number
  due_cue_count: number
  executing_cue_count: number
  recent_root_post_count: number
  recent_thread_followup_count: number
  active_scene_count: number
  hot_thread_pressure: number | null
  visible_llm_queue_depth: number | null
  media_queue_depth: number | null
  provider_queue_pressure: number | null
  load_score: number
  capacity_remaining: number
  computed_at: Date
}

/**
 * Re-export `CueLane` so consumers of the load layer don't need to reach into
 * the cue type module to spell out the same enum that the decision table is
 * indexed by.
 */
export type { CueLane }
