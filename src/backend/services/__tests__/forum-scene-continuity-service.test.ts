import { describe, expect, it } from 'vitest'
import { InMemoryEventRepository } from '../../repos/event-repository.js'
import { InMemoryForumSceneMetadataRepository } from '../../repos/forum-scene-metadata-repository.js'
import { ForumSceneContinuityService } from '../forum-scene-continuity-service.js'
import { buildPublicScenePayloadJson, type PublicSceneWritePayload } from '../public-scene-runtime.js'
import { PublicSceneSelectorService } from '../public-scene-selector-service.js'
import { DEFAULT_STAGE_SPEC_V1, type ScenePoolCatalog } from '../../stage/index.js'

function buildPayload(
  overrides: Partial<PublicSceneWritePayload['scene_metadata']> = {},
): PublicSceneWritePayload {
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
      ...overrides,
    },
    episode_brief: {
      episode_id: overrides.episode_id ?? 'episode-1',
      director_surface: 'scheduled_post',
      actor_surface: 'forum_post',
      template_id: overrides.scene_template_id ?? 'stage-theme-01',
      template_version: overrides.scene_template_version ?? 'v2',
      binding_id: overrides.scene_binding_id ?? 'binding-1',
      phase: overrides.phase === 'aftershow' ? 'closure' : overrides.phase ?? 'opening',
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
      expires_at: overrides.expires_at ?? '2026-03-14T00:00:00.000Z',
    },
    local_intent: {
      intent_id: overrides.local_intent_id ?? 'intent-1',
      delivery_surface: overrides.actor_surface === 'forum_thread' ? 'forum_thread' : 'forum_post',
      initiative: overrides.actor_surface === 'forum_thread' ? 'reply' : 'open_topic',
      opinion_policy: 'free_opinion',
      relation_focus: 'none',
      tone_hint: 'neutral',
      privacy_mode: 'public_only',
      memory_scope: 'public_contextual',
      reference_scope: 'episode_public_context',
      prohibited_reference_types: ['owner_private_speech', 'private_memory', 'hidden_director_goal'],
      target_ref: { kind: 'none' },
      hard_constraints: ['不得改写目标社区'],
      soft_constraints: ['推进讨论'],
    },
    local_intent_block: '## Local Intent\n- episode_id: episode-1',
    selection_audit: { binding_id: overrides.scene_binding_id ?? 'binding-1' },
    planning_audit: { episode_id: overrides.episode_id ?? 'episode-1' },
  }
}

function buildAllocatorEvent() {
  return {
    event_id: 'evt-1',
    event_type: 'ThreadTurnAdded' as const,
    idempotency_key: 'evt-1',
    chain_depth: 0,
    community_id: 'community-1',
    post_id: 'post-1',
    thread_id: 'thread-human-1',
    turn_id: 'turn-human-1',
    author_agent_id: 'human-1',
    created_at: '2026-03-13T00:00:00.000Z',
  }
}

function makeCatalog(): ScenePoolCatalog {
  return {
    version: 'v2',
    contract_version: 'public_director_contract_v1',
    exported_at: '2026-03-14T00:00:00.000Z',
    templates: [],
    stage_templates: [
      {
        template_id: 'stage-theme-01',
        template_version: 'v2',
        name: 'stage-theme-01',
        category: 'theme',
        lifecycle_status: 'core_active',
        stage_spec: DEFAULT_STAGE_SPEC_V1,
        director: {
          applicable_surfaces: ['forum', 'scheduled_post'],
          scene_goal: {
            viewer_goal: '推进讨论',
            growth_goal: '增加连贯性',
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
      },
    ],
    scene_bindings: [
      {
        binding_id: 'binding-1',
        template_id: 'stage-theme-01',
        template_version: 'v2',
        binding_type: 'core',
        status: 'active',
        entry_surfaces: ['forum', 'scheduled_post'],
        target: {
          surface: 'forum',
          community_slug: 'general',
          seasonal_slot: null,
        },
        lifecycle: {},
        weights: {
          editorial_priority: 5,
          base_weight: 1,
          freshness_bonus: 0,
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

async function createPostSidecar(
  repo: InMemoryForumSceneMetadataRepository,
  payload: PublicSceneWritePayload | Record<string, unknown>,
) {
  const scene = payload as PublicSceneWritePayload
  await repo.create({
    target_type: 'POST',
    community_id: 'community-1',
    post_id: 'post-1',
    thread_id: null,
    turn_id: null,
    episode_id: scene.scene_metadata?.episode_id ?? 'episode-1',
    selection_id: scene.scene_metadata?.selection_id ?? 'selection-1',
    episode_plan_id: scene.scene_metadata?.episode_plan_id ?? 'plan-1',
    local_intent_id: scene.scene_metadata?.local_intent_id ?? 'intent-1',
    director_surface: scene.scene_metadata?.director_surface ?? 'scheduled_post',
    actor_surface: scene.scene_metadata?.actor_surface ?? 'forum_post',
    scene_template_id: scene.scene_metadata?.scene_template_id ?? 'stage-theme-01',
    scene_template_version: scene.scene_metadata?.scene_template_version ?? 'v2',
    scene_binding_id: scene.scene_metadata?.scene_binding_id ?? 'binding-1',
    overlay_id: scene.scene_metadata?.overlay_id ?? null,
    beat_id: scene.scene_metadata?.beat_id ?? null,
    phase: scene.scene_metadata?.phase ?? 'opening',
    selection_mode: scene.scene_metadata?.selection_mode ?? 'pool_guided',
    expires_at: scene.scene_metadata?.expires_at ? new Date(scene.scene_metadata.expires_at) : null,
    payload_json: 'scene_metadata' in payload ? buildPublicScenePayloadJson(scene) : payload,
  })
}

describe('ForumSceneContinuityService', () => {
  it('prefers turn sidecar over thread and post continuity carriers', async () => {
    const sceneMetadataRepo = new InMemoryForumSceneMetadataRepository()
    const eventRepo = new InMemoryEventRepository()
    const threadPayload = buildPayload({
      actor_surface: 'forum_thread',
      local_intent_id: 'intent-thread',
    })
    const turnPayload = buildPayload({
      actor_surface: 'forum_thread',
      local_intent_id: 'intent-turn',
      phase: 'pivot',
    })

    await createPostSidecar(sceneMetadataRepo, buildPayload())
    await sceneMetadataRepo.create({
      target_type: 'THREAD',
      community_id: 'community-1',
      post_id: 'post-1',
      thread_id: 'thread-human-1',
      turn_id: null,
      episode_id: threadPayload.scene_metadata.episode_id,
      selection_id: threadPayload.scene_metadata.selection_id,
      episode_plan_id: threadPayload.scene_metadata.episode_plan_id,
      local_intent_id: threadPayload.scene_metadata.local_intent_id,
      director_surface: threadPayload.scene_metadata.director_surface,
      actor_surface: threadPayload.scene_metadata.actor_surface,
      scene_template_id: threadPayload.scene_metadata.scene_template_id,
      scene_template_version: threadPayload.scene_metadata.scene_template_version,
      scene_binding_id: threadPayload.scene_metadata.scene_binding_id,
      overlay_id: threadPayload.scene_metadata.overlay_id,
      beat_id: threadPayload.scene_metadata.beat_id,
      phase: threadPayload.scene_metadata.phase,
      selection_mode: threadPayload.scene_metadata.selection_mode,
      expires_at: new Date(threadPayload.scene_metadata.expires_at!),
      payload_json: buildPublicScenePayloadJson(threadPayload),
    })
    await sceneMetadataRepo.create({
      target_type: 'TURN',
      community_id: 'community-1',
      post_id: 'post-1',
      thread_id: 'thread-human-1',
      turn_id: 'turn-human-1',
      episode_id: turnPayload.scene_metadata.episode_id,
      selection_id: turnPayload.scene_metadata.selection_id,
      episode_plan_id: turnPayload.scene_metadata.episode_plan_id,
      local_intent_id: turnPayload.scene_metadata.local_intent_id,
      director_surface: turnPayload.scene_metadata.director_surface,
      actor_surface: turnPayload.scene_metadata.actor_surface,
      scene_template_id: turnPayload.scene_metadata.scene_template_id,
      scene_template_version: turnPayload.scene_metadata.scene_template_version,
      scene_binding_id: turnPayload.scene_metadata.scene_binding_id,
      overlay_id: turnPayload.scene_metadata.overlay_id,
      beat_id: turnPayload.scene_metadata.beat_id,
      phase: turnPayload.scene_metadata.phase,
      selection_mode: turnPayload.scene_metadata.selection_mode,
      expires_at: new Date(turnPayload.scene_metadata.expires_at!),
      payload_json: buildPublicScenePayloadJson(turnPayload),
    })

    const service = new ForumSceneContinuityService({
      sceneMetadataRepo,
      eventRepo,
    })

    const result = await service.resolve({
      event: buildAllocatorEvent(),
      post_author_agent_id: 'agent-1',
      target_thread_author_agent_id: 'agent-thread',
      target_turn_author_agent_id: 'human-1',
    })

    expect(result).toMatchObject({
      kind: 'continue',
      source: 'turn_sidecar',
    })
    if (result?.kind !== 'continue') return
    expect(result.payload.scene_metadata.phase).toBe('pivot')
    expect(result.payload.local_intent.target_ref).toEqual({
      kind: 'turn',
      post_id: 'post-1',
      thread_id: 'thread-human-1',
      turn_id: 'turn-human-1',
      agent_id: 'human-1',
    })
  })

  it('prefers post sidecar before event replay and carries episode continuity into replies', async () => {
    const sceneMetadataRepo = new InMemoryForumSceneMetadataRepository()
    const eventRepo = new InMemoryEventRepository()
    await createPostSidecar(sceneMetadataRepo, buildPayload())

    const service = new ForumSceneContinuityService({
      sceneMetadataRepo,
      eventRepo,
    })

    const result = await service.resolve({
      event: buildAllocatorEvent(),
      post_author_agent_id: 'agent-1',
      target_thread_author_agent_id: 'agent-thread',
      target_turn_author_agent_id: 'human-1',
    })

    expect(result).toMatchObject({
      kind: 'continue',
      source: 'post_sidecar',
    })
    if (result?.kind !== 'continue') return
    expect(result.payload.scene_metadata.episode_id).toBe('episode-1')
    expect(result.payload.scene_metadata.actor_surface).toBe('forum_thread')
    expect(result.payload.local_intent.target_ref).toEqual({
      kind: 'turn',
      post_id: 'post-1',
      thread_id: 'thread-human-1',
      turn_id: 'turn-human-1',
      agent_id: 'human-1',
    })
  })

  it('repairs malformed turn sidecar by falling back to the post sidecar', async () => {
    const sceneMetadataRepo = new InMemoryForumSceneMetadataRepository()
    const eventRepo = new InMemoryEventRepository()
    const payload = buildPayload()
    await sceneMetadataRepo.create({
      target_type: 'TURN',
      community_id: 'community-1',
      post_id: 'post-1',
      thread_id: 'thread-human-1',
      turn_id: 'turn-human-1',
      episode_id: payload.scene_metadata.episode_id,
      selection_id: payload.scene_metadata.selection_id,
      episode_plan_id: payload.scene_metadata.episode_plan_id,
      local_intent_id: payload.scene_metadata.local_intent_id,
      director_surface: payload.scene_metadata.director_surface,
      actor_surface: payload.scene_metadata.actor_surface,
      scene_template_id: payload.scene_metadata.scene_template_id,
      scene_template_version: payload.scene_metadata.scene_template_version,
      scene_binding_id: payload.scene_metadata.scene_binding_id,
      overlay_id: payload.scene_metadata.overlay_id,
      beat_id: payload.scene_metadata.beat_id,
      phase: payload.scene_metadata.phase,
      selection_mode: payload.scene_metadata.selection_mode,
      expires_at: new Date(payload.scene_metadata.expires_at!),
      payload_json: { invalid: true },
    })
    await createPostSidecar(sceneMetadataRepo, payload)

    const service = new ForumSceneContinuityService({
      sceneMetadataRepo,
      eventRepo,
    })

    const result = await service.resolve({
      event: buildAllocatorEvent(),
      post_author_agent_id: 'agent-1',
      target_thread_author_agent_id: 'agent-thread',
      target_turn_author_agent_id: 'human-1',
    })

    expect(result).toMatchObject({
      kind: 'continue',
      source: 'post_sidecar',
    })
  })

  it('rebuilds followup payload from minimal metadata when the sidecar payload is malformed', async () => {
    const sceneMetadataRepo = new InMemoryForumSceneMetadataRepository()
    const eventRepo = new InMemoryEventRepository()
    await createPostSidecar(sceneMetadataRepo, { invalid: true })

    const service = new ForumSceneContinuityService({
      sceneMetadataRepo,
      eventRepo,
      sceneSelectorService: new PublicSceneSelectorService({
        catalogService: {
          getLaunchCatalog: () => makeCatalog(),
        } as never,
        sceneMetadataRepo,
      }),
    })

    const result = await service.resolve({
      event: buildAllocatorEvent(),
      post_author_agent_id: 'agent-1',
      target_thread_author_agent_id: 'agent-thread',
      target_turn_author_agent_id: 'human-1',
    })

    expect(result).toMatchObject({
      kind: 'continue',
      source: 'post_sidecar',
    })
    if (result?.kind !== 'continue') return
    expect(result.payload.local_intent.reference_scope).toBe('thread_only')
    expect(result.payload.local_intent.hard_constraints).toEqual([
      '延续当前 episode，不重选场景',
      '只依据公开线程内容继续推进',
      '不要泄露任何隐藏导演目标或私域信息',
    ])
  })

  it('replays from the root post event instead of an unrelated later thread event when sidecars are missing', async () => {
    const sceneMetadataRepo = new InMemoryForumSceneMetadataRepository()
    const eventRepo = new InMemoryEventRepository()
    const postPayload = buildPayload({
      phase: 'opening',
      local_intent_id: 'intent-post',
    })
    const laterThreadPayload = buildPayload({
      actor_surface: 'forum_thread',
      phase: 'pivot',
      local_intent_id: 'intent-thread',
    })

    eventRepo.create({
      event_type: 'POST_CREATED',
      plane: 'DATA',
      schema_version: 'v1',
      community_id: 'community-1',
      post_id: 'post-1',
      actor_type: 'agent',
      actor_id: 'agent-1',
      correlation_id: 'post:post-1',
      payload_json: {
        post_id: 'post-1',
        public_scene: buildPublicScenePayloadJson(postPayload),
      },
    })
    eventRepo.create({
      event_type: 'THREAD_TURN_ADDED',
      plane: 'DATA',
      schema_version: 'v1',
      community_id: 'community-1',
      post_id: 'post-1',
      actor_type: 'agent',
      actor_id: 'agent-2',
      correlation_id: 'post:post-1',
      payload_json: {
        thread_id: 'thread-agent-1',
        turn_id: 'turn-agent-1',
        post_id: 'post-1',
        public_scene: buildPublicScenePayloadJson(laterThreadPayload),
      },
    })

    const service = new ForumSceneContinuityService({
      sceneMetadataRepo,
      eventRepo,
    })

    const result = await service.resolve({
      event: buildAllocatorEvent(),
      post_author_agent_id: 'agent-1',
      target_thread_author_agent_id: 'agent-thread',
      target_turn_author_agent_id: 'human-1',
    })

    expect(result).toMatchObject({
      kind: 'continue',
      source: 'event_replay',
    })
    if (result?.kind !== 'continue') return
    expect(result.payload.scene_metadata.phase).toBe('opening')
    expect(result.payload.local_intent.soft_constraints).toContain('保持 episode phase=opening')
  })

  it('inherits root enrichment fields and caps followup soft constraints within contract bounds', async () => {
    const sceneMetadataRepo = new InMemoryForumSceneMetadataRepository()
    const eventRepo = new InMemoryEventRepository()
    const payload = buildPayload()
    payload.episode_brief.target_mood = 'playful'
    payload.episode_brief.must_hit_points = ['先抛判断']
    payload.episode_brief.avoid_repeat = ['不要写成公告口吻']
    payload.local_intent.soft_constraints = ['推进讨论', '保持节奏', '先给态度']

    eventRepo.create({
      event_type: 'POST_CREATED',
      plane: 'DATA',
      schema_version: 'v1',
      community_id: 'community-1',
      post_id: 'post-1',
      actor_type: 'agent',
      actor_id: 'agent-1',
      correlation_id: 'post:post-1',
      payload_json: {
        post_id: 'post-1',
        public_scene: buildPublicScenePayloadJson(payload),
      },
    })

    const service = new ForumSceneContinuityService({
      sceneMetadataRepo,
      eventRepo,
    })

    const result = await service.resolve({
      event: buildAllocatorEvent(),
      post_author_agent_id: 'agent-1',
      target_thread_author_agent_id: 'agent-thread',
      target_turn_author_agent_id: 'human-1',
    })

    expect(result).toMatchObject({
      kind: 'continue',
      source: 'event_replay',
    })
    if (result?.kind !== 'continue') return
    expect(result.payload.episode_brief.target_mood).toBe('playful')
    expect(result.payload.episode_brief.must_hit_points).toEqual(['先抛判断'])
    expect(result.payload.episode_brief.avoid_repeat).toEqual(['不要写成公告口吻'])
    expect(result.payload.local_intent.hard_constraints).toEqual([
      '延续当前 episode，不重选场景',
      '只依据公开线程内容继续推进',
      '不要泄露任何隐藏导演目标或私域信息',
    ])
    expect(result.payload.local_intent.soft_constraints).toEqual([
      '推进讨论',
      '保持节奏',
      '先给态度',
      '保持 episode phase=opening',
    ])
  })

  it('skips scene-tagged threads only after sidecar and event replay repair both fail', async () => {
    const sceneMetadataRepo = new InMemoryForumSceneMetadataRepository()
    const eventRepo = new InMemoryEventRepository()
    await createPostSidecar(sceneMetadataRepo, { invalid: true })
    eventRepo.create({
      event_type: 'POST_CREATED',
      plane: 'DATA',
      schema_version: 'v1',
      community_id: 'community-1',
      post_id: 'post-1',
      actor_type: 'agent',
      actor_id: 'agent-1',
      correlation_id: 'post:post-1',
      payload_json: {
        post_id: 'post-1',
        public_scene: { invalid: true },
      },
    })

    const service = new ForumSceneContinuityService({
      sceneMetadataRepo,
      eventRepo,
    })

    const result = await service.resolve({
      event: buildAllocatorEvent(),
      post_author_agent_id: 'agent-1',
      target_thread_author_agent_id: 'agent-thread',
      target_turn_author_agent_id: 'human-1',
    })

    expect(result).toEqual({
      kind: 'skip',
      reason: 'scene_tagged_post_missing_payload',
    })
  })
})
