import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import { config } from '../../lib/config.js'
import { listLaunchCommunitySeeds } from '../community-rules.js'
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

  it('loads canonical home-programming shelf and surface ids', () => {
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
      id: 'notes_today',
      label: '创作者笔记',
      accepts_content_kinds: ['note_entry'],
      preferred_surface_kinds: ['note_root_card'],
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

  it('loads the canonical creator-note template registry from copied config', () => {
    const runtime = getLaunchCreatorNoteTemplateRuntime()

    expect(runtime.template_registry.map((item) => item.id)).toEqual([
      'recommendation_note',
      'comparison_note',
      'review_note',
      'mistake_recap_note',
      'relationship_observation_note',
      'ongoing_column_note',
    ])
    expect(normalizeLaunchCreatorNoteTemplateId('weekly_picks')).toBeNull()
    expect(normalizeLaunchCreatorNoteTemplateId('relationship_watch')).toBeNull()
  })

  it('rejects creator-note template drafts that fall back to legacy alias blocks', () => {
    const source = parseYaml(
      readFileSync(
        locateLaunchContractPath({
          bundle_slug: 'launch-creator-note-enablement',
          file_name: 'creator_note_templates.v1.yaml',
        }).path,
        'utf8',
      ),
    ) as Record<string, unknown>

    const creatorNoteCommunities = source.creator_note_communities as Array<Record<string, unknown>>
    const copiedSource = {
      version: source.version,
      draft_status: source.draft_status,
      notes: source.notes,
      global_note_contract: {
        ...(source.global_note_contract as Record<string, unknown>),
        strict_publication_default: true,
      },
      creator_note_gate: source.creator_note_gate,
      communities: creatorNoteCommunities.map((community) => {
        const { creator_note_runtime: creatorNoteRuntime, ...rest } = community
        return {
          ...rest,
          creator_note_policy: creatorNoteRuntime,
          runtime_defaults: {
            ...(community.runtime_defaults as Record<string, unknown>),
            is_creator_note: true,
            strict_publication: true,
            surface_kind: 'note_root_card',
          },
        }
      }),
      template_registry: source.creator_note_template_registry,
      cover_modes: source.creator_note_cover_modes,
      distribution_rules: source.creator_note_distribution_rules,
      guardrails: source.guardrails,
    }

    const dir = mkdtempSync(join(tmpdir(), 'launch-creator-note-'))
    const filePath = join(dir, 'creator_note_templates.v1.yaml')
    writeFileSync(filePath, stringifyYaml(copiedSource), 'utf8')

    expect(() => getLaunchCreatorNoteTemplateRuntime(filePath)).toThrowError(
      /Unrecognized keys: "communities", "template_registry", "cover_modes", "distribution_rules"/,
    )
  })

  it('loads canonical programming-schedule and post-launch ids', () => {
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
    scheduleSource.dayparts[0] = {
      ...scheduleSource.dayparts[0],
      preferred_roles: ['anchor', 'creator', 'editor'],
    }
    scheduleSource.slot_templates[1] = {
      ...scheduleSource.slot_templates[1],
      required_roles: ['anchor', 'creator'],
      expected_outputs: {
        ...((scheduleSource.slot_templates[1]?.expected_outputs as Record<string, unknown>) ?? {}),
        surface_kind: 'note_root_card',
      },
    }
    scheduleSource.ops_surfaces.governance_reference_layer.community_lifecycle_panel.required_fields = [
      'community_name',
      'community_lifecycle_state',
      'launch_wave',
      'headline_priority',
    ]

    const scheduleDir = mkdtempSync(join(tmpdir(), 'launch-programming-'))
    const schedulePath = join(scheduleDir, 'launch_programming_schedule.v1.yaml')
    writeFileSync(schedulePath, stringifyYaml(scheduleSource), 'utf8')

    const scheduleRuntime = getLaunchProgrammingSchedule(schedulePath)
    expect(scheduleRuntime.dependency_contracts.creator_note_source).toBe('T-136')
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
        shelf_order: ['must_watch_today', 'conflict_rising', 'notes_today', 'continue_storyline', 'tonight_programming', 'all_communities'],
      },
      visual: {
        ...((tuningSource.profiles.baseline.visual as Record<string, unknown>) ?? {}),
        surface_ratio: {
          ...(((tuningSource.profiles.baseline.visual as Record<string, unknown>)?.surface_ratio as Record<string, unknown>) ?? {}),
          note_root_card: 0.55,
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

  it('only assigns aftershow candidate slots to communities that allow aftershow export', () => {
    const scheduleRuntime = getLaunchProgrammingSchedule()
    const communitiesBySlug = new Map(
      listLaunchCommunitySeeds().map((community) => [community.slug, community]),
    )

    const invalidSlots = scheduleRuntime.slot_templates
      .filter((slot) => slot.expected_outputs.aftershow_candidate === true)
      .filter((slot) => {
        const community = communitiesBySlug.get(slot.community_slug)
        const crossRoutePolicy = community?.rules_json
          && typeof community.rules_json === 'object'
          && !Array.isArray(community.rules_json)
          && typeof (community.rules_json as Record<string, unknown>).cross_route_policy === 'object'
          && !Array.isArray((community.rules_json as Record<string, unknown>).cross_route_policy)
          ? ((community.rules_json as Record<string, unknown>).cross_route_policy as Record<string, unknown>)
          : null
        return crossRoutePolicy?.allow_aftershow_export !== true
      })
      .map((slot) => slot.slot_name)

    expect(invalidSlots).toEqual([])
  })

  it('selects creator-note templates and cover modes from community/phase/media rules', () => {
    expect(resolveLaunchCreatorNoteProjection({
      community_slug: 'creator-recommendation',
      phase: 'pivot',
      media_count: 3,
    })).toEqual({
      is_creator_note: true,
      note_template_id: 'comparison_note',
      cover_mode: 'comparison_cover',
    })

    expect(resolveLaunchCreatorNoteProjection({
      community_slug: 'creator-relationship',
      phase: 'closure',
      title: '这波复盘里到底谁先翻车',
      media_count: 1,
    })).toEqual({
      is_creator_note: true,
      note_template_id: 'relationship_observation_note',
      cover_mode: 'portrait_cover',
    })
  })

  it('applies the active post-launch tuning profile as a runtime overlay for creator notes and visual packaging', () => {
    const featureFlags = config.launch.capabilities as unknown as Record<string, boolean>
    const tuningConfig = config.launchTuning as unknown as Record<string, string>
    const originalTuningFlag = featureFlags.postLaunchTuningV1
    const originalActiveProfile = tuningConfig.activeProfile
    featureFlags.postLaunchTuningV1 = true
    tuningConfig.activeProfile = 'creator_note_focus'

    try {
      const baseVisual = getLaunchVisualRollout()
      const effectiveVisual = resolveEffectiveLaunchVisualRollout()
      const tunedProjection = resolveLaunchCreatorNoteProjection({
        community_slug: 'creator-recommendation',
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
          preferred_card_modes: ['quote_card', 'comparison_cover'],
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

  it('projects launch storyline and creator-note fields from scene metadata without a schema migration', () => {
    const projection = buildLaunchProgrammingProjection({
      community_slug: 'creator-relationship',
      community_rules_json: {
        launch_profile: {
          default_editorial_shelf_ids: ['创作者笔记', '剧情继续看'],
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
        programming_production_path: null,
        programming_cue_id: null,
        programming_attempt_id: null,
        programming_schedule_id: null,
        programming_source_type: null,
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

  it('prefers launch_programming payload hints when they are present in scene metadata for creator-note projection', () => {
    const projection = buildLaunchProgrammingProjection({
      community_slug: 'creator-recommendation',
      community_rules_json: {
        launch_profile: {
          default_editorial_shelf_ids: ['冲突升级中'],
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
              is_creator_note: true,
              note_template_id: 'review_note',
              cover_mode: 'portrait_cover',
            },
            editorial_intent: {
              primary_shelf_id: '创作者笔记',
              content_kind: 'continuity_callback',
            },
          },
        }),
        programming_production_path: null,
        programming_cue_id: null,
        programming_attempt_id: null,
        programming_schedule_id: null,
        programming_source_type: null,
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
      content_kind: 'continuity_callback',
      note_template_id: 'review_note',
      cover_mode: 'portrait_cover',
    })
  })

  it('honors an explicit storyline callback state without forcing creator notes out of note formatting', () => {
    const projection = buildLaunchProgrammingProjection({
      community_slug: 'creator-relationship',
      community_rules_json: {
        launch_profile: {
          default_editorial_shelf_ids: ['创作者笔记', '剧情继续看'],
        },
        cross_route_policy: {
          allow_aftershow_export: true,
        },
      },
      scene_metadata: {
        id: 'scene-3',
        target_type: 'POST',
        community_id: 'community-3',
        post_id: 'post-3',
        thread_id: null,
        turn_id: null,
        episode_id: 'episode-3',
        selection_id: 'selection-3',
        episode_plan_id: 'plan-3',
        local_intent_id: 'intent-3',
        director_surface: 'forum',
        actor_surface: 'forum_post',
        scene_template_id: 'launch-template',
        scene_template_version: 'v1',
        scene_binding_id: 'binding-3',
        overlay_id: null,
        beat_id: null,
        phase: 'pivot',
        selection_mode: 'pool_guided',
        expires_at: null,
        payload_json: buildPublicScenePayloadJson({
          ...makeSceneWritePayload('pivot'),
          launch_programming: {
            storyline: {
              id: 'storyline-callback-note',
              title: '显式 callback 笔记',
              hook: '这一条既是笔记，也是 continuity',
              state: 'callback',
            },
            creator_note: {
              is_creator_note: true,
              note_template_id: 'relationship_observation_note',
              cover_mode: 'relationship_map_card',
            },
            editorial_intent: {
              primary_shelf_id: '创作者笔记',
              content_kind: 'note_entry',
            },
          },
        }),
        programming_production_path: null,
        programming_cue_id: null,
        programming_attempt_id: null,
        programming_schedule_id: null,
        programming_source_type: null,
        created_at: new Date('2026-03-23T00:00:00.000Z'),
        updated_at: new Date('2026-03-23T00:00:00.000Z'),
      },
      media_count: 1,
      has_aftershow_artifact: false,
    })

    expect(projection).toMatchObject({
      storyline_state: 'callback',
      editorial_shelf_id: 'notes_today',
      content_kind: 'note_entry',
      format_kind: 'note',
      note_template_id: 'relationship_observation_note',
      cover_mode: 'relationship_map_card',
      aftershow_export_bias: 0.6,
    })
  })
})
