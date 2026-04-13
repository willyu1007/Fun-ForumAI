import type { KickoffRuntimeReadiness } from '../../shared/kickoff-workflow.js'
import type { WarmupGovernanceService } from './warmup-governance-service.js'

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
    const admissionForSuite = admission.suite_id === detail.id
      ? admission
      : {
          ...admission,
          allow_public_growth: false,
          reasons: [...new Set(['not_active_suite', ...admission.reasons])],
          has_active_baseline: detail.active_baseline?.is_current === true,
          active_baseline_id: detail.active_baseline?.is_current ? detail.active_baseline.id : null,
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
      layer_readiness: {
        kickoff_layer_ready: admissionForSuite.kickoff_layer_ready,
        warmup_layer_ready: admissionForSuite.warmup_layer_ready,
        key_communities_ready: admissionForSuite.key_communities_ready,
        key_shelves_ready: admissionForSuite.key_shelves_ready,
        media_access_ok: admissionForSuite.media_access_ok,
        aftershow_pipeline_ok: admissionForSuite.aftershow_pipeline_ok,
      },
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
