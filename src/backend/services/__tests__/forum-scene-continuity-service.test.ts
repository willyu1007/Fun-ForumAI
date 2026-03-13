import { describe, expect, it } from 'vitest'
import { InMemoryEventRepository } from '../../repos/event-repository.js'
import { InMemoryForumSceneMetadataRepository } from '../../repos/forum-scene-metadata-repository.js'
import { ForumSceneContinuityService } from '../forum-scene-continuity-service.js'
import { buildPublicScenePayloadJson, type PublicSceneWritePayload } from '../public-scene-runtime.js'

function buildPayload(
  overrides: Partial<PublicSceneWritePayload['scene_metadata']> = {},
): PublicSceneWritePayload {
  return {
    scene_metadata: {
      director_surface: 'scheduled_post',
      actor_surface: 'forum_post',
      scene_template_id: 'stage-theme-01',
      scene_template_version: 'legacy-v1',
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
      template_version: overrides.scene_template_version ?? 'legacy-v1',
      binding_id: overrides.scene_binding_id ?? 'binding-1',
      phase: overrides.phase ?? 'opening',
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
      delivery_surface: overrides.actor_surface === 'forum_comment' ? 'forum_comment' : 'forum_post',
      initiative: overrides.actor_surface === 'forum_comment' ? 'reply' : 'open_topic',
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
    fallback_reason: null,
  }
}

function buildAllocatorEvent() {
  return {
    event_id: 'evt-1',
    event_type: 'NewCommentCreated' as const,
    idempotency_key: 'evt-1',
    chain_depth: 0,
    community_id: 'community-1',
    post_id: 'post-1',
    comment_id: 'comment-human-1',
    author_agent_id: 'human-1',
    created_at: '2026-03-13T00:00:00.000Z',
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
    comment_id: null,
    episode_id: scene.scene_metadata?.episode_id ?? 'episode-1',
    selection_id: scene.scene_metadata?.selection_id ?? 'selection-1',
    episode_plan_id: scene.scene_metadata?.episode_plan_id ?? 'plan-1',
    local_intent_id: scene.scene_metadata?.local_intent_id ?? 'intent-1',
    director_surface: scene.scene_metadata?.director_surface ?? 'scheduled_post',
    actor_surface: scene.scene_metadata?.actor_surface ?? 'forum_post',
    scene_template_id: scene.scene_metadata?.scene_template_id ?? 'stage-theme-01',
    scene_template_version: scene.scene_metadata?.scene_template_version ?? 'legacy-v1',
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
      target_comment_author_agent_id: 'human-1',
    })

    expect(result).toMatchObject({
      kind: 'continue',
      source: 'post_sidecar',
    })
    if (result?.kind !== 'continue') return
    expect(result.payload.scene_metadata.episode_id).toBe('episode-1')
    expect(result.payload.scene_metadata.actor_surface).toBe('forum_comment')
    expect(result.payload.local_intent.target_ref).toEqual({
      kind: 'comment',
      post_id: 'post-1',
      comment_id: 'comment-human-1',
      agent_id: 'human-1',
    })
  })

  it('repairs malformed comment sidecar by falling back to the post sidecar', async () => {
    const sceneMetadataRepo = new InMemoryForumSceneMetadataRepository()
    const eventRepo = new InMemoryEventRepository()
    const payload = buildPayload()
    await sceneMetadataRepo.create({
      target_type: 'COMMENT',
      community_id: 'community-1',
      post_id: 'post-1',
      comment_id: 'comment-human-1',
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
      target_comment_author_agent_id: 'human-1',
    })

    expect(result).toMatchObject({
      kind: 'continue',
      source: 'post_sidecar',
    })
  })

  it('replays from the root post event instead of a later comment event when sidecars are missing', async () => {
    const sceneMetadataRepo = new InMemoryForumSceneMetadataRepository()
    const eventRepo = new InMemoryEventRepository()
    const postPayload = buildPayload({
      phase: 'opening',
      local_intent_id: 'intent-post',
    })
    const laterCommentPayload = buildPayload({
      actor_surface: 'forum_comment',
      phase: 'pivot',
      local_intent_id: 'intent-comment',
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
      event_type: 'COMMENT_CREATED',
      plane: 'DATA',
      schema_version: 'v1',
      community_id: 'community-1',
      post_id: 'post-1',
      actor_type: 'agent',
      actor_id: 'agent-2',
      correlation_id: 'post:post-1',
      payload_json: {
        comment_id: 'comment-agent-1',
        post_id: 'post-1',
        public_scene: buildPublicScenePayloadJson(laterCommentPayload),
      },
    })

    const service = new ForumSceneContinuityService({
      sceneMetadataRepo,
      eventRepo,
    })

    const result = await service.resolve({
      event: buildAllocatorEvent(),
      post_author_agent_id: 'agent-1',
      target_comment_author_agent_id: 'human-1',
    })

    expect(result).toMatchObject({
      kind: 'continue',
      source: 'event_replay',
    })
    if (result?.kind !== 'continue') return
    expect(result.payload.scene_metadata.phase).toBe('opening')
    expect(result.payload.local_intent.soft_constraints).toContain('保持 episode phase=opening')
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
      target_comment_author_agent_id: 'human-1',
    })

    expect(result).toEqual({
      kind: 'skip',
      reason: 'scene_tagged_post_missing_payload',
    })
  })
})
