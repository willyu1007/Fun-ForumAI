import { describe, expect, it } from 'vitest'
import {
  buildSceneBindingV1FromManifestItem,
  localIntentSchema,
  privateChatContextSchema,
  projectLegacyTemplateToStageTemplateV2,
  proactiveDmOpeningContextSchema,
  runtimeSceneStateV1Schema,
  sceneMetadataSchema,
} from '../public-director-contract.js'

describe('public-director-contract', () => {
  it('projects legacy templates into stage_template_v2 with safe director defaults', () => {
    const projected = projectLegacyTemplateToStageTemplateV2(
      {
        id: 'stage-theme-01',
        category: 'theme',
        path: 'templates/stage-theme-01.yaml',
        status: 'launch',
        binding: {
          community_slug: 'general',
          binding_type: 'core',
        },
      },
      {
        template_id: 'stage-theme-01',
        name: 'Stage Theme 01',
        stage_spec: {
          version: 'v1',
        },
      },
    )

    expect(projected.lifecycle_status).toBe('core_active')
    expect(projected.director.applicable_surfaces).toEqual(['forum', 'scheduled_post'])
    expect(projected.director.scene_goal.viewer_goal).toContain('公域讨论')
    expect(projected.director.autonomy_policy.allow_autonomous_mutation).toBe(false)
  })

  it('projects manifest bindings into scene_binding_v1 forum targets', () => {
    const binding = buildSceneBindingV1FromManifestItem({
      id: 'stage-theme-02',
      category: 'theme',
      path: 'templates/stage-theme-02.yaml',
      status: 'launch',
      binding: {
        community_slug: 'philosophy',
        slot: 'season-slot-1',
        binding_type: 'seasonal',
      },
    })

    expect(binding).not.toBeNull()
    expect(binding?.target.surface).toBe('forum')
    expect(binding?.entry_surfaces).toEqual(['forum', 'scheduled_post'])
    expect(binding?.target).toMatchObject({
      community_slug: 'philosophy',
      seasonal_slot: 'season-slot-1',
    })
  })

  it('rejects forum launch bindings when director applicable surfaces exclude legacy forum entry points', () => {
    const item = {
      id: 'stage-theme-chat-only',
      category: 'theme',
      path: 'templates/stage-theme-chat-only.yaml',
      status: 'launch',
      binding: {
        community_slug: 'general',
        binding_type: 'core',
      },
    } as const
    const projected = projectLegacyTemplateToStageTemplateV2(item, {
      template_id: 'stage-theme-chat-only',
      name: 'Stage Theme Chat Only',
      stage_spec: {
        version: 'v1',
      },
      director: {
        applicable_surfaces: ['chat_room'],
      },
    })

    expect(() => buildSceneBindingV1FromManifestItem(item, projected.director)).toThrow()
  })

  it('validates private/public contract boundary objects', () => {
    const localIntent = localIntentSchema.parse({
      intent_id: 'intent-1',
      delivery_surface: 'forum_comment',
      initiative: 'reply',
      opinion_policy: 'free_opinion',
      relation_focus: 'bridge',
      tone_hint: 'warm',
      privacy_mode: 'public_only',
      memory_scope: 'public_contextual',
      reference_scope: 'thread_only',
      prohibited_reference_types: ['owner_private_speech'],
      target_ref: {
        kind: 'comment',
        post_id: 'post-1',
        comment_id: 'comment-1',
      },
      hard_constraints: ['直接接住当前评论的核心观点'],
      soft_constraints: ['保持轻微幽默'],
    })
    const privateContext = privateChatContextSchema.parse({
      agent_id: 'agent-1',
      owner_id: 'owner-1',
      session_id: 'session-1',
      relationship_state: 'trusted',
      recent_messages: ['hello'],
      private_memories: ['owner likes direct feedback'],
      privacy_mode: 2,
      session_origin: 'ongoing',
    })
    const proactiveContext = proactiveDmOpeningContextSchema.parse({
      trigger_type: 'vote_received',
      trigger_context: '你的帖子被点赞了。',
      owner_id: 'owner-1',
      agent_id: 'agent-1',
      ttl_minutes: 30,
      opening_only: true,
    })
    const runtimeState = runtimeSceneStateV1Schema.parse({
      runtime_scene_id: 'runtime-scene-1',
      episode_id: 'episode-1',
      director_surface: 'forum',
      actor_surface: 'forum_post',
      community_id: 'community-1',
      room_id: null,
      scene_template_id: 'stage-theme-01',
      scene_template_version: 'legacy-v1',
      scene_binding_id: null,
      overlay_id: null,
      phase: 'opening',
      status: 'active',
      cast: {
        active_agent_ids: ['agent-1'],
        standby_agent_ids: [],
        recently_spoke_agent_ids: [],
        cast_version: 1,
      },
      continuity: {
        previous_episode_ids: [],
        open_loops: [],
        resolved_loops: [],
      },
      dynamics: {
        turn_count: 0,
        message_count: 0,
        heat_score: 0,
        fatigue_score: 0,
        repetition_score: 0,
        phase_entered_at: '2026-03-13T00:00:00.000Z',
      },
      close_condition: {
        reason: null,
        satisfied: false,
        objective_refs: ['推进讨论'],
        ttl_at: '2026-03-14T00:00:00.000Z',
        message_threshold: 12,
        evaluated_at: '2026-03-13T00:00:00.000Z',
      },
      aftershow: {
        mode: 'threshold',
        status: 'pending',
        artifact_ref: null,
      },
      cooldown_until: null,
      experiment: {
        bucket: 'A',
        assignment_source: 'feature_flag',
      },
      audit: {
        selection_id: null,
        episode_plan_id: null,
        latest_local_intent_id: null,
        latest_program_event_id: null,
        state_version: 1,
      },
      started_at: '2026-03-13T00:00:00.000Z',
      updated_at: '2026-03-13T00:00:00.000Z',
      expires_at: '2026-03-14T00:00:00.000Z',
      closed_at: null,
    })
    const metadata = sceneMetadataSchema.parse({
      director_surface: 'forum',
      actor_surface: 'forum_post',
      scene_template_id: 'stage-theme-01',
      scene_template_version: 'legacy-v1',
      scene_binding_id: null,
      overlay_id: null,
      episode_id: 'episode-1',
      beat_id: null,
      phase: 'opening',
      selection_mode: 'pool_guided',
      selection_id: 'sel-1',
      episode_plan_id: 'plan-1',
      local_intent_id: 'intent-1',
      started_at: '2026-03-13T00:00:00.000Z',
      expires_at: null,
    })

    expect(localIntent.target_ref.kind).toBe('comment')
    expect(privateContext.session_origin).toBe('ongoing')
    expect(proactiveContext.opening_only).toBe(true)
    expect(runtimeState.phase).toBe('opening')
    expect(metadata.selection_mode).toBe('pool_guided')
  })
})
