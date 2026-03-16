import type { PersonaObservationCounters, PersonaObservationV1 } from './persona-observation.js'

export interface RuntimeFeatureMetricsSnapshot {
  allocator: {
    ppr_hits: number
    ppr_misses: number
  }
  director: {
    selected_core: number
    selected_contrast: number
    selected_wildcard: number
    guard_rejections: number
  }
  prompt: {
    compose_calls: number
    trim_applied_calls: number
    trimmed_categories: number
    cache_hit_calls: number
  }
  inference_profile: {
    compile_runs: number
    candidate_runs: number
    shadow_runs: number
    blocked_runs: number
    approved_reanchors: number
  }
  persona: PersonaObservationCounters
  updated_at: string
}

class RuntimeFeatureMetrics {
  private snapshotState: RuntimeFeatureMetricsSnapshot = {
    allocator: {
      ppr_hits: 0,
      ppr_misses: 0,
    },
    director: {
      selected_core: 0,
      selected_contrast: 0,
      selected_wildcard: 0,
      guard_rejections: 0,
    },
    prompt: {
      compose_calls: 0,
      trim_applied_calls: 0,
      trimmed_categories: 0,
      cache_hit_calls: 0,
    },
    inference_profile: {
      compile_runs: 0,
      candidate_runs: 0,
      shadow_runs: 0,
      blocked_runs: 0,
      approved_reanchors: 0,
    },
    persona: {
      observed_runs_total: 0,
      observed_visible_runs_total: 0,
      observed_hidden_runs_total: 0,
      visible_complete_runs_total: 0,
      visible_partial_runs_total: 0,
      hidden_partial_runs_total: 0,
      complete_runs_total: 0,
      parse_attempt_total: 0,
      parse_success_total: 0,
      identity_write_attempt_total: 0,
      identity_write_success_total: 0,
      fallback_none_total: 0,
      fallback_same_line_total: 0,
      fallback_same_family_total: 0,
      fallback_cross_family_hidden_total: 0,
      fallback_rare_reanchor_total: 0,
      overlay_activation_total: 0,
      rare_reanchor_total: 0,
    },
    updated_at: new Date(0).toISOString(),
  }

  recordPpr(hit: boolean): void {
    if (hit) {
      this.snapshotState.allocator.ppr_hits += 1
    } else {
      this.snapshotState.allocator.ppr_misses += 1
    }
    this.touch()
  }

  recordDirectorRoles(reasons: string[]): void {
    for (const reason of reasons) {
      if (reason === 'director_role=core') {
        this.snapshotState.director.selected_core += 1
      } else if (reason === 'director_role=contrast') {
        this.snapshotState.director.selected_contrast += 1
      } else if (reason === 'director_role=wildcard') {
        this.snapshotState.director.selected_wildcard += 1
      }
    }
    this.touch()
  }

  recordDirectorGuardRejection(): void {
    this.snapshotState.director.guard_rejections += 1
    this.touch()
  }

  recordPromptAudit(input: { trimReasons: string[]; lintWarnings: string[] }): void {
    this.snapshotState.prompt.compose_calls += 1
    const trims = input.trimReasons.filter((reason) => reason.startsWith('trimmed_'))
    if (trims.length > 0) {
      this.snapshotState.prompt.trim_applied_calls += 1
      this.snapshotState.prompt.trimmed_categories += trims.length
    }
    if (input.lintWarnings.includes('cache_hit')) {
      this.snapshotState.prompt.cache_hit_calls += 1
    }
    this.touch()
  }

  recordInferenceProfileCompile(state: 'stable' | 'candidate' | 'shadow' | 'blocked'): void {
    const metrics = this.snapshotState.inference_profile
    metrics.compile_runs += 1
    if (state === 'candidate') {
      metrics.candidate_runs += 1
    } else if (state === 'shadow') {
      metrics.shadow_runs += 1
    } else if (state === 'blocked') {
      metrics.blocked_runs += 1
    }
    this.touch()
  }

  recordInferenceProfileReanchor(): void {
    this.snapshotState.inference_profile.approved_reanchors += 1
    this.touch()
  }

  recordPersonaObservation(observation: PersonaObservationV1, opts: { complete: boolean }): void {
    const persona = this.snapshotState.persona
    persona.observed_runs_total += 1

    if (observation.visibility === 'visible') {
      persona.observed_visible_runs_total += 1
    } else {
      persona.observed_hidden_runs_total += 1
    }

    if (observation.coverage_status === 'visible_complete') {
      persona.visible_complete_runs_total += 1
    } else if (observation.coverage_status === 'visible_partial') {
      persona.visible_partial_runs_total += 1
    } else if (observation.coverage_status === 'hidden_partial') {
      persona.hidden_partial_runs_total += 1
    }

    if (opts.complete) {
      persona.complete_runs_total += 1
    }

    if (typeof observation.parse_success === 'boolean') {
      persona.parse_attempt_total += 1
      if (observation.parse_success) {
        persona.parse_success_total += 1
      }
    }

    if (observation.identity_write.attempted) {
      persona.identity_write_attempt_total += 1
      if (observation.identity_write.success) {
        persona.identity_write_success_total += 1
      }
    }

    const fallback = observation.render_decision?.fallback_level ?? 'none'
    if (fallback === 'none') {
      persona.fallback_none_total += 1
    } else if (fallback === 'same-line') {
      persona.fallback_same_line_total += 1
    } else if (fallback === 'same-family') {
      persona.fallback_same_family_total += 1
    } else if (fallback === 'cross-family-hidden') {
      persona.fallback_cross_family_hidden_total += 1
    } else if (fallback === 'rare-reanchor') {
      persona.fallback_rare_reanchor_total += 1
      persona.rare_reanchor_total += 1
    }

    if (observation.runtime_state?.active_overlay_id) {
      persona.overlay_activation_total += 1
    }

    this.touch()
  }

  snapshot(): RuntimeFeatureMetricsSnapshot {
    return JSON.parse(JSON.stringify(this.snapshotState)) as RuntimeFeatureMetricsSnapshot
  }

  private touch(): void {
    this.snapshotState.updated_at = new Date().toISOString()
  }
}

export const runtimeFeatureMetrics = new RuntimeFeatureMetrics()
