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
          promptVersion: 2,
        },
        promptRef: { id: 'agent-create-post', version: 2 },
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
        items: [
          {
            id: 'agent-1',
            display_name: 'Agent One',
          },
        ],
      })),
      getAgent: vi.fn(() => ({
        id: 'agent-1',
        display_name: 'Agent One',
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
    publicSceneSelectorService: {
      selectScheduledPost: vi.fn(async () => defaultSceneSelection),
    } as unknown as NonNullable<PostSchedulerDeps['publicSceneSelectorService']>,
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

    expect((deps.llmGateway.generateVisibleText as ReturnType<typeof vi.fn>).mock.calls[0]?.[0].promptRef)
      .toEqual({ id: 'agent-create-post', version: 2 })
    expect((deps.responseParser.parseAsScheduledPost as ReturnType<typeof vi.fn>).mock.calls[0]?.[0])
      .toEqual(expect.objectContaining({
        fallbackCommunityId: 'community-2',
        lockedCommunityId: 'community-2',
      }))
    expect(write).toHaveBeenCalledWith(
      expect.objectContaining({
        community_id: 'community-2',
        public_scene: scenePayload,
      }),
      'agent-1',
      'evt-1',
      expect.anything(),
      expect.any(Number),
      0,
      expect.anything(),
    )
  })

  it('skips scheduled_post when selector cannot provide a public scene', async () => {
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

    expect(result).toEqual({
      triggered: true,
      agent_id: 'agent-1',
      error: 'Public scene unavailable: scene_catalog_unavailable',
    })
    expect(deps.llmGateway.generateVisibleText).not.toHaveBeenCalled()
    expect(write).not.toHaveBeenCalled()
  })

  it('reports selector service misconfiguration as a triggered scheduling failure', async () => {
    const write = vi.fn(async () => ({ success: true, content_id: 'post-1' }))
    const deps = createDeps(write)
    deps.publicSceneSelectorService = null
    const scheduler = new PostScheduler(deps, {
      postIntervalMs: 60_000,
      postMaxPerDay: 2,
    })

    const result = await scheduler.createPost()

    expect(result).toEqual({
      triggered: true,
      agent_id: 'agent-1',
      error: 'Public scene selector unavailable',
    })
    expect(deps.llmGateway.generateVisibleText).not.toHaveBeenCalled()
    expect(write).not.toHaveBeenCalled()
  })
})
