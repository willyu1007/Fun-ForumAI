/**
 * T-216 M1 — `CueMediaPlanner` unit tests.
 *
 * Baseline + active policy behavior:
 *   - one row per pool item, all four strengths accepted
 *   - empty pool → no rows, no DB call
 *   - degraded media flag flips outcome to `degraded`
 *   - M1 fixtures default to `runtime_context`; M2/M4 fixtures cover
 *     strength-aware and pre-write selected-asset outcomes
 */

import { describe, expect, it, vi } from 'vitest'
import { CueMediaPlanner } from '../cue-media-planner.js'
import { InMemoryMediaPlanResolutionRepository } from '../../repos/media-plan-resolution-repository.js'
import type { DirectorCueBrief } from '../../programming/cue/director-cue-brief.js'
import type {
  CueMediaRole,
  CueMediaUsageStrength,
  PublicDiscussionCueMediaDomain,
} from '../../repos/cue-repository.js'
import type { PreparedSurfaceVisualPlan } from '../surface-media-planning-service.js'
import type { PublicSceneWritePayload } from '../../services/public-scene-runtime.js'

function buildBrief(
  pool: Array<{
    asset_id: string
    role?: CueMediaRole
    usage_strength: CueMediaUsageStrength
  }>,
): DirectorCueBrief {
  return {
    overlay: {
      version: 1,
      overlay_kind: 'public_discussion_cue',
    } as unknown as DirectorCueBrief['overlay'],
    programming: {
      audit_refs: {
        schedule_id: 'sched-1',
        cue_id: 'cue-1',
        attempt_id: 'attempt-1',
        source_type: 'manual',
      },
      theme_intent: {
        primary_theme: 'theme-x',
      } as unknown as DirectorCueBrief['programming']['theme_intent'],
      scene_constraints:
        {} as unknown as DirectorCueBrief['programming']['scene_constraints'],
      role_requirements: {
        requirements: [{ role: 'anchor', weight: 0.7 }],
      } as unknown as DirectorCueBrief['programming']['role_requirements'],
      media_resource_pool: pool.map((item, idx) => ({
        asset_id: item.asset_id,
        role: item.role ?? 'context_anchor',
        usage_strength: item.usage_strength,
        use_policy: 'runtime_only',
        sort_order: idx,
      })),
      safety_boundary: { no_persona_writeback: true, no_private_leak: true },
      privacy_boundary: {
        privacy_mode: 'public_only',
        prohibited_reference_types: [],
      },
    },
    source: 'live',
  }
}

function buildCueMedia(
  assetId: string,
  usageStrength: CueMediaUsageStrength,
  validationStatus: PublicDiscussionCueMediaDomain['validation_status'] = 'valid',
): PublicDiscussionCueMediaDomain {
  return {
    id: `cue_media_${assetId}`,
    cue_id: 'cue-1',
    asset_id: assetId,
    semantic_snapshot_id: null,
    role: 'cover_candidate',
    usage_strength: usageStrength,
    use_policy: 'prefer_public_display',
    display_policy: 'default',
    selection_note: null,
    sort_order: 0,
    reuse_limit: null,
    validation_status: validationStatus,
    validation_reason: null,
    created_by_type: 'admin',
    created_by_id: 'user-1',
    created_at: new Date('2026-04-26T00:00:00.000Z'),
  }
}

function buildSurfacePlan(
  patch: Partial<PreparedSurfaceVisualPlan> = {},
): PreparedSurfaceVisualPlan {
  return {
    directive_id: 'visual-directive-1',
    image_plan_id: 'image-plan-1',
    runtime_card_ids: [],
    display_attachment_refs: [],
    planning_audit: {
      visual_directive_id: 'visual-directive-1',
      image_plan_id: 'image-plan-1',
      planner_status: 'ready',
      planner_decision: 'reuse_public_original',
      planner_reason: 'selected_pool_asset',
      generation_status: 'not_requested',
      generation_job_id: null,
      runtime_card_ids: [],
      public_media_prompt_injection_status: 'not_requested',
    },
    selected_sources: [],
    ...patch,
  }
}

function buildScenePayload(): PublicSceneWritePayload {
  return {
    planning_audit: null,
  } as unknown as PublicSceneWritePayload
}

describe('CueMediaPlanner.record', () => {
  it('writes one MediaPlanResolution row per pool item', async () => {
    const repo = new InMemoryMediaPlanResolutionRepository()
    const planner = new CueMediaPlanner({ mediaPlanResolutionRepo: repo })
    const brief = buildBrief([
      { asset_id: 'asset-1', usage_strength: 'optional' },
      { asset_id: 'asset-2', usage_strength: 'preferred' },
      { asset_id: 'asset-3', usage_strength: 'anchor' },
      { asset_id: 'asset-4', usage_strength: 'selected_only_pool' },
    ])

    const rows = await planner.record({ attemptId: 'attempt-1', brief })
    expect(rows).toHaveLength(4)

    const persisted = await repo.findByAttempt('attempt-1')
    expect(persisted).toHaveLength(4)
    expect(persisted.map((r) => r.requested_strength)).toEqual([
      'optional',
      'preferred',
      'anchor',
      'selected_only_pool',
    ])
    expect(persisted.every((r) => r.plan_outcome === 'runtime_context')).toBe(
      true,
    )
    expect(persisted.every((r) => r.attempt_id === 'attempt-1')).toBe(true)
  })

  it('returns no rows for an empty pool and skips the repo write', async () => {
    const repo = new InMemoryMediaPlanResolutionRepository()
    const recordSpy = vi.spyOn(repo, 'recordMany')
    const planner = new CueMediaPlanner({ mediaPlanResolutionRepo: repo })
    const brief = buildBrief([])

    const rows = await planner.record({ attemptId: 'attempt-empty', brief })
    expect(rows).toEqual([])
    expect(recordSpy).not.toHaveBeenCalled()
  })

  it('downgrades outcomes to "degraded" when admission flagged degraded_media', async () => {
    const repo = new InMemoryMediaPlanResolutionRepository()
    const planner = new CueMediaPlanner({ mediaPlanResolutionRepo: repo })
    const brief = buildBrief([
      { asset_id: 'asset-1', usage_strength: 'preferred' },
      { asset_id: 'asset-2', usage_strength: 'anchor' },
    ])

    const rows = await planner.record({
      attemptId: 'attempt-degraded',
      brief,
      degradedMedia: true,
    })
    expect(rows).toHaveLength(2)
    expect(rows.every((r) => r.plan_outcome === 'degraded')).toBe(true)
    expect(rows.every((r) => r.reason === 'admission_load_yellow_degraded_media')).toBe(true)
  })

  it('preserves the requested role per pool item', async () => {
    const repo = new InMemoryMediaPlanResolutionRepository()
    const planner = new CueMediaPlanner({ mediaPlanResolutionRepo: repo })
    const brief = buildBrief([
      { asset_id: 'asset-cover', role: 'cover_candidate', usage_strength: 'preferred' },
      { asset_id: 'asset-mood', role: 'mood_reference', usage_strength: 'optional' },
    ])

    const rows = await planner.record({ attemptId: 'attempt-roles', brief })
    expect(rows.map((r) => r.requested_role)).toEqual([
      'cover_candidate',
      'mood_reference',
    ])
  })
})

describe('CueMediaPlanner.record — T-216 M2 anchor mode', () => {
  it('keeps M1 outcomes when anchorModeEnabled is left default (false)', async () => {
    const repo = new InMemoryMediaPlanResolutionRepository()
    const planner = new CueMediaPlanner({ mediaPlanResolutionRepo: repo })
    const brief = buildBrief([
      { asset_id: 'asset-anchor', usage_strength: 'anchor' },
      { asset_id: 'asset-pool', usage_strength: 'selected_only_pool' },
    ])

    const rows = await planner.record({ attemptId: 'attempt-flag-off', brief })
    expect(rows.map((r) => r.plan_outcome)).toEqual([
      'runtime_context',
      'runtime_context',
    ])
    expect(rows.every((r) => r.reason === 'm1_baseline_runtime_context')).toBe(true)
  })

  it('promotes anchor + selected_only_pool to public_display when anchor mode is on', async () => {
    const repo = new InMemoryMediaPlanResolutionRepository()
    const planner = new CueMediaPlanner({
      mediaPlanResolutionRepo: repo,
      anchorModeEnabled: true,
    })
    const brief = buildBrief([
      { asset_id: 'asset-optional', usage_strength: 'optional' },
      { asset_id: 'asset-preferred', usage_strength: 'preferred' },
      { asset_id: 'asset-anchor', usage_strength: 'anchor' },
      { asset_id: 'asset-pool', usage_strength: 'selected_only_pool' },
    ])

    const rows = await planner.record({ attemptId: 'attempt-m2', brief })
    const byAsset = Object.fromEntries(rows.map((r) => [r.asset_id, r]))
    expect(byAsset['asset-optional']?.plan_outcome).toBe('runtime_context')
    expect(byAsset['asset-preferred']?.plan_outcome).toBe('runtime_context')
    expect(byAsset['asset-anchor']?.plan_outcome).toBe('public_display')
    expect(byAsset['asset-anchor']?.reason).toBe('m2_anchor_used_as_public_display')
    expect(byAsset['asset-pool']?.plan_outcome).toBe('public_display')
    expect(byAsset['asset-pool']?.reason).toBe('m2_selected_only_pool_used_as_public_display')
  })

  it('flips anchor row to derivative_source when caller signals derivative usage', async () => {
    const repo = new InMemoryMediaPlanResolutionRepository()
    const planner = new CueMediaPlanner({
      mediaPlanResolutionRepo: repo,
      anchorModeEnabled: true,
    })
    const brief = buildBrief([
      { asset_id: 'asset-anchor', usage_strength: 'anchor' },
      { asset_id: 'asset-other', usage_strength: 'preferred' },
    ])

    const rows = await planner.record({
      attemptId: 'attempt-derivative',
      brief,
      derivativeSourcedAnchorAssetIds: ['asset-anchor'],
    })
    const anchorRow = rows.find((r) => r.asset_id === 'asset-anchor')
    expect(anchorRow?.plan_outcome).toBe('derivative_source')
    expect(anchorRow?.reason).toBe('m2_anchor_used_for_derivative')
  })

  it('persists per-asset image_planner_decision_id when supplied', async () => {
    const repo = new InMemoryMediaPlanResolutionRepository()
    const planner = new CueMediaPlanner({
      mediaPlanResolutionRepo: repo,
      anchorModeEnabled: true,
    })
    const brief = buildBrief([
      { asset_id: 'asset-anchor', usage_strength: 'anchor' },
      { asset_id: 'asset-other', usage_strength: 'preferred' },
    ])

    const rows = await planner.record({
      attemptId: 'attempt-link',
      brief,
      imagePlannerDecisionsByAssetId: {
        'asset-anchor': 'plan-decision-1',
      },
    })
    const anchorRow = rows.find((r) => r.asset_id === 'asset-anchor')
    expect(anchorRow?.image_planner_decision_id).toBe('plan-decision-1')
    const otherRow = rows.find((r) => r.asset_id === 'asset-other')
    expect(otherRow?.image_planner_decision_id).toBeNull()
  })

  it('keeps the degraded outcome winning over anchor mode promotion', async () => {
    const repo = new InMemoryMediaPlanResolutionRepository()
    const planner = new CueMediaPlanner({
      mediaPlanResolutionRepo: repo,
      anchorModeEnabled: true,
    })
    const brief = buildBrief([
      { asset_id: 'asset-anchor', usage_strength: 'anchor' },
      { asset_id: 'asset-pool', usage_strength: 'selected_only_pool' },
    ])

    const rows = await planner.record({
      attemptId: 'attempt-degraded-anchor',
      brief,
      degradedMedia: true,
      derivativeSourcedAnchorAssetIds: ['asset-anchor'],
    })
    expect(rows.every((r) => r.plan_outcome === 'degraded')).toBe(true)
    expect(rows.every((r) => r.reason === 'admission_load_yellow_degraded_media')).toBe(true)
  })

  it('does not promote unselected strong assets when an active pre-write plan is enforced', async () => {
    const repo = new InMemoryMediaPlanResolutionRepository()
    const planner = new CueMediaPlanner({
      mediaPlanResolutionRepo: repo,
      anchorModeEnabled: true,
    })
    const brief = buildBrief([
      { asset_id: 'asset-anchor', usage_strength: 'anchor' },
      { asset_id: 'asset-pool', usage_strength: 'selected_only_pool' },
    ])

    const rows = await planner.record({
      attemptId: 'attempt-active-plan',
      brief,
      activePlanEnforced: true,
      imagePlannerDecisionsByAssetId: {
        'asset-pool': 'image-plan-pool',
      },
    })
    const byAsset = Object.fromEntries(rows.map((r) => [r.asset_id, r]))
    expect(byAsset['asset-anchor']?.plan_outcome).toBe('not_used')
    expect(byAsset['asset-anchor']?.reason).toBe('m4_active_plan_not_selected')
    expect(byAsset['asset-pool']?.plan_outcome).toBe('public_display')
  })
})

describe('CueMediaPlanner.planForWrite — T-216 pre-write routing', () => {
  it('routes anchor media through the surface planner and marks derivative source', async () => {
    const repo = new InMemoryMediaPlanResolutionRepository()
    const prepareCueForumPostPlan = vi.fn(async () =>
      buildSurfacePlan({
        image_plan_id: 'image-plan-anchor',
        planning_audit: {
          visual_directive_id: 'visual-directive-anchor',
          image_plan_id: 'image-plan-anchor',
          planner_status: 'pending_generation',
          planner_decision: 'generate_from_public_reference',
          planner_reason: 'selected_anchor_for_generation',
          generation_status: 'queued',
          generation_job_id: 'generation-job-1',
          runtime_card_ids: ['card-anchor'],
          public_media_prompt_injection_status: 'accepted',
        },
        runtime_card_ids: ['card-anchor'],
        selected_sources: [
          {
            asset_id: 'asset-anchor',
            reuse_mode: 'derive_new',
            projection_id: 'projection-anchor',
            rejection_reason: null,
          },
        ],
      }))
    const planner = new CueMediaPlanner({
      mediaPlanResolutionRepo: repo,
      anchorModeEnabled: true,
      surfaceMediaPlanningService: { prepareCueForumPostPlan },
    })
    const brief = buildBrief([
      { asset_id: 'asset-anchor', usage_strength: 'anchor' },
    ])

    const result = await planner.planForWrite({
      attemptId: 'attempt-1',
      brief,
      media: [buildCueMedia('asset-anchor', 'anchor')],
      scenePayload: buildScenePayload(),
      communityId: 'community-1',
      agentId: 'agent-1',
    })

    expect(result.kind).toBe('ready')
    if (result.kind !== 'ready') return
    expect(prepareCueForumPostPlan).toHaveBeenCalledWith(expect.objectContaining({
      agent_id: 'agent-1',
      community_id: 'community-1',
      anchor_asset_id: 'asset-anchor',
      candidate_asset_ids: [],
      forbid_generation: false,
    }))
    expect(result.imagePlanId).toBe('image-plan-anchor')
    expect(result.scenePayload.visual_ref).toEqual({
      directive_id: 'visual-directive-1',
      image_plan_id: 'image-plan-anchor',
      runtime_card_ids: ['card-anchor'],
    })
    expect(result.imagePlannerDecisionsByAssetId).toEqual({
      'asset-anchor': 'image-plan-anchor',
    })
    expect(result.derivativeSourcedAnchorAssetIds).toEqual(['asset-anchor'])
  })

  it('forces selected_only_pool to use a selected asset without generation', async () => {
    const repo = new InMemoryMediaPlanResolutionRepository()
    const prepareCueForumPostPlan = vi.fn(async () =>
      buildSurfacePlan({
        image_plan_id: 'image-plan-pool',
        display_attachment_refs: [
          {
            asset_id: 'asset-pool',
            slot: 0,
            display_variant: 'original',
          },
        ],
        selected_sources: [
          {
            asset_id: 'asset-pool',
            reuse_mode: 'quote_original',
            rejection_reason: null,
          },
        ],
      }))
    const planner = new CueMediaPlanner({
      mediaPlanResolutionRepo: repo,
      anchorModeEnabled: true,
      surfaceMediaPlanningService: { prepareCueForumPostPlan },
    })
    const brief = buildBrief([
      { asset_id: 'asset-pool', usage_strength: 'selected_only_pool' },
    ])

    const result = await planner.planForWrite({
      attemptId: 'attempt-1',
      brief,
      media: [buildCueMedia('asset-pool', 'selected_only_pool')],
      scenePayload: buildScenePayload(),
      communityId: 'community-1',
      agentId: 'agent-1',
    })

    expect(result.kind).toBe('ready')
    if (result.kind !== 'ready') return
    expect(prepareCueForumPostPlan).toHaveBeenCalledWith(expect.objectContaining({
      anchor_asset_id: 'asset-pool',
      candidate_asset_ids: ['asset-pool'],
      forbid_generation: true,
    }))
    expect(result.displayAttachmentRefs).toEqual([
      {
        asset_id: 'asset-pool',
        slot: 0,
        display_variant: 'original',
      },
    ])
    expect(result.mediaUsage).toEqual([
      { asset_id: 'asset-pool', usage: 'display' },
    ])
  })

  it('fails selected_only_pool before write when no pool asset is displayable', async () => {
    const repo = new InMemoryMediaPlanResolutionRepository()
    const planner = new CueMediaPlanner({
      mediaPlanResolutionRepo: repo,
      anchorModeEnabled: true,
      surfaceMediaPlanningService: {
        prepareCueForumPostPlan: vi.fn(async () => null),
      },
    })
    const brief = buildBrief([
      { asset_id: 'asset-pool', usage_strength: 'selected_only_pool' },
    ])

    const result = await planner.planForWrite({
      attemptId: 'attempt-1',
      brief,
      media: [buildCueMedia('asset-pool', 'selected_only_pool')],
      scenePayload: buildScenePayload(),
      communityId: 'community-1',
      agentId: 'agent-1',
    })

    expect(result).toEqual({
      kind: 'failed',
      reasonCode: 'cue_media_selected_only_pool_unresolved',
      errorText: 'selected_only_pool could not resolve a displayable pool asset',
      retryable: false,
    })
  })

  it('fails selected_only_pool before write when validation leaves the brief pool empty', async () => {
    const repo = new InMemoryMediaPlanResolutionRepository()
    const planner = new CueMediaPlanner({
      mediaPlanResolutionRepo: repo,
      anchorModeEnabled: true,
      surfaceMediaPlanningService: {
        prepareCueForumPostPlan: vi.fn(),
      },
    })

    const result = await planner.planForWrite({
      attemptId: 'attempt-1',
      brief: buildBrief([]),
      media: [buildCueMedia('asset-invalid-pool', 'selected_only_pool', 'invalid')],
      scenePayload: buildScenePayload(),
      communityId: 'community-1',
      agentId: 'agent-1',
    })

    expect(result).toEqual({
      kind: 'failed',
      reasonCode: 'cue_media_selected_only_pool_empty',
      errorText: 'selected_only_pool has no valid media resource',
      retryable: false,
    })
  })
})
