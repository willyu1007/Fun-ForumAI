import { describe, expect, it, vi } from 'vitest'
import { PostScheduler } from '../post-scheduler.js'
import type { PostSchedulerDeps } from '../post-scheduler.js'
import type { PublicSceneWritePayload } from '../../services/public-scene-runtime.js'

function buildScenePayload(): PublicSceneWritePayload {
  return {
    scene_metadata: {
      director_surface: 'scheduled_post',
      actor_surface: 'forum_post',
      scene_template_id: 'stage-theme-01',
      scene_template_version: 'v2',
      scene_binding_id: 'binding-1',
      overlay_id: null,
      episode_id: 'episode-1',
      beat_id: null,
      phase: 'opening',
      selection_mode: 'pool_guided',
      selection_id: 'selection-1',
      episode_plan_id: 'plan-1',
      local_intent_id: 'intent-1',
      started_at: '2026-03-13T00:00:00.000Z',
      expires_at: '2026-03-14T00:00:00.000Z',
    },
    episode_brief: {
      episode_id: 'episode-1',
      director_surface: 'scheduled_post',
      actor_surface: 'forum_post',
      template_id: 'stage-theme-01',
      template_version: 'v2',
      binding_id: 'binding-1',
      phase: 'opening',
      scene_goal: {
        viewer_goal: '推进讨论',
        growth_goal: '增加连贯性',
      },
      casting_directive: {
        must_have_roles: [],
        avoid_pairs: [],
        core_quota: 2,
        contrast_quota: 1,
        wildcard_quota: 1,
      },
      open_loops: [],
      must_hit_points: [],
      avoid_repeat: [],
      close_condition: {
        ttl_hours: 24,
        message_threshold: 12,
        objective: '推进讨论',
      },
      expires_at: '2026-03-14T00:00:00.000Z',
    },
    local_intent: {
      intent_id: 'intent-1',
      delivery_surface: 'forum_post',
      initiative: 'open_topic',
      opinion_policy: 'free_opinion',
      relation_focus: 'none',
      tone_hint: 'neutral',
      privacy_mode: 'public_only',
      memory_scope: 'public_contextual',
      reference_scope: 'seed_only',
      prohibited_reference_types: ['owner_private_speech', 'private_memory', 'hidden_director_goal'],
      target_ref: { kind: 'none' },
      hard_constraints: ['不得改写目标社区'],
      soft_constraints: ['推进讨论'],
    },
    local_intent_block: '## Local Intent\n- episode_id: episode-1',
    selection_audit: { community_id: 'community-1' },
    planning_audit: { episode_id: 'episode-1' },
  }
}

function createDeps(
  writeImpl: ReturnType<typeof vi.fn>,
  options: {
    communities?: Array<{
      id: string
      slug: string
      name: string
      description: string
      rules_json: Record<string, unknown>
    }>
    activeCommunityIdsByAgent?: string[]
    scheduledPostCommunityId?: string
    sceneSelection?: {
      kind: 'scene'
      community: {
        id: string
        slug: string
        name: string
        description: string
        rules: string
      }
      payload: PublicSceneWritePayload
    } | {
      kind: 'skip'
      reason: string
    }
    activeAgents?: Array<{
      id: string
      display_name: string
    }>
  } = {},
): PostSchedulerDeps {
  const communities = options.communities ?? [
    {
      id: 'community-1',
      slug: 'general',
      name: 'General',
      description: '',
      rules_json: {},
    },
  ]
  const scheduledPostCommunityId = options.scheduledPostCommunityId ?? communities[0]?.id ?? 'community-1'
  const selectedCommunity = communities.find((item) => item.id === scheduledPostCommunityId) ?? communities[0]!
  const defaultSceneSelection = options.sceneSelection ?? {
    kind: 'scene' as const,
    community: {
      id: selectedCommunity.id,
      slug: selectedCommunity.slug,
      name: selectedCommunity.name,
      description: selectedCommunity.description,
      rules: JSON.stringify(selectedCommunity.rules_json),
    },
    payload: buildScenePayload(),
  }
  const activeAgents = options.activeAgents ?? [
    {
      id: 'agent-1',
      display_name: 'Agent One',
    },
  ]

  return {
    llmGateway: {
      generateVisibleText: vi.fn(async () => ({
        content: 'mock llm output',
        messages: [],
        usage: { prompt_tokens: 10, completion_tokens: 12, total_tokens: 22 },
        latencyMs: 15,
        platformRetryCount: 0,
        renderDecision: {
          voiceLineId: 'qwen-social-v1',
          tier: 'base',
          profileId: 'profile-1',
          providerId: 'dashscope-openai',
          modelId: 'qwen-plus',
          region: 'cn',
          endpointId: 'default',
          credentialId: 'cred-1',
          fallbackLevel: 'none',
          reasons: ['test'],
          promptTemplateId: 'agent-create-post',
          promptVersion: 4,
        },
        promptRef: { id: 'agent-create-post', version: 4 },
      })),
    } as unknown as PostSchedulerDeps['llmGateway'],
    forumReadService: {
      getCommunities: vi.fn(async () => ({
        items: communities,
      })),
      getFeed: vi.fn(async () => ({ items: [] })),
    } as unknown as PostSchedulerDeps['forumReadService'],
    agentService: {
      listActiveAgents: vi.fn(() => ({
        items: activeAgents,
      })),
      getAgent: vi.fn((agentId: string) => ({
        id: agentId,
        display_name: activeAgents.find((item) => item.id === agentId)?.display_name ?? 'Agent',
        model: 'mock-model',
      })),
      getLatestConfig: vi.fn(() => null),
    } as unknown as PostSchedulerDeps['agentService'],
    responseParser: {
      parseAsScheduledPost: vi.fn(() => ({
        action: 'create_post',
        community_id: scheduledPostCommunityId,
        title: 'generated title',
        body: 'generated body',
      })),
    } as unknown as PostSchedulerDeps['responseParser'],
    dataplaneWriter: {
      write: writeImpl,
    } as unknown as PostSchedulerDeps['dataplaneWriter'],
    eventRepo: {
      create: vi.fn(() => ({ id: 'evt-1' })),
    } as unknown as PostSchedulerDeps['eventRepo'],
    agentRunRepo: {
      create: vi.fn(),
    } as unknown as PostSchedulerDeps['agentRunRepo'],
    membershipRepo: {
      listActiveCommunityIdsByAgent: vi.fn(() => options.activeCommunityIdsByAgent ?? communities.map((item) => item.id)),
    } as unknown as NonNullable<PostSchedulerDeps['membershipRepo']>,
    promptOrchestrator: {
      compose: vi.fn(async () => ({
        persona: {
          name: 'Agent One',
          style: 'neutral',
          interests: ['general'],
          language: 'zh-CN',
        },
        blocks: {
          hard_control_block: 'hard',
          compact_control_block: 'compact',
          current_context_block: 'context',
          memory_block: 'memory',
          soft_expression_block: 'soft',
        },
        audit: {
          version: 'v2',
          scene: 'scheduled_post',
          includedBlockIds: ['hard_control_block', 'current_context_block'],
          promptContract: 'compiled_blocks_v2',
          tokenEstimates: { hard_control_block: 1, current_context_block: 1 },
          lintWarnings: [],
          trimReasons: [],
        },
        runtimeEnvelope: null,
      })),
    } as unknown as PostSchedulerDeps['promptOrchestrator'],
    publicSceneSelectorService: {
      selectScheduledPost: vi.fn(async () => defaultSceneSelection),
    } as unknown as NonNullable<PostSchedulerDeps['publicSceneSelectorService']>,
    visualDirectiveService: {
      createScheduledPostDirective: vi.fn(async () => ({
        id: 'directive-1',
        schema_version: 'visual-directive.v1',
        scene_ref: {
          request_id: 'selection-1',
          director_surface: 'scheduled_post',
          actor_surface: 'forum_post',
          community_id: scheduledPostCommunityId,
          episode_id: 'episode-1',
          selection_id: 'selection-1',
          episode_plan_id: 'plan-1',
          local_intent_id: 'intent-1',
          phase: 'opening',
          selection_mode: 'pool_guided',
        },
        goal: {
          need_image: 'preferred',
          visual_role: 'scene_establishing',
          human_goal: 'worldbuilding',
          runtime_influence: 'medium',
          display_priority: 'primary',
        },
        narrative_context: {
          hook: '推进讨论',
          objective: '增加连贯性',
          tone_hint: 'neutral',
          relation_focus: 'none',
          semantic_query: '推进讨论',
          required_elements: ['推进讨论'],
          forbidden_elements: [],
          style_hint: null,
          aspect_ratio_hint: '4:5',
        },
        sourcing_policy: {
          allow_sources: ['self_public_archive', 'same_episode_public', 'private_derived_public', 'generated_public', 'same_thread_public', 'owner_private_pool'],
          prefer_order: ['self_public_archive', 'same_episode_public', 'private_derived_public', 'generated_public', 'same_thread_public', 'owner_private_pool'],
          allow_private_runtime_projection: true,
          allow_private_inspired_generation: false,
          allow_cross_agent_public: false,
          allow_generation: false,
          max_display_assets: 1,
        },
        guardrails: {
          privacy_mode: 'public_only',
          memory_scope: 'public_contextual',
          reference_scope: 'seed_only',
          display_policy: 'original_allowed',
          mention_policy: 'explicit_describe',
          text_in_image: 'avoid',
        },
        budget: {
          generation_tier: 'none',
          sync_generation_ms_budget: 0,
          async_generation_allowed: false,
          max_generation_attempts: 0,
        },
        audit: {
          director_reason: 'phase=opening',
          hard_constraints: [],
          soft_constraints: [],
        },
        created_at: new Date(),
        updated_at: new Date(),
      })),
    } as unknown as NonNullable<PostSchedulerDeps['visualDirectiveService']>,
    imagePlannerService: {
      planScheduledPost: vi.fn(async () => ({
        id: 'image-plan-1',
        directive_id: 'directive-1',
        schema_version: 'image-plan.v1',
        scene_ref: {
          request_id: 'selection-1',
          director_surface: 'scheduled_post',
          actor_surface: 'forum_post',
          community_id: scheduledPostCommunityId,
          episode_id: 'episode-1',
          selection_id: 'selection-1',
          episode_plan_id: 'plan-1',
          local_intent_id: 'intent-1',
          phase: 'opening',
          selection_mode: 'pool_guided',
        },
        status: 'ready',
        decision: 'reuse_public_original',
        reason: 'selected_owner_private_pool_for_public_original_display',
        runtime: {
          enabled: true,
          influence_level: 'medium',
          cards: [{
            schema_version: 'public-media-context-card.v1',
            card_id: 'card-1',
            modality: 'image',
            asset_ref: {
              asset_id: 'asset-1',
              semantic_snapshot_id: 'snapshot-1',
              projection_id: 'projection-1',
            },
            source: {
              kind: 'owner_private_pool',
              derived_from_private: true,
            },
            relation: {
              visual_role: 'scene_establishing',
              prompt_weight: 'primary',
              mention_policy: 'explicit_describe',
              why_now: '用于开场建立场景和阅读锚点。',
            },
            public_summary: {
              theme: 'travel',
              scene: 'city skyline',
              mood: 'bright',
              salient_entities: ['city'],
              discussion_points: ['城市氛围'],
              public_safe_caption: 'A bright city skyline.',
              alt_text: 'A bright city skyline.',
            },
            display: {
              original_display_allowed: true,
              derivative_display_allowed: true,
              preferred_variant: 'original',
            },
            governance: {
              public_scope: 'community_public',
              disclose_origin_policy: 'never',
              cross_agent_quote_allowed: false,
              prohibited_reference_types: ['owner_private_speech', 'private_memory', 'hidden_director_goal'],
              expires_at: null,
            },
            audit: {
              confidence: 0.9,
              relevance_score: 0.9,
              model_version: 'test',
            },
          }],
        },
        display: {
          enabled: true,
          attachments: [{
            slot: 0,
            binding_role: 'primary',
            asset_id: 'asset-1',
            mime_type: 'image/png',
            display_variant: 'original',
            derived_from_asset_id: null,
            aspect_ratio_hint: '4:5',
            public_caption: 'A bright city skyline.',
            alt_text: 'A bright city skyline.',
            attach_after_persist: true,
          }],
        },
        generation: {
          mode: 'none',
          status: 'not_requested',
        },
        selected_sources: [{
          source_kind: 'owner_private_pool',
          asset_id: 'asset-1',
          semantic_snapshot_id: 'snapshot-1',
          projection_id: 'projection-1',
          card_id: 'card-1',
          selection_score: 4.5,
          rejection_reason: null,
        }],
        planner_audit: {
          evaluated_candidates: 1,
          score_breakdown: {
            relevance: 1,
            continuity: 0.6,
            novelty: 1,
            privacy_safety: 0.75,
            display_fitness: 1,
            cost_fitness: 1,
            total: 4.5,
          },
          fallback_action: null,
        },
        created_at: new Date(),
        updated_at: new Date(),
      })),
    } as unknown as NonNullable<PostSchedulerDeps['imagePlannerService']>,
    mediaProjectionService: {
      serializePublicCardForPrompt: vi.fn(() => ({
        text: 'visual_role: scene_establishing\nwhy_now: 用于开场建立场景和阅读锚点。\ntheme/scene/mood: travel / city skyline / bright',
        token_estimate: 20,
        trimmed_fields: [],
        audit: {
          omitted_sensitive_fields: ['asset_id', 'asset_url', 'owner_note', 'raw_private_text'],
          contains_url: false,
          contains_asset_id: false,
          contains_owner_note: false,
          contains_private_text: false,
        },
      })),
    } as unknown as NonNullable<PostSchedulerDeps['mediaProjectionService']>,
  }
}

describe('PostScheduler', () => {
  it('does not consume daily quota when write fails', async () => {
    const write = vi.fn(async () => ({ success: false, error: 'write failed' }))
    const scheduler = new PostScheduler(createDeps(write), {
      postIntervalMs: 60_000,
      postMaxPerDay: 2,
    })

    const first = await scheduler.createPost()
    const second = await scheduler.createPost()

    expect(first.triggered).toBe(true)
    expect(first.post_id).toBeUndefined()
    expect(first.error).toBe('write failed')

    expect(second.triggered).toBe(true)
    expect(write).toHaveBeenCalledTimes(2)
    expect(scheduler.stats.postsToday).toBe(0)
    expect(scheduler.stats.lastPostAt).toBe(0)
  })

  it('passes persona observation into scheduled post writes', async () => {
    const write = vi.fn(async () => ({ success: true, content_id: 'post-1' }))
    const scheduler = new PostScheduler(createDeps(write), {
      postIntervalMs: 60_000,
      postMaxPerDay: 2,
    })

    const result = await scheduler.createPost()

    expect(result).toEqual(expect.objectContaining({
      triggered: true,
      post_id: 'post-1',
      agent_id: 'agent-1',
      community_id: 'community-1',
    }))
    expect(write).toHaveBeenCalledTimes(1)
    expect(write).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'create_post',
        community_id: 'community-1',
      }),
      'agent-1',
      'evt-1',
      expect.objectContaining({ total_tokens: 22 }),
      expect.any(Number),
      0,
      expect.objectContaining({
        source_callsite_id: 'post-scheduler-create-post',
        scene: 'scheduled_post',
        visibility: 'visible',
        coverage_status: 'visible_complete',
        parse_success: true,
      }),
    )
  })

  it('only schedules posts into communities where the agent is actively enrolled', async () => {
    const write = vi.fn(async () => ({ success: true, content_id: 'post-2' }))
    const scheduler = new PostScheduler(createDeps(write, {
      communities: [
        {
          id: 'community-1',
          slug: 'general',
          name: 'General',
          description: '',
          rules_json: {},
        },
        {
          id: 'community-2',
          slug: 'tech',
          name: 'Tech',
          description: '',
          rules_json: {},
        },
      ],
      activeCommunityIdsByAgent: ['community-2'],
      scheduledPostCommunityId: 'community-2',
    }), {
      postIntervalMs: 60_000,
      postMaxPerDay: 2,
    })

    const result = await scheduler.createPost()

    expect(result).toEqual(expect.objectContaining({
      triggered: true,
      community_id: 'community-2',
      post_id: 'post-2',
    }))
    expect(write).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'create_post',
        community_id: 'community-2',
      }),
      'agent-1',
      'evt-1',
      expect.objectContaining({ total_tokens: 22 }),
      expect.any(Number),
      0,
      expect.objectContaining({
        source_callsite_id: 'post-scheduler-create-post',
      }),
    )
  })

  it('locks scheduled_post to selector authority and switches to scene prompt version', async () => {
    const write = vi.fn(async () => ({ success: true, content_id: 'post-scene-1' }))
    const scenePayload = buildScenePayload()
    const deps = createDeps(write, {
      communities: [
        {
          id: 'community-1',
          slug: 'general',
          name: 'General',
          description: '',
          rules_json: {},
        },
        {
          id: 'community-2',
          slug: 'tech',
          name: 'Tech',
          description: '',
          rules_json: {},
        },
      ],
      activeCommunityIdsByAgent: ['community-1', 'community-2'],
      scheduledPostCommunityId: 'community-2',
      sceneSelection: {
        kind: 'scene',
        community: {
          id: 'community-2',
          slug: 'tech',
          name: 'Tech',
          description: '',
          rules: '',
        },
        payload: scenePayload,
      },
    })
    const scheduler = new PostScheduler(deps, {
      postIntervalMs: 60_000,
      postMaxPerDay: 2,
    })

    await scheduler.createPost()

    const firstGatewayCall = (
      deps.llmGateway.generateVisibleText as ReturnType<typeof vi.fn>
    ).mock.calls.at(0)?.[0] as { promptRef: { id: string; version: number }; variables: Record<string, string> } | undefined

    expect(firstGatewayCall?.promptRef)
      .toEqual({ id: 'agent-create-post', version: 4 })
    expect(Object.keys(firstGatewayCall?.variables ?? {}).every((key) => !key.startsWith('layer_'))).toBe(true)
    expect((deps.responseParser.parseAsScheduledPost as ReturnType<typeof vi.fn>).mock.calls.at(0)?.[0])
      .toEqual(expect.objectContaining({
        fallbackCommunityId: 'community-2',
        lockedCommunityId: 'community-2',
      }))
    const writeCall = write.mock.calls.at(0) as [Record<string, unknown>, string, string] | undefined
    expect(writeCall?.[0]).toEqual(expect.objectContaining({
      community_id: 'community-2',
      image_plan_id: 'image-plan-1',
      display_attachment_refs: [{
        asset_id: 'asset-1',
        slot: 0,
        display_variant: 'original',
      }],
      public_scene: expect.objectContaining({
        visual_ref: {
          directive_id: 'directive-1',
          image_plan_id: 'image-plan-1',
          runtime_card_ids: ['card-1'],
        },
      }),
    }))
    expect(writeCall?.[1]).toBe('agent-1')
    expect(writeCall?.[2]).toBe('evt-1')
  })

  it('falls back to unlocked community scheduling when selector cannot provide a public scene', async () => {
    const write = vi.fn(async () => ({ success: true, content_id: 'post-fallback-1' }))
    const deps = createDeps(write, {
      sceneSelection: {
        kind: 'skip',
        reason: 'scene_catalog_unavailable',
      },
    })
    const scheduler = new PostScheduler(deps, {
      postIntervalMs: 60_000,
      postMaxPerDay: 2,
    })

    const result = await scheduler.createPost()

    expect(result).toEqual(expect.objectContaining({
      triggered: true,
      agent_id: 'agent-1',
      community_id: 'community-1',
      post_id: 'post-fallback-1',
    }))
    expect((deps.llmGateway.generateVisibleText as ReturnType<typeof vi.fn>).mock.calls.at(0)?.[0]?.promptRef)
      .toEqual({ id: 'agent-create-post', version: 4 })
    expect((deps.responseParser.parseAsScheduledPost as ReturnType<typeof vi.fn>).mock.calls.at(0)?.[0])
      .toEqual(expect.objectContaining({
        fallbackCommunityId: 'community-1',
        lockedCommunityId: undefined,
      }))
    expect(write).toHaveBeenCalledTimes(1)
    const fallbackInstruction = (write as ReturnType<typeof vi.fn>).mock.calls.at(0)?.[0] as Record<string, unknown> | undefined
    expect(fallbackInstruction).toEqual(expect.objectContaining({
      community_id: 'community-1',
    }))
    expect(fallbackInstruction?.public_scene).toBeUndefined()
    expect(fallbackInstruction?.audit_metadata).toEqual(expect.objectContaining({
      scheduled_post_scene_selection: 'fallback',
      scheduled_post_scene_reason: 'scene_catalog_unavailable',
    }))
  })

  it('falls back to unlocked community scheduling when the selector service is unavailable', async () => {
    const write = vi.fn(async () => ({ success: true, content_id: 'post-1' }))
    const deps = createDeps(write)
    deps.publicSceneSelectorService = null
    const scheduler = new PostScheduler(deps, {
      postIntervalMs: 60_000,
      postMaxPerDay: 2,
    })

    const result = await scheduler.createPost()

    expect(result).toEqual(expect.objectContaining({
      triggered: true,
      agent_id: 'agent-1',
      community_id: 'community-1',
      post_id: 'post-1',
    }))
    expect((deps.llmGateway.generateVisibleText as ReturnType<typeof vi.fn>).mock.calls.at(0)?.[0]?.promptRef)
      .toEqual({ id: 'agent-create-post', version: 4 })
    expect(write).toHaveBeenCalledTimes(1)
    const selectorFallbackInstruction = (write as ReturnType<typeof vi.fn>).mock.calls.at(0)?.[0] as Record<string, unknown> | undefined
    expect(selectorFallbackInstruction?.audit_metadata).toEqual(expect.objectContaining({
      scheduled_post_scene_selection: 'fallback',
      scheduled_post_scene_reason: 'scene_selector_unavailable',
    }))
  })

  it('injects public media card context and image plan refs into scheduled post writes', async () => {
    const write = vi.fn(async () => ({ success: true, content_id: 'post-media-1' }))
    const deps = createDeps(write)
    const scheduler = new PostScheduler(deps, {
      postIntervalMs: 60_000,
      postMaxPerDay: 2,
    })

    const result = await scheduler.createPost()

    expect(result).toEqual(expect.objectContaining({
      triggered: true,
      agent_id: 'agent-1',
      post_id: 'post-media-1',
    }))
    expect((deps.promptOrchestrator?.compose as ReturnType<typeof vi.fn>).mock.calls.at(0)?.[0]?.currentContextSources)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          kind: 'public_media_card',
          source_id: 'card-1',
        }),
      ]))
    expect(write).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'create_post',
        image_plan_id: 'image-plan-1',
        display_attachment_refs: [{
          asset_id: 'asset-1',
          slot: 0,
          display_variant: 'original',
        }],
        public_scene: expect.objectContaining({
          visual_ref: {
            directive_id: 'directive-1',
            image_plan_id: 'image-plan-1',
            runtime_card_ids: ['card-1'],
          },
        }),
      }),
      'agent-1',
      'evt-1',
      expect.anything(),
      expect.any(Number),
      0,
      expect.anything(),
    )
  })

  it('blocks public media card prompt injection when serialization audit is unsafe', async () => {
    const write = vi.fn(async () => ({ success: true, content_id: 'post-media-unsafe-1' }))
    const deps = createDeps(write)
    ;(deps.mediaProjectionService?.serializePublicCardForPrompt as ReturnType<typeof vi.fn>).mockReturnValue({
      text: 'https://private.example.com/asset-1',
      token_estimate: 12,
      trimmed_fields: [],
      audit: {
        omitted_sensitive_fields: ['asset_id', 'asset_url', 'owner_note', 'raw_private_text'],
        contains_url: true,
        contains_asset_id: false,
        contains_owner_note: false,
        contains_private_text: false,
      },
    })
    const scheduler = new PostScheduler(deps, {
      postIntervalMs: 60_000,
      postMaxPerDay: 2,
    })

    await scheduler.createPost()

    const rawComposeCall = (deps.promptOrchestrator?.compose as ReturnType<typeof vi.fn>).mock.calls.at(0)?.[0]
    const composeCall = rawComposeCall as { currentContextSources?: Array<{ kind: string }> } | undefined
    expect(composeCall?.currentContextSources?.some((item) => item.kind === 'public_media_card')).toBe(false)

    const writeInstruction = (
      write.mock.calls.at(0) as [{ public_scene?: { planning_audit?: Record<string, unknown> } }, ...unknown[]] | undefined
    )?.[0]
    expect(writeInstruction?.public_scene?.planning_audit).toEqual(expect.objectContaining({
      public_media_prompt_injection_status: 'blocked_by_audit',
    }))
  })
})
