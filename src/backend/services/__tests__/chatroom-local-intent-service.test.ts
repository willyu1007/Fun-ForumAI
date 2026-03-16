import { describe, expect, it } from 'vitest'
import { DEFAULT_STAGE_SPEC_V1 } from '../../stage/index.js'
import { ChatroomLocalIntentService } from '../chatroom-local-intent-service.js'

function makeInput() {
  return {
    cue_type: 'ADVANCE' as const,
    director_goal: '把 owner 的隐形导演 cue 往前推半步',
    anchor_message_id: null,
    callback_message_id: null,
    manual: false,
    runtime_state: {
      runtime_scene_id: 'runtime-scene-1',
      director_surface: 'chat_room',
      actor_surface: 'chat_room',
      community_id: null,
      room_id: 'room-1',
      scene_template_id: 'chatroom-template-1',
      scene_template_version: 'v2',
      scene_binding_id: 'binding-room-1',
      overlay_id: null,
      episode_id: 'episode-1',
      phase: 'opening',
      status: 'active',
      cast: {
        active_agent_ids: ['agent-1', 'agent-2'],
        standby_agent_ids: [],
        suppressed_agent_ids: [],
        recently_spoke_agent_ids: [],
        slot_audit: {
          core_agent_ids: ['agent-1'],
          contrast_agent_ids: ['agent-2'],
          wildcard_agent_ids: [],
          must_have_role_hits: ['HOST', 'FOIL'],
          target_active_count: 2,
        },
        cast_version: 1,
      },
      continuity: {
        previous_episode_ids: [],
        open_loops: [],
        resolved_loops: [],
      },
      dynamics: {
        turn_count: 2,
        message_count: 2,
        heat_score: 0.2,
        fatigue_score: 0.1,
        repetition_score: 0,
        phase_entered_at: '2026-03-14T00:00:00.000Z',
      },
      close_condition: {
        reason: null,
        satisfied: false,
        ttl_at: '2026-03-14T04:00:00.000Z',
        message_threshold: 12,
        evaluated_at: '2026-03-14T00:30:00.000Z',
        objective_refs: ['把房间推成更像节目的一拍'],
      },
      aftershow: {
        mode: 'threshold',
        status: 'pending',
        artifact_ref: null,
      },
      experiment: {
        bucket: 'A',
        assignment_source: 'feature_flag',
      },
      audit: {
        selection_id: null,
        episode_plan_id: null,
        state_version: 1,
        source: 'binding',
        latest_program_event_id: null,
        latest_local_intent_id: null,
      },
      started_at: '2026-03-14T00:00:00.000Z',
      expires_at: '2026-03-14T04:00:00.000Z',
      cooldown_until: null,
      updated_at: '2026-03-14T00:30:00.000Z',
      closed_at: null,
    },
    resolved_scene: {
      template: {
        template_id: 'chatroom-template-1',
        template_version: 'v2',
        name: 'Chatroom Template',
        category: 'show',
        lifecycle_status: 'core_active',
        stage_spec: DEFAULT_STAGE_SPEC_V1,
        director: {
          applicable_surfaces: ['chat_room'],
          scene_goal: {
            viewer_goal: '把房间推成一段更有看点的 talk show',
            growth_goal: '放大角色之间的互相接梗能力',
          },
          casting_recipe: {
            quota: 3,
            ratio: { core: 2, contrast: 1, wildcard: 0 },
            wildcard_cap: 0,
            must_have_roles: ['HOST', 'FOIL'],
            avoid_pairs: [],
            relationship_objectives: ['challenge'],
          },
          beat_plan: {
            phases: ['opening', 'escalation', 'closure'],
            optional_beats: [],
          },
          fatigue_policy: {
            cooldown_hours: 1,
            repeat_penalty: 0.8,
            max_runs_per_day: 6,
          },
          closing_policy: {
            ttl_hours: 4,
            min_turns: 3,
            message_threshold: 12,
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
      binding: {
        binding_id: 'binding-room-1',
        template_id: 'chatroom-template-1',
        template_version: 'v2',
        binding_type: 'core',
        status: 'active',
        entry_surfaces: ['chat_room'],
        target: {
          surface: 'chat_room',
          room_id: 'room-1',
        },
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
      source: 'binding' as const,
      selection_mode: 'pool_strict' as const,
    },
  } satisfies Parameters<ChatroomLocalIntentService['build']>[0]
}

describe('ChatroomLocalIntentService', () => {
  it('always hides director goal compat from actor-visible local intent', () => {
    const service = new ChatroomLocalIntentService()
    const result = service.build(makeInput())

    expect(result.local_intent.soft_constraints).not.toContain('把 owner 的隐形导演 cue 往前推半步')
    expect(result.local_intent_block).not.toContain('把 owner 的隐形导演 cue 往前推半步')
    expect(result.local_intent.soft_constraints).toContain('把房间推成一段更有看点的 talk show')
  })

  it('tolerates runtime state payloads that omit objective_refs', () => {
    const service = new ChatroomLocalIntentService()
    const input = structuredClone(makeInput()) as ReturnType<typeof makeInput>
    delete (input.runtime_state.close_condition as { objective_refs?: string[] }).objective_refs

    const result = service.build(input)

    expect(result.episode_brief.close_condition.objective).toBeUndefined()
    expect(result.local_intent_block).toContain('## Local Intent')
  })

  it('keeps working when the resolved scene comes from the room program fallback', () => {
    const service = new ChatroomLocalIntentService()
    const input = structuredClone(makeInput()) as Parameters<ChatroomLocalIntentService['build']>[0]
    input.resolved_scene.binding = null
    input.resolved_scene.source = 'room_program'
    input.resolved_scene.selection_mode = 'autonomous_anchored'

    const result = service.build(input)

    expect(result.scene_source).toBe('room_program')
    expect(result.episode_brief.binding_id).toBeUndefined()
    expect(result.local_intent.soft_constraints).toContain('把房间推成一段更有看点的 talk show')
  })
})
