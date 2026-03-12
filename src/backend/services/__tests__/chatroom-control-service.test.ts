import { describe, expect, it, vi } from 'vitest'
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
})
