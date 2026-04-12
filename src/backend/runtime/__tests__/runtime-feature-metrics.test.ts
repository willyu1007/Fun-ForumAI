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

  it('records branch-entropy and duel-risk forum orchestration metrics', () => {
    const metrics = new RuntimeFeatureMetrics()

    metrics.recordForumOrchestrationSelection({
      late_entry_ratio: 0.25,
      dominant_thread_share: 0.7,
      branch_entropy: 0.6,
      duel_risk: 0.8,
      newcomer_share: 0.1,
      recall_diversity: 0.5,
      same_pair_exchange_rate: 0.2,
      selection_cutover: true,
    })

    expect(metrics.snapshot().forum_orchestration).toMatchObject({
      selection_cutover_runs: 1,
      branch_entropy: 0.6,
      duel_risk: 0.8,
    })
  })

  it('records structured fallback and no-write telemetry for forum orchestration', () => {
    const metrics = new RuntimeFeatureMetrics()

    metrics.recordForumSelectionPath('selection_cutover_granted')
    metrics.recordForumBaselineFallback({
      stage: 'allocator',
      selection_path: 'selection_fallback_baseline',
      fallback_reason: 'allocator_selection_fallback',
      event_type: 'ThreadTurnAdded',
      post_id: 'post-1',
      thread_id: 'thread-1',
      agent_id: 'agent-1',
      opportunity_id: 'opp-1',
    })
    metrics.recordForumRoamingNoWrite({
      reason: 'observe_only',
      event_type: 'ThreadTurnAdded',
      post_id: 'post-1',
      thread_id: 'thread-1',
      agent_id: 'agent-1',
      opportunity_id: 'opp-1',
    })

    expect(metrics.snapshot().forum_orchestration).toMatchObject({
      fallback_count: 1,
      fallback_counters: {
        allocator_selection_fallback: 1,
      },
      no_write_counters: {
        observe_only: 1,
      },
      selection_path_counts: {
        selection_cutover_granted: 1,
        selection_fallback_baseline: 1,
      },
      recent_fallback_samples: [
        expect.objectContaining({
          stage: 'allocator',
          selection_path: 'selection_fallback_baseline',
          fallback_reason: 'allocator_selection_fallback',
          post_id: 'post-1',
          thread_id: 'thread-1',
          agent_id: 'agent-1',
          opportunity_id: 'opp-1',
        }),
      ],
      recent_no_write_samples: [
        expect.objectContaining({
          reason: 'observe_only',
          post_id: 'post-1',
          thread_id: 'thread-1',
          agent_id: 'agent-1',
          opportunity_id: 'opp-1',
        }),
      ],
    })
  })
})
