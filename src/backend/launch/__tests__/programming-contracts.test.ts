import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import { config } from '../../lib/config.js'
import { locateLaunchContractPath } from '../contract-paths.js'
import { getLaunchHomeProgramming } from '../home-programming.js'
import { getPostLaunchTuningRuntime } from '../post-launch-tuning.js'
import { buildLaunchProgrammingProjection } from '../programming-projection.js'
import { getLaunchProgrammingSchedule } from '../programming-schedule.js'
import {
  getLaunchCreatorNoteTemplateRuntime,
  normalizeLaunchCreatorNoteTemplateId,
  resolveLaunchCreatorNoteProjection,
} from '../creator-note-templates.js'
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
      '创作者笔记',
      '剧情继续看',
      '今晚节目单',
      '全部社区',
    ])
    expect(runtime.shelves.find((item) => item.id === 'notes_today')?.empty_policy).toBe('collapse')
    expect(runtime.shelves.find((item) => item.id === 'tonight_programming')?.empty_policy).toBe('collapse')
  })

  it('normalizes legacy home-programming ingress aliases into canonical shelf and surface ids', () => {
    const source = parseYaml(
      readFileSync(
        locateLaunchContractPath({
          bundle_slug: 'launch-home-ia-storyline-highlights',
          file_name: 'home_ia_and_shelves.v1.yaml',
        }).path,
        'utf8',
      ),
    ) as Record<string, unknown> & { shelves: Array<Record<string, unknown>> }

    source.shelves[2] = {
      ...source.shelves[2],
      id: 't4_today',
      label: 'T4 今日笔记',
      accepts_content_kinds: ['t4_note'],
      preferred_surface_kinds: ['t4_root_card'],
    }

    const dir = mkdtempSync(join(tmpdir(), 'launch-home-programming-'))
    const filePath = join(dir, 'home_ia_and_shelves.v1.yaml')
    writeFileSync(filePath, stringifyYaml(source), 'utf8')

    const runtime = getLaunchHomeProgramming(filePath)
    expect(runtime.shelves[2]).toMatchObject({
      id: 'notes_today',
      label: '创作者笔记',
      accepts_content_kinds: ['note_entry'],
      preferred_surface_kinds: ['note_root_card'],
    })
  })

  it('loads the canonical creator-note template registry and normalizes legacy aliases', () => {
    const runtime = getLaunchCreatorNoteTemplateRuntime()

    expect(runtime.template_registry.map((item) => item.id)).toEqual([
      'recommendation_note',
      'comparison_note',
      'review_note',
      'mistake_recap_note',
      'relationship_observation_note',
      'ongoing_column_note',
    ])
    expect(normalizeLaunchCreatorNoteTemplateId('weekly_picks')).toBe('recommendation_note')
    expect(normalizeLaunchCreatorNoteTemplateId('relationship_watch')).toBe('relationship_observation_note')
  })

  it('accepts legacy creator-note template top-level blocks via alias ingress', () => {
    const source = parseYaml(
      readFileSync(
        locateLaunchContractPath({
          bundle_slug: 'launch-t4-community-enablement',
          file_name: 'creator_note_templates.v1.yaml',
        }).path,
        'utf8',
      ),
    ) as Record<string, unknown>

    const creatorNoteCommunities = source.creator_note_communities as Array<Record<string, unknown>>
    const legacySource = {
      version: source.version,
      draft_status: source.draft_status,
      notes: source.notes,
      global_t4_contract: {
        ...(source.global_note_contract as Record<string, unknown>),
        strict_t4_default: true,
      },
      creator_gate: source.creator_note_gate,
      communities: creatorNoteCommunities.map((community) => ({
        ...community,
        t4_policy: community.creator_note_policy,
        runtime_defaults: {
          ...(community.runtime_defaults as Record<string, unknown>),
          is_t4: true,
          strict_t4: true,
          surface_kind: 't4_root_card',
        },
      })),
      template_registry: source.creator_note_template_registry,
      cover_modes: source.creator_note_cover_modes,
      distribution_rules: source.creator_note_distribution_rules,
      guardrails: source.guardrails,
    }

    const dir = mkdtempSync(join(tmpdir(), 'launch-creator-note-'))
    const filePath = join(dir, 't4_content_templates.v1.yaml')
    writeFileSync(filePath, stringifyYaml(legacySource), 'utf8')

    const runtime = getLaunchCreatorNoteTemplateRuntime(filePath)
    expect(runtime.global_note_contract.shelf_label).toBe('创作者笔记')
    expect(runtime.template_registry).toHaveLength(6)
  })

  it('normalizes legacy programming-schedule and post-launch alias fields into canonical ids', () => {
    const scheduleSource = parseYaml(
      readFileSync(
        locateLaunchContractPath({
          bundle_slug: 'launch-programming-ops-and-rollout',
          file_name: 'launch_programming_schedule.v1.yaml',
        }).path,
        'utf8',
      ),
    ) as Record<string, unknown> & {
      dependency_contracts: Record<string, unknown>
      dayparts: Array<Record<string, unknown>>
      slot_templates: Array<Record<string, unknown>>
      ops_surfaces: {
        governance_reference_layer: Record<string, { required_fields: string[] }>
      }
    }
    scheduleSource.dependency_contracts = {
      ...scheduleSource.dependency_contracts,
      t4_track_source: scheduleSource.dependency_contracts.creator_note_source,
    }
    delete scheduleSource.dependency_contracts.creator_note_source
    scheduleSource.dayparts[0] = {
      ...scheduleSource.dayparts[0],
      preferred_roles: ['anchor', 't4_blogger', 'editor'],
    }
    scheduleSource.slot_templates[1] = {
      ...scheduleSource.slot_templates[1],
      required_roles: ['anchor', 't4_blogger'],
      expected_outputs: {
        ...((scheduleSource.slot_templates[1]?.expected_outputs as Record<string, unknown>) ?? {}),
        surface_kind: 't4_root_card',
      },
    }
    scheduleSource.ops_surfaces.governance_reference_layer.community_lifecycle_panel.required_fields = [
      'community_name',
      'community_lifecycle_state',
      'launch_phase',
      'headline_priority',
    ]

    const scheduleDir = mkdtempSync(join(tmpdir(), 'launch-programming-'))
    const schedulePath = join(scheduleDir, 'launch_programming_schedule.v1.yaml')
    writeFileSync(schedulePath, stringifyYaml(scheduleSource), 'utf8')

    const scheduleRuntime = getLaunchProgrammingSchedule(schedulePath)
    expect(scheduleRuntime.dependency_contracts.creator_note_source).toBe('T-136')
    expect('t4_track_source' in scheduleRuntime.dependency_contracts).toBe(false)
    expect(scheduleRuntime.dayparts[0]?.preferred_roles).toContain('creator')
    expect(scheduleRuntime.slot_templates[1]?.required_roles).toContain('creator')
    expect(
      scheduleRuntime.ops_surfaces.governance_reference_layer.community_lifecycle_panel.required_fields,
    ).toContain('launch_wave')

    const tuningSource = parseYaml(
      readFileSync(
        locateLaunchContractPath({
          bundle_slug: 'p1-shelf-template-optimization-and-incubation',
          file_name: 'post_launch_optimization_and_tuning.v1.yaml',
        }).path,
        'utf8',
      ),
    ) as Record<string, unknown> & { profiles: Record<string, Record<string, unknown>> }
    tuningSource.profiles.baseline = {
      ...tuningSource.profiles.baseline,
      home: {
        ...((tuningSource.profiles.baseline.home as Record<string, unknown>) ?? {}),
        shelf_order: ['must_watch_today', 'conflict_rising', 't4_today', 'continue_storyline', 'tonight_programming', 'all_communities'],
      },
      visual: {
        ...((tuningSource.profiles.baseline.visual as Record<string, unknown>) ?? {}),
        surface_ratio: {
          ...(((tuningSource.profiles.baseline.visual as Record<string, unknown>)?.surface_ratio as Record<string, unknown>) ?? {}),
          t4_root_card: 0.55,
        },
      },
    }

    const tuningDir = mkdtempSync(join(tmpdir(), 'launch-tuning-'))
    const tuningPath = join(tuningDir, 'post_launch_optimization_and_tuning.v1.yaml')
    writeFileSync(tuningPath, stringifyYaml(tuningSource), 'utf8')

    const tuningRuntime = getPostLaunchTuningRuntime(tuningPath)
    expect(tuningRuntime.profiles.baseline.home.shelf_order).toContain('notes_today')
    expect(tuningRuntime.profiles.baseline.visual.surface_ratio.note_root_card).toBe(0.55)
  })

  it('selects T4 note templates and cover modes from community/phase/media rules', () => {
    expect(resolveLaunchCreatorNoteProjection({
      community_slug: 't4-picks',
      phase: 'pivot',
      media_count: 3,
    })).toEqual({
      is_creator_note: true,
      note_template_id: 'comparison_note',
      cover_mode: 'comparison_cover',
    })

    expect(resolveLaunchCreatorNoteProjection({
      community_slug: 't4-relations',
      phase: 'closure',
      title: '这波复盘里到底谁先翻车',
      media_count: 1,
    })).toEqual({
      is_creator_note: true,
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
    tuningConfig.activeProfile = 'creator_note_focus'

    try {
      const baseVisual = getLaunchVisualRollout()
      const effectiveVisual = resolveEffectiveLaunchVisualRollout()
      const tunedProjection = resolveLaunchCreatorNoteProjection({
        community_slug: 't4-picks',
        phase: 'opening',
        media_count: 2,
      })

      expect(baseVisual.surface_rollout.home_root_card.target_ratio).toBe(0.5)
      expect(effectiveVisual.surface_rollout.home_root_card.target_ratio).toBe(0.38)
      expect(baseVisual.surface_rollout.note_root_card.target_ratio).toBe(0.7)
      expect(effectiveVisual.surface_rollout.note_root_card.target_ratio).toBe(0.62)
      expect(tunedProjection).toEqual({
        is_creator_note: true,
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
      editorial_shelf_id: 'notes_today',
      editorial_shelf: 't4_today',
      is_t4: true,
      note_template_id: 'ongoing_column_note',
      cover_mode: 'relationship_map_card',
      content_kind: 'note_entry',
      format_kind: 'note',
      aftershow_export_bias: 1,
    })
    expect(projection.content_semantics).toMatchObject({
      distribution: {
        content_kind: 'note_entry',
        editorial_shelf_id: 'notes_today',
      },
      format: {
        format_kind: 'note',
      },
      visual: {
        surface_kind: 'note_root_card',
      },
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
            creator_note: {
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
      editorial_shelf_id: 'notes_today',
      editorial_shelf: 't4_today',
      content_kind: 'continuity_callback',
      is_t4: true,
      note_template_id: 'review_note',
      cover_mode: 'portrait_cover',
    })
  })
})
