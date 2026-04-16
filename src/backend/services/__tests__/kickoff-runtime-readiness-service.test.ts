import { describe, expect, it, vi } from 'vitest'
import { KickoffRuntimeReadinessService } from '../kickoff-runtime-readiness-service.js'
import type {
  RuntimeBaselineAdmission,
  WarmupBatchReadModel,
  WarmupSuiteDetail,
} from '../warmup-governance-service.js'

function createBatch(
  kind: 'kickoff' | 'warmup',
  overrides: Partial<WarmupBatchReadModel['stats']> = {},
): WarmupBatchReadModel {
  const posts = overrides.posts ?? (kind === 'kickoff' ? 27 : 18)
  return {
    id: `${kind}-batch-1`,
    batch_kind: kind,
    state: 'review_ready',
    source_batch_id: null,
    revision_key: null,
    package_hash: null,
    notes: null,
    activated_at: null,
    archived_at: null,
    created_at: '2026-04-15T22:56:36.356Z',
    updated_at: '2026-04-15T22:56:43.137Z',
    stats: {
      posts,
      threads: overrides.threads ?? posts,
      turns: overrides.turns ?? posts * 3,
      votes: overrides.votes ?? posts * 6,
      media: overrides.media ?? (kind === 'kickoff' ? 12 : 6),
      communities: overrides.communities ?? (kind === 'kickoff' ? 12 : 6),
      media_covered_posts: overrides.media_covered_posts ?? (kind === 'kickoff' ? 12 : 6),
      media_coverage_ratio: overrides.media_coverage_ratio ?? (kind === 'kickoff' ? 0.44 : 0.4),
    },
    coverage: [],
    samples: [],
  }
}

function createSuiteDetail(overrides: Partial<WarmupSuiteDetail> = {}): WarmupSuiteDetail {
  return {
    id: 'suite-1',
    state: 'review_ready',
    suite_label: 'kickoff-foundation-v1',
    created_by_user_id: null,
    created_at: '2026-04-15T22:56:36.356Z',
    updated_at: '2026-04-15T22:56:43.137Z',
    activated_at: null,
    archived_at: null,
    kickoff_batch_id: 'kickoff-batch-1',
    warmup_batch_id: 'warmup-batch-1',
    latest_review: null,
    active_baseline: null,
    summary: {
      posts: 59,
      threads: 59,
      turns: 179,
      votes: 393,
      media: 25,
      communities: 12,
      media_covered_posts: 25,
      media_coverage_ratio: 0.424,
    },
    activation_readiness: {
      ok: true,
      reasons: [],
    },
    coverage: [],
    programming_health: {
      required_daily_outcomes: {
        creator_notes_min: 2,
        continuity_callbacks_min: 2,
      },
      observed_daily_outcomes: {
        creator_notes: 4,
        continuity_callbacks: 3,
      },
      daypart_readiness: [
        { daypart_id: 'morning_watch', label: 'Morning Watch', ok: true },
        { daypart_id: 'afternoon_spread', label: 'Afternoon Spread', ok: true },
      ],
      community_supply_floor: [
        { community_slug: 'whisper-hub', community_name: 'Whisper Hub', ok: true, missed_slots: 0 },
        {
          community_slug: 'late-night-radio',
          community_name: 'Late Night Radio',
          ok: true,
          missed_slots: 0,
        },
      ],
      visual_ratio_ok: true,
      aftershow_pipeline_ok: true,
      warning_count: 0,
      warnings: [],
    },
    kickoff_batch: createBatch('kickoff'),
    warmup_batch: createBatch('warmup'),
    actions: {
      can_review: true,
      can_retry: false,
      can_start_warmup: false,
      can_rebuild: false,
      can_archive: true,
    },
    ...overrides,
  }
}

describe('KickoffRuntimeReadinessService', () => {
  it('derives suite-scoped layer readiness for review-ready candidate suites', async () => {
    const getRuntimeBaselineAdmission = vi.fn<() => Promise<RuntimeBaselineAdmission>>()
    const getSuiteDetail = vi.fn<() => Promise<WarmupSuiteDetail>>()

    getRuntimeBaselineAdmission.mockResolvedValue({
      active_baseline_id: null,
      suite_id: null,
      kickoff_batch_id: null,
      warmup_batch_id: null,
      has_active_baseline: false,
      kickoff_layer_ready: false,
      warmup_layer_ready: false,
      key_communities_ready: false,
      key_shelves_ready: false,
      media_access_ok: false,
      aftershow_pipeline_ok: false,
      last_review_decision_ok: false,
      allow_public_growth: false,
      reasons: ['no_active_baseline'],
    })
    getSuiteDetail.mockResolvedValue(createSuiteDetail())

    const service = new KickoffRuntimeReadinessService({
      warmupGovernanceService: {
        getRuntimeBaselineAdmission,
        getSuiteDetail,
      },
    })

    const readiness = await service.buildForSuite('suite-1')

    expect(readiness.activation_readiness).toEqual({
      ok: true,
      reasons: [],
    })
    expect(readiness.layer_readiness).toEqual({
      kickoff_layer_ready: true,
      warmup_layer_ready: true,
      key_communities_ready: true,
      key_shelves_ready: true,
      media_access_ok: true,
      aftershow_pipeline_ok: true,
    })
    expect(readiness.admission).toEqual({
      allow_public_growth: false,
      reasons: ['not_active_suite', 'no_active_baseline'],
      has_active_baseline: false,
      active_baseline_id: null,
    })
  })

  it('keeps active suite layer readiness sourced from runtime baseline admission', async () => {
    const getRuntimeBaselineAdmission = vi.fn<() => Promise<RuntimeBaselineAdmission>>()
    const getSuiteDetail = vi.fn<() => Promise<WarmupSuiteDetail>>()

    getRuntimeBaselineAdmission.mockResolvedValue({
      active_baseline_id: 'baseline-1',
      suite_id: 'suite-1',
      kickoff_batch_id: 'kickoff-batch-1',
      warmup_batch_id: 'warmup-batch-1',
      has_active_baseline: true,
      kickoff_layer_ready: true,
      warmup_layer_ready: true,
      key_communities_ready: true,
      key_shelves_ready: true,
      media_access_ok: true,
      aftershow_pipeline_ok: true,
      last_review_decision_ok: true,
      allow_public_growth: true,
      reasons: [],
    })
    getSuiteDetail.mockResolvedValue(
      createSuiteDetail({
        state: 'active',
        active_baseline: {
          id: 'baseline-1',
          is_current: true,
          previous_baseline_id: null,
          activated_by_user_id: null,
          activated_at: '2026-04-15T23:10:00.000Z',
          deactivated_at: null,
        },
      }),
    )

    const service = new KickoffRuntimeReadinessService({
      warmupGovernanceService: {
        getRuntimeBaselineAdmission,
        getSuiteDetail,
      },
    })

    const readiness = await service.buildForSuite('suite-1')

    expect(readiness.layer_readiness).toEqual({
      kickoff_layer_ready: true,
      warmup_layer_ready: true,
      key_communities_ready: true,
      key_shelves_ready: true,
      media_access_ok: true,
      aftershow_pipeline_ok: true,
    })
    expect(readiness.admission).toEqual({
      allow_public_growth: true,
      reasons: [],
      has_active_baseline: true,
      active_baseline_id: 'baseline-1',
    })
  })

  it('allows kickoff-only candidate suites to be activation-ready while warmup stays pending', async () => {
    const getRuntimeBaselineAdmission = vi.fn<() => Promise<RuntimeBaselineAdmission>>()
    const getSuiteDetail = vi.fn<() => Promise<WarmupSuiteDetail>>()

    getRuntimeBaselineAdmission.mockResolvedValue({
      active_baseline_id: null,
      suite_id: null,
      kickoff_batch_id: null,
      warmup_batch_id: null,
      has_active_baseline: false,
      kickoff_layer_ready: false,
      warmup_layer_ready: false,
      key_communities_ready: false,
      key_shelves_ready: false,
      media_access_ok: false,
      aftershow_pipeline_ok: false,
      last_review_decision_ok: false,
      allow_public_growth: false,
      reasons: ['no_active_baseline'],
    })
    getSuiteDetail.mockResolvedValue(
      createSuiteDetail({
        warmup_batch_id: null,
        warmup_batch: null,
      }),
    )

    const service = new KickoffRuntimeReadinessService({
      warmupGovernanceService: {
        getRuntimeBaselineAdmission,
        getSuiteDetail,
      },
    })

    const readiness = await service.buildForSuite('suite-1')

    expect(readiness.activation_readiness).toEqual({
      ok: true,
      reasons: [],
    })
    expect(readiness.layer_readiness).toEqual({
      kickoff_layer_ready: true,
      warmup_layer_ready: false,
      key_communities_ready: true,
      key_shelves_ready: true,
      media_access_ok: true,
      aftershow_pipeline_ok: true,
    })
    expect(readiness.admission).toEqual({
      allow_public_growth: false,
      reasons: ['not_active_suite', 'no_active_baseline'],
      has_active_baseline: false,
      active_baseline_id: null,
    })
  })
})
