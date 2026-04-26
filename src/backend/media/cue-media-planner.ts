/**
 * T-216 M1 — `CueMediaPlanner` orchestrator.
 *
 * Sits between `PublicDiscussionCueWorker` and the existing media stack
 * (`SurfaceMediaPlanningService` + `imagePlannerService`). M1 ships
 * **audit-only**: the orchestrator records `MediaPlanResolution` rows for
 * every brief media item without intercepting the actual planning path. The
 * runtime continues to treat `optional` / `preferred` / `anchor` /
 * `selected_only_pool` identically (see T-216 M0 unlock).
 *
 * M2 will:
 *   - Make the planner the active decision point for `anchor` strength
 *     (passing the asset to `imagePlannerService` with `inputMode='reference'`
 *     for derivative generation).
 *   - Emit `derivative_source` rows.
 *
 * M3 will:
 *   - Restrict `selected_only_pool` to forbid text-to-image entirely.
 *   - Emit `blocked` / `degraded` rows when validation fails.
 *
 * Audit timing: the worker calls `record()` **after the data plane write has
 * succeeded** (post-commit). Rationale: rows reflect what actually shipped —
 * a downstream write failure leaves no orphan audit rows.
 */

import type {
  DirectorCueBrief,
  DirectorCueBriefMediaResource,
} from '../programming/cue/director-cue-brief.js'
import type {
  MediaPlanOutcome,
  MediaPlanResolution,
  MediaPlanResolutionRepository,
  RecordMediaPlanResolutionInput,
} from '../repos/media-plan-resolution-repository.js'

export interface CueMediaPlannerDeps {
  mediaPlanResolutionRepo: MediaPlanResolutionRepository
}

export interface RecordCueMediaPlanInput {
  attemptId: string
  brief: DirectorCueBrief
  /** Set to `true` if admission yielded `degraded_media`; downgrades outcomes. */
  degradedMedia?: boolean
}

export class CueMediaPlanner {
  constructor(private readonly deps: CueMediaPlannerDeps) {}

  /**
   * Persist one `MediaPlanResolution` row per pool item. Returns the persisted
   * rows so the worker (and downstream telemetry) can correlate.
   *
   * Empty pool → no rows, no DB call.
   */
  async record(input: RecordCueMediaPlanInput): Promise<MediaPlanResolution[]> {
    const pool = input.brief.programming.media_resource_pool
    if (pool.length === 0) return []

    const rows: RecordMediaPlanResolutionInput[] = pool.map((item) =>
      this.deriveResolution(input.attemptId, item, input.degradedMedia ?? false),
    )
    return await this.deps.mediaPlanResolutionRepo.recordMany(rows)
  }

  /**
   * Map a pool item to its M1 audit row. Rationale per strength tier:
   *
   * - `optional` / `preferred` / `anchor` / `selected_only_pool` (M1):
   *     all four collapse to `runtime_context` — runtime treats the asset as
   *     context input regardless of strength; M2/M3 add behavior. Rows still
   *     carry `requested_strength` so the audit-side report can reconstruct
   *     intent.
   *
   * Degraded media flag (set by `CueAdmissionController` when load is yellow):
   *     downgrades the outcome to `degraded` so admins see why the planner
   *     didn't promote the asset further.
   */
  private deriveResolution(
    attemptId: string,
    item: DirectorCueBriefMediaResource,
    degradedMedia: boolean,
  ): RecordMediaPlanResolutionInput {
    const planOutcome: MediaPlanOutcome = degradedMedia
      ? 'degraded'
      : 'runtime_context'
    return {
      attempt_id: attemptId,
      asset_id: item.asset_id,
      requested_strength: item.usage_strength,
      requested_role: item.role,
      plan_outcome: planOutcome,
      ...(degradedMedia
        ? { reason: 'admission_load_yellow_degraded_media' }
        : { reason: 'm1_baseline_runtime_context' }),
    }
  }
}
