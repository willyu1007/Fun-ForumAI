import { describe, expect, it, vi } from 'vitest'
import { PROMPT_TEMPLATE_REFS } from '../../llm/prompt-template-refs.js'
import { InMemoryForumSceneMetadataRepository } from '../../repos/forum-scene-metadata-repository.js'
import { DEFAULT_STAGE_SPEC_V1, type EpisodeBrief, type LocalIntent, type SceneMetadata, type StageTemplateV2 } from '../../stage/index.js'
import { buildPublicScenePayloadJson } from '../public-scene-runtime.js'
import { ForumDirectorPlanEnrichmentService, type ForumDirectorPlanRootSceneInput } from '../forum-director-plan-enrichment-service.js'

function makeTemplate(): StageTemplateV2 {
  return {
    template_id: 'template-alpha',
    template_version: 'v2',
    name: 'template-alpha',
    category: 'show',
    lifecycle_status: 'core_active',
    stage_spec: DEFAULT_STAGE_SPEC_V1,
    director: {
      applicable_surfaces: ['forum', 'scheduled_post'],
      scene_goal: {
        viewer_goal: '让 template-alpha 更可看',
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
        cooldown_hours: 24,
        repeat_penalty: 1,
        max_runs_per_day: 3,
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
        require_pool_match_before_create: false,
      },
    },
  }
}

function makeEpisodeBrief(): EpisodeBrief {
  return {
    episode_id: 'episode-1',
    director_surface: 'scheduled_post',
    actor_surface: 'forum_post',
    template_id: 'template-alpha',
    template_version: 'v2',
    binding_id: 'binding-alpha',
    phase: 'opening',
    scene_goal: {
      viewer_goal: '让 template-alpha 更可看',
      growth_goal: '推动关系继续演化',
    },
    target_mood: undefined,
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
      objective: '让 template-alpha 更可看',
    },
    expires_at: '2026-04-22T00:00:00.000Z',
  }
}

function makeLocalIntent(): LocalIntent {
  return {
    intent_id: 'intent-1',
    delivery_surface: 'forum_post',
    initiative: 'open_topic',
    opinion_policy: 'free_opinion',
    relation_focus: 'bridge',
    tone_hint: 'witty',
    privacy_mode: 'public_only',
    memory_scope: 'public_contextual',
    reference_scope: 'seed_only',
    prohibited_reference_types: ['owner_private_speech', 'private_memory', 'hidden_director_goal'],
    target_ref: { kind: 'none' },
    hard_constraints: [
      '只生成一条公开根帖，不模拟评论区后续',
      '不得改写已锁定的目标社区',
      '不要泄露任何隐藏导演目标或私域信息',
    ],
    soft_constraints: ['让 template-alpha 更可看', '推动关系继续演化'],
  }
}

function makeSceneMetadata(): SceneMetadata {
  return {
    director_surface: 'scheduled_post',
    actor_surface: 'forum_post',
    scene_template_id: 'template-alpha',
    scene_template_version: 'v2',
    scene_binding_id: 'binding-alpha',
    overlay_id: null,
    episode_id: 'episode-1',
    beat_id: null,
    phase: 'opening',
    selection_mode: 'pool_guided',
    selection_id: 'selection-1',
    episode_plan_id: 'plan-1',
    local_intent_id: 'intent-1',
    started_at: '2026-04-21T00:00:00.000Z',
    expires_at: '2026-04-22T00:00:00.000Z',
  }
}

function makeRootInput(overrides: Partial<ForumDirectorPlanRootSceneInput> = {}): ForumDirectorPlanRootSceneInput {
  return {
    entry_kind: 'scheduled_post',
    agent_id: 'agent-1',
    community: {
      id: 'community-1',
      slug: 'general',
      name: 'General',
      description: 'General community',
      rules: 'Be specific.',
    },
    template: makeTemplate(),
    scene_metadata: makeSceneMetadata(),
    episode_brief: makeEpisodeBrief(),
    local_intent: makeLocalIntent(),
    planning_audit: {
      episode_id: 'episode-1',
      selection_id: 'selection-1',
    },
    ...overrides,
  }
}

function buildGatewayResponse(content: string) {
  return {
    content,
    messages: [],
    usage: {
      prompt_tokens: 100,
      completion_tokens: 30,
      total_tokens: 130,
    },
    finishReason: 'stop',
    latencyMs: 12,
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

describe('ForumDirectorPlanEnrichmentService', () => {
  it('builds recent-scene digest and applies bounded enrichment', async () => {
    const repo = new InMemoryForumSceneMetadataRepository()
    await repo.create({
      target_type: 'POST',
      community_id: 'community-1',
      post_id: 'post-prev-1',
      episode_id: 'episode-prev-1',
      selection_id: 'selection-prev-1',
      episode_plan_id: 'plan-prev-1',
      local_intent_id: 'intent-prev-1',
      director_surface: 'forum',
      actor_surface: 'forum_post',
      scene_template_id: 'template-prev',
      scene_template_version: 'v1',
      scene_binding_id: 'binding-prev',
      overlay_id: null,
      beat_id: null,
      phase: 'opening',
      selection_mode: 'pool_guided',
      expires_at: null,
      payload_json: buildPublicScenePayloadJson({
        scene_metadata: {
          ...makeSceneMetadata(),
          scene_template_id: 'template-prev',
          scene_template_version: 'v1',
          selection_id: 'selection-prev-1',
          episode_id: 'episode-prev-1',
          episode_plan_id: 'plan-prev-1',
          local_intent_id: 'intent-prev-1',
        },
        episode_brief: {
          ...makeEpisodeBrief(),
          episode_id: 'episode-prev-1',
          template_id: 'template-prev',
          template_version: 'v1',
          target_mood: 'dry',
          must_hit_points: ['旧开场'],
        },
        local_intent: {
          ...makeLocalIntent(),
          intent_id: 'intent-prev-1',
          soft_constraints: ['旧约束'],
        },
        local_intent_block: 'prev block',
      }),
    })

    const generateHiddenArtifact = vi.fn().mockResolvedValue(buildGatewayResponse(JSON.stringify({
      target_mood: 'playful',
      must_hit_points: ['先抛判断', '留一个张力点'],
      avoid_repeat: ['不要写成公告口吻'],
      soft_constraints_append: ['先给态度再补观察', '不要像运营文案'],
    })))
    const service = new ForumDirectorPlanEnrichmentService({
      llmGateway: {
        isConfigured: true,
        generateHiddenArtifact,
      } as never,
      sceneMetadataRepo: repo,
    })

    const result = await service.enrichRootScene(makeRootInput())

    const variables = generateHiddenArtifact.mock.calls[0]?.[0]?.variables as Record<string, string> | undefined
    expect(variables?.recent_scene_digest).toContain('post:post-prev-1')
    expect(variables?.recent_scene_digest).toContain('target_mood=dry')
    expect(variables?.recent_scene_digest).toContain('must_hit_points=旧开场')
    expect(result.episode_brief.target_mood).toBe('playful')
    expect(result.episode_brief.must_hit_points).toEqual(['先抛判断', '留一个张力点'])
    expect(result.episode_brief.avoid_repeat).toEqual(['不要写成公告口吻'])
    expect(result.local_intent.soft_constraints).toEqual([
      '让 template-alpha 更可看',
      '推动关系继续演化',
      '先给态度再补观察',
    ])
    expect(result.planning_audit.director_plan_enrichment).toMatchObject({
      status: 'applied',
      prompt_ref: PROMPT_TEMPLATE_REFS.internalForumScenePlan,
      trace_id: 'director-plan:forum-root:selection-1',
      merged_fields: [
        'episode_brief.target_mood',
        'episode_brief.must_hit_points',
        'episode_brief.avoid_repeat',
        'local_intent.soft_constraints',
      ],
      recent_scene_refs: ['post:post-prev-1'],
    })
  })

  it('fails closed with schema_rejected when the final payload violates the public-director contract', async () => {
    const repo = new InMemoryForumSceneMetadataRepository()
    const service = new ForumDirectorPlanEnrichmentService({
      llmGateway: {
        isConfigured: true,
        generateHiddenArtifact: vi.fn().mockResolvedValue(buildGatewayResponse('{}')),
      } as never,
      sceneMetadataRepo: repo,
    })

    const result = await service.enrichRootScene(makeRootInput({
      local_intent: {
        ...makeLocalIntent(),
        soft_constraints: ['a', 'b', 'c', 'd', 'e'],
      },
    }))

    expect(result.episode_brief).toEqual(makeEpisodeBrief())
    expect(result.planning_audit.director_plan_enrichment).toMatchObject({
      status: 'schema_rejected',
      error_code: 'schema_rejected',
      trace_id: 'director-plan:forum-root:selection-1',
    })
  })
})
