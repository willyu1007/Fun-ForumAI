import { describe, expect, it, vi } from 'vitest'
import { InMemoryRoomWatchabilityRepository } from '../../repos/room-watchability-repository.js'
import type { RoomCastMemberView } from '../../repos/types.js'
import { config } from '../../lib/config.js'
import { RoomProgramEngine } from '../room-program-engine.js'
import { RoomCuePlanner } from '../room-cue-planner.js'
import { RoomProgramScorer } from '../room-program-scorer.js'
import type { LoadedRoomProgramState } from '../room-program-state-loader.js'

function makeCastMember(overrides: Partial<RoomCastMemberView>): RoomCastMemberView {
  return {
    agent_id: 'agent-1',
    name: 'Host',
    role: 'HOST',
    chemistry_score: 0.88,
    spotlight_weight: 1.1,
    last_spoke_at: new Date('2026-03-10T10:00:00.000Z'),
    role_hint: null,
    wander_eligible: true,
    suppressed_until: null,
    member_spotlight_weight: 1,
    projection: null,
    ...overrides,
  }
}

function makeLoadedState(): LoadedRoomProgramState {
  const now = new Date('2026-03-10T10:00:00.000Z')
  return {
    room: {
      id: 'room-1',
      name: '节目房',
      slug: 'show-room',
      description: '节目化房间',
      community_id: null,
      created_by_agent_id: 'agent-1',
      max_agents: 4,
      tick_interval_base: 20_000,
      status: 'active',
      last_message_at: now,
      created_at: now,
      updated_at: now,
    },
    program: {
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
        enabled: false,
        entry_cooldown_ms: 180_000,
        max_parallel_rooms: 2,
        min_discoverability_score: 0.25,
      },
      discoverability_tags: [],
      discoverability_short_hook: null,
      discoverability_default_view: 'live',
      created_at: now,
      updated_at: now,
    },
    episode: {
      id: 'episode-1',
      room_id: 'room-1',
      program_id: 'program-1',
      status: 'ACTIVE',
      summary_text: '',
      unresolved_question: null,
      callback_bank_json: [{
        message_id: 'msg-1',
        author_agent_id: 'agent-2',
        summary_text: '夜宵税那个旧梗',
        weight: 0.9,
        created_at: now.toISOString(),
      }],
      energy: 0.52,
      tension: 0.22,
      turn_count: 6,
      message_count: 6,
      started_at: now,
      ended_at: null,
      created_at: now,
      updated_at: now,
    },
    snapshot: null,
    cast: [
      makeCastMember({
        last_spoke_at: now,
      }),
      makeCastMember({
        agent_id: 'agent-2',
        name: 'Foil',
        role: 'FOIL',
        chemistry_score: 0.82,
        spotlight_weight: 1,
        last_spoke_at: new Date('2026-03-10T09:59:00.000Z'),
      }),
    ],
    members: [],
    recentMessages: [{
      id: 'msg-2',
      room_id: 'room-1',
      author_id: 'agent-1',
      author_type: 'agent',
      episode_id: 'episode-1',
      beat_id: null,
      program_event_id: null,
      speaker_role: 'HOST',
      cue_type: null,
      body: '先把这个前提留在台上。',
      message_kind: 'normal',
      parent_message_id: null,
      vote_score: 0,
      visibility: 'PUBLIC',
      state: 'APPROVED',
      created_at: now,
    }],
    latestBeat: null,
    latestEvent: null,
    latestHighlight: null,
    lastMessage: {
      id: 'msg-2',
      room_id: 'room-1',
      author_id: 'agent-1',
      author_type: 'agent',
      episode_id: 'episode-1',
      beat_id: null,
      program_event_id: null,
      speaker_role: 'HOST',
      cue_type: null,
      body: '先把这个前提留在台上。',
      message_kind: 'normal',
      parent_message_id: null,
      vote_score: 0,
      visibility: 'PUBLIC',
      state: 'APPROVED',
      created_at: now,
    },
  }
}

describe('RoomProgramEngine', () => {
  it('reuses the same planned cue on retry instead of duplicating beat/event/ledger rows', async () => {
    const watchabilityRepo = new InMemoryRoomWatchabilityRepository()
    const state = makeLoadedState()
    const engine = new RoomProgramEngine({
      stateLoader: {
        load: async () => state,
      } as never,
      cuePlanner: new RoomCuePlanner(),
      scorer: new RoomProgramScorer(),
      watchabilityRepo,
    })

    const first = await engine.planNextTurn({
      roomId: 'room-1',
      triggerAgentId: 'agent-trigger',
      canSpeak: async () => true,
    })
    const second = await engine.planNextTurn({
      roomId: 'room-1',
      triggerAgentId: 'agent-trigger',
      canSpeak: async () => true,
    })

    expect(first).not.toBeNull()
    expect(second).not.toBeNull()
    expect(second?.beat_id).toBe(first?.beat_id)
    expect(second?.program_event_id).toBe(first?.program_event_id)

    const latestBeat = await watchabilityRepo.getLatestBeat('episode-1')
    const ledgers = await watchabilityRepo.listSelectionLedger(first!.program_event_id)

    expect(latestBeat?.id).toBe(first?.beat_id)
    expect(ledgers).toHaveLength(2)
  })

  it('consumes an existing manually planned cue before generating a new one', async () => {
    const watchabilityRepo = new InMemoryRoomWatchabilityRepository()
    const state = makeLoadedState()
    const now = new Date('2026-03-10T10:01:00.000Z')

    const beat = await watchabilityRepo.createEpisodeBeat({
      room_id: state.room.id,
      episode_id: state.episode!.id,
      ordinal: 7,
      beat_type: 'CALLBACK',
      cue_type: 'CALLBACK',
      director_goal: '把 owner 的追问接起来',
      prompt_hint: '自然 callback',
      target_role: 'FOIL',
      selected_speaker_agent_id: 'agent-2',
      status: 'selected',
      audit_json: null,
    })
    const event = await watchabilityRepo.createProgramEvent({
      room_id: state.room.id,
      episode_id: state.episode!.id,
      beat_id: beat.id,
      event_type: 'PROGRAM_CUE',
      status: 'PLANNED',
      cue_type: 'CALLBACK',
      director_goal: '把 owner 的追问接起来',
      selected_speaker_agent_id: 'agent-2',
      idempotency_key: 'manual-cue:test',
      payload_json: { manual: true },
    })

    const engine = new RoomProgramEngine({
      stateLoader: {
        load: async () => ({
          ...state,
          latestBeat: {
            ...beat,
            created_at: now,
          },
          latestEvent: {
            ...event,
            created_at: now,
            updated_at: now,
          },
        }),
      } as never,
      cuePlanner: new RoomCuePlanner(),
      scorer: new RoomProgramScorer(),
      watchabilityRepo,
    })

    const turn = await engine.planNextTurn({
      roomId: state.room.id,
      triggerAgentId: 'agent-trigger',
      canSpeak: async () => true,
    })

    expect(turn).toEqual({
      episode_id: state.episode!.id,
      selected_speaker_agent_id: 'agent-2',
      speaker_role: 'FOIL',
      cue_type: 'CALLBACK',
      beat_type: 'CALLBACK',
      director_goal: '把 owner 的追问接起来',
      beat_id: beat.id,
      program_event_id: event.id,
      local_intent_id: null,
    })
  })

  it('prioritizes a pending manual cue even when a newer planned natural cue exists', async () => {
    const watchabilityRepo = new InMemoryRoomWatchabilityRepository()
    const state = makeLoadedState()

    const manualBeat = await watchabilityRepo.createEpisodeBeat({
      room_id: state.room.id,
      episode_id: state.episode!.id,
      ordinal: 7,
      beat_type: 'CALLBACK',
      cue_type: 'CALLBACK',
      director_goal: '先消费 owner cue',
      prompt_hint: '自然 callback',
      target_role: 'HOST',
      selected_speaker_agent_id: 'agent-1',
      status: 'selected',
      audit_json: null,
    })
    const manualEvent = await watchabilityRepo.createProgramEvent({
      room_id: state.room.id,
      episode_id: state.episode!.id,
      beat_id: manualBeat.id,
      event_type: 'PROGRAM_CUE',
      status: 'PLANNED',
      cue_type: 'CALLBACK',
      director_goal: '先消费 owner cue',
      selected_speaker_agent_id: 'agent-1',
      idempotency_key: 'manual-cue:priority',
      payload_json: { manual: true },
    })

    const naturalBeat = await watchabilityRepo.createEpisodeBeat({
      room_id: state.room.id,
      episode_id: state.episode!.id,
      ordinal: 8,
      beat_type: 'HOOK',
      cue_type: 'ASK',
      director_goal: '后续自然追问',
      prompt_hint: '继续推进',
      target_role: 'FOIL',
      selected_speaker_agent_id: 'agent-2',
      status: 'selected',
      audit_json: null,
    })
    const naturalEvent = await watchabilityRepo.createProgramEvent({
      room_id: state.room.id,
      episode_id: state.episode!.id,
      beat_id: naturalBeat.id,
      event_type: 'PROGRAM_CUE',
      status: 'PLANNED',
      cue_type: 'ASK',
      director_goal: '后续自然追问',
      selected_speaker_agent_id: 'agent-2',
      idempotency_key: 'natural-cue:newer',
      payload_json: { manual: false },
    })

    const engine = new RoomProgramEngine({
      stateLoader: {
        load: async () => ({
          ...state,
          latestBeat: naturalBeat,
          latestEvent: naturalEvent,
        }),
      } as never,
      cuePlanner: new RoomCuePlanner(),
      scorer: new RoomProgramScorer(),
      watchabilityRepo,
    })

    const turn = await engine.planNextTurn({
      roomId: state.room.id,
      triggerAgentId: 'agent-trigger',
      canSpeak: async () => true,
    })

    expect(turn).toEqual({
      episode_id: state.episode!.id,
      selected_speaker_agent_id: 'agent-1',
      speaker_role: 'HOST',
      cue_type: 'CALLBACK',
      beat_type: 'CALLBACK',
      director_goal: '先消费 owner cue',
      beat_id: manualBeat.id,
      program_event_id: manualEvent.id,
      local_intent_id: null,
    })
  })

  it('rolls over a closed runtime episode before planning the next turn', async () => {
    const featureFlags = config.launch.capabilities as unknown as Record<string, boolean>
    const snapshot = { ...featureFlags }
    featureFlags.directorRuntimeStateV1 = true

    try {
      const watchabilityRepo = new InMemoryRoomWatchabilityRepository()
      const state = makeLoadedState()
      const endedEpisode = vi.fn(async () => ({
        ...state.episode!,
        status: 'ENDED' as const,
        ended_at: new Date('2026-03-10T10:05:00.000Z'),
      }))

      const engine = new RoomProgramEngine({
        stateLoader: {
          load: vi.fn()
            .mockResolvedValueOnce(state)
            .mockResolvedValueOnce({
              ...state,
              episode: {
                ...state.episode!,
                id: 'episode-2',
              },
            }),
        } as never,
        cuePlanner: {
          plan: vi.fn(() => null),
        } as never,
        scorer: {
          score: vi.fn(() => []),
        } as never,
        watchabilityRepo: {
          ...watchabilityRepo,
          endActiveEpisode: endedEpisode,
          ensureActiveEpisode: vi.fn(async () => ({
            ...state.episode!,
            id: 'episode-2',
          })),
          replaceEpisodeCast: vi.fn(async () => []),
          getNextPlannedProgramTurn: vi.fn(async () => null),
        } as never,
        runtimeSceneStateManager: {
          ensureChatroomState: vi.fn(async () => ({
            state: {
              status: 'closed',
              state_json: {
                cooldown_until: null,
              },
            },
          })),
        } as never,
      })

      await engine.planNextTurn({
        roomId: state.room.id,
        triggerAgentId: 'agent-trigger',
        canSpeak: async () => true,
      })

      expect(endedEpisode).toHaveBeenCalledWith(state.room.id)
    } finally {
      Object.assign(featureFlags, snapshot)
    }
  })
})
