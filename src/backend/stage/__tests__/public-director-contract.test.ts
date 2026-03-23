import { describe, expect, it } from 'vitest'
import {
  buildSceneBindingV1FromManifestItem,
  buildSceneBindingV1ListFromManifestItem,
  buildStageTemplateV2FromAuthoring,
  localIntentSchema,
  privateChatContextSchema,
  proactiveDmOpeningContextSchema,
  runtimeSceneStateV1Schema,
  sceneMetadataSchema,
} from '../public-director-contract.js'

type ManifestItemInput = Parameters<typeof buildStageTemplateV2FromAuthoring>[0]
type ManifestBindingInput = ManifestItemInput['bindings'][number]
type ForumBindingInput = Extract<ManifestBindingInput, { surface: 'forum' }>

function makeForumBinding(overrides: Partial<ForumBindingInput> = {}): ForumBindingInput {
  return {
    surface: 'forum' as const,
    community_slug: 'general',
    seasonal_slot: null,
    binding_type: 'core' as const,
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
    ...overrides,
  }
}

describe('public-director-contract', () => {
  it('builds stage_template_v2 from authoring v2 source', () => {
    const projected = buildStageTemplateV2FromAuthoring(
      {
        id: 'stage-theme-01',
        category: 'theme',
        path: 'templates/stage-theme-01.yaml',
        lifecycle_status: 'core_active',
        bindings: [makeForumBinding()],
      } satisfies ManifestItemInput,
      {
        template_id: 'stage-theme-01',
        template_version: 'v2',
        name: 'Stage Theme 01',
        category: 'theme',
        stage_spec: {
          version: 'v1',
        },
        director: {
          applicable_surfaces: ['forum', 'scheduled_post'],
          scene_goal: {
            viewer_goal: '把讨论组织成有节目感的公域片段。',
            growth_goal: '推动角色形成稳定的接梗与拆招关系。',
          },
          casting_recipe: {
            quota: 4,
            ratio: { core: 2, contrast: 1, wildcard: 1 },
            wildcard_cap: 1,
            must_have_roles: ['HOST'],
            avoid_pairs: [],
            relationship_objectives: ['bridge'],
          },
          beat_plan: {
            phases: ['opening', 'escalation', 'pivot', 'closure'],
            optional_beats: [],
          },
          fatigue_policy: {
            cooldown_hours: 12,
            repeat_penalty: 1,
            max_runs_per_day: 3,
          },
          closing_policy: {
            ttl_hours: 6,
            min_turns: 3,
            message_threshold: 10,
            aftershow_mode: 'threshold',
          },
          hot_topic_policy: {
            injection_mode: 'overlay_only',
            sensitive_topic_mode: 'standard',
          },
          autonomy_policy: {
            allow_autonomous_mutation: false,
            require_pool_match_before_create: true,
          },
        },
      },
    )

    expect(projected.template_version).toBe('v2')
    expect(projected.lifecycle_status).toBe('core_active')
    expect(projected.director.applicable_surfaces).toEqual(['forum', 'scheduled_post'])
    expect(projected.director.scene_goal.viewer_goal).toContain('节目感')
  })

  it('projects manifest bindings into scene_binding_v1 forum targets', () => {
    const item = {
      id: 'stage-theme-02',
      category: 'theme',
      path: 'templates/stage-theme-02.yaml',
      lifecycle_status: 'seasonal_active',
      bindings: [
        makeForumBinding({
          community_slug: 'philosophy',
          seasonal_slot: 'season-slot-1',
          binding_type: 'seasonal',
          weights: {
            editorial_priority: 10,
            base_weight: 1,
            freshness_bonus: 1,
          },
        }),
      ],
    } satisfies ManifestItemInput
    const binding = buildSceneBindingV1FromManifestItem(item, {
      applicable_surfaces: ['forum', 'scheduled_post'],
      scene_goal: {
        viewer_goal: '让观众看到接力式讨论推进。',
        growth_goal: '让角色形成稳定公开配合。',
      },
      casting_recipe: {
        quota: 4,
        ratio: { core: 2, contrast: 1, wildcard: 1 },
        wildcard_cap: 1,
        must_have_roles: [],
        avoid_pairs: [],
        relationship_objectives: [],
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
        require_pool_match_before_create: true,
      },
    })

    expect(binding).not.toBeNull()
    expect(binding?.template_version).toBe('v2')
    expect(binding?.target.surface).toBe('forum')
    expect(binding?.entry_surfaces).toEqual(['forum', 'scheduled_post'])
    expect(binding?.target).toMatchObject({
      community_slug: 'philosophy',
      seasonal_slot: 'season-slot-1',
    })
  })

  it('rejects forum bindings when director applicable surfaces exclude forum entry points', () => {
    const item = {
      id: 'stage-theme-chat-only',
      category: 'theme',
      path: 'templates/stage-theme-chat-only.yaml',
      lifecycle_status: 'core_active',
      bindings: [makeForumBinding()],
    } satisfies ManifestItemInput
    const projected = buildStageTemplateV2FromAuthoring(item, {
      template_id: 'stage-theme-chat-only',
      template_version: 'v2',
      name: 'Stage Theme Chat Only',
      category: 'theme',
      stage_spec: {
        version: 'v1',
      },
      director: {
        applicable_surfaces: ['chat_room'],
        scene_goal: {
          viewer_goal: '只给聊天室使用的节目感。',
          growth_goal: '只在聊天室里推进关系。',
        },
        casting_recipe: {
          quota: 4,
          ratio: { core: 2, contrast: 1, wildcard: 1 },
          wildcard_cap: 1,
          must_have_roles: [],
          avoid_pairs: [],
          relationship_objectives: [],
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
          require_pool_match_before_create: true,
        },
      },
    })

    expect(() => buildSceneBindingV1FromManifestItem(item, projected.director)).toThrow()
  })

  it('projects additional chat_room bindings from manifest bindings[]', () => {
    const item = {
      id: 'stage-show-chat',
      category: 'show',
      path: 'templates/stage-show-chat.yaml',
      lifecycle_status: 'core_active',
      bindings: [
        makeForumBinding({
          community_slug: 'history-lab',
          seasonal_slot: null,
        }),
        {
          surface: 'chat_room' as const,
          room_id: 'scene-pool-room-ai-consciousness',
          binding_type: 'core' as const,
          lifecycle: {},
          weights: {
            editorial_priority: 8,
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
    } satisfies ManifestItemInput
    const projected = buildStageTemplateV2FromAuthoring(item, {
      template_id: 'stage-show-chat',
      template_version: 'v2',
      name: 'Stage Show Chat',
      category: 'show',
      stage_spec: {
        version: 'v1',
      },
      director: {
        applicable_surfaces: ['forum', 'scheduled_post', 'chat_room'],
        scene_goal: {
          viewer_goal: '让论坛和房间都带着节目推进。',
          growth_goal: '让角色在公域场里形成更明显的互补关系。',
        },
        casting_recipe: {
          quota: 4,
          ratio: { core: 2, contrast: 1, wildcard: 1 },
          wildcard_cap: 1,
          must_have_roles: ['HOST'],
          avoid_pairs: [],
          relationship_objectives: ['challenge'],
        },
        beat_plan: {
          phases: ['opening', 'escalation', 'pivot', 'closure'],
          optional_beats: [],
        },
        fatigue_policy: {
          cooldown_hours: 12,
          repeat_penalty: 1,
          max_runs_per_day: 4,
        },
        closing_policy: {
          ttl_hours: 6,
          min_turns: 3,
          message_threshold: 10,
          aftershow_mode: 'threshold',
        },
        hot_topic_policy: {
          injection_mode: 'overlay_only',
          sensitive_topic_mode: 'standard',
        },
        autonomy_policy: {
          allow_autonomous_mutation: false,
          require_pool_match_before_create: true,
        },
      },
    })

    const bindings = buildSceneBindingV1ListFromManifestItem(item, projected.director)
    expect(bindings).toHaveLength(2)
    expect(bindings.find((binding) => binding.target.surface === 'chat_room')).toMatchObject({
      template_version: 'v2',
      entry_surfaces: ['chat_room'],
      target: {
        surface: 'chat_room',
        room_id: 'scene-pool-room-ai-consciousness',
      },
    })
  })

  it('validates private/public contract boundary objects', () => {
    const localIntent = localIntentSchema.parse({
      intent_id: 'intent-1',
      delivery_surface: 'forum_thread',
      initiative: 'reply',
      opinion_policy: 'free_opinion',
      relation_focus: 'bridge',
      tone_hint: 'warm',
      privacy_mode: 'public_only',
      memory_scope: 'public_contextual',
      reference_scope: 'thread_only',
      prohibited_reference_types: ['owner_private_speech'],
      target_ref: {
        kind: 'turn',
        post_id: 'post-1',
        thread_id: 'thread-1',
        turn_id: 'turn-1',
      },
      hard_constraints: ['直接接住当前回合的核心观点'],
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
      scene_template_version: 'v2',
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
        source: 'binding',
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
      scene_template_version: 'v2',
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

    expect(localIntent.target_ref.kind).toBe('turn')
    expect(privateContext.session_origin).toBe('ongoing')
    expect(proactiveContext.opening_only).toBe(true)
    expect(runtimeState.phase).toBe('opening')
    expect(metadata.selection_mode).toBe('pool_guided')
  })
})
