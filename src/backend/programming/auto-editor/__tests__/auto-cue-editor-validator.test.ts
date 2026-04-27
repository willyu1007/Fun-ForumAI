import { describe, expect, it } from 'vitest'
import {
  AutoCueEditorValidator,
  type AutoCueEditorValidationContext,
} from '../auto-cue-editor-validator.js'
import { FORBIDDEN_CUE_FIELDS } from '../../cue/cue-patch.js'

const baseContext: AutoCueEditorValidationContext = {
  authorizedMediaAssetIds: ['asset-1', 'asset-2'],
  allowedActions: ['create_cue', 'update_cue', 'cancel_cue', 'attach_media'],
  lockedFields: [],
}

function buildOutput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    action: 'create_cue',
    reason: 'community lull detected',
    risk_level: 'standard',
    target_cue_id: null,
    patch_json: {
      version: 1,
      partial: {
        trigger_at: '2026-04-27T20:00:00Z',
        timezone: 'UTC',
        priority: 50,
        lane: 'standard',
      },
    },
    confidence: 0.7,
    requires_review: true,
    ...overrides,
  }
}

describe('AutoCueEditorValidator — happy path', () => {
  it('accepts a well-formed CuePatchV1 + supported action', () => {
    const validator = new AutoCueEditorValidator()
    const result = validator.validate(buildOutput(), baseContext)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.output.action).toBe('create_cue')
      expect(result.output.confidence).toBe(0.7)
    }
  })
})

describe('AutoCueEditorValidator — schema rejection', () => {
  it('rejects off-schema input (missing required fields)', () => {
    const validator = new AutoCueEditorValidator()
    const result = validator.validate({ action: 'create_cue' }, baseContext)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.failures[0]?.code).toBe('off_schema')
    }
  })

  it('rejects unknown action', () => {
    const validator = new AutoCueEditorValidator()
    const result = validator.validate(
      buildOutput({ action: 'invent_a_new_action' }),
      baseContext,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.failures[0]?.code).toBe('off_schema')
    }
  })

  it('rejects confidence outside [0,1]', () => {
    const validator = new AutoCueEditorValidator()
    const result = validator.validate(
      buildOutput({ confidence: 1.5 }),
      baseContext,
    )
    expect(result.ok).toBe(false)
  })
})

describe('AutoCueEditorValidator — forbidden field probe (21-field matrix)', () => {
  // The CuePatchV1 superRefine catches most of these at schema level; the
  // backstop catches nested occurrences that the schema's strict shape
  // wouldn't trip on. Probe both.
  const NESTABLE_FORBIDDEN_FIELDS = [
    'candidate_agent_ids',
    'preferred_agent_ids',
    'fallback_agent_ids',
    'selected_agent_id',
    'must_hit_points',
    'expected_outputs',
    'agent_dialogue',
    'private_owner_memory',
  ] as const

  it('schema-level superRefine rejects each forbidden top-level field', () => {
    const validator = new AutoCueEditorValidator()
    for (const forbidden of FORBIDDEN_CUE_FIELDS) {
      const result = validator.validate(
        buildOutput({
          patch_json: {
            version: 1,
            partial: { [forbidden]: 'x' },
          },
        }),
        baseContext,
      )
      expect(result.ok).toBe(false)
    }
  })

  it('backstop scan rejects forbidden field nested inside media_policy', () => {
    const validator = new AutoCueEditorValidator()
    const result = validator.validate(
      buildOutput({
        patch_json: {
          version: 1,
          partial: {
            media_policy: {
              media_resource_pool: [{
                asset_id: 'asset-1',
                role: 'context_anchor',
                usage_strength: 'optional',
                use_policy: 'runtime_only',
                sort_order: 0,
                // Probe: nested forbidden field that schema's .strict() on
                // outer object can't catch (this is inside an array entry).
                must_hit_points: ['leak'],
              }],
            },
          },
        },
      }),
      baseContext,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      const codes = result.failures.map((f) => f.code)
      // Either the schema rejects (off_schema) or the backstop fires
      // (forbidden_field). Either is correct defense.
      expect(codes.some((c) => c === 'forbidden_field' || c === 'off_schema')).toBe(true)
    }
  })

  it('FORBIDDEN_CUE_FIELDS includes all 21 frozen entries', () => {
    expect(FORBIDDEN_CUE_FIELDS.length).toBe(21)
    expect(FORBIDDEN_CUE_FIELDS).toContain('candidate_agent_ids')
    expect(FORBIDDEN_CUE_FIELDS).toContain('selected_cast')
    expect(FORBIDDEN_CUE_FIELDS).toContain('post_body')
    for (const _f of NESTABLE_FORBIDDEN_FIELDS) {
      expect(FORBIDDEN_CUE_FIELDS).toContain(_f)
    }
  })
})

describe('AutoCueEditorValidator — locked-field violation', () => {
  it('rejects patches touching a top-level locked field', () => {
    const validator = new AutoCueEditorValidator()
    const result = validator.validate(
      buildOutput({
        action: 'update_cue',
        target_cue_id: 'cue-1',
        patch_json: {
          version: 1,
          partial: {
            risk_level: 'low',
            priority: 90,
          },
        },
      }),
      { ...baseContext, allowedActions: ['update_cue'], lockedFields: ['risk_level'] },
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      const violation = result.failures.find((f) => f.code === 'locked_field_violation')
      expect(violation).toBeDefined()
      expect(violation?.offending).toContain('risk_level')
    }
  })

  it('rejects patches with locked field listed in removed_fields', () => {
    const validator = new AutoCueEditorValidator()
    const result = validator.validate(
      buildOutput({
        action: 'update_cue',
        target_cue_id: 'cue-1',
        patch_json: {
          version: 1,
          partial: { priority: 80 },
          removed_fields: ['risk_level'],
        },
      }),
      { ...baseContext, allowedActions: ['update_cue'], lockedFields: ['risk_level'] },
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.failures.some((f) => f.code === 'locked_field_violation')).toBe(true)
    }
  })
})

describe('AutoCueEditorValidator — media whitelist (forward-looking defense)', () => {
  // The current CuePatchV1Schema is strict and does not yet expose an
  // asset_id surface — media attaches today flow through admin routes,
  // not through the patch envelope. The whitelist scan is forward-
  // looking defense: when M3 widens the patch shape, an unauthorized
  // asset_id will trip immediately. Probe that by feeding the validator
  // a CuePatchV1-shaped object with an asset_id buried in a nested
  // sub-object; the validator's scan should still catch it (alongside
  // off_schema, since the surface is .strict()).
  it('catches asset_id leaks even when the surrounding shape is off-schema', () => {
    const validator = new AutoCueEditorValidator()
    const synthetic = {
      action: 'attach_media',
      reason: 'attach a context anchor',
      risk_level: 'standard',
      target_cue_id: 'cue-1',
      patch_json: {
        version: 1,
        partial: {
          media_policy: {
            // Forward-looking: an extra key the strict schema rejects,
            // but the validator's nested asset_id scan still picks it up
            // before reporting validation failure to the caller.
            media_resource_pool: [{ asset_id: 'asset-NOT-AUTHORIZED' }],
          },
        },
      },
      confidence: 0.6,
      requires_review: true,
    }
    const result = validator.validate(synthetic, baseContext)
    expect(result.ok).toBe(false)
    // Either off_schema or unauthorized_media_asset is a correct
    // rejection — the test asserts at least one fired so an unauthorized
    // id can never silently land.
    if (!result.ok) {
      const codes = result.failures.map((f) => f.code)
      expect(
        codes.some((c) => c === 'off_schema' || c === 'unauthorized_media_asset'),
      ).toBe(true)
    }
  })

  it('does not flag an empty patch as a media-whitelist violation', () => {
    const validator = new AutoCueEditorValidator()
    const result = validator.validate(buildOutput(), baseContext)
    if (!result.ok) {
      expect(
        result.failures.find((f) => f.code === 'unauthorized_media_asset'),
      ).toBeUndefined()
    } else {
      expect(result.ok).toBe(true)
    }
  })
})

describe('AutoCueEditorValidator — action surface check', () => {
  it('rejects an action absent from the load gate allowed_actions', () => {
    const validator = new AutoCueEditorValidator()
    const result = validator.validate(
      buildOutput({ action: 'create_cue' }),
      { ...baseContext, allowedActions: ['cancel_cue', 'defer_cue'] }, // red-state envelope
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      const violation = result.failures.find((f) => f.code === 'action_not_allowed')
      expect(violation).toBeDefined()
      expect(violation?.offending).toEqual(['create_cue'])
    }
  })
})

describe('AutoCueEditorValidator — invariant I-6', () => {
  it('probe: output never references PostScheduler-specific autonomous fields', () => {
    // I-6 says auto-editor must not patch PostScheduler tick state. Since
    // PostScheduler state is not part of the cue editable surface (cue
    // only exposes trigger / dispatch / theme / scene / role / media /
    // safety / locked / risk), CuePatchV1Schema's strict shape is the
    // structural guarantee. Probe by attempting to inject an autonomous
    // tick field — schema rejects it.
    const validator = new AutoCueEditorValidator()
    const result = validator.validate(
      buildOutput({
        patch_json: {
          version: 1,
          partial: {
            // PostScheduler-domain key — not a valid cue partial key
            autonomous_tick_interval_ms: 1000,
          },
        },
      }),
      baseContext,
    )
    expect(result.ok).toBe(false)
  })
})
