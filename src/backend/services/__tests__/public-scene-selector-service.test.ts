import { describe, expect, it } from 'vitest'
import { listLaunchCommunitySeeds } from '../../launch/community-rules.js'
import { InMemoryForumSceneMetadataRepository } from '../../repos/forum-scene-metadata-repository.js'
import { DEFAULT_STAGE_SPEC_V1, type ScenePoolCatalog, type StageTemplateV2 } from '../../stage/index.js'
import { PublicSceneCatalogService } from '../public-scene-catalog-service.js'
import { PublicSceneSelectorService } from '../public-scene-selector-service.js'

function makeTemplate(input: {
  id: string
  surfaces?: Array<'forum' | 'scheduled_post' | 'chat_room'>
  require_pool_match_before_create?: boolean
  max_runs_per_day?: number
  cooldown_hours?: number
}): StageTemplateV2 {
  return {
    template_id: input.id,
    template_version: 'v2',
    name: input.id,
    category: 'show',
    lifecycle_status: 'core_active',
    stage_spec: DEFAULT_STAGE_SPEC_V1,
    director: {
      applicable_surfaces: input.surfaces ?? ['forum', 'scheduled_post'],
      scene_goal: {
        viewer_goal: `让 ${input.id} 更可看`,
        growth_goal: '推动关系继续演化',
      },
      casting_recipe: {
        quota: 4,
        ratio: {
          core: 2,
          contrast: 1,
          wildcard: 1,
        },
        wildcard_cap: 1,
        must_have_roles: [],
        avoid_pairs: [],
        relationship_objectives: ['bridge'],
      },
      beat_plan: {
        phases: ['opening', 'escalation', 'pivot', 'closure'],
        optional_beats: [],
      },
      fatigue_policy: {
        cooldown_hours: input.cooldown_hours ?? 24,
        repeat_penalty: 1,
        max_runs_per_day: input.max_runs_per_day ?? 3,
      },
      closing_policy: {
        ttl_hours: 24,
        min_turns: 3,
        message_threshold: 12,
        aftershow_mode: 'off',
      },
      hot_topic_policy: {
        injection_mode: 'overlay_only',
        sensitive_topic_mode: 'standard',
      },
      autonomy_policy: {
        allow_autonomous_mutation: false,
        require_pool_match_before_create: input.require_pool_match_before_create ?? false,
      },
    },
  }
}

function makeCatalog(): ScenePoolCatalog {
  const templateAlpha = makeTemplate({ id: 'template-alpha' })
  const templateBeta = makeTemplate({ id: 'template-beta', require_pool_match_before_create: true })
  return {
    version: 'v2',
    contract_version: 'public_director_contract_v1',
    exported_at: '2026-03-14T00:00:00.000Z',
    templates: [],
    stage_templates: [templateAlpha, templateBeta],
    scene_bindings: [
      {
        binding_id: 'binding-alpha',
        template_id: templateAlpha.template_id,
        template_version: templateAlpha.template_version,
        binding_type: 'core',
        status: 'active',
        entry_surfaces: ['scheduled_post', 'forum'],
        target: {
          surface: 'forum',
          community_slug: 'general',
          seasonal_slot: null,
        },
        lifecycle: {},
        weights: {
          editorial_priority: 2,
          base_weight: 1,
          freshness_bonus: 1,
        },
        activation: {
          time_windows: [],
          allowed_days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
          trigger_conditions: [],
        },
        governance: {},
        constraints: {},
      },
      {
        binding_id: 'binding-beta',
        template_id: templateBeta.template_id,
        template_version: templateBeta.template_version,
        binding_type: 'core',
        status: 'active',
        entry_surfaces: ['scheduled_post', 'forum'],
        target: {
          surface: 'forum',
          community_slug: 'tech',
          seasonal_slot: null,
        },
        lifecycle: {},
        weights: {
          editorial_priority: 9,
          base_weight: 2,
          freshness_bonus: 2,
        },
        activation: {
          time_windows: [],
          allowed_days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
          trigger_conditions: [],
        },
        governance: {},
        constraints: {},
      },
    ],
    surface_vocabulary: {
      director_surfaces: ['forum', 'chat_room', 'scheduled_post'],
      actor_surfaces: ['forum_post', 'forum_thread', 'chat_room'],
      private_surfaces: ['private_chat', 'proactive_dm'],
    },
  }
}

describe('PublicSceneSelectorService', () => {
  it('selects the strongest eligible scheduled_post binding and builds seed-only local intent', async () => {
    const repo = new InMemoryForumSceneMetadataRepository()
    const service = new PublicSceneSelectorService({
      catalogService: {
        getLaunchCatalog: () => makeCatalog(),
      } as never,
      sceneMetadataRepo: repo,
    })

    const result = await service.selectScheduledPost({
      agent: {
        id: 'agent-1',
        display_name: 'Selector Agent',
      },
      eligible_communities: [
        {
          id: 'community-general',
          slug: 'general',
          name: 'General',
          description: 'General community',
          rules: 'Be specific.',
        },
        {
          id: 'community-tech',
          slug: 'tech',
          name: 'Tech',
          description: 'Tech community',
          rules: 'Be concrete.',
        },
      ],
    })

    expect(result).toMatchObject({
      kind: 'scene',
      community: {
        id: 'community-tech',
      },
    })
    if (result.kind !== 'scene') return
    expect(result.payload.scene_metadata.scene_binding_id).toBe('binding-beta')
    expect(result.payload.scene_metadata.selection_mode).toBe('pool_strict')
    expect(result.payload.local_intent.reference_scope).toBe('seed_only')
    expect(result.payload.selection_audit).toMatchObject({
      entry_kind: 'scheduled_post',
    })
  })

  it('skips future lifecycle bindings and respects same-day daily limit / cooldown', async () => {
    const repo = new InMemoryForumSceneMetadataRepository()
    const catalog = makeCatalog()
    catalog.scene_bindings[0] = {
      ...catalog.scene_bindings[0]!,
      lifecycle: {
        start_at: '2099-01-01T00:00:00.000Z',
      },
    }
    catalog.scene_bindings[1] = {
      ...catalog.scene_bindings[1]!,
      constraints: {
        max_runs_per_day: 1,
        cooldown_hours: 24,
      },
    }
    await repo.create({
      target_type: 'POST',
      community_id: 'community-tech',
      post_id: 'post-1',
      episode_id: 'episode-1',
      selection_id: 'selection-1',
      episode_plan_id: 'plan-1',
      local_intent_id: 'intent-1',
      director_surface: 'scheduled_post',
      actor_surface: 'forum_post',
      scene_template_id: 'template-beta',
      scene_template_version: 'v2',
      scene_binding_id: 'binding-beta',
      overlay_id: null,
      beat_id: null,
      phase: 'opening',
      selection_mode: 'pool_guided',
      expires_at: new Date(Date.now() + 3600_000),
      payload_json: {},
    })

    const service = new PublicSceneSelectorService({
      catalogService: {
        getLaunchCatalog: () => catalog,
      } as never,
      sceneMetadataRepo: repo,
    })

    const result = await service.selectScheduledPost({
      agent: {
        id: 'agent-1',
        display_name: 'Selector Agent',
      },
      eligible_communities: [
        {
          id: 'community-general',
          slug: 'general',
          name: 'General',
          description: 'General community',
          rules: 'Be specific.',
        },
        {
          id: 'community-tech',
          slug: 'tech',
          name: 'Tech',
          description: 'Tech community',
          rules: 'Be concrete.',
        },
      ],
    })

    expect(result).toEqual({
      kind: 'skip',
      reason: 'no_pool_match',
    })
  })

  it('locks forum_post_seed to the requested community binding', async () => {
    const repo = new InMemoryForumSceneMetadataRepository()
    const service = new PublicSceneSelectorService({
      catalogService: {
        getLaunchCatalog: () => makeCatalog(),
      } as never,
      sceneMetadataRepo: repo,
    })

    const result = await service.selectForumPostSeed({
      agent: {
        id: 'agent-1',
        display_name: 'Selector Agent',
      },
      community: {
        id: 'community-general',
        slug: 'general',
        name: 'General',
        description: 'General community',
        rules: 'Be specific.',
      },
    })

    expect(result).toMatchObject({
      kind: 'scene',
      community: {
        id: 'community-general',
      },
    })
    if (result.kind !== 'scene') return
    expect(result.payload.scene_metadata.director_surface).toBe('forum')
    expect(result.payload.scene_metadata.scene_binding_id).toBe('binding-alpha')
  })

  it('rebuilds forum_thread_followup from minimal scene metadata without leaking full director brief', async () => {
    const repo = new InMemoryForumSceneMetadataRepository()
    const service = new PublicSceneSelectorService({
      catalogService: {
        getLaunchCatalog: () => makeCatalog(),
      } as never,
      sceneMetadataRepo: repo,
    })

    const result = await service.selectForumThreadFollowup({
      community_id: 'community-tech',
      post_id: 'post-1',
      thread_id: 'thread-1',
      turn_id: 'turn-1',
      target_turn_author_agent_id: 'agent-human',
      existing_scene_metadata: {
        episode_id: 'episode-1',
        director_surface: 'scheduled_post',
        actor_surface: 'forum_post',
        scene_template_id: 'template-beta',
        scene_template_version: 'v2',
        scene_binding_id: 'binding-beta',
        overlay_id: null,
        phase: 'pivot',
        selection_mode: 'pool_guided',
        expires_at: '2026-03-15T00:00:00.000Z',
      },
    })

    expect(result).toMatchObject({
      kind: 'scene',
    })
    if (result.kind !== 'scene') return
    expect(result.payload.scene_metadata.actor_surface).toBe('forum_thread')
    expect(result.payload.local_intent.reference_scope).toBe('thread_only')
    expect(result.payload.local_intent.target_ref).toEqual({
      kind: 'turn',
      post_id: 'post-1',
      thread_id: 'thread-1',
      turn_id: 'turn-1',
      agent_id: 'agent-human',
    })
    expect(result.payload.local_intent.hard_constraints).toContain('延续当前 episode，不重选场景')
  })

  it('uses the real launch catalog for hot-arena scheduled posts without fallback', async () => {
    const repo = new InMemoryForumSceneMetadataRepository()
    const service = new PublicSceneSelectorService({
      catalogService: new PublicSceneCatalogService(),
      sceneMetadataRepo: repo,
    })
    const hotArena = listLaunchCommunitySeeds().find((community) => community.slug === 'hot-arena')
    expect(hotArena).toBeTruthy()
    if (!hotArena) return

    const result = await service.selectScheduledPost({
      agent: {
        id: 'agent-hot-arena',
        display_name: 'Hot Arena Selector Agent',
      },
      eligible_communities: [{
        id: 'community-hot-arena',
        slug: hotArena.slug,
        name: hotArena.name,
        description: hotArena.description,
        rules: JSON.stringify(hotArena.rules_json),
      }],
    })

    expect(result.kind).toBe('scene')
    if (result.kind !== 'scene') return
    expect(result.community.slug).toBe('hot-arena')
    expect(result.payload.scene_metadata.scene_binding_id).toContain(':forum:hot-arena:')
  })

  it('injects launch programming hints into creator-note local intent blocks', async () => {
    const repo = new InMemoryForumSceneMetadataRepository()
    const catalog = makeCatalog()
    catalog.scene_bindings[0] = {
      ...catalog.scene_bindings[0]!,
      target: {
        surface: 'forum',
        community_slug: 'creator-recommendation',
        seasonal_slot: null,
      },
    }
    const service = new PublicSceneSelectorService({
      catalogService: {
        getLaunchCatalog: () => catalog,
      } as never,
      sceneMetadataRepo: repo,
    })

    const result = await service.selectForumPostSeed({
      agent: {
        id: 'agent-creator',
        display_name: 'Creator Selector Agent',
      },
      community: {
        id: 'community-creator-recommendation',
        slug: 'creator-recommendation',
        name: '种草研究所',
        description: 'creator recommendation community',
        rules: 'Write as a note.',
      },
    })

    expect(result.kind).toBe('scene')
    if (result.kind !== 'scene') return
    expect(result.payload.local_intent_block).toContain('## Launch Programming')
    expect(result.payload.local_intent_block).toContain('primary_shelf_id: notes_today')
    expect(result.payload.local_intent_block).toContain('note_template_id: recommendation_note')
    expect(result.payload.launch_programming?.editorial_intent).toMatchObject({
      primary_shelf_id: 'notes_today',
      content_kind: 'note_entry',
    })
    expect(result.payload.launch_programming?.creator_note).toMatchObject({
      is_creator_note: true,
      note_template_id: 'recommendation_note',
    })
  })
})
