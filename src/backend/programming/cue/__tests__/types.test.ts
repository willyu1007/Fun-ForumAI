import { describe, it, expect } from 'vitest'
import {
  CueCommunityScopeSchema,
  CueRoleRequirementVectorSchema,
  CueSceneConstraintsSchema,
  CueThemeIntentSchema,
  LockedFieldsSchema,
  PublicDiscussionCueDomainSchema,
} from '../types.js'

describe('CueThemeIntentSchema', () => {
  it('accepts a minimal theme intent (topic_seed only)', () => {
    expect(() =>
      CueThemeIntentSchema.parse({ topic_seed: 'AI 陪伴边界' }),
    ).not.toThrow()
  })

  it('accepts full theme intent with public_context_refs', () => {
    expect(() =>
      CueThemeIntentSchema.parse({
        topic_seed: 'AI 陪伴边界',
        discussion_question: '何时是越界？',
        angle_hint: '不下结论',
        tone_band: 'tense_but_playful',
        public_context_refs: [
          { kind: 'post', id: 'post_1', note: '昨日讨论' },
        ],
      }),
    ).not.toThrow()
  })

  it('rejects empty topic_seed', () => {
    expect(() => CueThemeIntentSchema.parse({ topic_seed: '' })).toThrow()
  })

  it('rejects unknown tone_band', () => {
    expect(() =>
      CueThemeIntentSchema.parse({
        topic_seed: 'x',
        tone_band: 'angry',
      }),
    ).toThrow()
  })

  it('rejects unknown extra keys (strict)', () => {
    expect(() =>
      CueThemeIntentSchema.parse({
        topic_seed: 'x',
        extra: 'nope',
      }),
    ).toThrow()
  })
})

describe('CueSceneConstraintsSchema', () => {
  function valid() {
    return {
      community_scope: { mode: 'single' as const, community_id: 'c1' },
      public_stage_scope: ['forum' as const],
      privacy_policy: 'public_only' as const,
      private_reference_policy: 'forbidden' as const,
      safety_profile: 'standard' as const,
    }
  }

  it('accepts the minimal valid constraint set', () => {
    expect(() => CueSceneConstraintsSchema.parse(valid())).not.toThrow()
  })

  it('rejects mode=single without community_id', () => {
    expect(() =>
      CueSceneConstraintsSchema.parse({
        ...valid(),
        community_scope: { mode: 'single' },
      }),
    ).toThrow()
  })

  it('rejects mode=community_family without community_family_id', () => {
    expect(() =>
      CueSceneConstraintsSchema.parse({
        ...valid(),
        community_scope: { mode: 'community_family' },
      }),
    ).toThrow()
  })

  it('rejects empty public_stage_scope', () => {
    expect(() =>
      CueSceneConstraintsSchema.parse({
        ...valid(),
        public_stage_scope: [],
      }),
    ).toThrow()
  })

  it('rejects tension_range with min > max', () => {
    expect(() =>
      CueSceneConstraintsSchema.parse({
        ...valid(),
        tension_range: { min: 0.8, max: 0.4 },
      }),
    ).toThrow()
  })
})

describe('CueRoleRequirementVectorSchema', () => {
  it('accepts a vector with at least one requirement', () => {
    expect(() =>
      CueRoleRequirementVectorSchema.parse({
        requirements: [{ role: 'anchor', weight: 0.7 }],
        relationship_shape: 'contrast_with_bridge',
        novelty_preference: 'avoid_recently_overexposed',
      }),
    ).not.toThrow()
  })

  it('rejects empty requirements list', () => {
    expect(() =>
      CueRoleRequirementVectorSchema.parse({ requirements: [] }),
    ).toThrow()
  })

  it('rejects weight out of [0, 1]', () => {
    expect(() =>
      CueRoleRequirementVectorSchema.parse({
        requirements: [{ role: 'anchor', weight: 1.5 }],
      }),
    ).toThrow()
  })

  it('rejects unknown role', () => {
    expect(() =>
      CueRoleRequirementVectorSchema.parse({
        requirements: [{ role: 'critic', weight: 0.5 }],
      }),
    ).toThrow()
  })
})

describe('PublicDiscussionCueDomainSchema', () => {
  function valid() {
    return {
      id: 'cue_1',
      schedule_id: 'sched_1',
      source_type: 'manual' as const,
      status: 'scheduled' as const,
      community_id: 'c1',
      scope: { mode: 'single' as const, community_id: 'c1' },
      trigger_at: '2026-04-25T20:30:00+08:00',
      timezone: 'Asia/Shanghai',
      priority: 60,
      lane: 'standard' as const,
      dispatch_policy: {
        trigger_at: '2026-04-25T20:30:00+08:00',
        timezone: 'Asia/Shanghai',
        dispatch_mode: 'graceful' as const,
        grace_seconds: 60,
        priority: 60,
        lane: 'standard' as const,
        misfire_policy: 'delay' as const,
        max_attempts: 3,
        retry_backoff_seconds: 30,
      },
      theme_intent: { topic_seed: 'topic' },
      scene_constraints: {
        community_scope: { mode: 'single' as const, community_id: 'c1' },
        public_stage_scope: ['forum' as const],
        privacy_policy: 'public_only' as const,
        private_reference_policy: 'forbidden' as const,
        safety_profile: 'standard' as const,
      },
      role_requirements: {
        requirements: [{ role: 'anchor' as const, weight: 0.7 }],
      },
      locked_fields: [],
      risk_level: 'standard' as const,
      revision: 1,
      idempotency_key: 'cue:sched_1:cue_1:1',
      created_at: '2026-04-25T20:00:00+08:00',
      updated_at: '2026-04-25T20:10:00+08:00',
    }
  }

  it('accepts a fully populated domain entity', () => {
    expect(() => PublicDiscussionCueDomainSchema.parse(valid())).not.toThrow()
  })

  it('rejects priority > 100', () => {
    expect(() =>
      PublicDiscussionCueDomainSchema.parse({ ...valid(), priority: 101 }),
    ).toThrow()
  })

  it('rejects unknown extra keys (strict)', () => {
    expect(() =>
      PublicDiscussionCueDomainSchema.parse({
        ...valid(),
        unknown_field: 'nope',
      }),
    ).toThrow()
  })
})

describe('CueCommunityScopeSchema (CRITICAL-1 export)', () => {
  it('is exported and validates valid single-community scope', () => {
    expect(() =>
      CueCommunityScopeSchema.parse({ mode: 'single', community_id: 'c1' }),
    ).not.toThrow()
  })

  it('rejects single-mode scope without community_id', () => {
    expect(() =>
      CueCommunityScopeSchema.parse({ mode: 'single' }),
    ).toThrow()
  })

  it('rejects unknown mode', () => {
    expect(() =>
      CueCommunityScopeSchema.parse({ mode: 'invalid', community_id: 'c1' }),
    ).toThrow()
  })
})

describe('LockedFieldsSchema (CRITICAL-2 fix)', () => {
  it('accepts an array of non-empty strings', () => {
    expect(LockedFieldsSchema.parse(['priority', 'risk_level'])).toEqual([
      'priority',
      'risk_level',
    ])
  })

  it('defaults to empty array when input is undefined', () => {
    expect(LockedFieldsSchema.parse(undefined)).toEqual([])
  })

  it('rejects non-array input (e.g., null, object)', () => {
    expect(() => LockedFieldsSchema.parse(null)).toThrow()
    expect(() => LockedFieldsSchema.parse({ a: 1 })).toThrow()
  })

  it('rejects array containing non-string entries', () => {
    expect(() => LockedFieldsSchema.parse(['ok', 42])).toThrow()
    expect(() => LockedFieldsSchema.parse([null])).toThrow()
  })

  it('rejects array containing empty strings', () => {
    expect(() => LockedFieldsSchema.parse([''])).toThrow()
  })
})
