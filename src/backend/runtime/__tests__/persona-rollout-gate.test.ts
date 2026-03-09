import { describe, expect, it } from 'vitest'
import type { PersonaGateSnapshotV1 } from '../persona-observation.js'
import {
  buildPersonaBlindReviewTemplate,
  buildPersonaRolloutPreReview,
  createPersonaBlindReviewResult,
  finalizePersonaRolloutGate,
} from '../persona-rollout-gate.js'
import type { PersonaEvalCorpusManifestV1 } from '../persona-rollout-gate.js'

function baseOfflineGate(overrides: Partial<PersonaGateSnapshotV1> = {}): PersonaGateSnapshotV1 {
  return {
    version: 'persona-gate-snapshot-v1',
    generated_at: new Date().toISOString(),
    overall_status: 'warn',
    gating_basis: 'persona-eval-v1',
    results: [
      {
        gate_id: 'render-log-completeness',
        kind: 'blocking',
        threshold: 'migrated visible=100%',
        status: 'pass',
        actual: 'migrated_visible=4/4',
      },
      {
        gate_id: 'visible-render-cost',
        kind: 'guardrail',
        threshold: '<=baseline +25%',
        status: 'not_run',
        actual: 'avg=1200 tokens',
        note: 'Baseline cost window is not provided in offline replay.',
      },
    ],
    ...overrides,
  }
}

function baseManifest(): PersonaEvalCorpusManifestV1 {
  return {
    version: 'persona-eval-corpus-v1' as const,
    run_id: 'persona-eval-test',
    generated_at: new Date().toISOString(),
    scanned_runs_total: 12,
    observed_runs_total: 8,
    slices: [
      {
        slice_id: 'cross_scene_same_agent' as const,
        label: 'Cross scene',
        description: '',
        samples: [
          {
            sample_id: 'cross_scene_same_agent-01',
            review_target: 'same agent',
            run_ids: ['r1', 'r2'],
            entries: [],
          },
        ],
      },
      {
        slice_id: 'private_to_public_delta' as const,
        label: 'Private to public',
        description: '',
        samples: [
          {
            sample_id: 'private_to_public_delta-01',
            review_target: 'private delta',
            run_ids: ['r3', 'r4'],
            entries: [],
          },
        ],
      },
      {
        slice_id: 'fallback_or_degraded' as const,
        label: 'Fallback',
        description: '',
        samples: [
          {
            sample_id: 'fallback_or_degraded-01',
            review_target: 'fallback',
            run_ids: ['r5'],
            entries: [],
          },
        ],
      },
      {
        slice_id: 'same_seed_cross_line' as const,
        label: 'Same seed',
        description: '',
        samples: [],
      },
    ],
  }
}

function comparableBaselineAttribution() {
  return {
    visible_runs_total: 10,
    by_callsite: {
      'post-scheduler-create-post': 4,
      'private-channel-reply': 2,
      'conversation-clock-chat-reply': 4,
    },
    by_provider: {
      'dashscope-openai': 10,
    },
    by_model: {
      'qwen-plus-character': 10,
    },
  }
}

function comparableCurrentAttribution() {
  return {
    visible_runs_total: 10,
    by_callsite: {
      'post-scheduler-create-post': 5,
      'private-channel-reply': 3,
      'conversation-clock-chat-reply': 1,
      'proactive-orchestrated-opening': 1,
    },
    by_provider: {
      'dashscope-openai': 10,
    },
    by_model: {
      'qwen-plus-character': 10,
    },
  }
}

function runtimeIdentityDelta(overrides: Partial<{
  before_success_total: number
  before_failure_total: number
  after_success_total: number
  after_failure_total: number
}> = {}) {
  return {
    before_success_total: 0,
    before_failure_total: 0,
    after_success_total: 2,
    after_failure_total: 0,
    ...overrides,
  }
}

describe('persona rollout gate', () => {
  it('builds pre-review warning snapshot when only cost baseline is incomparable', () => {
    const preReview = buildPersonaRolloutPreReview({
      offlineGate: baseOfflineGate(),
      baselineAttribution: {
        by_callsite: {
          'post-scheduler-create-post': 1,
          'private-channel-reply': 2,
        },
      },
      currentAttribution: {
        by_callsite: {
          'post-scheduler-create-post': 2,
          'private-channel-reply': 4,
        },
      },
      manifest: baseManifest(),
    })

    expect(preReview.overall_status).toBe('warn')
    expect(preReview.recommendation).toBe('hold')
    expect(preReview.issues.some((issue) => issue.code === 'cost-baseline-incomparable')).toBe(true)
    expect(preReview.issues.some((issue) => issue.severity === 'blocking')).toBe(false)
  })

  it('uses runtime identity delta to resolve identity-write guardrail', () => {
    const preReview = buildPersonaRolloutPreReview({
      offlineGate: baseOfflineGate({
        results: [
          {
            gate_id: 'render-log-completeness',
            kind: 'blocking',
            threshold: 'migrated visible=100%',
            status: 'pass',
            actual: 'migrated_visible=4/4',
          },
          {
            gate_id: 'identity-write-success',
            kind: 'guardrail',
            threshold: '>=95%',
            status: 'not_run',
            actual: null,
          },
          {
            gate_id: 'visible-render-cost',
            kind: 'guardrail',
            threshold: '<=baseline +25%',
            status: 'not_run',
            actual: 'avg=110.0 tokens',
            note: 'Baseline cost window is not provided in offline replay.',
          },
        ],
      }),
      baselineAttribution: comparableBaselineAttribution(),
      currentAttribution: comparableCurrentAttribution(),
      runtimeIdentityDelta: runtimeIdentityDelta(),
      baselineGate: baseOfflineGate({
        results: [
          {
            gate_id: 'render-log-completeness',
            kind: 'blocking',
            threshold: 'migrated visible=100%',
            status: 'pass',
            actual: 'migrated_visible=4/4',
          },
          {
            gate_id: 'visible-render-cost',
            kind: 'guardrail',
            threshold: '<=baseline +25%',
            status: 'not_run',
            actual: 'avg=100.0 tokens',
          },
        ],
      }),
      currentGate: baseOfflineGate({
        results: [
          {
            gate_id: 'render-log-completeness',
            kind: 'blocking',
            threshold: 'migrated visible=100%',
            status: 'pass',
            actual: 'migrated_visible=4/4',
          },
          {
            gate_id: 'visible-render-cost',
            kind: 'guardrail',
            threshold: '<=baseline +25%',
            status: 'not_run',
            actual: 'avg=110.0 tokens',
          },
        ],
      }),
      manifest: baseManifest(),
    })

    expect(preReview.overall_status).toBe('pass')
    expect(preReview.issues.some((issue) => issue.code === 'identity-write-success-guardrail-not-run')).toBe(false)
    expect(preReview.supplemental_guardrails.find((item) => item.gate_id === 'identity-write-success')?.status).toBe('pass')
  })

  it('marks identity-write guardrail failed when runtime delta is below threshold', () => {
    const preReview = buildPersonaRolloutPreReview({
      offlineGate: baseOfflineGate({
        results: [
          {
            gate_id: 'render-log-completeness',
            kind: 'blocking',
            threshold: 'migrated visible=100%',
            status: 'pass',
            actual: 'migrated_visible=4/4',
          },
          {
            gate_id: 'identity-write-success',
            kind: 'guardrail',
            threshold: '>=95%',
            status: 'not_run',
            actual: null,
          },
        ],
      }),
      baselineAttribution: {
        by_callsite: {
          'post-scheduler-create-post': 1,
          'private-channel-reply': 1,
        },
      },
      currentAttribution: {
        by_callsite: {
          'post-scheduler-create-post': 2,
          'private-channel-reply': 2,
        },
      },
      runtimeIdentityDelta: runtimeIdentityDelta({
        after_success_total: 1,
        after_failure_total: 1,
      }),
      manifest: baseManifest(),
    })

    expect(preReview.overall_status).toBe('warn')
    expect(preReview.issues.some((issue) => issue.code === 'identity-write-success-guardrail-failed')).toBe(true)
    expect(preReview.supplemental_guardrails.find((item) => item.gate_id === 'identity-write-success')?.status).toBe('fail')
  })

  it('passes visible render cost when baseline and current windows are comparable', () => {
    const preReview = buildPersonaRolloutPreReview({
      offlineGate: baseOfflineGate(),
      baselineAttribution: comparableBaselineAttribution(),
      currentAttribution: comparableCurrentAttribution(),
      baselineGate: baseOfflineGate({
        results: [
          {
            gate_id: 'render-log-completeness',
            kind: 'blocking',
            threshold: 'migrated visible=100%',
            status: 'pass',
            actual: 'migrated_visible=4/4',
          },
          {
            gate_id: 'visible-render-cost',
            kind: 'guardrail',
            threshold: '<=baseline +25%',
            status: 'not_run',
            actual: 'avg=100.0 tokens',
          },
        ],
      }),
      currentGate: baseOfflineGate({
        results: [
          {
            gate_id: 'render-log-completeness',
            kind: 'blocking',
            threshold: 'migrated visible=100%',
            status: 'pass',
            actual: 'migrated_visible=4/4',
          },
          {
            gate_id: 'visible-render-cost',
            kind: 'guardrail',
            threshold: '<=baseline +25%',
            status: 'not_run',
            actual: 'avg=120.0 tokens',
          },
        ],
      }),
      manifest: baseManifest(),
    })

    expect(preReview.overall_status).toBe('pass')
    expect(preReview.issues.some((issue) => issue.code === 'cost-baseline-incomparable')).toBe(false)
    expect(preReview.supplemental_guardrails.find((item) => item.gate_id === 'visible-render-cost')?.status).toBe('pass')
  })

  it('fails visible render cost when a comparable window exceeds the threshold', () => {
    const preReview = buildPersonaRolloutPreReview({
      offlineGate: baseOfflineGate(),
      baselineAttribution: comparableBaselineAttribution(),
      currentAttribution: comparableCurrentAttribution(),
      baselineGate: baseOfflineGate({
        results: [
          {
            gate_id: 'render-log-completeness',
            kind: 'blocking',
            threshold: 'migrated visible=100%',
            status: 'pass',
            actual: 'migrated_visible=4/4',
          },
          {
            gate_id: 'visible-render-cost',
            kind: 'guardrail',
            threshold: '<=baseline +25%',
            status: 'not_run',
            actual: 'avg=100.0 tokens',
          },
        ],
      }),
      currentGate: baseOfflineGate({
        results: [
          {
            gate_id: 'render-log-completeness',
            kind: 'blocking',
            threshold: 'migrated visible=100%',
            status: 'pass',
            actual: 'migrated_visible=4/4',
          },
          {
            gate_id: 'visible-render-cost',
            kind: 'guardrail',
            threshold: '<=baseline +25%',
            status: 'not_run',
            actual: 'avg=130.0 tokens',
          },
        ],
      }),
      manifest: baseManifest(),
    })

    expect(preReview.overall_status).toBe('warn')
    expect(preReview.issues.some((issue) => issue.code === 'visible-render-cost-guardrail-failed')).toBe(true)
    expect(preReview.supplemental_guardrails.find((item) => item.gate_id === 'visible-render-cost')?.status).toBe('fail')
  })

  it('keeps visible render cost incomparable when the model mix changes', () => {
    const preReview = buildPersonaRolloutPreReview({
      offlineGate: baseOfflineGate(),
      baselineAttribution: comparableBaselineAttribution(),
      currentAttribution: {
        ...comparableCurrentAttribution(),
        by_model: {
          'qwen-flash-character': 10,
        },
      },
      baselineGate: baseOfflineGate({
        results: [
          {
            gate_id: 'render-log-completeness',
            kind: 'blocking',
            threshold: 'migrated visible=100%',
            status: 'pass',
            actual: 'migrated_visible=4/4',
          },
          {
            gate_id: 'visible-render-cost',
            kind: 'guardrail',
            threshold: '<=baseline +25%',
            status: 'not_run',
            actual: 'avg=100.0 tokens',
          },
        ],
      }),
      currentGate: baseOfflineGate({
        results: [
          {
            gate_id: 'render-log-completeness',
            kind: 'blocking',
            threshold: 'migrated visible=100%',
            status: 'pass',
            actual: 'migrated_visible=4/4',
          },
          {
            gate_id: 'visible-render-cost',
            kind: 'guardrail',
            threshold: '<=baseline +25%',
            status: 'not_run',
            actual: 'avg=110.0 tokens',
          },
        ],
      }),
      manifest: baseManifest(),
    })

    expect(preReview.overall_status).toBe('warn')
    expect(preReview.issues.some((issue) => issue.code === 'cost-baseline-incomparable')).toBe(true)
    expect(preReview.supplemental_guardrails.find((item) => item.gate_id === 'visible-render-cost')?.status).toBe('not_run')
  })

  it('accepts shadow-window callsite evidence when corpus totals stay flat', () => {
    const preReview = buildPersonaRolloutPreReview({
      offlineGate: baseOfflineGate({
        results: [
          {
            gate_id: 'render-log-completeness',
            kind: 'blocking',
            threshold: 'migrated visible=100%',
            status: 'pass',
            actual: 'migrated_visible=4/4',
          },
        ],
      }),
      baselineAttribution: {
        by_callsite: {
          'post-scheduler-create-post': 3,
          'private-channel-reply': 2,
        },
      },
      currentAttribution: {
        by_callsite: {
          'post-scheduler-create-post': 3,
          'private-channel-reply': 2,
        },
      },
      manifest: baseManifest(),
      shadowActivity: {
        windowStartedAt: '2026-03-09T10:00:00.000Z',
        targetAgentId: 'agent-1',
        targetAgentRunCount: 3,
        targetAgentObservedRunCount: 3,
        windowCallsiteCounts: {
          'post-scheduler-create-post': 1,
          'private-channel-reply': 2,
        },
      },
    })

    expect(preReview.overall_status).toBe('pass')
    expect(preReview.issues.some((issue) => issue.code === 'callsite-private-channel-reply-not-advanced')).toBe(false)
    expect(preReview.callsite_deltas.find((item) => item.source_callsite_id === 'private-channel-reply')).toMatchObject({
      status: 'pass',
      shadow_window_total: 2,
    })
    expect(preReview.shadow_activity.target_agent_window_callsite_counts['private-channel-reply']).toBe(2)
  })

  it('returns go when required slices are complete and pass review', () => {
    const manifest = baseManifest()
    const preReview = buildPersonaRolloutPreReview({
      offlineGate: baseOfflineGate({
        results: [
          {
            gate_id: 'render-log-completeness',
            kind: 'blocking',
            threshold: 'migrated visible=100%',
            status: 'pass',
            actual: 'migrated_visible=4/4',
          },
        ],
      }),
      baselineAttribution: {
        by_callsite: {
          'post-scheduler-create-post': 3,
          'private-channel-reply': 2,
        },
      },
      currentAttribution: {
        by_callsite: {
          'post-scheduler-create-post': 5,
          'private-channel-reply': 4,
        },
      },
      manifest,
    })

    const template = buildPersonaBlindReviewTemplate(manifest)
    const review = createPersonaBlindReviewResult(template)
    for (const sample of review.samples) {
      sample.scores.persona_consistency = 4
      sample.scores.group_distinctiveness = 4
      sample.scores.overlay_naturalness = 4
      sample.scores.nurture_perceptibility = 4
    }

    const finalSnapshot = finalizePersonaRolloutGate({
      preReview,
      review,
      manifest,
    })

    expect(finalSnapshot.overall_status).toBe('pass')
    expect(finalSnapshot.recommendation).toBe('go')
  })

  it('returns go_with_caveats when fallback slice has no eligible samples', () => {
    const manifest = baseManifest()
    manifest.slices[2] = {
      ...manifest.slices[2]!,
      samples: [],
    }

    const preReview = buildPersonaRolloutPreReview({
      offlineGate: baseOfflineGate({
        results: [
          {
            gate_id: 'render-log-completeness',
            kind: 'blocking',
            threshold: 'migrated visible=100%',
            status: 'pass',
            actual: 'migrated_visible=4/4',
          },
        ],
      }),
      baselineAttribution: {
        by_callsite: {
          'post-scheduler-create-post': 3,
          'private-channel-reply': 2,
        },
      },
      currentAttribution: {
        by_callsite: {
          'post-scheduler-create-post': 5,
          'private-channel-reply': 4,
        },
      },
      manifest,
    })

    const template = buildPersonaBlindReviewTemplate(manifest)
    const review = createPersonaBlindReviewResult(template)
    for (const sample of review.samples) {
      sample.scores.persona_consistency = 4
      sample.scores.group_distinctiveness = 4
      sample.scores.overlay_naturalness = 4
      sample.scores.nurture_perceptibility = 4
    }

    const finalSnapshot = finalizePersonaRolloutGate({
      preReview,
      review,
      manifest,
    })

    expect(finalSnapshot.overall_status).toBe('warn')
    expect(finalSnapshot.recommendation).toBe('go_with_caveats')
    expect(finalSnapshot.issues.some((issue) => issue.code === 'slice-fallback_or_degraded-missing')).toBe(true)
  })

  it('returns hold when required review is incomplete', () => {
    const manifest = baseManifest()
    const preReview = buildPersonaRolloutPreReview({
      offlineGate: baseOfflineGate(),
      baselineAttribution: {
        by_callsite: {
          'post-scheduler-create-post': 0,
          'private-channel-reply': 0,
        },
      },
      currentAttribution: {
        by_callsite: {
          'post-scheduler-create-post': 1,
          'private-channel-reply': 1,
        },
      },
      manifest,
    })

    const template = buildPersonaBlindReviewTemplate(manifest)
    const review = createPersonaBlindReviewResult(template)
    review.samples[0]!.scores.persona_consistency = 4

    const finalSnapshot = finalizePersonaRolloutGate({
      preReview,
      review,
      manifest,
    })

    expect(finalSnapshot.overall_status).toBe('warn')
    expect(finalSnapshot.recommendation).toBe('hold')
  })

  it('returns rollback when a required slice average drops below threshold', () => {
    const manifest = baseManifest()
    const preReview = buildPersonaRolloutPreReview({
      offlineGate: baseOfflineGate({
        results: [
          {
            gate_id: 'render-log-completeness',
            kind: 'blocking',
            threshold: 'migrated visible=100%',
            status: 'pass',
            actual: 'migrated_visible=4/4',
          },
        ],
      }),
      baselineAttribution: {
        by_callsite: {
          'post-scheduler-create-post': 2,
          'private-channel-reply': 1,
        },
      },
      currentAttribution: {
        by_callsite: {
          'post-scheduler-create-post': 4,
          'private-channel-reply': 3,
        },
      },
      manifest,
    })

    const template = buildPersonaBlindReviewTemplate(manifest)
    const review = createPersonaBlindReviewResult(template)
    for (const sample of review.samples) {
      sample.scores.persona_consistency = sample.slice_id === 'cross_scene_same_agent' ? 2 : 4
      sample.scores.group_distinctiveness = 4
      sample.scores.overlay_naturalness = 4
      sample.scores.nurture_perceptibility = 4
    }

    const finalSnapshot = finalizePersonaRolloutGate({
      preReview,
      review,
      manifest,
    })

    expect(finalSnapshot.overall_status).toBe('fail')
    expect(finalSnapshot.recommendation).toBe('rollback')
  })

  it('fails pre-review when shadow window produced runs without persona observation', () => {
    const preReview = buildPersonaRolloutPreReview({
      offlineGate: baseOfflineGate({
        results: [
          {
            gate_id: 'render-log-completeness',
            kind: 'blocking',
            threshold: 'migrated visible=100%',
            status: 'pass',
            actual: 'migrated_visible=4/4',
          },
        ],
      }),
      baselineAttribution: {
        by_callsite: {
          'post-scheduler-create-post': 1,
          'private-channel-reply': 1,
        },
      },
      currentAttribution: {
        observed_runs_total: 12,
        by_callsite: {
          'post-scheduler-create-post': 2,
          'private-channel-reply': 2,
        },
      },
      manifest: baseManifest(),
      shadowActivity: {
        windowStartedAt: '2026-03-09T00:00:00.000Z',
        targetAgentId: 'agent-1',
        targetAgentRunCount: 2,
        targetAgentObservedRunCount: 0,
      },
    })

    expect(preReview.overall_status).toBe('fail')
    expect(preReview.shadow_activity.target_agent_run_count).toBe(2)
    expect(preReview.shadow_activity.target_agent_observed_run_count).toBe(0)
    expect(preReview.shadow_activity.target_agent_window_callsite_counts).toEqual({})
    expect(preReview.issues.some((issue) => issue.code === 'shadow-runs-missing-persona-observation')).toBe(true)
  })

  it('rejects duplicate sample ids in blind review results', () => {
    const manifest = baseManifest()
    manifest.slices[0] = {
      ...manifest.slices[0]!,
      samples: [
        ...manifest.slices[0]!.samples,
        {
          sample_id: 'cross_scene_same_agent-02',
          review_target: 'same agent second sample',
          run_ids: ['r6', 'r7'],
          entries: [],
        },
      ],
    }

    const preReview = buildPersonaRolloutPreReview({
      offlineGate: baseOfflineGate({
        results: [
          {
            gate_id: 'render-log-completeness',
            kind: 'blocking',
            threshold: 'migrated visible=100%',
            status: 'pass',
            actual: 'migrated_visible=4/4',
          },
        ],
      }),
      baselineAttribution: {
        by_callsite: {
          'post-scheduler-create-post': 3,
          'private-channel-reply': 2,
        },
      },
      currentAttribution: {
        by_callsite: {
          'post-scheduler-create-post': 4,
          'private-channel-reply': 3,
        },
      },
      manifest,
    })

    const template = buildPersonaBlindReviewTemplate(manifest)
    const review = createPersonaBlindReviewResult(template)
    const duplicate = {
      ...review.samples[0]!,
      scores: {
        persona_consistency: 4,
        group_distinctiveness: 4,
        overlay_naturalness: 4,
        nurture_perceptibility: 4,
      },
    }

    review.samples = [
      duplicate,
      duplicate,
      ...review.samples.slice(2).map((sample) => ({
        ...sample,
        scores: {
          persona_consistency: 4,
          group_distinctiveness: 4,
          overlay_naturalness: 4,
          nurture_perceptibility: 4,
        },
      })),
    ]

    expect(() =>
      finalizePersonaRolloutGate({
        preReview,
        review,
        manifest,
      }),
    ).toThrow(/Duplicate review sample_id/)
  })

  it('keeps slice incomplete when a manifest sample has no review row', () => {
    const manifest = baseManifest()
    manifest.slices[0] = {
      ...manifest.slices[0]!,
      samples: [
        ...manifest.slices[0]!.samples,
        {
          sample_id: 'cross_scene_same_agent-02',
          review_target: 'same agent second sample',
          run_ids: ['r6', 'r7'],
          entries: [],
        },
      ],
    }

    const preReview = buildPersonaRolloutPreReview({
      offlineGate: baseOfflineGate(),
      baselineAttribution: {
        by_callsite: {
          'post-scheduler-create-post': 0,
          'private-channel-reply': 0,
        },
      },
      currentAttribution: {
        by_callsite: {
          'post-scheduler-create-post': 1,
          'private-channel-reply': 1,
        },
      },
      manifest,
    })

    const template = buildPersonaBlindReviewTemplate(manifest)
    const review = createPersonaBlindReviewResult(template)
      .samples
      .filter((sample) => sample.sample_id !== 'cross_scene_same_agent-02')

    const finalSnapshot = finalizePersonaRolloutGate({
      preReview,
      review: {
        version: 'persona-blind-review-result-v1',
        generated_at: new Date().toISOString(),
        mode: 'collaborative',
        manifest_run_id: manifest.run_id,
        samples: review.map((sample) => ({
          ...sample,
          scores: {
            persona_consistency: 4,
            group_distinctiveness: 4,
            overlay_naturalness: 4,
            nurture_perceptibility: 4,
          },
        })),
      },
      manifest,
    })

    const crossScene = finalSnapshot.slice_summaries.find((item) => item.slice_id === 'cross_scene_same_agent')
    expect(crossScene?.available_samples).toBe(2)
    expect(crossScene?.reviewed_samples).toBe(1)
    expect(crossScene?.completed).toBe(false)
    expect(finalSnapshot.overall_status).toBe('warn')
  })
})
