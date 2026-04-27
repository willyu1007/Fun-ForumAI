import { describe, expect, it, vi } from 'vitest'
import { PROMPT_TEMPLATE_REFS } from '../../llm/prompt-template-refs.js'
import { listLaunchCommunitySeeds } from '../../launch/community-rules.js'
import { InMemoryForumSceneMetadataRepository } from '../../repos/forum-scene-metadata-repository.js'
import { DEFAULT_STAGE_SPEC_V1, type ScenePoolCatalog, type StageTemplateV2 } from '../../stage/index.js'
import { ForumDirectorPlanEnrichmentService } from '../forum-director-plan-enrichment-service.js'
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

function buildDirectorPlanGatewayResponse(content: string) {
  return {
    content,
    messages: [],
    usage: {
      prompt_tokens: 100,
      completion_tokens: 20,
      total_tokens: 120,
    },
    finishReason: 'stop',
    latencyMs: 15,
    platformRetryCount: 0,
    renderDecision: {
      voiceLineId: 'qwen-director-v1',
      tier: 'base',
      profileId: 'qwen-director-director-plan-base',
      policyId: 'hidden-director_plan-base',
      providerId: 'token-plan-openai',
      modelId: 'qwen3.6-plus',
      adapterId: 'openai-chat-completions-v1',
      region: 'cn-beijing',
      endpointId: 'token-plan-cn-beijing',
      credentialId: 'cred-1',
      fallbackLevel: 'none',
      reasons: ['profile-default'],
      promptTemplateId: PROMPT_TEMPLATE_REFS.internalForumScenePlan.id,
      promptVersion: PROMPT_TEMPLATE_REFS.internalForumScenePlan.version,
    },
    executionPlan: {} as never,
    promptRef: PROMPT_TEMPLATE_REFS.internalForumScenePlan,
    warnings: [],
  } as const
}

function makeSelectorWithDirectorPlan(input?: {
  llmConfigured?: boolean
  content?: string
  rejectWith?: Error
}) {
  const repo = new InMemoryForumSceneMetadataRepository()
  const generateHiddenArtifact = input?.rejectWith
    ? vi.fn().mockRejectedValue(input.rejectWith)
    : vi.fn().mockResolvedValue(buildDirectorPlanGatewayResponse(input?.content ?? '{}'))
  const directorPlanEnrichmentService = new ForumDirectorPlanEnrichmentService({
    llmGateway: {
      isConfigured: input?.llmConfigured ?? true,
      generateHiddenArtifact,
    } as never,
    sceneMetadataRepo: repo,
  })
  const service = new PublicSceneSelectorService({
    catalogService: {
      getLaunchCatalog: () => makeCatalog(),
    } as never,
    sceneMetadataRepo: repo,
    directorPlanEnrichmentService,
  })

  return {
    repo,
    service,
    generateHiddenArtifact,
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

  it('applies director-plan enrichment to scheduled_post root scenes and preserves deterministic authority', async () => {
    const { service, generateHiddenArtifact } = makeSelectorWithDirectorPlan({
      content: JSON.stringify({
        target_mood: 'playful',
        must_hit_points: ['先抛判断', '给读者留一个继续接的线头'],
        avoid_repeat: ['不要写成公告口吻'],
        soft_constraints_append: ['先给态度再补观察', '不要像运营文案'],
      }),
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

    expect(result.kind).toBe('scene')
    if (result.kind !== 'scene') return
    expect(generateHiddenArtifact).toHaveBeenCalledTimes(1)
    expect(generateHiddenArtifact.mock.calls[0]?.[0]).toMatchObject({
      intent: 'director_plan',
      promptRef: PROMPT_TEMPLATE_REFS.internalForumScenePlan,
      traceId: expect.stringContaining('director-plan:forum-root:'),
    })
    expect(result.community.id).toBe('community-tech')
    expect(result.payload.scene_metadata.scene_binding_id).toBe('binding-beta')
    expect(result.payload.episode_brief.target_mood).toBe('playful')
    expect(result.payload.episode_brief.must_hit_points).toEqual([
      '先抛判断',
      '给读者留一个继续接的线头',
    ])
    expect(result.payload.episode_brief.avoid_repeat).toEqual(['不要写成公告口吻'])
    expect(result.payload.local_intent.soft_constraints).toEqual([
      '让 template-beta 更可看',
      '推动关系继续演化',
      '先给态度再补观察',
    ])
    expect(result.payload.planning_audit?.director_plan_enrichment).toMatchObject({
      status: 'applied',
      prompt_ref: PROMPT_TEMPLATE_REFS.internalForumScenePlan,
      merged_fields: [
        'episode_brief.target_mood',
        'episode_brief.must_hit_points',
        'episode_brief.avoid_repeat',
        'local_intent.soft_constraints',
      ],
    })
  })

  it('applies director-plan enrichment to forum_post_seed without changing the locked target or binding', async () => {
    const { service } = makeSelectorWithDirectorPlan({
      content: JSON.stringify({
        target_mood: 'curious',
        must_hit_points: ['先亮出核心判断'],
      }),
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

    expect(result.kind).toBe('scene')
    if (result.kind !== 'scene') return
    expect(result.community.id).toBe('community-general')
    expect(result.payload.scene_metadata.scene_binding_id).toBe('binding-alpha')
    expect(result.payload.episode_brief.target_mood).toBe('curious')
    expect(result.payload.episode_brief.must_hit_points).toEqual(['先亮出核心判断'])
    expect(result.payload.planning_audit?.director_plan_enrichment).toMatchObject({
      status: 'applied',
    })
  })

  it('records skipped_unconfigured when the hidden director planner is unavailable', async () => {
    const { service, generateHiddenArtifact } = makeSelectorWithDirectorPlan({
      llmConfigured: false,
    })

    const result = await service.selectScheduledPost({
      agent: {
        id: 'agent-1',
        display_name: 'Selector Agent',
      },
      eligible_communities: [
        {
          id: 'community-tech',
          slug: 'tech',
          name: 'Tech',
          description: 'Tech community',
          rules: 'Be concrete.',
        },
      ],
    })

    expect(result.kind).toBe('scene')
    if (result.kind !== 'scene') return
    expect(generateHiddenArtifact).not.toHaveBeenCalled()
    expect(result.payload.episode_brief.target_mood).toBeUndefined()
    expect(result.payload.episode_brief.must_hit_points).toEqual([])
    expect(result.payload.planning_audit?.director_plan_enrichment).toMatchObject({
      status: 'skipped_unconfigured',
      prompt_ref: PROMPT_TEMPLATE_REFS.internalForumScenePlan,
    })
  })

  it('fails closed when the planner returns invalid json', async () => {
    const { service } = makeSelectorWithDirectorPlan({
      content: 'not-json',
    })

    const result = await service.selectScheduledPost({
      agent: {
        id: 'agent-1',
        display_name: 'Selector Agent',
      },
      eligible_communities: [
        {
          id: 'community-tech',
          slug: 'tech',
          name: 'Tech',
          description: 'Tech community',
          rules: 'Be concrete.',
        },
      ],
    })

    expect(result.kind).toBe('scene')
    if (result.kind !== 'scene') return
    expect(result.payload.episode_brief.target_mood).toBeUndefined()
    expect(result.payload.episode_brief.must_hit_points).toEqual([])
    expect(result.payload.local_intent.soft_constraints).toEqual([
      '让 template-beta 更可看',
      '推动关系继续演化',
    ])
    expect(result.payload.planning_audit?.director_plan_enrichment).toMatchObject({
      status: 'invalid_json',
      error_code: 'invalid_json',
    })
  })

  it('fails closed when the planner request errors', async () => {
    const { service } = makeSelectorWithDirectorPlan({
      rejectWith: new Error('planner timeout'),
    })

    const result = await service.selectScheduledPost({
      agent: {
        id: 'agent-1',
        display_name: 'Selector Agent',
      },
      eligible_communities: [
        {
          id: 'community-tech',
          slug: 'tech',
          name: 'Tech',
          description: 'Tech community',
          rules: 'Be concrete.',
        },
      ],
    })

    expect(result.kind).toBe('scene')
    if (result.kind !== 'scene') return
    expect(result.payload.episode_brief.target_mood).toBeUndefined()
    expect(result.payload.planning_audit?.director_plan_enrichment).toMatchObject({
      status: 'llm_failed',
      error_message: 'planner timeout',
    })
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

// ===========================================================================
// T-212 M3 — selectFromDiscussionCue
// ===========================================================================

describe('PublicSceneSelectorService.selectFromDiscussionCue', () => {
  function makeAgent(id: string, name: string = id) {
    return { id, display_name: name }
  }

  const community = {
    id: 'community-general',
    slug: 'general',
    name: 'General',
    description: '',
    rules: '',
  }

  const cueRef = { id: 'cue_a', community_id: 'community-general' }
  const briefRef = {
    audit_refs: { schedule_id: 'sched_1', cue_id: 'cue_a', attempt_id: 'att_1' },
  }

  it('returns dry_run with candidate_pool_size when dryRun=true (no scene built)', async () => {
    const repo = new InMemoryForumSceneMetadataRepository()
    const service = new PublicSceneSelectorService({
      catalogService: { getLaunchCatalog: () => makeCatalog() } as never,
      sceneMetadataRepo: repo,
    })
    const result = await service.selectFromDiscussionCue({
      cue: cueRef,
      brief: briefRef,
      community,
      agents: [makeAgent('a1'), makeAgent('a2'), makeAgent('a3')],
      dryRun: true,
    })
    expect(result.kind).toBe('dry_run')
    if (result.kind !== 'dry_run') return
    expect(result.cue_id).toBe('cue_a')
    expect(result.brief_compiled).toBe(true)
    expect(result.candidate_pool_size).toBe(3)
    expect(result.selected_cast_estimate.map((a) => a.id)).toEqual(['a1', 'a2', 'a3'])
  })

  it('skips when no agents are provided', async () => {
    const repo = new InMemoryForumSceneMetadataRepository()
    const service = new PublicSceneSelectorService({
      catalogService: { getLaunchCatalog: () => makeCatalog() } as never,
      sceneMetadataRepo: repo,
    })
    const result = await service.selectFromDiscussionCue({
      cue: cueRef,
      brief: briefRef,
      community,
      agents: [],
    })
    expect(result.kind).toBe('skip')
    if (result.kind !== 'skip') return
    expect(result.reason).toBe('cue_no_agents')
  })

  it('skips when cue.community_id does not match the supplied community', async () => {
    const repo = new InMemoryForumSceneMetadataRepository()
    const service = new PublicSceneSelectorService({
      catalogService: { getLaunchCatalog: () => makeCatalog() } as never,
      sceneMetadataRepo: repo,
    })
    const result = await service.selectFromDiscussionCue({
      cue: { id: 'cue_a', community_id: 'community-other' },
      brief: briefRef,
      community,
      agents: [makeAgent('a1')],
    })
    expect(result.kind).toBe('skip')
    if (result.kind !== 'skip') return
    expect(result.reason).toBe('cue_community_mismatch')
  })

  it('selects a scene with cast vector audit and primary author = cast[0] (R3 / R10)', async () => {
    const repo = new InMemoryForumSceneMetadataRepository()
    const service = new PublicSceneSelectorService({
      catalogService: { getLaunchCatalog: () => makeCatalog() } as never,
      sceneMetadataRepo: repo,
    })
    const result = await service.selectFromDiscussionCue({
      cue: cueRef,
      brief: briefRef,
      community,
      agents: [makeAgent('a1', 'Alice'), makeAgent('a2', 'Bob'), makeAgent('a3', 'Carol')],
    })
    expect(result.kind).toBe('scene')
    if (result.kind !== 'scene') return
    expect(result.selected_cast.map((a) => a.id)).toEqual(['a1', 'a2', 'a3'])
    const audit = result.payload.selection_audit as Record<string, unknown>
    expect(audit.cue_audit_refs).toEqual(briefRef.audit_refs)
    expect(audit.cue_primary_author_id).toBe('a1')
    expect((audit.cue_cast_pool as Array<{ id: string }>).map((a) => a.id)).toEqual([
      'a1',
      'a2',
      'a3',
    ])
  })

  it('does NOT modify selectScheduledPost behavior when consuming the same selector', async () => {
    // Sanity: calling selectFromDiscussionCue then selectScheduledPost must
    // produce a clean scheduled-post result (no cue audit leak into the
    // autonomous path).
    const repo = new InMemoryForumSceneMetadataRepository()
    const service = new PublicSceneSelectorService({
      catalogService: { getLaunchCatalog: () => makeCatalog() } as never,
      sceneMetadataRepo: repo,
    })
    await service.selectFromDiscussionCue({
      cue: cueRef,
      brief: briefRef,
      community,
      agents: [makeAgent('a1')],
    })
    const scheduled = await service.selectScheduledPost({
      agent: makeAgent('agent-x', 'X'),
      eligible_communities: [community],
    })
    expect(scheduled.kind).toBe('scene')
    if (scheduled.kind !== 'scene') return
    const audit = scheduled.payload.selection_audit as Record<string, unknown>
    expect(audit.cue_audit_refs).toBeUndefined()
    expect(audit.cue_cast_pool).toBeUndefined()
    expect(audit.cue_primary_author_id).toBeUndefined()
  })
})
