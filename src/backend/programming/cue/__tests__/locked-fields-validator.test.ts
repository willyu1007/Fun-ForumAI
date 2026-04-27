import { describe, it, expect } from 'vitest'
import { validateLockedFields } from '../locked-fields-validator.js'
import type { CuePatchV1, PartialPublicDiscussionCue } from '../cue-patch.js'

const baseScene: PartialPublicDiscussionCue['scene_constraints'] = {
  community_scope: { mode: 'single', community_id: 'c1' },
  public_stage_scope: ['forum'],
  allowed_scene_families: ['debate', 'round_table'],
  preferred_scene_family: 'debate',
  privacy_policy: 'public_only',
  private_reference_policy: 'forbidden',
  safety_profile: 'standard',
}

const baseTheme: PartialPublicDiscussionCue['theme_intent'] = {
  topic_seed: 'AI 陪伴',
  tone_band: 'calm',
}

const basePartial: PartialPublicDiscussionCue = {
  priority: 50,
  risk_level: 'standard',
  scene_constraints: baseScene,
  theme_intent: baseTheme,
}

function patch(partial: PartialPublicDiscussionCue, removed_fields?: string[]): CuePatchV1 {
  return { version: 1, partial, ...(removed_fields ? { removed_fields } : {}) }
}

describe('validateLockedFields — empty cases', () => {
  it('returns [] when lockedPaths is empty', () => {
    const result = validateLockedFields({
      oldPartial: basePartial,
      patch: patch({ priority: 99 }),
      lockedPaths: [],
    })
    expect(result).toEqual([])
  })

  it('returns [] when patch makes no changes (deep-equal)', () => {
    const result = validateLockedFields({
      oldPartial: basePartial,
      patch: patch({ scene_constraints: { ...baseScene } }),
      lockedPaths: ['scene_constraints'],
    })
    expect(result).toEqual([])
  })
})

describe('validateLockedFields — exact match', () => {
  it('rejects when patch changes a leaf at the exact locked path', () => {
    const result = validateLockedFields({
      oldPartial: basePartial,
      patch: patch({ theme_intent: { topic_seed: 'AI 陪伴', tone_band: 'sharp' } }),
      lockedPaths: ['theme_intent.tone_band'],
    })
    expect(result.length).toBeGreaterThan(0)
    expect(result[0]).toMatchObject({
      patchPath: 'theme_intent.tone_band',
      lockedBy: 'theme_intent.tone_band',
    })
  })

  it('accepts when patch supplies the same leaf value', () => {
    const result = validateLockedFields({
      oldPartial: basePartial,
      patch: patch({ theme_intent: { topic_seed: 'AI 陪伴', tone_band: 'calm' } }),
      lockedPaths: ['theme_intent.tone_band'],
    })
    expect(result).toEqual([])
  })
})

describe('validateLockedFields — parent locks child', () => {
  it('rejects any descendant change when parent is locked', () => {
    const result = validateLockedFields({
      oldPartial: basePartial,
      patch: patch({
        scene_constraints: {
          ...baseScene,
          preferred_scene_family: 'round_table',
        },
      }),
      lockedPaths: ['scene_constraints'],
    })
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      patchPath: 'scene_constraints.preferred_scene_family',
      lockedBy: 'scene_constraints',
    })
  })

  it('rejects nested-leaf change when grandparent locked', () => {
    const result = validateLockedFields({
      oldPartial: basePartial,
      patch: patch({
        scene_constraints: {
          ...baseScene,
          community_scope: { mode: 'single', community_id: 'c2' },
        },
      }),
      lockedPaths: ['scene_constraints'],
    })
    expect(result).toHaveLength(1)
    expect(result[0].patchPath).toBe('scene_constraints.community_scope.community_id')
  })
})

describe('validateLockedFields — child blocks parent rewrite', () => {
  it('rejects parent rewrite when locked child changes within it', () => {
    const result = validateLockedFields({
      oldPartial: basePartial,
      patch: patch({
        scene_constraints: {
          ...baseScene,
          allowed_scene_families: ['hot_topic_match'],
        },
      }),
      lockedPaths: ['scene_constraints.allowed_scene_families'],
    })
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      patchPath: 'scene_constraints.allowed_scene_families',
      lockedBy: 'scene_constraints.allowed_scene_families',
    })
  })

  it('accepts parent rewrite when locked child is unchanged', () => {
    const result = validateLockedFields({
      oldPartial: basePartial,
      patch: patch({
        scene_constraints: {
          ...baseScene,
          preferred_scene_family: 'round_table',
        },
      }),
      lockedPaths: ['scene_constraints.allowed_scene_families'],
    })
    expect(result).toEqual([])
  })
})

describe('validateLockedFields — sibling independence', () => {
  it('does not block changes to a sibling path', () => {
    const result = validateLockedFields({
      oldPartial: basePartial,
      patch: patch({
        scene_constraints: {
          ...baseScene,
          preferred_scene_family: 'round_table',
        },
      }),
      lockedPaths: ['scene_constraints.allowed_scene_families'],
    })
    expect(result).toEqual([])
  })

  it('does not match prefix-similar but distinct segment names', () => {
    // 'priority' should not be matched by lock 'prio'
    const result = validateLockedFields({
      oldPartial: basePartial,
      patch: patch({ priority: 80 }),
      lockedPaths: ['prio'],
    })
    expect(result).toEqual([])
  })
})

describe('validateLockedFields — array semantics (deep-equal, no per-index diff)', () => {
  it('accepts an array set to a deep-equal value', () => {
    const result = validateLockedFields({
      oldPartial: basePartial,
      patch: patch({
        scene_constraints: {
          ...baseScene,
          allowed_scene_families: ['debate', 'round_table'],
        },
      }),
      lockedPaths: ['scene_constraints.allowed_scene_families'],
    })
    expect(result).toEqual([])
  })

  it('rejects an array with a different length', () => {
    const result = validateLockedFields({
      oldPartial: basePartial,
      patch: patch({
        scene_constraints: {
          ...baseScene,
          allowed_scene_families: ['debate'],
        },
      }),
      lockedPaths: ['scene_constraints.allowed_scene_families'],
    })
    expect(result).toHaveLength(1)
    expect(result[0].patchPath).toBe('scene_constraints.allowed_scene_families')
  })
})

describe('validateLockedFields — removed_fields', () => {
  it('rejects removed_fields entry that maps to a locked path', () => {
    const result = validateLockedFields({
      oldPartial: basePartial,
      patch: patch({}, ['theme_intent']),
      lockedPaths: ['theme_intent'],
    })
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      patchPath: 'theme_intent',
      lockedBy: 'theme_intent',
    })
  })

  it('rejects removed_fields entry covered by a locked descendant', () => {
    const result = validateLockedFields({
      oldPartial: basePartial,
      patch: patch({}, ['theme_intent']),
      lockedPaths: ['theme_intent.tone_band'],
    })
    expect(result).toHaveLength(1)
    expect(result[0].patchPath).toBe('theme_intent')
    expect(result[0].lockedBy).toBe('theme_intent.tone_band')
  })

  it('does not flag removed_fields entry that was never in the cue', () => {
    const partialWithoutPolicy: PartialPublicDiscussionCue = {
      ...basePartial,
      // admission_policy intentionally absent
    }
    const result = validateLockedFields({
      oldPartial: partialWithoutPolicy,
      patch: patch({}, ['admission_policy']),
      lockedPaths: ['admission_policy'],
    })
    expect(result).toEqual([])
  })
})

describe('validateLockedFields — multi-lock interaction', () => {
  it('reports each (changed-leaf × locking-path) pair', () => {
    const result = validateLockedFields({
      oldPartial: basePartial,
      patch: patch({
        scene_constraints: {
          ...baseScene,
          preferred_scene_family: 'round_table',
          allowed_scene_families: ['hot_topic_match'],
        },
      }),
      lockedPaths: ['scene_constraints', 'scene_constraints.preferred_scene_family'],
    })
    // 2 changed leaves × 2 locks where each lock applies to specific leaves
    // - allowed_scene_families is covered by 'scene_constraints' (1 violation)
    // - preferred_scene_family is covered by both locks (2 violations)
    expect(result).toHaveLength(3)
  })
})

describe('validateLockedFields — primitive-shaped top-level changes', () => {
  it('records change at top-level path when value is primitive', () => {
    const result = validateLockedFields({
      oldPartial: basePartial,
      patch: patch({ priority: 99 }),
      lockedPaths: ['priority'],
    })
    expect(result).toEqual([{ patchPath: 'priority', lockedBy: 'priority' }])
  })

  it('top-level new value (was undefined) records change at the top-level path; child lock still trips', () => {
    const newPartial: PartialPublicDiscussionCue = {
      priority: 50,
      risk_level: 'standard',
    }
    const result = validateLockedFields({
      oldPartial: newPartial,
      patch: patch({
        theme_intent: { topic_seed: 'novel topic', tone_band: 'reflective' },
      }),
      lockedPaths: ['theme_intent.tone_band'],
    })
    // Patch path is recorded at 'theme_intent' (old side undefined → non-plain),
    // and the child-blocks-parent-rewrite arm matches because
    // 'theme_intent.tone_band'.startsWith('theme_intent.') is true.
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      patchPath: 'theme_intent',
      lockedBy: 'theme_intent.tone_band',
    })
  })
})
