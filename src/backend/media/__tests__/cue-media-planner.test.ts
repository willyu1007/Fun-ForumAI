/**
 * T-216 M1 — `CueMediaPlanner` unit tests.
 *
 * Audit-only behavior:
 *   - one row per pool item, all four strengths accepted
 *   - empty pool → no rows, no DB call
 *   - degraded media flag flips outcome to `degraded`
 *   - all outcomes default to `runtime_context` in M1 (M2/M3 will widen)
 */

import { describe, expect, it, vi } from 'vitest'
import { CueMediaPlanner } from '../cue-media-planner.js'
import { InMemoryMediaPlanResolutionRepository } from '../../repos/media-plan-resolution-repository.js'
import type { DirectorCueBrief } from '../../programming/cue/director-cue-brief.js'
import type {
  CueMediaRole,
  CueMediaUsageStrength,
} from '../../repos/cue-repository.js'

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
  }
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
