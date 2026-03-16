import { describe, expect, it } from 'vitest'
import { InMemoryRuntimeSceneStateRepository } from '../runtime-scene-state-repository.js'
import { runtimeSceneStateV1Schema } from '../../stage/index.js'

function buildState(overrides: Record<string, unknown> = {}) {
  return runtimeSceneStateV1Schema.parse({
    runtime_scene_id: 'runtime-scene-1',
    director_surface: 'chat_room',
    actor_surface: 'chat_room',
    community_id: null,
    room_id: 'room-1',
    scene_template_id: 'chatroom-template-1',
    scene_template_version: 'v2',
    scene_binding_id: null,
    overlay_id: null,
    episode_id: 'episode-1',
    phase: 'opening',
    status: 'active',
    cast: {
      active_agent_ids: ['agent-1', 'agent-2'],
      standby_agent_ids: ['agent-3'],
      recently_spoke_agent_ids: ['agent-1'],
      cast_version: 1,
    },
    continuity: {
      previous_episode_ids: [],
      open_loops: [],
      resolved_loops: [],
    },
    dynamics: {
      turn_count: 1,
      message_count: 1,
      heat_score: 0.2,
      fatigue_score: 0.1,
      repetition_score: 0.1,
      phase_entered_at: '2026-03-13T00:00:00.000Z',
    },
    close_condition: {
      reason: null,
      satisfied: false,
      objective_refs: ['继续推进'],
      ttl_at: '2026-03-13T04:00:00.000Z',
      message_threshold: 8,
      evaluated_at: '2026-03-13T00:00:00.000Z',
    },
    aftershow: {
      mode: 'off',
      status: 'not_applicable',
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
    expires_at: '2026-03-13T04:00:00.000Z',
    closed_at: null,
    ...overrides,
  })
}

describe('InMemoryRuntimeSceneStateRepository', () => {
  it('accepts room-program runtime scene authority in the canonical state schema', () => {
    const state = buildState({
      scene_binding_id: null,
      audit: {
        selection_id: null,
        episode_plan_id: null,
        source: 'room_program',
        latest_local_intent_id: null,
        latest_program_event_id: null,
        state_version: 1,
      },
    })

    expect(state.audit.source).toBe('room_program')
  })

  it('creates, looks up by room/episode, and updates with optimistic versioning', async () => {
    const repo = new InMemoryRuntimeSceneStateRepository()
    const initialState = buildState()
    const created = await repo.create({
      runtime_scene_id: initialState.runtime_scene_id,
      director_surface: 'chat_room',
      actor_surface: 'chat_room',
      room_id: 'room-1',
      episode_id: 'episode-1',
      scene_template_id: initialState.scene_template_id,
      scene_template_version: initialState.scene_template_version,
      scene_binding_id: null,
      overlay_id: null,
      experiment_bucket: 'A',
      initial_state: initialState,
    })

    expect(created.state_version).toBe(1)
    expect((await repo.findActiveByRoom('room-1'))?.runtime_scene_id).toBe('runtime-scene-1')
    expect((await repo.findByEpisodeId('episode-1'))?.runtime_scene_id).toBe('runtime-scene-1')

    const nextState = buildState({
      phase: 'pivot',
      dynamics: {
        ...initialState.dynamics,
        turn_count: 4,
        message_count: 4,
        fatigue_score: 0.5,
      },
      audit: {
        ...initialState.audit,
        state_version: 2,
      },
      updated_at: '2026-03-13T01:00:00.000Z',
    })
    const updated = await repo.update('runtime-scene-1', {
      expected_state_version: 1,
      phase: 'pivot',
      status: 'active',
      fatigue_score: 0.5,
      repetition_score: 0.1,
      cooldown_until: null,
      state_json: nextState,
    })

    expect(updated?.phase).toBe('pivot')
    expect(updated?.state_version).toBe(2)

    const rejected = await repo.update('runtime-scene-1', {
      expected_state_version: 1,
      phase: 'closure',
      status: 'cooldown',
      fatigue_score: 1,
      repetition_score: 1,
      cooldown_until: new Date('2026-03-13T02:00:00.000Z'),
      state_json: buildState({
        phase: 'closure',
        status: 'cooldown',
        cooldown_until: '2026-03-13T02:00:00.000Z',
        audit: {
          ...initialState.audit,
          state_version: 3,
        },
      }),
    })

    expect(rejected).toBeNull()
  })
})
