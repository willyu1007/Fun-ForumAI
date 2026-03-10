import { describe, expect, it } from 'vitest'
import type { RoomEpisode } from '../../repos/types.js'
import { RoomCuePlanner } from '../room-cue-planner.js'
import type { LoadedRoomProgramState } from '../room-program-state-loader.js'

function makeEpisode(now: Date): RoomEpisode {
  return {
    id: 'episode-1',
    room_id: 'room-1',
    program_id: 'program-1',
    status: 'ACTIVE',
    summary_text: '',
    unresolved_question: null,
    callback_bank_json: [],
    energy: 0.45,
    tension: 0.2,
    turn_count: 4,
    message_count: 4,
    started_at: now,
    ended_at: null,
    created_at: now,
    updated_at: now,
  }
}

function makeState(overrides?: Partial<LoadedRoomProgramState>): LoadedRoomProgramState {
  const now = new Date('2026-03-10T09:00:00.000Z')
  return {
    room: {
      id: 'room-1',
      name: '节目房',
      slug: 'show-room',
      description: 'room desc',
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
    episode: makeEpisode(now),
    snapshot: null,
    cast: [],
    members: [],
    recentMessages: [],
    latestBeat: null,
    latestEvent: null,
    latestHighlight: null,
    lastMessage: null,
    ...overrides,
  }
}

describe('RoomCuePlanner', () => {
  it('prefers unresolved questions with ASK cue', () => {
    const planner = new RoomCuePlanner()
    const questionTime = new Date(Date.now() - 5_000)
    const plan = planner.plan(makeState({
      recentMessages: [{
        id: 'msg-q',
        room_id: 'room-1',
        author_id: 'agent-2',
        author_type: 'agent',
        episode_id: null,
        beat_id: null,
        program_event_id: null,
        speaker_role: null,
        cue_type: null,
        body: '那到底是谁先开始夸大这个结论的？',
        message_kind: 'normal',
        parent_message_id: null,
        vote_score: 0,
        created_at: questionTime,
      }],
      lastMessage: {
        id: 'msg-q',
        room_id: 'room-1',
        author_id: 'agent-2',
        author_type: 'agent',
        episode_id: null,
        beat_id: null,
        program_event_id: null,
        speaker_role: null,
        cue_type: null,
        body: '那到底是谁先开始夸大这个结论的？',
        message_kind: 'normal',
        parent_message_id: null,
        vote_score: 0,
        created_at: questionTime,
      },
    }), 'agent-trigger')

    expect(plan).toMatchObject({
      cue_type: 'ASK',
      beat_type: 'EXPLAIN',
      target_role: 'SKEPTIC',
    })
  })

  it('emits callback cue when callback bank has a reusable item', () => {
    const planner = new RoomCuePlanner()
    const now = new Date('2026-03-10T09:00:00.000Z')
    const plan = planner.plan(makeState({
      episode: {
        ...makeEpisode(now),
        callback_bank_json: [{
          message_id: 'msg-callback',
          author_agent_id: 'agent-3',
          summary_text: '刚才那个夜宵税的梗',
          weight: 0.9,
          created_at: new Date().toISOString(),
        }],
        turn_count: 6,
      },
      recentMessages: [{
        id: 'msg-latest',
        room_id: 'room-1',
        author_id: 'agent-1',
        author_type: 'agent',
        episode_id: null,
        beat_id: null,
        program_event_id: null,
        speaker_role: null,
        cue_type: null,
        body: '先把这个前提挂在这里。',
        message_kind: 'normal',
        parent_message_id: null,
        vote_score: 0,
        created_at: new Date(),
      }],
      lastMessage: {
        id: 'msg-latest',
        room_id: 'room-1',
        author_id: 'agent-1',
        author_type: 'agent',
        episode_id: null,
        beat_id: null,
        program_event_id: null,
        speaker_role: null,
        cue_type: null,
        body: '先把这个前提挂在这里。',
        message_kind: 'normal',
        parent_message_id: null,
        vote_score: 0,
        created_at: new Date(),
      },
    }), 'agent-trigger')

    expect(plan).toMatchObject({
      cue_type: 'CALLBACK',
      beat_type: 'CALLBACK',
      callback_message_id: 'msg-callback',
    })
  })

  it('falls back to CLOSE when energy is low and unresolved is empty', () => {
    const planner = new RoomCuePlanner()
    const idleTime = new Date(Date.now() - 20_000)
    const plan = planner.plan(makeState({
      episode: {
        ...makeEpisode(idleTime),
        unresolved_question: null,
        energy: 0.1,
        turn_count: 8,
      },
      snapshot: {
        id: 'snap-1',
        room_id: 'room-1',
        episode_id: 'episode-1',
        scene_type: 'FREE_CHAT',
        current_beat: null,
        live_hook: null,
        unresolved_question: null,
        recap_short: null,
        active_cast: [],
        last_highlight_text: null,
        energy: 0.1,
        tension: 0.1,
        message_cursor_id: null,
        version: 1,
        created_at: idleTime,
        updated_at: idleTime,
      },
      recentMessages: [{
        id: 'msg-last',
        room_id: 'room-1',
        author_id: 'agent-1',
        author_type: 'agent',
        episode_id: null,
        beat_id: null,
        program_event_id: null,
        speaker_role: null,
        cue_type: null,
        body: '行，那先到这。',
        message_kind: 'normal',
        parent_message_id: null,
        vote_score: 0,
        created_at: idleTime,
      }],
      lastMessage: {
        id: 'msg-last',
        room_id: 'room-1',
        author_id: 'agent-1',
        author_type: 'agent',
        episode_id: null,
        beat_id: null,
        program_event_id: null,
        speaker_role: null,
        cue_type: null,
        body: '行，那先到这。',
        message_kind: 'normal',
        parent_message_id: null,
        vote_score: 0,
        created_at: idleTime,
      },
    }), 'agent-trigger')

    expect(plan).toMatchObject({
      cue_type: 'CLOSE',
      beat_type: 'LANDING',
    })
  })
})
