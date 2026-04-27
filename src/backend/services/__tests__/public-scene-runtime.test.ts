/**
 * T-212 M1 — `parsePublicScenePayload` programming-block validation matrix.
 *
 * Establishes invariant I-1 at the read seam: a present-but-malformed
 * `programming` block hard-rejects (returns `null`) instead of being
 * swallowed alongside other parse failures. Missing programming is tolerated
 * (back-compat with legacy rows that predate the contract).
 */

import { describe, expect, it } from 'vitest'
import {
  buildPublicScenePayloadJson,
  parsePublicScenePayload,
  type PublicSceneWritePayload,
} from '../public-scene-runtime.js'

function baseScenePayload(): PublicSceneWritePayload {
  return {
    scene_metadata: {
      director_surface: 'scheduled_post',
      actor_surface: 'forum_post',
      scene_template_id: 'stage-theme-01',
      scene_template_version: 'v2',
      scene_binding_id: 'binding-1',
      overlay_id: null,
      episode_id: 'episode-1',
      beat_id: null,
      phase: 'opening',
      selection_mode: 'pool_guided',
      selection_id: 'selection-1',
      episode_plan_id: 'plan-1',
      local_intent_id: 'intent-1',
      started_at: '2026-04-26T00:00:00.000Z',
      expires_at: '2026-04-27T00:00:00.000Z',
    },
    episode_brief: {
      episode_id: 'episode-1',
      director_surface: 'scheduled_post',
      actor_surface: 'forum_post',
      template_id: 'stage-theme-01',
      template_version: 'v2',
      binding_id: 'binding-1',
      phase: 'opening',
      scene_goal: { viewer_goal: 'goal', growth_goal: 'growth' },
      casting_directive: {
        must_have_roles: [],
        avoid_pairs: [],
        core_quota: 1,
        contrast_quota: 0,
        wildcard_quota: 0,
      },
      open_loops: [],
      must_hit_points: [],
      avoid_repeat: [],
      close_condition: { ttl_hours: 24, message_threshold: 8, objective: 'goal' },
      expires_at: '2026-04-27T00:00:00.000Z',
    },
    local_intent: {
      intent_id: 'intent-1',
      delivery_surface: 'forum_post',
      initiative: 'open_topic',
      opinion_policy: 'free_opinion',
      relation_focus: 'none',
      tone_hint: 'neutral',
      privacy_mode: 'public_only',
      memory_scope: 'public_contextual',
      reference_scope: 'seed_only',
      prohibited_reference_types: [
        'owner_private_speech',
        'private_memory',
        'hidden_director_goal',
      ],
      target_ref: { kind: 'none' },
      hard_constraints: [],
      soft_constraints: [],
    },
    local_intent_block: '## Local Intent\n- episode_id: episode-1',
    selection_audit: null,
    planning_audit: null,
  }
}

describe('public-scene-runtime — programming block round-trip', () => {
  it('serializes and parses an autonomous-path payload', () => {
    const payload: PublicSceneWritePayload = {
      ...baseScenePayload(),
      programming: { production_path: 'autonomous' },
    }
    const serialized = buildPublicScenePayloadJson(payload)
    const parsed = parsePublicScenePayload(serialized)
    expect(parsed).not.toBeNull()
    expect(parsed?.programming).toEqual({ production_path: 'autonomous' })
  })

  it('serializes and parses a cue-path payload with full cue refs', () => {
    const payload: PublicSceneWritePayload = {
      ...baseScenePayload(),
      programming: {
        production_path: 'cue',
        cue: {
          schedule_id: 'sched-1',
          cue_id: 'cue-1',
          attempt_id: 'attempt-1',
          source_type: 'manual',
          change_ids: ['change-1', 'change-2'],
        },
      },
    }
    const serialized = buildPublicScenePayloadJson(payload)
    const parsed = parsePublicScenePayload(serialized)
    expect(parsed).not.toBeNull()
    expect(parsed?.programming).toEqual({
      production_path: 'cue',
      cue: {
        schedule_id: 'sched-1',
        cue_id: 'cue-1',
        attempt_id: 'attempt-1',
        source_type: 'manual',
        change_ids: ['change-1', 'change-2'],
      },
    })
  })

  it('parses a cue payload without optional change_ids', () => {
    const serialized = buildPublicScenePayloadJson({
      ...baseScenePayload(),
      programming: {
        production_path: 'cue',
        cue: {
          schedule_id: 'sched-1',
          cue_id: 'cue-1',
          attempt_id: 'attempt-1',
          source_type: 'baseline',
        },
      },
    })
    const parsed = parsePublicScenePayload(serialized)
    expect(parsed?.programming?.cue?.change_ids).toBeUndefined()
  })
})

describe('parsePublicScenePayload — programming back-compat (missing tolerated)', () => {
  it('returns programming=undefined when the field is missing entirely (legacy row)', () => {
    const serialized = buildPublicScenePayloadJson(baseScenePayload())
    const parsed = parsePublicScenePayload(serialized)
    expect(parsed).not.toBeNull()
    expect(parsed?.programming).toBeUndefined()
  })

  it('returns programming=undefined when the field is explicitly null (legacy row)', () => {
    const serialized = {
      ...buildPublicScenePayloadJson(baseScenePayload()),
      programming: null,
    }
    const parsed = parsePublicScenePayload(serialized)
    expect(parsed).not.toBeNull()
    expect(parsed?.programming).toBeUndefined()
  })
})

describe('parsePublicScenePayload — programming hard-reject matrix (I-1 invariant)', () => {
  function withBadProgramming(programming: unknown): unknown {
    return {
      ...buildPublicScenePayloadJson(baseScenePayload()),
      programming,
    }
  }

  it('rejects when production_path is missing', () => {
    expect(parsePublicScenePayload(withBadProgramming({}))).toBeNull()
  })

  it('rejects when production_path is an unknown string', () => {
    expect(
      parsePublicScenePayload(withBadProgramming({ production_path: 'hybrid' })),
    ).toBeNull()
  })

  it('rejects when production_path is non-string', () => {
    expect(
      parsePublicScenePayload(withBadProgramming({ production_path: 1 })),
    ).toBeNull()
  })

  it('rejects when programming is an array', () => {
    expect(parsePublicScenePayload(withBadProgramming([]))).toBeNull()
  })

  it('rejects when production_path=autonomous but a cue block is present', () => {
    expect(
      parsePublicScenePayload(
        withBadProgramming({
          production_path: 'autonomous',
          cue: { schedule_id: 's', cue_id: 'c', attempt_id: 'a', source_type: 'manual' },
        }),
      ),
    ).toBeNull()
  })

  it('rejects when production_path=cue but cue block is missing', () => {
    expect(
      parsePublicScenePayload(withBadProgramming({ production_path: 'cue' })),
    ).toBeNull()
  })

  it('rejects when production_path=cue but cue block lacks schedule_id', () => {
    expect(
      parsePublicScenePayload(
        withBadProgramming({
          production_path: 'cue',
          cue: { cue_id: 'c', attempt_id: 'a', source_type: 'manual' },
        }),
      ),
    ).toBeNull()
  })

  it('rejects when production_path=cue but cue block lacks cue_id', () => {
    expect(
      parsePublicScenePayload(
        withBadProgramming({
          production_path: 'cue',
          cue: { schedule_id: 's', attempt_id: 'a', source_type: 'manual' },
        }),
      ),
    ).toBeNull()
  })

  it('rejects when production_path=cue but cue block lacks attempt_id', () => {
    expect(
      parsePublicScenePayload(
        withBadProgramming({
          production_path: 'cue',
          cue: { schedule_id: 's', cue_id: 'c', source_type: 'manual' },
        }),
      ),
    ).toBeNull()
  })

  it('rejects when cue.source_type is unknown', () => {
    expect(
      parsePublicScenePayload(
        withBadProgramming({
          production_path: 'cue',
          cue: {
            schedule_id: 's',
            cue_id: 'c',
            attempt_id: 'a',
            source_type: 'autonomous',
          },
        }),
      ),
    ).toBeNull()
  })

  it('rejects when cue.change_ids is non-array', () => {
    expect(
      parsePublicScenePayload(
        withBadProgramming({
          production_path: 'cue',
          cue: {
            schedule_id: 's',
            cue_id: 'c',
            attempt_id: 'a',
            source_type: 'manual',
            change_ids: 'change-1',
          },
        }),
      ),
    ).toBeNull()
  })

  it('rejects when cue.change_ids contains a non-string element', () => {
    expect(
      parsePublicScenePayload(
        withBadProgramming({
          production_path: 'cue',
          cue: {
            schedule_id: 's',
            cue_id: 'c',
            attempt_id: 'a',
            source_type: 'manual',
            change_ids: ['ok', 42],
          },
        }),
      ),
    ).toBeNull()
  })

  it('rejects when schedule_id is empty string', () => {
    expect(
      parsePublicScenePayload(
        withBadProgramming({
          production_path: 'cue',
          cue: { schedule_id: '', cue_id: 'c', attempt_id: 'a', source_type: 'manual' },
        }),
      ),
    ).toBeNull()
  })
})
