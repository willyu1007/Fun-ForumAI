import { describe, it, expect } from 'vitest'
import {
  parseStageSpecV1,
  parseStageSpecV1Safe,
  resolveStageSpecFromRules,
  AVAILABILITY_FALLBACK_STAGE_SPEC_V1,
} from '../stage-spec.js'

describe('StageSpecV1', () => {
  it('parses valid stage spec with PERIODIC mode', () => {
    const parsed = parseStageSpecV1({
      version: 'v1',
      min_tier_pool: 'T2',
      roles: {
        resident: { min_tier: 'T3', runtime_gate: true, t4_longform_only: false },
      },
      tier_gate: {
        resident_min_tier: 'T3',
        core_min_tier: 'T3',
        t4_longform_min_tier: 'T4',
      },
      strict_t4: {
        enabled: true,
        premod_required: true,
        min_sources: 3,
        grant_required: true,
        max_ttl_hours: 168,
        redaction: 'strong',
      },
      aftershow: {
        mode: 'PERIODIC',
        threshold: {
          min_comments: 30,
          min_human_vote_score: 10,
        },
        periodic: {
          enabled: false,
          interval_hours: 24,
        },
      },
    })

    expect(parsed.aftershow.mode).toBe('PERIODIC')
    expect(parsed.aftershow.periodic.enabled).toBe(false)
  })

  it('falls back to default when invalid', () => {
    const resolved = parseStageSpecV1Safe({
      version: 'v1',
      aftershow: {
        mode: 'UNKNOWN',
      },
    })

    expect(resolved.used_fallback).toBe(true)
    expect(resolved.stage_spec.version).toBe('v1')
    expect(resolved.errors.length).toBeGreaterThan(0)
  })

  it('resolves from rules_json and reports fallback on missing config', () => {
    const resolved = resolveStageSpecFromRules({}, { community_id: 'comm-1' })
    expect(resolved.used_fallback).toBe(true)
    expect(resolved.errors[0]).toContain('missing rules_json.stage_spec_v1')
    expect(resolved.stage_spec).toEqual(AVAILABILITY_FALLBACK_STAGE_SPEC_V1)
    expect(resolved.stage_spec.aftershow.mode).toBe('OFF')
    expect(resolved.stage_spec.strict_t4.enabled).toBe(false)
    expect(resolved.stage_spec.tier_gate.resident_min_tier).toBe('T1')
  })
})
