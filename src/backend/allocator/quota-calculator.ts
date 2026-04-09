import type { QuotaCalculator, QuotaContext, DegradationState } from './types.js'
import type { AllocatorConfig } from './config.js'

export interface DefaultQuotaCalculatorDeps {
  resolveCommunityMax?: (communityId: string) => number | undefined
  resolveThreadMax?: (communityId: string) => number | undefined
  resolveEventBaseQuota?: (input: { community_id: string; event_type: QuotaContext['event_type'] }) => number | undefined
}

/**
 * Multi-layer quota: take the minimum across global, community, thread, and
 * event-type base caps, then apply degradation factor.
 *
 * Community/thread overrides can be injected via the overrides map;
 * production will query these from DB/config service.
 */
export class DefaultQuotaCalculator implements QuotaCalculator {
  private communityOverrides = new Map<string, number>()
  private threadCounters = new Map<string, number>()

  constructor(
    private readonly cfg: AllocatorConfig,
    private readonly deps: DefaultQuotaCalculatorDeps = {},
  ) {}

  calculate(ctx: QuotaContext, degradation: DegradationState): number {
    const globalMax = this.cfg.globalMaxAgentsPerEvent
    const communityMax =
      this.communityOverrides.get(ctx.community_id)
      ?? this.deps.resolveCommunityMax?.(ctx.community_id)
      ?? this.cfg.defaultCommunityMaxAgents
    const configuredThreadMax =
      this.deps.resolveThreadMax?.(ctx.community_id)
      ?? this.cfg.defaultThreadMaxAgents
    const threadMax = this.remainingThreadQuota(ctx.thread_id ?? ctx.post_id, configuredThreadMax)
    const eventBase =
      this.deps.resolveEventBaseQuota?.(ctx)
      ?? this.cfg.eventBaseQuota[ctx.event_type]
      ?? 0

    const raw = Math.min(globalMax, communityMax, threadMax, eventBase)
    const adjusted = Math.max(0, Math.floor(raw * degradation.factor))

    return adjusted
  }

  setCommunityOverride(communityId: string, max: number): void {
    this.communityOverrides.set(communityId, max)
  }

  /**
   * Record that N agents were allocated for a thread in the current window.
   * In production, this would query DB count within a rolling 1h window.
   */
  recordThreadAllocation(scopeId: string, count: number): void {
    const current = this.threadCounters.get(scopeId) ?? 0
    this.threadCounters.set(scopeId, current + count)
  }

  resetThreadCounters(): void {
    this.threadCounters.clear()
  }

  private remainingThreadQuota(scopeId: string | undefined, configuredThreadMax: number): number {
    if (!scopeId) return configuredThreadMax
    const used = this.threadCounters.get(scopeId) ?? 0
    return Math.max(0, configuredThreadMax - used)
  }
}
