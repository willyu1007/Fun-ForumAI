import type {
  KickoffLayerReadiness,
  KickoffRuntimeReadiness,
} from '../../shared/kickoff-workflow.js'
import type {
  WarmupBatchReadModel,
  WarmupGovernanceService,
  WarmupSuiteDetail,
} from './warmup-governance-service.js'

const BATCH_MEDIA_FLOOR_CAP: Record<'kickoff' | 'warmup', number> = {
  kickoff: 4,
  warmup: 2,
}

const BATCH_COMMUNITY_FLOOR_CAP: Record<'kickoff' | 'warmup', number> = {
  kickoff: 12,
  warmup: 2,
}

function batchLayerReady(batch: WarmupBatchReadModel | null, kind: 'kickoff' | 'warmup'): boolean {
  if (!batch) return false
  const postFloor = Math.max(1, batch.stats.posts)
  const mediaFloor = Math.min(postFloor, BATCH_MEDIA_FLOOR_CAP[kind])
  const communityFloor = Math.min(postFloor, BATCH_COMMUNITY_FLOOR_CAP[kind])

  return (
    batch.stats.posts >= 1 &&
    batch.stats.threads >= postFloor &&
    batch.stats.turns >= postFloor &&
    batch.stats.votes >= postFloor &&
    batch.stats.media >= mediaFloor &&
    batch.stats.communities >= communityFloor
  )
}

function dailyOutcomeFloorReady(detail: Pick<WarmupSuiteDetail, 'programming_health'>): boolean {
  return Object.entries(detail.programming_health.required_daily_outcomes).every(
    ([key, required]) => {
      const observed =
        detail.programming_health.observed_daily_outcomes[key.replace(/_min$/, '')] ?? 0
      return observed >= required
    },
  )
}

function buildSuiteLayerReadiness(
  detail: Pick<WarmupSuiteDetail, 'kickoff_batch' | 'warmup_batch' | 'programming_health'>,
): KickoffLayerReadiness {
  return {
    kickoff_layer_ready: batchLayerReady(detail.kickoff_batch, 'kickoff'),
    warmup_layer_ready: batchLayerReady(detail.warmup_batch, 'warmup'),
    key_communities_ready: detail.programming_health.community_supply_floor.every(
      (item) => item.ok,
    ),
    key_shelves_ready:
      detail.programming_health.daypart_readiness.every((item) => item.ok) &&
      dailyOutcomeFloorReady(detail),
    media_access_ok: detail.programming_health.visual_ratio_ok,
    aftershow_pipeline_ok: detail.programming_health.aftershow_pipeline_ok,
  }
}

export class KickoffRuntimeReadinessService {
  constructor(
    private readonly deps: {
      warmupGovernanceService: Pick<
        WarmupGovernanceService,
        'getRuntimeBaselineAdmission' | 'getSuiteDetail'
      >
    },
  ) {}

  async buildForSuite(suiteId: string | null): Promise<KickoffRuntimeReadiness> {
    const admission = await this.deps.warmupGovernanceService.getRuntimeBaselineAdmission()
    if (!suiteId) {
      return {
        contract_version: 1,
        suite_id: null,
        suite_label: null,
        suite_state: 'unknown',
        kickoff_batch_id: admission.kickoff_batch_id,
        warmup_batch_id: admission.warmup_batch_id,
        active_baseline_id: admission.active_baseline_id,
        activation_readiness: {
          ok: false,
          reasons: admission.reasons,
        },
        layer_readiness: {
          kickoff_layer_ready: admission.kickoff_layer_ready,
          warmup_layer_ready: admission.warmup_layer_ready,
          key_communities_ready: admission.key_communities_ready,
          key_shelves_ready: admission.key_shelves_ready,
          media_access_ok: admission.media_access_ok,
          aftershow_pipeline_ok: admission.aftershow_pipeline_ok,
        },
        quality_state: {
          summary: {
            posts: 0,
            threads: 0,
            turns: 0,
            votes: 0,
            media: 0,
            communities: 0,
            media_covered_posts: 0,
            media_coverage_ratio: 0,
          },
          warning_count: 0,
          warnings: [],
        },
        admission: {
          allow_public_growth: admission.allow_public_growth,
          reasons: admission.reasons,
          has_active_baseline: admission.has_active_baseline,
          active_baseline_id: admission.active_baseline_id,
        },
        generated_at: new Date().toISOString(),
      }
    }

    const detail = await this.deps.warmupGovernanceService.getSuiteDetail(suiteId)
    const suiteLayerReadiness = buildSuiteLayerReadiness(detail)
    const admissionForSuite =
      admission.suite_id === detail.id
        ? admission
        : {
            ...admission,
            allow_public_growth: false,
            reasons: [...new Set(['not_active_suite', ...admission.reasons])],
            has_active_baseline: detail.active_baseline?.is_current === true,
            active_baseline_id: detail.active_baseline?.is_current
              ? detail.active_baseline.id
              : null,
          }

    return {
      contract_version: 1,
      suite_id: detail.id,
      suite_label: detail.suite_label,
      suite_state: detail.state,
      kickoff_batch_id: detail.kickoff_batch_id,
      warmup_batch_id: detail.warmup_batch_id,
      active_baseline_id: detail.active_baseline?.is_current ? detail.active_baseline.id : null,
      activation_readiness: detail.activation_readiness,
      layer_readiness:
        admission.suite_id === detail.id
          ? {
              kickoff_layer_ready: admissionForSuite.kickoff_layer_ready,
              warmup_layer_ready: admissionForSuite.warmup_layer_ready,
              key_communities_ready: admissionForSuite.key_communities_ready,
              key_shelves_ready: admissionForSuite.key_shelves_ready,
              media_access_ok: admissionForSuite.media_access_ok,
              aftershow_pipeline_ok: admissionForSuite.aftershow_pipeline_ok,
            }
          : suiteLayerReadiness,
      quality_state: {
        summary: detail.summary,
        warning_count: detail.programming_health.warning_count,
        warnings: detail.programming_health.warnings,
      },
      admission: {
        allow_public_growth: admissionForSuite.allow_public_growth,
        reasons: admissionForSuite.reasons,
        has_active_baseline: admissionForSuite.has_active_baseline,
        active_baseline_id: admissionForSuite.active_baseline_id,
      },
      generated_at: new Date().toISOString(),
    }
  }
}
