import { describe, expect, it } from 'vitest'
import type { RoomCastMemberView } from '../../repos/types.js'
import { RoomProgramScorer } from '../room-program-scorer.js'

function makeCastMember(overrides: Partial<RoomCastMemberView>): RoomCastMemberView {
  return {
    agent_id: 'agent-host',
    name: 'Host',
    role: 'HOST',
    chemistry_score: 0.91,
    spotlight_weight: 1.2,
    last_spoke_at: null,
    role_hint: null,
    wander_eligible: true,
    suppressed_until: null,
    member_spotlight_weight: 1,
    projection: null,
    ...overrides,
  }
}

describe('RoomProgramScorer', () => {
  it('rewards role fit and callback hits while penalizing repetition', () => {
    const scorer = new RoomProgramScorer()
    const scores = scorer.score({
      cue: {
        cue_type: 'CALLBACK',
        beat_type: 'CALLBACK',
        director_goal: '把梗回收回来',
        prompt_hint: null,
        target_role: 'FOIL',
        anchor_message_id: 'msg-latest',
        callback_message_id: 'msg-old',
        audit_json: {},
      },
      cast: [
        makeCastMember({
          agent_id: 'agent-foil',
          name: 'Foil',
          role: 'FOIL',
          chemistry_score: 0.82,
          spotlight_weight: 1,
          last_spoke_at: null,
        }),
        makeCastMember({}),
      ],
      scene_type: 'FREE_CHAT',
      recentMessages: [
        {
          id: 'msg-old',
          room_id: 'room-1',
          author_id: 'agent-foil',
          author_type: 'agent',
          episode_id: null,
          beat_id: null,
          program_event_id: null,
          speaker_role: 'FOIL',
          cue_type: null,
          body: '夜宵税这个说法我先记着。',
          message_kind: 'normal',
          parent_message_id: null,
          vote_score: 0,
          created_at: new Date('2026-03-10T10:00:00.000Z'),
        },
        {
          id: 'msg-latest',
          room_id: 'room-1',
          author_id: 'agent-host',
          author_type: 'agent',
          episode_id: null,
          beat_id: null,
          program_event_id: null,
          speaker_role: 'HOST',
          cue_type: null,
          body: '先把现场稳住。',
          message_kind: 'normal',
          parent_message_id: null,
          vote_score: 0,
          created_at: new Date('2026-03-10T10:00:10.000Z'),
        },
      ],
      maxConsecutiveTurns: 1,
    })

    expect(scores[0]).toMatchObject({
      agent_id: 'agent-foil',
      role: 'FOIL',
    })
    expect(scores[0].reasons_json.some((reason) => reason.code === 'callback_bonus')).toBe(true)
    expect(scores[1].reasons_json.some((reason) => reason.code === 'last_speaker_penalty')).toBe(true)
  })
})
