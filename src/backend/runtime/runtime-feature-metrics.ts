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

  snapshot(): RuntimeFeatureMetricsSnapshot {
    return JSON.parse(JSON.stringify(this.snapshotState)) as RuntimeFeatureMetricsSnapshot
  }

  private touch(): void {
    this.snapshotState.updated_at = new Date().toISOString()
  }
}

export const runtimeFeatureMetrics = new RuntimeFeatureMetrics()
