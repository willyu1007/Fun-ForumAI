import { config } from '../lib/config.js'
import type { MediaRolloutControllerOverrideRepository } from '../repos/media-rollout-controller-override-repository.js'
import type {
  MediaRolloutControllerMode,
  MediaRolloutControllerOverride,
  PersistedVisualDirective,
} from '../repos/types.js'
import {
  deriveTargetBandFromOverride,
  MediaObservabilityService,
  type MediaObservabilityGate,
  type MediaObservabilitySnapshot,
} from './media-observability-service.js'

export interface MediaRolloutEffectiveSettings {
  target_min_rate: number
  target_max_rate: number
  threshold_delta: number
  allow_generation: boolean
  generation_tier: PersistedVisualDirective['budget']['generation_tier']
  sync_generation_ms_budget: number
  allow_private_runtime_projection: boolean
  allow_private_inspired_generation: boolean
  force_safe_mode: boolean
  semantic_v3_enforced: boolean
  strict_audit_enforced: boolean
  lineage_required: boolean
}

export interface MediaRolloutControllerProfile {
  mode: MediaRolloutControllerMode
  active_override: MediaRolloutControllerOverride | null
  profile:
    | 'steady'
    | 'boost'
    | 'conserve'
    | 'safe_mode'
    | 'manual'
    | 'off'
  metrics: MediaObservabilitySnapshot
  gates: MediaObservabilityGate[]
  effective: MediaRolloutEffectiveSettings
  reason: string
}

const STEADY_SYNC_BUDGET_MS = 2200

function buildSteadySettings(): MediaRolloutEffectiveSettings {
  return {
    target_min_rate: config.mediaController.rootPostTargetMinRate,
    target_max_rate: config.mediaController.rootPostTargetMaxRate,
    threshold_delta: 0,
    allow_generation: config.features.mediaGenerationV1,
    generation_tier: config.features.mediaGenerationV1 ? 'medium' : 'none',
    sync_generation_ms_budget: config.features.mediaGenerationV1 ? STEADY_SYNC_BUDGET_MS : 0,
    allow_private_runtime_projection: true,
    allow_private_inspired_generation: true,
    force_safe_mode: false,
    semantic_v3_enforced: true,
    strict_audit_enforced: true,
    lineage_required: true,
  }
}

function gateStatus(gates: MediaObservabilityGate[], id: MediaObservabilityGate['id']): MediaObservabilityGate['status'] {
  return gates.find((item) => item.id === id)?.status ?? 'pass'
}

function shouldCostConserve(metrics: MediaObservabilitySnapshot): boolean {
  const budget = config.mediaController.estimatedGenerationDailyBudgetCny
  if (budget <= 0) return false
  return (metrics.generation_24h.estimated_cost_cny ?? 0) > budget
}

function applySafeModeIfRequested(
  settings: MediaRolloutEffectiveSettings,
): MediaRolloutEffectiveSettings {
  if (!settings.force_safe_mode) {
    return settings
  }
  return {
    ...settings,
    threshold_delta: Math.max(settings.threshold_delta, 0.35),
    allow_generation: false,
    generation_tier: 'none',
    sync_generation_ms_budget: 0,
    allow_private_runtime_projection: false,
    allow_private_inspired_generation: false,
    semantic_v3_enforced: settings.semantic_v3_enforced,
    strict_audit_enforced: settings.strict_audit_enforced,
    lineage_required: settings.lineage_required,
  }
}

export class MediaRolloutControllerService {
  constructor(private readonly deps: {
    mediaObservabilityService: MediaObservabilityService
    mediaRolloutControllerOverrideRepo: MediaRolloutControllerOverrideRepository
  }) {}

  async getActiveOverride(): Promise<MediaRolloutControllerOverride | null> {
    return this.deps.mediaRolloutControllerOverrideRepo.findActive()
  }

  async getEffectiveProfile(): Promise<MediaRolloutControllerProfile> {
    const activeOverride = await this.getActiveOverride()
    const targetBand = deriveTargetBandFromOverride(activeOverride)
    const metrics = await this.deps.mediaObservabilityService.getSnapshot()
    const gates = this.deps.mediaObservabilityService.buildGates(metrics, targetBand)
    const baseSteady = buildSteadySettings()
    const steady = {
      ...baseSteady,
      target_min_rate: targetBand.target_min_rate,
      target_max_rate: targetBand.target_max_rate,
    }

    if (!config.features.mediaRolloutControllerV1) {
      return {
        mode: 'OFF',
        active_override: activeOverride,
        profile: 'off',
        metrics,
        gates,
        effective: baseSteady,
        reason: 'feature_flag_disabled',
      }
    }

    if (activeOverride?.mode === 'OFF') {
      return {
        mode: 'OFF',
        active_override: activeOverride,
        profile: 'off',
        metrics,
        gates,
        effective: baseSteady,
        reason: activeOverride.reason ?? 'manual_off_override',
      }
    }

    if (activeOverride?.mode === 'MANUAL') {
      return {
        mode: 'MANUAL',
        active_override: activeOverride,
        profile: 'manual',
        metrics,
        gates,
        effective: applySafeModeIfRequested({
          target_min_rate: activeOverride.target_min_rate ?? steady.target_min_rate,
          target_max_rate: activeOverride.target_max_rate ?? steady.target_max_rate,
          threshold_delta: activeOverride.threshold_delta ?? steady.threshold_delta,
          allow_generation: activeOverride.allow_generation ?? steady.allow_generation,
          generation_tier: activeOverride.generation_tier ?? steady.generation_tier,
          sync_generation_ms_budget:
            activeOverride.sync_generation_ms_budget ?? steady.sync_generation_ms_budget,
          allow_private_runtime_projection:
            activeOverride.allow_private_runtime_projection
            ?? steady.allow_private_runtime_projection,
          allow_private_inspired_generation:
            activeOverride.allow_private_inspired_generation
            ?? steady.allow_private_inspired_generation,
          force_safe_mode: activeOverride.force_safe_mode,
          semantic_v3_enforced: activeOverride.semantic_v3_enforced,
          strict_audit_enforced: activeOverride.strict_audit_enforced,
          lineage_required: activeOverride.lineage_required,
        }),
        reason: activeOverride.reason ?? 'manual_override',
      }
    }

    const rootPostBand = gateStatus(gates, 'root_post_band')
    const attachStability = gateStatus(gates, 'attach_stability')
    const generationHealth = gateStatus(gates, 'generation_health')
    const privacySafety = gateStatus(gates, 'privacy_safety')
    const promptAuditSpike =
      metrics.root_post.prompt_audit_blocked_24h >= 3
      || (metrics.root_post.prompt_audit_block_rate_24h ?? 0) >= 0.2
    const costConserve = shouldCostConserve(metrics)
    const attachRate = metrics.root_post.attach_rate_7d ?? 0

    if (privacySafety === 'block' || promptAuditSpike) {
      return {
        mode: 'AUTO',
        active_override: activeOverride,
        profile: 'safe_mode',
        metrics,
        gates,
        effective: {
          ...steady,
          threshold_delta: 0.35,
          allow_generation: false,
          generation_tier: 'none',
          sync_generation_ms_budget: 0,
          allow_private_runtime_projection: false,
          allow_private_inspired_generation: false,
          force_safe_mode: true,
        },
        reason: privacySafety === 'block' ? 'critical_private_leak_detected' : 'prompt_audit_spike',
      }
    }

    if (
      attachRate < steady.target_min_rate
      && attachStability === 'pass'
      && generationHealth !== 'block'
    ) {
      return {
        mode: 'AUTO',
        active_override: activeOverride,
        profile: 'boost',
        metrics,
        gates,
        effective: {
          ...steady,
          threshold_delta: -0.2,
          generation_tier: config.features.mediaGenerationV1 ? 'medium' : 'none',
          sync_generation_ms_budget: config.features.mediaGenerationV1 ? 2600 : 0,
        },
        reason: 'attach_rate_below_target_band',
      }
    }

    if (
      attachRate > steady.target_max_rate
      || rootPostBand === 'block'
      || attachStability === 'block'
      || generationHealth === 'block'
      || costConserve
    ) {
      const disableGeneration = generationHealth === 'block' || costConserve
      return {
        mode: 'AUTO',
        active_override: activeOverride,
        profile: 'conserve',
        metrics,
        gates,
        effective: {
          ...steady,
          threshold_delta: 0.2,
          allow_generation: !disableGeneration && config.features.mediaGenerationV1,
          generation_tier: disableGeneration ? 'none' : 'low',
          sync_generation_ms_budget: disableGeneration ? 0 : 1000,
          allow_private_inspired_generation: !disableGeneration,
        },
        reason: costConserve ? 'estimated_cost_over_budget' : 'stability_or_band_pressure',
      }
    }

    return {
      mode: activeOverride?.mode ?? 'AUTO',
      active_override: activeOverride,
      profile: 'steady',
      metrics,
      gates,
      effective: steady,
      reason: 'within_target_band',
    }
  }

  async createOrReplaceOverride(input: {
    mode: MediaRolloutControllerMode
    target_min_rate?: number | null
    target_max_rate?: number | null
    threshold_delta?: number | null
    allow_generation?: boolean | null
    generation_tier?: PersistedVisualDirective['budget']['generation_tier'] | null
    sync_generation_ms_budget?: number | null
    allow_private_runtime_projection?: boolean | null
    allow_private_inspired_generation?: boolean | null
    force_safe_mode?: boolean
    semantic_v3_enforced?: boolean | null
    strict_audit_enforced?: boolean | null
    lineage_required?: boolean | null
    reason?: string | null
    created_by_user_id: string
  }): Promise<MediaRolloutControllerOverride> {
    return this.deps.mediaRolloutControllerOverrideRepo.replaceActive({
      next_override: {
        mode: input.mode,
        target_min_rate: input.target_min_rate ?? null,
        target_max_rate: input.target_max_rate ?? null,
        threshold_delta: input.threshold_delta ?? null,
        allow_generation: input.allow_generation ?? null,
        generation_tier: input.generation_tier ?? null,
        sync_generation_ms_budget: input.sync_generation_ms_budget ?? null,
        allow_private_runtime_projection: input.allow_private_runtime_projection ?? null,
        allow_private_inspired_generation: input.allow_private_inspired_generation ?? null,
        force_safe_mode: input.force_safe_mode ?? false,
        semantic_v3_enforced: input.semantic_v3_enforced ?? true,
        strict_audit_enforced: input.strict_audit_enforced ?? true,
        lineage_required: input.lineage_required ?? true,
        root_post_attachment_only: true,
        reason: input.reason ?? null,
        created_by_user_id: input.created_by_user_id,
      },
      release: {
        released_by_user_id: input.created_by_user_id,
        released_reason: 'replaced_by_new_override',
      },
    })
  }

  async releaseOverride(input: {
    override_id: string
    released_by_user_id: string
    released_reason?: string | null
  }): Promise<MediaRolloutControllerOverride | null> {
    return this.deps.mediaRolloutControllerOverrideRepo.release(input.override_id, {
      released_by_user_id: input.released_by_user_id,
      released_reason: input.released_reason ?? null,
    })
  }

  async applyToScheduledPostDirective(
    directive: PersistedVisualDirective,
  ): Promise<{
    directive: PersistedVisualDirective
    profile: MediaRolloutControllerProfile
  }> {
    const profile = await this.getEffectiveProfile()
    if (profile.mode === 'OFF') {
      return { directive, profile }
    }

    return {
      profile,
      directive: {
        ...directive,
        sourcing_policy: {
          ...directive.sourcing_policy,
          allow_generation: profile.effective.allow_generation,
          allow_private_runtime_projection: profile.effective.allow_private_runtime_projection,
          allow_private_inspired_generation:
            profile.effective.allow_private_inspired_generation,
        },
        budget: {
          ...directive.budget,
          generation_tier: profile.effective.generation_tier,
          sync_generation_ms_budget: profile.effective.sync_generation_ms_budget,
          selection_threshold_delta: profile.effective.threshold_delta,
        },
      },
    }
  }
}
