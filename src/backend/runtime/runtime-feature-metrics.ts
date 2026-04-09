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
  forum_orchestration: {
    shadow_runs: number
    selection_cutover_runs: number
    envelope_cutover_runs: number
    late_entry_ratio: number
    dominant_thread_share: number
    newcomer_share: number
    recall_diversity: number
    same_pair_exchange_rate: number
    selected_vs_actual_anchor_mismatch: number
    resolved_vs_written_anchor_mismatch: number
    runtime_context_token_count_p95: number
    fallback_count: number
    shadow_overlap_ratio: number
  }
  persona: PersonaObservationCounters
  updated_at: string
}

export class RuntimeFeatureMetrics {
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
    forum_orchestration: {
      shadow_runs: 0,
      selection_cutover_runs: 0,
      envelope_cutover_runs: 0,
      late_entry_ratio: 0,
      dominant_thread_share: 0,
      newcomer_share: 0,
      recall_diversity: 0,
      same_pair_exchange_rate: 0,
      selected_vs_actual_anchor_mismatch: 0,
      resolved_vs_written_anchor_mismatch: 0,
      runtime_context_token_count_p95: 0,
      fallback_count: 0,
      shadow_overlap_ratio: 0,
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
  private readonly forumOrchestrationSamples = {
    late_entry_ratio: [] as number[],
    dominant_thread_share: [] as number[],
    newcomer_share: [] as number[],
    recall_diversity: [] as number[],
    same_pair_exchange_rate: [] as number[],
    selected_vs_actual_anchor_mismatch: [] as number[],
    resolved_vs_written_anchor_mismatch: [] as number[],
    shadow_overlap_ratio: [] as number[],
    runtime_context_token_count: [] as number[],
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

  recordForumOrchestrationSelection(input: {
    late_entry_ratio: number
    dominant_thread_share: number
    newcomer_share: number
    recall_diversity: number
    same_pair_exchange_rate: number
    selection_cutover: boolean
  }): void {
    if (input.selection_cutover) {
      this.snapshotState.forum_orchestration.selection_cutover_runs += 1
    }
    this.pushForumSample('late_entry_ratio', input.late_entry_ratio)
    this.pushForumSample('dominant_thread_share', input.dominant_thread_share)
    this.pushForumSample('newcomer_share', input.newcomer_share)
    this.pushForumSample('recall_diversity', input.recall_diversity)
    this.pushForumSample('same_pair_exchange_rate', input.same_pair_exchange_rate)
  }

  recordForumOrchestrationShadow(overlapRatio: number): void {
    this.snapshotState.forum_orchestration.shadow_runs += 1
    this.pushForumSample('shadow_overlap_ratio', overlapRatio)
  }

  recordForumRuntimeContext(input: {
    token_count: number
    envelope_cutover: boolean
  }): void {
    if (input.envelope_cutover) {
      this.snapshotState.forum_orchestration.envelope_cutover_runs += 1
    }
    this.pushForumSample('runtime_context_token_count', input.token_count)
  }

  recordForumAnchorResolution(input: {
    selected_anchor_turn_id?: string | null
    actual_anchor_turn_id?: string | null
    final_write_anchor_turn_id?: string | null
    written_anchor_turn_id?: string | null
  }): void {
    this.pushForumSample(
      'selected_vs_actual_anchor_mismatch',
      normalizeAnchorId(input.selected_anchor_turn_id) === normalizeAnchorId(input.actual_anchor_turn_id) ? 0 : 1,
    )
    this.pushForumSample(
      'resolved_vs_written_anchor_mismatch',
      normalizeAnchorId(input.final_write_anchor_turn_id) === normalizeAnchorId(input.written_anchor_turn_id) ? 0 : 1,
    )
  }

  recordForumOrchestrationFallback(): void {
    this.snapshotState.forum_orchestration.fallback_count += 1
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

  private pushForumSample(
    key: keyof RuntimeFeatureMetrics['forumOrchestrationSamples'],
    value: number,
  ): void {
    const boundedValue = Number.isFinite(value) ? value : 0
    const bucket = this.forumOrchestrationSamples[key]
    bucket.push(boundedValue)
    if (bucket.length > 200) {
      bucket.shift()
    }

    if (key === 'runtime_context_token_count') {
      this.snapshotState.forum_orchestration.runtime_context_token_count_p95 = percentile(bucket, 0.95)
    } else {
      const nextValue = average(bucket)
      if (key === 'late_entry_ratio') {
        this.snapshotState.forum_orchestration.late_entry_ratio = nextValue
      } else if (key === 'dominant_thread_share') {
        this.snapshotState.forum_orchestration.dominant_thread_share = nextValue
      } else if (key === 'newcomer_share') {
        this.snapshotState.forum_orchestration.newcomer_share = nextValue
      } else if (key === 'recall_diversity') {
        this.snapshotState.forum_orchestration.recall_diversity = nextValue
      } else if (key === 'same_pair_exchange_rate') {
        this.snapshotState.forum_orchestration.same_pair_exchange_rate = nextValue
      } else if (key === 'selected_vs_actual_anchor_mismatch') {
        this.snapshotState.forum_orchestration.selected_vs_actual_anchor_mismatch = nextValue
      } else if (key === 'resolved_vs_written_anchor_mismatch') {
        this.snapshotState.forum_orchestration.resolved_vs_written_anchor_mismatch = nextValue
      } else if (key === 'shadow_overlap_ratio') {
        this.snapshotState.forum_orchestration.shadow_overlap_ratio = nextValue
      }
    }

    this.touch()
  }

  private touch(): void {
    this.snapshotState.updated_at = new Date().toISOString()
  }
}

export const runtimeFeatureMetrics = new RuntimeFeatureMetrics()

function normalizeAnchorId(value: string | null | undefined): string {
  return typeof value === 'string' && value.length > 0 ? value : ''
}

function average(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function percentile(values: number[], ratio: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((left, right) => left - right)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1))
  return sorted[index] ?? 0
}
