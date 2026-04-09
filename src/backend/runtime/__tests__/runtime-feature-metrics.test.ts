import { describe, expect, it } from 'vitest'
import { RuntimeFeatureMetrics } from '../runtime-feature-metrics.js'

describe('RuntimeFeatureMetrics', () => {
  it('tracks selected-vs-actual and resolved-vs-written anchor mismatch ratios', () => {
    const metrics = new RuntimeFeatureMetrics()

    metrics.recordForumAnchorResolution({
      selected_anchor_turn_id: 'turn-2',
      actual_anchor_turn_id: 'turn-1',
      final_write_anchor_turn_id: 'turn-1',
      written_anchor_turn_id: 'turn-2',
    })
    metrics.recordForumAnchorResolution({
      selected_anchor_turn_id: 'turn-3',
      actual_anchor_turn_id: 'turn-3',
      final_write_anchor_turn_id: 'turn-3',
      written_anchor_turn_id: 'turn-3',
    })

    expect(metrics.snapshot().forum_orchestration).toMatchObject({
      selected_vs_actual_anchor_mismatch: 0.5,
      resolved_vs_written_anchor_mismatch: 0.5,
    })
  })
})
