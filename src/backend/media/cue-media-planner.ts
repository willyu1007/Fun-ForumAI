/**
 * T-216 — `CueMediaPlanner` orchestrator.
 *
 * Sits between `PublicDiscussionCueWorker` and the existing media stack
 * (`SurfaceMediaPlanningService` + `imagePlannerService`).
 *
 * - **M1 baseline**: every brief media item produces one audit row whose
 *   outcome collapses to `runtime_context` (or `degraded` when admission
 *   flagged degraded media). All four `usage_strength` values are accepted;
 *   the row preserves the requested strength so the report can reconstruct
 *   intent.
 * - **M2**: when the runtime feature flag
 *   `cueMediaPolicyAnchorMode` is on, strength-aware outcomes light up:
 *   - `anchor` → `public_display` (baseline) or `derivative_source` if the
 *     caller signals that this anchor was used to generate a derivative
 *     (via `derivativeSourcedAnchorAssetIds`)
 *   - `selected_only_pool` → `public_display`
 *   - `optional` / `preferred` → unchanged from M1 (`runtime_context`)
 *   Optional `imagePlannerDecisionsByAssetId` lets the caller link the
 *   resulting plan record id per pool item for downstream observability.
 *   Flag off → exact M1 behavior preserved.
 * - **M4 closure**: the worker calls `planForWrite()` before the data-plane
 *   write. Anchor / selected-only decisions are resolved through
 *   `SurfaceMediaPlanningService` → `imagePlannerService`, then the post
 *   write carries the resulting `image_plan_id` and display refs. `record()`
 *   remains post-success persistence of the pre-write decision so failed
 *   writes do not leave orphan audit rows.
 */

import type {
  DirectorCueBrief,
  DirectorCueBriefMediaResource,
} from '../programming/cue/director-cue-brief.js'
import type { PublicDiscussionCueMediaDomain } from '../repos/cue-repository.js'
import type {
  MediaPlanOutcome,
  MediaPlanResolution,
  MediaPlanResolutionRepository,
  RecordMediaPlanResolutionInput,
} from '../repos/media-plan-resolution-repository.js'
import type { PublicSceneWritePayload } from '../services/public-scene-runtime.js'
import type {
  PreparedSurfaceVisualPlan,
  SurfaceMediaPlanningService,
} from './surface-media-planning-service.js'

export interface CueMediaPlannerDeps {
  mediaPlanResolutionRepo: MediaPlanResolutionRepository
  /**
   * T-216 M2/M4 — when `true`, `anchor` and `selected_only_pool` strengths
   * become active runtime policy instead of M1's blanket `runtime_context`.
   * Production config defaults on after closure; tests may omit it to keep
   * M1 baseline fixtures lightweight. The flag is read once at construction.
   */
  anchorModeEnabled?: boolean
  /**
   * T-216 M4 — active pre-write planner. Optional only for legacy M1/M2
   * fixtures; production wiring provides the service.
   */
  surfaceMediaPlanningService?: Pick<SurfaceMediaPlanningService, 'prepareCueForumPostPlan'> | null
}

export interface RecordCueMediaPlanInput {
  attemptId: string
  brief: DirectorCueBrief
  /** Set to `true` if admission yielded `degraded_media`; downgrades outcomes. */
  degradedMedia?: boolean
  /**
   * T-216 M2 — optional per-asset image-planner decision ids so the audit
   * row can be joined back to the planner's selection record. Caller may
   * supply only the assets it has decisions for; missing entries persist
   * as `null` (existing behavior).
   */
  imagePlannerDecisionsByAssetId?: Record<string, string | null | undefined>
  /**
   * T-216 M2 — anchor assets the caller used to generate a derivative.
   * Each asset id present here flips the anchor row's outcome from
   * `public_display` to `derivative_source` (M2 frozen contract per
   * dev-docs/active/cue-media-policy/00-overview.md §90-95). Only
   * meaningful when `anchorModeEnabled` is `true` and the brief carries
   * the matching `anchor` strength entry.
   */
  derivativeSourcedAnchorAssetIds?: ReadonlyArray<string>
  /**
   * T-216 closure — set by the cue worker when `planForWrite()` produced an
   * active image plan before the post write. In that mode, strong rows only
   * promote when the pre-write image plan actually selected that asset.
   */
  activePlanEnforced?: boolean
}

export interface PlanCueMediaForWriteInput {
  attemptId: string
  brief: DirectorCueBrief
  media?: ReadonlyArray<PublicDiscussionCueMediaDomain>
  scenePayload: PublicSceneWritePayload
  communityId: string
  agentId: string
  degradedMedia?: boolean
}

export type CueMediaPlanForWrite =
  | {
      kind: 'ready'
      scenePayload: PublicSceneWritePayload
      imagePlanId?: string
      displayAttachmentRefs?: PreparedSurfaceVisualPlan['display_attachment_refs']
      imagePlannerDecisionsByAssetId: Record<string, string>
      derivativeSourcedAnchorAssetIds: string[]
      mediaUsage: Array<{ asset_id: string; usage: 'context' | 'display' }>
    }
  | {
      kind: 'failed'
      reasonCode: string
      errorText: string
      retryable: boolean
    }

const ANCHOR_DERIVATIVE_REASON = 'm2_anchor_used_for_derivative'
const ANCHOR_DISPLAY_REASON = 'm2_anchor_used_as_public_display'
const SELECTED_ONLY_POOL_DISPLAY_REASON = 'm2_selected_only_pool_used_as_public_display'
const M1_BASELINE_REASON = 'm1_baseline_runtime_context'
const DEGRADED_REASON = 'admission_load_yellow_degraded_media'

export class CueMediaPlanner {
  private readonly anchorModeEnabled: boolean

  constructor(private readonly deps: CueMediaPlannerDeps) {
    this.anchorModeEnabled = deps.anchorModeEnabled === true
  }

  async planForWrite(input: PlanCueMediaForWriteInput): Promise<CueMediaPlanForWrite> {
    const pool = input.brief.programming.media_resource_pool
    const selectedOnlyItems = pool.filter((item) => item.usage_strength === 'selected_only_pool')
    const anchorItems = pool.filter((item) => item.usage_strength === 'anchor')
    const rawSelectedOnlyItems = (input.media ?? []).filter(
      (item) => item.usage_strength === 'selected_only_pool',
    )

    if (!this.anchorModeEnabled || input.degradedMedia === true) {
      return this.readyWithoutActivePlan(input.scenePayload)
    }

    if (rawSelectedOnlyItems.length > 0 && selectedOnlyItems.length === 0) {
      return {
        kind: 'failed',
        reasonCode: 'cue_media_selected_only_pool_empty',
        errorText: 'selected_only_pool has no valid media resource',
        retryable: false,
      }
    }

    if (pool.length === 0 || (selectedOnlyItems.length === 0 && anchorItems.length === 0)) {
      return this.readyWithoutActivePlan(input.scenePayload)
    }

    const surfacePlanner = this.deps.surfaceMediaPlanningService
    if (!surfacePlanner) {
      return {
        kind: 'failed',
        reasonCode: 'cue_media_planner_unavailable',
        errorText: 'cue media policy requires surface media planning service',
        retryable: true,
      }
    }

    const selectedOnlyAssetIds = selectedOnlyItems.map((item) => item.asset_id)
    const selectedOnlyAssetSet = new Set(selectedOnlyAssetIds)
    const requestedAnchorAssetId = anchorItems[0]?.asset_id ?? null
    const anchorAssetId = selectedOnlyAssetIds.length > 0
      ? selectedOnlyAssetSet.has(requestedAnchorAssetId ?? '')
        ? requestedAnchorAssetId
        : selectedOnlyAssetIds[0] ?? null
      : requestedAnchorAssetId

    let plan: PreparedSurfaceVisualPlan | null
    try {
      plan = await surfacePlanner.prepareCueForumPostPlan({
        agent_id: input.agentId,
        community_id: input.communityId,
        payload: input.scenePayload,
        anchor_asset_id: anchorAssetId,
        candidate_asset_ids: selectedOnlyAssetIds,
        forbid_generation: selectedOnlyAssetIds.length > 0,
      })
    } catch (error) {
      return {
        kind: 'failed',
        reasonCode: 'cue_media_planning_error',
        errorText: error instanceof Error ? error.message : 'cue media planning failed',
        retryable: true,
      }
    }

    if (selectedOnlyItems.length > 0) {
      const failure = this.validateSelectedOnlyPlan(plan, selectedOnlyAssetSet)
      if (failure) return failure
    }
    if (anchorItems.length > 0 && selectedOnlyItems.length === 0) {
      const failure = this.validateAnchorPlan(plan, anchorItems[0].asset_id)
      if (failure) return failure
    }

    if (!plan) return this.readyWithoutActivePlan(input.scenePayload)

    const decisionsByAssetId = this.resolveImagePlannerDecisions({
      pool,
      plan,
    })
    const derivativeSourcedAnchorAssetIds = this.resolveDerivativeSourcedAnchors({
      anchorItems,
      plan,
    })
    const displayAssetIds = new Set(plan.display_attachment_refs.map((ref) => ref.asset_id))
    const scenePayload: PublicSceneWritePayload = {
      ...input.scenePayload,
      planning_audit: {
        ...(input.scenePayload.planning_audit ?? {}),
        ...plan.planning_audit,
        cue_media_policy: {
          active: true,
          anchor_asset_id: anchorAssetId,
          selected_only_asset_ids: selectedOnlyAssetIds,
          forbid_generation: selectedOnlyAssetIds.length > 0,
        },
      },
      visual_ref: {
        directive_id: plan.directive_id,
        image_plan_id: plan.image_plan_id,
        runtime_card_ids: plan.runtime_card_ids,
      },
    }

    return {
      kind: 'ready',
      scenePayload,
      imagePlanId: plan.image_plan_id,
      displayAttachmentRefs: plan.display_attachment_refs,
      imagePlannerDecisionsByAssetId: decisionsByAssetId,
      derivativeSourcedAnchorAssetIds,
      mediaUsage: pool
        .filter((item) => decisionsByAssetId[item.asset_id])
        .map((item) => ({
          asset_id: item.asset_id,
          usage: displayAssetIds.has(item.asset_id) ? 'display' : 'context',
        })),
    }
  }

  /**
   * Persist one `MediaPlanResolution` row per pool item. Returns the persisted
   * rows so the worker (and downstream telemetry) can correlate.
   *
   * Empty pool → no rows, no DB call.
   */
  async record(input: RecordCueMediaPlanInput): Promise<MediaPlanResolution[]> {
    const pool = input.brief.programming.media_resource_pool
    if (pool.length === 0) return []

    const derivativeSourced = new Set(input.derivativeSourcedAnchorAssetIds ?? [])
    const decisionsById = input.imagePlannerDecisionsByAssetId ?? {}

    const rows: RecordMediaPlanResolutionInput[] = pool.map((item) =>
      this.deriveResolution({
        attemptId: input.attemptId,
        item,
        degradedMedia: input.degradedMedia ?? false,
        derivativeSourced: derivativeSourced.has(item.asset_id),
        imagePlannerDecisionId: decisionsById[item.asset_id] ?? null,
        activePlanEnforced: input.activePlanEnforced === true,
      }),
    )
    return await this.deps.mediaPlanResolutionRepo.recordMany(rows)
  }

  /**
   * Map a pool item to its audit row. Outcome rules:
   *
   * - `degradedMedia: true` → `degraded` (admission load downgrade), reason
   *   `admission_load_yellow_degraded_media`. Wins over strength-aware paths
   *   because the asset is not actually flowing through to the post.
   * - With `anchorModeEnabled === true` (M2/M4):
   *   - `anchor` + `derivativeSourced=true` → `derivative_source`
   *   - `anchor` (no derivative) → `public_display`
   *   - `selected_only_pool` → `public_display`
   *   - `preferred` / `optional` → `runtime_context` (unchanged)
   * - Without anchor mode (M1 baseline):
   *   - All strengths → `runtime_context`
   */
  private deriveResolution(args: {
    attemptId: string
    item: DirectorCueBriefMediaResource
    degradedMedia: boolean
    derivativeSourced: boolean
    imagePlannerDecisionId: string | null
    activePlanEnforced: boolean
  }): RecordMediaPlanResolutionInput {
    const {
      attemptId,
      item,
      degradedMedia,
      derivativeSourced,
      imagePlannerDecisionId,
      activePlanEnforced,
    } = args

    if (degradedMedia) {
      return this.row(attemptId, item, 'degraded', DEGRADED_REASON, imagePlannerDecisionId)
    }

    if (this.anchorModeEnabled) {
      if (
        activePlanEnforced
        && (item.usage_strength === 'anchor' || item.usage_strength === 'selected_only_pool')
        && !imagePlannerDecisionId
      ) {
        return this.row(attemptId, item, 'not_used', 'm4_active_plan_not_selected', null)
      }
      if (item.usage_strength === 'anchor') {
        return derivativeSourced
          ? this.row(attemptId, item, 'derivative_source', ANCHOR_DERIVATIVE_REASON, imagePlannerDecisionId)
          : this.row(attemptId, item, 'public_display', ANCHOR_DISPLAY_REASON, imagePlannerDecisionId)
      }
      if (item.usage_strength === 'selected_only_pool') {
        return this.row(attemptId, item, 'public_display', SELECTED_ONLY_POOL_DISPLAY_REASON, imagePlannerDecisionId)
      }
    }

    return this.row(attemptId, item, 'runtime_context', M1_BASELINE_REASON, imagePlannerDecisionId)
  }

  private readyWithoutActivePlan(scenePayload: PublicSceneWritePayload): CueMediaPlanForWrite {
    return {
      kind: 'ready',
      scenePayload,
      imagePlannerDecisionsByAssetId: {},
      derivativeSourcedAnchorAssetIds: [],
      mediaUsage: [],
    }
  }

  private validateSelectedOnlyPlan(
    plan: PreparedSurfaceVisualPlan | null,
    selectedOnlyAssetIds: ReadonlySet<string>,
  ): Extract<CueMediaPlanForWrite, { kind: 'failed' }> | null {
    if (!plan) {
      return {
        kind: 'failed',
        reasonCode: 'cue_media_selected_only_pool_unresolved',
        errorText: 'selected_only_pool could not resolve a displayable pool asset',
        retryable: false,
      }
    }
    const selectedDisplay = plan.display_attachment_refs.some((ref) =>
      selectedOnlyAssetIds.has(ref.asset_id),
    )
    if (!selectedDisplay) {
      return {
        kind: 'failed',
        reasonCode: 'cue_media_selected_only_pool_unresolved',
        errorText: 'selected_only_pool plan did not select a pool asset for display',
        retryable: false,
      }
    }
    const generatedDisplay = plan.display_attachment_refs.some(
      (ref) => ref.display_variant === 'generated_derivative',
    )
    const generationStatus = readString(plan.planning_audit, 'generation_status')
    if (generatedDisplay || (generationStatus && generationStatus !== 'not_requested')) {
      return {
        kind: 'failed',
        reasonCode: 'cue_media_selected_only_pool_generation_blocked',
        errorText: 'selected_only_pool forbids generated images',
        retryable: false,
      }
    }
    return null
  }

  private validateAnchorPlan(
    plan: PreparedSurfaceVisualPlan | null,
    anchorAssetId: string,
  ): Extract<CueMediaPlanForWrite, { kind: 'failed' }> | null {
    if (!plan) {
      return {
        kind: 'failed',
        reasonCode: 'cue_media_anchor_unresolved',
        errorText: 'anchor media could not resolve an image plan',
        retryable: false,
      }
    }
    const displaysAnchor = plan.display_attachment_refs.some((ref) =>
      ref.asset_id === anchorAssetId,
    )
    const derivesFromAnchor = plan.selected_sources.some((source) =>
      source.asset_id === anchorAssetId
      && source.reuse_mode === 'derive_new'
      && !source.rejection_reason,
    )
    if (!displaysAnchor && !derivesFromAnchor) {
      return {
        kind: 'failed',
        reasonCode: 'cue_media_anchor_unresolved',
        errorText: 'anchor media was not selected for display or derivative generation',
        retryable: false,
      }
    }
    return null
  }

  private resolveImagePlannerDecisions(input: {
    pool: ReadonlyArray<DirectorCueBriefMediaResource>
    plan: PreparedSurfaceVisualPlan
  }): Record<string, string> {
    const displayAssetIds = new Set(input.plan.display_attachment_refs.map((ref) => ref.asset_id))
    const selectedAssetIds = new Set(
      input.plan.selected_sources
        .filter((source) => !source.rejection_reason && source.asset_id)
        .map((source) => source.asset_id as string),
    )
    const decisions: Record<string, string> = {}
    for (const item of input.pool) {
      if (displayAssetIds.has(item.asset_id) || selectedAssetIds.has(item.asset_id)) {
        decisions[item.asset_id] = input.plan.image_plan_id
      }
    }
    return decisions
  }

  private resolveDerivativeSourcedAnchors(input: {
    anchorItems: ReadonlyArray<DirectorCueBriefMediaResource>
    plan: PreparedSurfaceVisualPlan
  }): string[] {
    const derivativeSourceIds = new Set(
      input.plan.selected_sources
        .filter((source) =>
          source.reuse_mode === 'derive_new'
          && !source.rejection_reason
          && source.asset_id)
        .map((source) => source.asset_id as string),
    )
    return input.anchorItems
      .map((item) => item.asset_id)
      .filter((assetId) => derivativeSourceIds.has(assetId))
  }

  private row(
    attemptId: string,
    item: DirectorCueBriefMediaResource,
    outcome: MediaPlanOutcome,
    reason: string,
    imagePlannerDecisionId: string | null,
  ): RecordMediaPlanResolutionInput {
    return {
      attempt_id: attemptId,
      asset_id: item.asset_id,
      requested_strength: item.usage_strength,
      requested_role: item.role,
      plan_outcome: outcome,
      reason,
      ...(imagePlannerDecisionId ? { image_planner_decision_id: imagePlannerDecisionId } : {}),
    }
  }
}

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key]
  return typeof value === 'string' ? value : null
}
