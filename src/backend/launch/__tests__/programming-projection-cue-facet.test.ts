import { describe, expect, it } from 'vitest'
import {
  CUE_PROJECTION_FORBIDDEN_KEYS,
  buildCueProjectionFacet,
  isUpcomingProjectableStatus,
} from '../programming-projection-cue-facet.js'
import type { PublicDiscussionCueDomain } from '../../programming/cue/types.js'

function buildCue(
  overrides: Partial<PublicDiscussionCueDomain> = {},
): PublicDiscussionCueDomain {
  return {
    id: 'cue-1',
    schedule_id: 'sched-1',
    source_type: 'manual',
    status: 'scheduled',
    community_id: 'community-1',
    scope: { mode: 'single', community_id: 'community-1' },
    trigger_at: '2026-04-26T20:00:00Z',
    timezone: 'UTC',
    priority: 50,
    lane: 'standard',
    dispatch_policy: {} as PublicDiscussionCueDomain['dispatch_policy'],
    theme_intent: {
      topic_seed: 'INTERNAL_TOPIC_SEED_DO_NOT_LEAK',
      discussion_question: 'INTERNAL_DISCUSSION_QUESTION_DO_NOT_LEAK',
      angle_hint: 'INTERNAL_ANGLE_HINT_DO_NOT_LEAK',
      tone_band: 'sharp',
    },
    scene_constraints: {} as PublicDiscussionCueDomain['scene_constraints'],
    role_requirements: {} as PublicDiscussionCueDomain['role_requirements'],
    locked_fields: ['risk_level'],
    risk_level: 'high',
    revision: 1,
    idempotency_key: 'idem-1',
    created_at: '2026-04-26T18:00:00Z',
    updated_at: '2026-04-26T19:00:00Z',
    ...overrides,
  }
}

describe('buildCueProjectionFacet — sanitization', () => {
  it('omits every forbidden internal field across upcoming / live / completed', () => {
    const cue = buildCue({ id: 'cue-internal', risk_level: 'high' })
    const facet = buildCueProjectionFacet({
      upcoming: [{ cue, community_id: 'community-1' }],
      live: [{ cue: buildCue({ id: 'cue-live', status: 'executing' }), community_id: 'community-1', attempt_id: 'attempt-live' }],
      completed: [{
        cue: buildCue({ id: 'cue-done', status: 'consumed' }),
        community_id: 'community-1',
        completed_at: '2026-04-26T20:30:00Z',
        result_post_id: 'post-1',
        result_thread_id: null,
        result_url: 'https://example.com/posts/post-1',
      }],
    })

    const serialized = JSON.stringify(facet)
    for (const forbidden of CUE_PROJECTION_FORBIDDEN_KEYS) {
      expect(serialized).not.toContain(`"${forbidden}"`)
    }
    // Probe that the internal markers we set on the fixture never appear in the output.
    expect(serialized).not.toContain('INTERNAL_TOPIC_SEED_DO_NOT_LEAK')
    expect(serialized).not.toContain('INTERNAL_DISCUSSION_QUESTION_DO_NOT_LEAK')
    expect(serialized).not.toContain('INTERNAL_ANGLE_HINT_DO_NOT_LEAK')
  })

  it('emits stable structural fields on upcoming items', () => {
    const cue = buildCue({ id: 'cue-up', lane: 'prime', trigger_at: '2026-04-26T20:00:00Z' })
    const facet = buildCueProjectionFacet({
      upcoming: [{ cue, community_id: 'community-1' }],
      live: [],
      completed: [],
    })
    expect(facet.upcoming).toHaveLength(1)
    const item = facet.upcoming[0]!
    expect(item).toEqual({
      cue_id: 'cue-up',
      schedule_id: 'sched-1',
      community_id: 'community-1',
      trigger_at: '2026-04-26T20:00:00Z',
      lane: 'prime',
      status: 'upcoming',
    })
  })

  it('emits result references on completed items so the consumer can deep-link', () => {
    const facet = buildCueProjectionFacet({
      upcoming: [],
      live: [],
      completed: [{
        cue: buildCue({ id: 'cue-done', status: 'consumed' }),
        community_id: 'community-1',
        completed_at: '2026-04-26T20:45:00Z',
        result_post_id: 'post-99',
        result_thread_id: 'thread-99',
        result_url: 'https://example.com/posts/post-99',
      }],
    })
    expect(facet.completed[0]).toEqual({
      cue_id: 'cue-done',
      schedule_id: 'sched-1',
      community_id: 'community-1',
      completed_at: '2026-04-26T20:45:00Z',
      status: 'completed',
      result_post_id: 'post-99',
      result_thread_id: 'thread-99',
      result_url: 'https://example.com/posts/post-99',
    })
  })

  it('exposes attempt_id on live items for diagnostic linking only', () => {
    const facet = buildCueProjectionFacet({
      upcoming: [],
      live: [{
        cue: buildCue({ id: 'cue-live', status: 'executing' }),
        community_id: 'community-1',
        attempt_id: 'attempt-xyz',
      }],
      completed: [],
    })
    expect(facet.live[0]?.status).toBe('live')
    expect(facet.live[0]?.attempt_id).toBe('attempt-xyz')
  })

  it('handles community-family scope by surfacing community_id=null', () => {
    const cue = buildCue({
      community_id: undefined,
      scope: { mode: 'community_family', community_family_id: 'family-1' },
    })
    const facet = buildCueProjectionFacet({
      upcoming: [{ cue, community_id: null }],
      live: [],
      completed: [],
    })
    expect(facet.upcoming[0]?.community_id).toBeNull()
  })
})

describe('isUpcomingProjectableStatus', () => {
  it('admits scheduled / prewarming / due statuses only', () => {
    expect(isUpcomingProjectableStatus('scheduled')).toBe(true)
    expect(isUpcomingProjectableStatus('prewarming')).toBe(true)
    expect(isUpcomingProjectableStatus('due')).toBe(true)
  })

  it('rejects draft / claimed / executing / terminal statuses', () => {
    expect(isUpcomingProjectableStatus('draft')).toBe(false)
    expect(isUpcomingProjectableStatus('validating')).toBe(false)
    expect(isUpcomingProjectableStatus('validated')).toBe(false)
    expect(isUpcomingProjectableStatus('claimed')).toBe(false)
    expect(isUpcomingProjectableStatus('executing')).toBe(false)
    expect(isUpcomingProjectableStatus('consumed')).toBe(false)
    expect(isUpcomingProjectableStatus('cancelled')).toBe(false)
    expect(isUpcomingProjectableStatus('failed')).toBe(false)
    expect(isUpcomingProjectableStatus('expired')).toBe(false)
    expect(isUpcomingProjectableStatus('skipped')).toBe(false)
    expect(isUpcomingProjectableStatus('deferred')).toBe(false)
  })
})
