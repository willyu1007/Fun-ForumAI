import { describe, expect, it, vi } from 'vitest'
import { config } from '../../lib/config.js'
import { ChatroomControlService } from '../chatroom-control-service.js'

function makeProgram() {
  return {
    id: 'program-1',
    room_id: 'room-1',
    enabled: true,
    scene_type: 'FREE_CHAT',
    pacing_preset: 'balanced',
    target_cast_min: 2,
    target_cast_max: 4,
    callback_window: 18,
    recap_every_turns: 10,
    max_consecutive_turns: 1,
    idle_cue_after_ms: 30_000,
    allow_wandering: true,
    director_policy_json: {},
    wander_policy_json: {
      enabled: true,
      entry_cooldown_ms: 180_000,
      max_parallel_rooms: 2,
      min_discoverability_score: 0.25,
    },
    discoverability_tags: [],
    discoverability_short_hook: null,
    discoverability_default_view: 'live',
    created_at: new Date('2026-03-10T10:00:00.000Z'),
    updated_at: new Date('2026-03-10T10:00:00.000Z'),
  }
}

describe('ChatroomControlService', () => {
  it('does not refresh the room projector when editing controls on a non-active room', async () => {
    const refreshRoom = vi.fn(async () => null)
    const service = new ChatroomControlService({
      roomRepo: {
        findById: vi.fn(async () => ({
          id: 'room-1',
          max_agents: 4,
          status: 'cooling',
        })),
        updateMemberControl: vi.fn(async () => ({
          room_id: 'room-1',
          member_id: 'agent-2',
          spotlight_weight: 1.2,
        })),
      } as never,
      watchabilityRepo: {
        getProgram: vi.fn(async () => makeProgram()),
        updateProgram: vi.fn(async () => makeProgram()),
        getLiveSnapshot: vi.fn(async () => null),
        getActiveEpisode: vi.fn(async () => null),
      } as never,
      agentRepo: {
        findById: vi.fn(() => ({ display_name: 'Agent Two' })),
      } as never,
      roomProjector: {
        refreshRoom,
        toProgramReadModel: vi.fn(() => ({
          room_id: 'room-1',
          enabled: true,
        })),
      } as never,
      stateLoader: {} as never,
      scorer: {} as never,
      projectionService: {} as never,
      sseHub: {
        broadcastToRoom: vi.fn(),
      } as never,
    })

    await service.updateProgram('room-1', { callback_window: 20 })
    await service.updateMemberControl('room-1', 'agent-2', { spotlight_weight: 1.2 })

    expect(refreshRoom).not.toHaveBeenCalled()
  })

  it('rejects manual cues for non-active rooms before attempting to create an episode', async () => {
    const refreshRoom = vi.fn(async () => null)
    const service = new ChatroomControlService({
      roomRepo: {} as never,
      watchabilityRepo: {} as never,
      agentRepo: {} as never,
      roomProjector: {
        refreshRoom,
      } as never,
      stateLoader: {
        load: vi.fn(async () => ({
          room: { id: 'room-1', status: 'cooling' },
          program: makeProgram(),
          episode: null,
        })),
      } as never,
      scorer: {} as never,
      projectionService: {} as never,
    })

    await expect(service.createCue('room-1', {
      cue_type: 'ADVANCE',
      director_goal: '继续推进',
    })).rejects.toThrow('Room must be active before a cue can be created')

    expect(refreshRoom).not.toHaveBeenCalled()
  })

  it('rejects invalid program bounds before persistence', async () => {
    const updateProgram = vi.fn(async () => makeProgram())
    const service = new ChatroomControlService({
      roomRepo: {
        findById: vi.fn(async () => ({
          id: 'room-1',
          max_agents: 4,
          status: 'active',
        })),
      } as never,
      watchabilityRepo: {
        getProgram: vi.fn(async () => makeProgram()),
        updateProgram,
      } as never,
      agentRepo: {} as never,
      roomProjector: {} as never,
      stateLoader: {} as never,
      scorer: {} as never,
      projectionService: {} as never,
    })

    await expect(service.updateProgram('room-1', {
      target_cast_min: 5,
      target_cast_max: 4,
    })).rejects.toThrow('target_cast_min cannot exceed target_cast_max')

    expect(updateProgram).not.toHaveBeenCalled()
  })

  it('triggers fast-lane scheduling after creating a manual cue', async () => {
    const broadcastToRoom = vi.fn()
    const fastLaneHook = vi.fn(async () => undefined)
    const service = new ChatroomControlService({
      roomRepo: {} as never,
      watchabilityRepo: {
        planProgramCue: vi.fn(async () => ({
          beat: {
            id: 'beat-1',
            selected_speaker_agent_id: 'agent-2',
            target_role: 'HOST',
            created_at: new Date('2026-03-10T10:00:00.000Z'),
          },
          event: { id: 'event-1' },
          ledgers: [],
          created_now: true,
        })),
      } as never,
      agentRepo: {} as never,
      roomProjector: {} as never,
      stateLoader: {
        load: vi.fn(async () => ({
          room: { id: 'room-1', status: 'active' },
          program: makeProgram(),
          episode: { id: 'episode-1' },
          latestBeat: { ordinal: 3 },
          cast: [{ agent_id: 'agent-2', role: 'HOST' }],
          recentMessages: [],
        })),
      } as never,
      scorer: {
        score: vi.fn(() => [{
          agent_id: 'agent-2',
          role: 'HOST',
          final_score: 1,
          reasons_json: [],
        }]),
      } as never,
      projectionService: {} as never,
      sseHub: {
        broadcastToRoom,
      } as never,
    })
    service.setFastLaneHook(fastLaneHook)

    await service.createCue('room-1', {
      cue_type: 'CALLBACK',
      director_goal: '把 owner cue 立即推进给主持人',
    })

    expect(fastLaneHook).toHaveBeenCalledWith({
      roomId: 'room-1',
      agentId: 'agent-2',
    })
    expect(broadcastToRoom).toHaveBeenCalledWith('room-1', expect.objectContaining({
      type: 'ROOM_CONTROL_STATE_UPDATED',
      payload: expect.objectContaining({
        reason: 'manual_cue',
        selected_agent_id: 'agent-2',
      }),
    }))
  })

  it('limits manual cue speaker selection to the scene-aware active cast when runtime authority is on', async () => {
    const featureFlags = config.launch.capabilities as unknown as Record<string, boolean>
    const snapshot = { ...featureFlags }
    featureFlags.directorRuntimeStateV1 = true

    try {
      const service = new ChatroomControlService({
        roomRepo: {} as never,
        watchabilityRepo: {
          planProgramCue: vi.fn(async (input) => ({
            beat: {
              id: 'beat-1',
              selected_speaker_agent_id: input.selected_speaker_agent_id,
              target_role: input.target_role,
              created_at: new Date('2026-03-10T10:00:00.000Z'),
            },
            event: { id: 'event-1' },
            ledgers: [],
            created_now: true,
          })),
        } as never,
        agentRepo: {} as never,
        roomProjector: {} as never,
        stateLoader: {
          load: vi.fn(async () => ({
            room: { id: 'room-1', status: 'active' },
            program: makeProgram(),
            episode: { id: 'episode-1' },
            latestBeat: { ordinal: 0 },
            cast: [
              { agent_id: 'agent-2', role: 'FOIL' },
              { agent_id: 'agent-1', role: 'HOST' },
            ],
            members: [],
            recentMessages: [],
          })),
        } as never,
        scorer: {
          score: vi.fn(({ cast }) => cast.map((candidate: { agent_id: string; role: string }) => ({
            agent_id: candidate.agent_id,
            role: candidate.role,
            final_score: 1,
            reasons_json: [],
          }))),
        } as never,
        projectionService: {} as never,
        runtimeSceneStateManager: {
          findActiveByRoom: vi.fn(async () => null),
          ensureChatroomState: vi.fn(async () => ({
            state: {
              state_json: {
                cast: {
                  active_agent_ids: ['agent-1'],
                  suppressed_agent_ids: ['agent-2'],
                  slot_audit: {
                    core_agent_ids: ['agent-1'],
                    contrast_agent_ids: ['agent-2'],
                    wildcard_agent_ids: [],
                    must_have_role_hits: ['HOST'],
                    target_active_count: 1,
                  },
                },
              },
            },
          })),
          handleSignal: vi.fn(async () => undefined),
        } as never,
        sseHub: {
          broadcastToRoom: vi.fn(),
        } as never,
      })

      const result = await service.createCue('room-1', {
        cue_type: 'ADVANCE',
        director_goal: '只让 active cast 接住这拍',
      })

      expect(result.selected_agent_id).toBe('agent-1')
    } finally {
      Object.assign(featureFlags, snapshot)
    }
  })

  it('redacts hidden director fields from exposed cue payloads', async () => {
    const featureFlags = config.launch.capabilities as unknown as Record<string, boolean>
    const snapshot = { ...featureFlags }
    featureFlags.directorRuntimeStateV1 = true

    const planProgramCue = vi.fn(async (input: { event_payload_json: Record<string, unknown> }) => ({
      beat: {
        id: 'beat-1',
        selected_speaker_agent_id: 'agent-1',
        target_role: 'HOST',
        created_at: new Date('2026-03-10T10:00:00.000Z'),
      },
      event: {
        id: 'event-1',
        payload_json: input.event_payload_json,
      },
      ledgers: [],
      created_now: true,
    }))

    try {
      const service = new ChatroomControlService({
        roomRepo: {} as never,
        watchabilityRepo: {
          planProgramCue,
        } as never,
        agentRepo: {} as never,
        roomProjector: {} as never,
        stateLoader: {
          load: vi.fn(async () => ({
            room: { id: 'room-1', status: 'active' },
            program: makeProgram(),
            episode: { id: 'episode-1' },
            latestBeat: { ordinal: 0 },
            cast: [{ agent_id: 'agent-1', role: 'HOST' }],
            members: [],
            recentMessages: [],
          })),
        } as never,
        scorer: {
          score: vi.fn(() => [{
            agent_id: 'agent-1',
            role: 'HOST',
            final_score: 1,
            reasons_json: [],
          }]),
        } as never,
        projectionService: {} as never,
        runtimeSceneStateManager: {
          findActiveByRoom: vi.fn(async () => null),
          ensureChatroomState: vi.fn(async () => ({
            state: {
              state_json: {
                cast: {
                  active_agent_ids: ['agent-1'],
                  suppressed_agent_ids: [],
                  slot_audit: {
                    core_agent_ids: ['agent-1'],
                    contrast_agent_ids: [],
                    wildcard_agent_ids: [],
                    must_have_role_hits: ['HOST'],
                    target_active_count: 1,
                  },
                },
              },
            },
            resolved: {
              template: {
                director: {
                  scene_goal: {
                    viewer_goal: '推进现场',
                    growth_goal: '稳住节奏',
                  },
                  casting_recipe: {
                    must_have_roles: ['HOST'],
                    avoid_pairs: [],
                    ratio: { core: 1, contrast: 0, wildcard: 0 },
                  },
                  closing_policy: {
                    aftershow_mode: 'threshold',
                  },
                },
              },
              source: 'binding',
            },
          })),
          handleSignal: vi.fn(async () => undefined),
        } as never,
        localIntentService: {
          build: vi.fn(() => ({
            local_intent_id: 'local-intent-1',
            local_intent: { intent_id: 'local-intent-1' },
            local_intent_block: '[LOCAL_INTENT]',
            episode_brief_min: {
              episode_id: 'episode-1',
              phase: 'opening',
              template_id: 'template-1',
              template_version: 'v2',
              scene_goal: {
                viewer_goal: '推进现场',
                growth_goal: '稳住节奏',
              },
              open_loops: [],
              expires_at: '2026-03-15T00:00:00.000Z',
            },
            scene_source: 'binding',
          })),
        } as never,
        sseHub: {
          broadcastToRoom: vi.fn(),
        } as never,
      })

      const result = await service.createCue('room-1', {
        cue_type: 'ADVANCE',
        director_goal: '把 owner cue 往前推半步',
      })

      const payload = planProgramCue.mock.calls[0]?.[0]?.event_payload_json as Record<string, unknown>
      expect(payload.local_intent_id).toBe('local-intent-1')
      expect(payload.scene_source).toBe('binding')
      expect(payload).not.toHaveProperty('director_goal')
      expect(result.event.payload_json).not.toHaveProperty('director_goal')
    } finally {
      Object.assign(featureFlags, snapshot)
    }
  })
})
