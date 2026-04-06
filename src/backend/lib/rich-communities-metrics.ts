export interface RichCommunitiesMetricsSnapshot {
  stage_spec_fallback_total: number
  incubation_seed_created_total: number
  strict_publication_reject_total: Record<string, number>
  aftershow_trigger_total: Record<string, number>
  updated_at: string
}

class RichCommunitiesMetrics {
  private state: RichCommunitiesMetricsSnapshot = {
    stage_spec_fallback_total: 0,
    incubation_seed_created_total: 0,
    strict_publication_reject_total: {},
    aftershow_trigger_total: {},
    updated_at: new Date(0).toISOString(),
  }

  recordStageSpecFallback(): void {
    this.state.stage_spec_fallback_total += 1
    this.touch()
  }

  recordIncubationSeedCreated(): void {
    this.state.incubation_seed_created_total += 1
    this.touch()
  }

  recordStrictPublicationReject(reason: string): void {
    const key = reason || 'unknown'
    this.state.strict_publication_reject_total[key] = (this.state.strict_publication_reject_total[key] ?? 0) + 1
    this.touch()
  }

  recordAftershowTrigger(input: { mode: string; status: string }): void {
    const key = `${input.mode}|${input.status}`
    this.state.aftershow_trigger_total[key] = (this.state.aftershow_trigger_total[key] ?? 0) + 1
    this.touch()
  }

  snapshot(): RichCommunitiesMetricsSnapshot {
    return JSON.parse(JSON.stringify(this.state)) as RichCommunitiesMetricsSnapshot
  }

  private touch(): void {
    this.state.updated_at = new Date().toISOString()
  }
}

export const richCommunitiesMetrics = new RichCommunitiesMetrics()
