import { describe, it, expect } from 'vitest'
import {
  CuePatchV1Schema,
  FORBIDDEN_CUE_FIELDS,
  PartialPublicDiscussionCueSchema,
  applyCuePatch,
  isForbiddenCueField,
} from '../cue-patch.js'

describe('FORBIDDEN_CUE_FIELDS', () => {
  it('contains all 21 forbidden fields per umbrella §3', () => {
    expect(FORBIDDEN_CUE_FIELDS).toHaveLength(21)
  })

  it('isForbiddenCueField narrows on known names', () => {
    expect(isForbiddenCueField('agent_dialogue')).toBe(true)
    expect(isForbiddenCueField('topic_seed')).toBe(false)
  })
})

describe('CuePatchV1Schema — accept', () => {
  it('accepts a minimal valid patch with version=1 and partial fields', () => {
    const patch = {
      version: 1 as const,
      partial: {
        priority: 70,
        risk_level: 'standard' as const,
      },
    }
    const parsed = CuePatchV1Schema.parse(patch)
    expect(parsed.version).toBe(1)
    expect(parsed.partial.priority).toBe(70)
  })

  it('accepts a patch carrying theme_intent + scene_constraints + role_requirements', () => {
    const patch = {
      version: 1 as const,
      partial: {
        theme_intent: { topic_seed: 'AI 陪伴边界' },
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
      },
    }
    expect(() => CuePatchV1Schema.parse(patch)).not.toThrow()
  })

  it('accepts removed_fields containing only editable field names', () => {
    const patch = {
      version: 1 as const,
      partial: {},
      removed_fields: ['admission_policy', 'load_policy'],
    }
    expect(() => CuePatchV1Schema.parse(patch)).not.toThrow()
  })
})

describe('CuePatchV1Schema — reject (forbidden fields, exhaustive)', () => {
  for (const forbidden of FORBIDDEN_CUE_FIELDS) {
    it(`rejects "${forbidden}" appearing as a partial key`, () => {
      const patch = {
        version: 1,
        partial: { [forbidden]: 'anything' },
      }
      expect(() => CuePatchV1Schema.parse(patch)).toThrow()
    })

    it(`rejects "${forbidden}" appearing in removed_fields`, () => {
      const patch = {
        version: 1,
        partial: {},
        removed_fields: [forbidden],
      }
      expect(() => CuePatchV1Schema.parse(patch)).toThrow()
    })
  }
})

describe('CuePatchV1Schema — reject (other rules)', () => {
  it('rejects version != 1', () => {
    expect(() =>
      CuePatchV1Schema.parse({ version: 2, partial: {} }),
    ).toThrow()
  })

  it('rejects unknown extra keys at the patch envelope (strict)', () => {
    expect(() =>
      CuePatchV1Schema.parse({
        version: 1,
        partial: {},
        extra: 'nope',
      }),
    ).toThrow()
  })

  it('rejects unknown fields in partial (strict)', () => {
    expect(() =>
      CuePatchV1Schema.parse({
        version: 1,
        partial: { unknown_field: 'x' },
      }),
    ).toThrow()
  })

  it('rejects priority > 100', () => {
    expect(() =>
      CuePatchV1Schema.parse({
        version: 1,
        partial: { priority: 101 },
      }),
    ).toThrow()
  })

  it('rejects unknown lane', () => {
    expect(() =>
      CuePatchV1Schema.parse({
        version: 1,
        partial: { lane: 'turbo' },
      }),
    ).toThrow()
  })

  it('rejects malformed trigger_at', () => {
    expect(() =>
      CuePatchV1Schema.parse({
        version: 1,
        partial: { trigger_at: 'not-a-date' },
      }),
    ).toThrow()
  })

  it('rejects removed_fields entry that is not an editable field name', () => {
    expect(() =>
      CuePatchV1Schema.parse({
        version: 1,
        partial: {},
        removed_fields: ['id'],
      }),
    ).toThrow()
  })
})

describe('PartialPublicDiscussionCueSchema', () => {
  it('rejects priority < 0', () => {
    expect(() =>
      PartialPublicDiscussionCueSchema.parse({ priority: -1 }),
    ).toThrow()
  })

  it('rejects unknown enum in risk_level', () => {
    expect(() =>
      PartialPublicDiscussionCueSchema.parse({ risk_level: 'extreme' }),
    ).toThrow()
  })
})

describe('applyCuePatch', () => {
  it('shallow-merges partial fields onto base', () => {
    const base = { priority: 50, risk_level: 'standard' as const }
    const merged = applyCuePatch(base, {
      version: 1,
      partial: { priority: 80 },
    })
    expect(merged).toEqual({ priority: 80, risk_level: 'standard' })
  })

  it('removes listed fields via removed_fields', () => {
    const base = {
      priority: 50,
      admission_policy: {
        on_global_overload: 'defer' as const,
        on_community_overload: 'defer' as const,
        on_media_overload: 'defer' as const,
        on_agent_pool_empty: 'defer' as const,
        max_deferral_minutes: 30,
      },
    }
    const merged = applyCuePatch(base, {
      version: 1,
      partial: {},
      removed_fields: ['admission_policy'],
    })
    expect(merged.admission_policy).toBeUndefined()
    expect(merged.priority).toBe(50)
  })

  it('partial overrides take precedence over base, removed_fields take precedence over partial', () => {
    const base = { priority: 50 }
    const merged = applyCuePatch(base, {
      version: 1,
      partial: { priority: 99 },
      removed_fields: ['priority'],
    })
    expect(merged.priority).toBeUndefined()
  })

  it('throws when merged shape would be invalid (e.g., unknown field smuggled into base)', () => {
    const base = { priority: 50 } as Record<string, unknown>
    base.unknown = 'x'
    expect(() =>
      applyCuePatch(base as never, { version: 1, partial: {} }),
    ).toThrow()
  })
})
