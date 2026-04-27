import { describe, expect, it } from 'vitest'
import {
  chooseFinalRisk,
  classifyRisk,
  readLaneFromCue,
} from '../risk-classifier.js'
import type { PublicDiscussionCueDomain } from '../../cue/types.js'

describe('classifyRisk — action baselines', () => {
  it('low: defer / attach_media / remove_media', () => {
    expect(classifyRisk({
      action: 'defer_cue',
      targetLane: 'standard',
      inPrimeWindow: false,
      proposeOnly: false,
    }).band).toBe('low')
    expect(classifyRisk({
      action: 'attach_media',
      targetLane: 'standard',
      inPrimeWindow: false,
      proposeOnly: false,
    }).band).toBe('low')
    expect(classifyRisk({
      action: 'remove_media',
      targetLane: 'standard',
      inPrimeWindow: false,
      proposeOnly: false,
    }).band).toBe('low')
  })

  it('standard: create / update / cancel / merge / split', () => {
    for (const action of ['create_cue', 'update_cue', 'cancel_cue', 'merge_into_existing_cue', 'split_cue'] as const) {
      const result = classifyRisk({
        action,
        targetLane: 'standard',
        inPrimeWindow: false,
        proposeOnly: false,
      })
      expect(result.band).toBe('standard')
    }
  })

  it('high: dispatch_policy / risk_level / publish / rollback baseline', () => {
    for (const action of ['update_dispatch_policy', 'update_risk_level', 'publish_schedule', 'rollback_schedule'] as const) {
      const result = classifyRisk({
        action,
        targetLane: 'standard',
        inPrimeWindow: false,
        proposeOnly: false,
      })
      expect(result.band).toBe('high')
    }
  })
})

describe('classifyRisk — structural bumps', () => {
  it('prime-lane cancel → high', () => {
    const result = classifyRisk({
      action: 'cancel_cue',
      targetLane: 'prime',
      inPrimeWindow: false,
      proposeOnly: false,
    })
    expect(result.band).toBe('high')
    expect(result.reason_codes).toContain('prime_lane_cancel')
  })

  it('prime-lane update → high', () => {
    const result = classifyRisk({
      action: 'update_cue',
      targetLane: 'prime',
      inPrimeWindow: false,
      proposeOnly: false,
    })
    expect(result.band).toBe('high')
    expect(result.reason_codes).toContain('prime_lane_update')
  })

  it('prime-window structural change → high (even on standard lane)', () => {
    const result = classifyRisk({
      action: 'create_cue',
      targetLane: 'standard',
      inPrimeWindow: true,
      proposeOnly: false,
    })
    expect(result.band).toBe('high')
    expect(result.reason_codes).toContain('prime_window_structural_change')
  })

  it('public-display media → high', () => {
    const result = classifyRisk({
      action: 'attach_media',
      targetLane: 'standard',
      inPrimeWindow: false,
      proposeOnly: false,
      publicDisplayMediaInvolved: true,
    })
    expect(result.band).toBe('high')
    expect(result.reason_codes).toContain('public_display_media')
  })

  it('LoadGate propose_only forces high under stress', () => {
    const result = classifyRisk({
      action: 'defer_cue',
      targetLane: 'background',
      inPrimeWindow: false,
      proposeOnly: true,
    })
    expect(result.band).toBe('high')
    expect(result.reason_codes).toContain('load_gate_propose_only')
  })
})

describe('chooseFinalRisk — never downgrades', () => {
  it('LLM standard + classifier high → high', () => {
    const result = chooseFinalRisk({
      classifier: { band: 'high', reason_codes: ['prime_lane_cancel'] },
      llmReported: 'standard',
    })
    expect(result.band).toBe('high')
    expect(result.reason_codes).toContain('prime_lane_cancel')
    expect(result.reason_codes).not.toContain('llm_self_escalated')
  })

  it('LLM high + classifier standard → high (escalation tag added)', () => {
    const result = chooseFinalRisk({
      classifier: { band: 'standard', reason_codes: ['create_cue_baseline'] },
      llmReported: 'high',
    })
    expect(result.band).toBe('high')
    expect(result.reason_codes).toContain('llm_self_escalated')
  })

  it('LLM low + classifier low → low', () => {
    const result = chooseFinalRisk({
      classifier: { band: 'low', reason_codes: ['defer_cue_baseline'] },
      llmReported: 'low',
    })
    expect(result.band).toBe('low')
  })
})

describe('readLaneFromCue', () => {
  it('reads cue.lane', () => {
    const cue = { lane: 'prime' } as PublicDiscussionCueDomain
    expect(readLaneFromCue(cue)).toBe('prime')
  })

  it('defaults to standard when cue is null/undefined', () => {
    expect(readLaneFromCue(null)).toBe('standard')
    expect(readLaneFromCue(undefined)).toBe('standard')
  })
})
