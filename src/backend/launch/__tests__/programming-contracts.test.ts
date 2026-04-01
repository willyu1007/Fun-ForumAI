import { describe, expect, it } from 'vitest'
import { config } from '../../lib/config.js'
import { locateLaunchContractPath } from '../contract-paths.js'
import { getLaunchHomeProgramming } from '../home-programming.js'
import { buildLaunchProgrammingProjection } from '../programming-projection.js'
import {
  getLaunchT4TemplateRuntime,
  normalizeLaunchT4TemplateId,
  resolveLaunchT4Projection,
} from '../t4-content-templates.js'
import { getLaunchVisualRollout, resolveEffectiveLaunchVisualRollout, resolveLaunchVisualPackaging } from '../visual-rollout.js'
import { buildPublicScenePayloadJson, type PublicSceneWritePayload } from '../../services/public-scene-runtime.js'

function makeSceneWritePayload(phase: 'opening' | 'escalation' | 'pivot' | 'closure'): PublicSceneWritePayload {
  return {
    scene_metadata: {
      director_surface: 'forum',
      actor_surface: 'forum_post',
      scene_template_id: 'launch-template',
      scene_template_version: 'v1',
      scene_binding_id: 'binding-1',
      overlay_id: null,
      episode_id: 'episode-1',
      beat_id: null,
      phase,
      selection_mode: 'pool_guided',
      selection_id: 'selection-1',
      episode_plan_id: 'plan-1',
      local_intent_id: 'intent-1',
      started_at: new Date('2026-03-23T00:00:00.000Z').toISOString(),
      expires_at: null,
    },
    episode_brief: {
      episode_id: 'episode-1',
      director_surface: 'forum',
      actor_surface: 'forum_post',
      template_id: 'launch-template',
      template_version: 'v1',
      phase,
      scene_goal: {
        viewer_goal: '把当前主线再往前推一步',
        growth_goal: '让角色关系继续演化',
      },
      target_mood: 'playful',
      casting_directive: {
        must_have_roles: ['HOST'],
        avoid_pairs: [],
        core_quota: 1,
        contrast_quota: 1,
        wildcard_quota: 0,
      },
      open_loops: ['下一步还会继续升级'],
      must_hit_points: ['先把冲突点亮出来'],
      avoid_repeat: [],
      close_condition: {},
      expires_at: new Date('2026-03-24T00:00:00.000Z').toISOString(),
    },
    local_intent: {
      intent_id: 'intent-1',
      delivery_surface: 'forum_post',
      initiative: 'open_topic',
      opinion_policy: 'free_opinion',
      relation_focus: 'bridge',
      tone_hint: 'witty',
      privacy_mode: 'public_only',
      memory_scope: 'public_contextual',
      reference_scope: 'episode_public_context',
      prohibited_reference_types: [],
      target_ref: { kind: 'none' },
      hard_constraints: [],
      soft_constraints: ['保持节奏'],
    },
    local_intent_block: 'local intent',
  }
}

function makeScenePayload(phase: 'opening' | 'escalation' | 'pivot' | 'closure') {
  return buildPublicScenePayloadJson(makeSceneWritePayload(phase))
}

describe('launch programming contracts', () => {
  it('resolves runtime launch contracts from config/launch via the manifest', () => {
    const visualRollout = locateLaunchContractPath({
      bundle_slug: 'launch-visual-rollout-and-packaging',
      file_name: 'visual_surface_rollout.v1.yaml',
    })

    expect(visualRollout.tier).toBe('config')
  })

  it('loads the canonical home programming contract with fixed shelf order', () => {
    const runtime = getLaunchHomeProgramming()

    expect(runtime.shelves.map((item) => item.label)).toEqual([
      '今日必看',
      '冲突升级中',
      'T4 今日笔记',
      '剧情继续看',
      '今晚节目单',
      '全部社区',
    ])
    expect(runtime.shelves.find((item) => item.id === 't4_today')?.empty_policy).toBe('collapse')
    expect(runtime.shelves.find((item) => item.id === 'tonight_programming')?.empty_policy).toBe('collapse')
  })

  it('loads the canonical T4 template registry and normalizes legacy aliases', () => {
    const runtime = getLaunchT4TemplateRuntime()

    expect(runtime.template_registry.map((item) => item.id)).toEqual([
      'recommendation_note',
      'comparison_note',
      'review_note',
      'mistake_recap_note',
      'relationship_observation_note',
      'ongoing_column_note',
    ])
    expect(normalizeLaunchT4TemplateId('weekly_picks')).toBe('recommendation_note')
    expect(normalizeLaunchT4TemplateId('relationship_watch')).toBe('relationship_observation_note')
  })

  it('selects T4 note templates and cover modes from community/phase/media rules', () => {
    expect(resolveLaunchT4Projection({
      community_slug: 't4-picks',
      phase: 'pivot',
      media_count: 3,
    })).toEqual({
      is_t4: true,
      note_template_id: 'comparison_note',
      cover_mode: 'comparison_cover',
    })

    expect(resolveLaunchT4Projection({
      community_slug: 't4-relations',
      phase: 'closure',
      title: '这波复盘里到底谁先翻车',
      media_count: 1,
    })).toEqual({
      is_t4: true,
      note_template_id: 'mistake_recap_note',
      cover_mode: 'timeline_cover',
    })
  })

  it('applies the active post-launch tuning profile as a runtime overlay for T4 and visual packaging', () => {
    const featureFlags = config.features as unknown as Record<string, boolean>
    const tuningConfig = config.launchTuning as unknown as Record<string, string>
    const originalTuningFlag = featureFlags.postLaunchTuningV1
    const originalActiveProfile = tuningConfig.activeProfile
    featureFlags.postLaunchTuningV1 = true
    tuningConfig.activeProfile = 't4_focus'

    try {
      const baseVisual = getLaunchVisualRollout()
      const effectiveVisual = resolveEffectiveLaunchVisualRollout()
      const tunedProjection = resolveLaunchT4Projection({
        community_slug: 't4-picks',
        phase: 'opening',
        media_count: 2,
      })

      expect(baseVisual.surface_rollout.home_root_card.target_ratio).toBe(0.5)
      expect(effectiveVisual.surface_rollout.home_root_card.target_ratio).toBe(0.38)
      expect(baseVisual.surface_rollout.t4_root_card.target_ratio).toBe(0.7)
      expect(effectiveVisual.surface_rollout.t4_root_card.target_ratio).toBe(0.62)
      expect(tunedProjection).toEqual({
        is_t4: true,
        note_template_id: 'recommendation_note',
        cover_mode: 'comparison_cover',
      })

      const packaging = resolveLaunchVisualPackaging({
        surface: 'home_root_card',
        community_visual_policy: {
          preferred_cover_modes: ['quote_card', 'comparison_cover'],
        },
        has_thumbnail: true,
      })

      expect(packaging).toMatchObject({
        surface_kind: 'home_root_card',
        card_mode: 'comparison_cover',
      })
      expect(baseVisual.surface_rollout.highlight_card.target_ratio).toBe(0.9)
    } finally {
      featureFlags.postLaunchTuningV1 = originalTuningFlag
      tuningConfig.activeProfile = originalActiveProfile
    }
  })

  it('projects launch storyline and T4 fields from scene metadata without a schema migration', () => {
    const projection = buildLaunchProgrammingProjection({
      community_slug: 't4-relations',
      community_rules_json: {
        launch_profile: {
          editorial_shelf: ['T4 今日笔记', '剧情继续看'],
        },
        cross_route_policy: {
          allow_aftershow_export: true,
        },
      },
      scene_metadata: {
        id: 'scene-1',
        target_type: 'POST',
        community_id: 'community-1',
        post_id: 'post-1',
        thread_id: null,
        turn_id: null,
        episode_id: 'episode-1',
        selection_id: 'selection-1',
        episode_plan_id: 'plan-1',
        local_intent_id: 'intent-1',
        director_surface: 'forum',
        actor_surface: 'forum_post',
        scene_template_id: 'launch-template',
        scene_template_version: 'v1',
        scene_binding_id: 'binding-1',
        overlay_id: null,
        beat_id: null,
        phase: 'closure',
        selection_mode: 'pool_guided',
        expires_at: null,
        payload_json: makeScenePayload('closure'),
        created_at: new Date('2026-03-23T00:00:00.000Z'),
        updated_at: new Date('2026-03-23T00:00:00.000Z'),
      },
      media_count: 2,
      has_aftershow_artifact: true,
    })

    expect(projection).toMatchObject({
      storyline_id: 'episode-1',
      storyline_state: 'callback',
      editorial_shelf: 'T4 今日笔记',
      is_t4: true,
      note_template_id: 'ongoing_column_note',
      cover_mode: 'relationship_map_card',
      content_kind: 't4_note',
      aftershow_export_bias: 1,
    })
  })

  it('prefers launch_programming payload hints when they are present in scene metadata', () => {
    const projection = buildLaunchProgrammingProjection({
      community_slug: 't4-picks',
      community_rules_json: {
        launch_profile: {
          editorial_shelf: ['冲突升级中'],
        },
        cross_route_policy: {
          allow_aftershow_export: true,
        },
      },
      scene_metadata: {
        id: 'scene-2',
        target_type: 'POST',
        community_id: 'community-2',
        post_id: 'post-2',
        thread_id: null,
        turn_id: null,
        episode_id: 'episode-2',
        selection_id: 'selection-2',
        episode_plan_id: 'plan-2',
        local_intent_id: 'intent-2',
        director_surface: 'forum',
        actor_surface: 'forum_post',
        scene_template_id: 'launch-template',
        scene_template_version: 'v1',
        scene_binding_id: 'binding-2',
        overlay_id: null,
        beat_id: null,
        phase: 'aftershow',
        selection_mode: 'pool_guided',
        expires_at: null,
        payload_json: buildPublicScenePayloadJson({
          ...makeSceneWritePayload('closure'),
          launch_programming: {
            storyline: {
              id: 'storyline-manual',
              title: '显式主线标题',
              hook: '显式钩子',
            },
            t4_note: {
              is_t4: true,
              note_template_id: 'review_note',
              cover_mode: 'portrait_cover',
            },
            editorial_intent: {
              primary_shelf: 'T4 今日笔记',
              content_kind: 'continuity_callback',
            },
          },
        }),
        created_at: new Date('2026-03-23T00:00:00.000Z'),
        updated_at: new Date('2026-03-23T00:00:00.000Z'),
      },
      media_count: 1,
      has_aftershow_artifact: true,
    })

    expect(projection).toMatchObject({
      storyline_id: 'storyline-manual',
      storyline_title: '显式主线标题',
      storyline_hook: '显式钩子',
      storyline_state: 'callback',
      editorial_shelf: 'T4 今日笔记',
      content_kind: 'continuity_callback',
      is_t4: true,
      note_template_id: 'review_note',
      cover_mode: 'portrait_cover',
    })
  })
})
