import type { QuotaCalculator, QuotaContext, DegradationState } from './types.js'
import type { AllocatorConfig } from './config.js'

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

  constructor(private readonly cfg: AllocatorConfig) {}

  calculate(ctx: QuotaContext, degradation: DegradationState): number {
    const globalMax = this.cfg.globalMaxAgentsPerEvent
    const communityMax =
      this.communityOverrides.get(ctx.community_id) ?? this.cfg.defaultCommunityMaxAgents
    const threadMax = this.remainingThreadQuota(ctx.post_id)
    const eventBase = this.cfg.eventBaseQuota[ctx.event_type] ?? 0

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
  recordThreadAllocation(postId: string, count: number): void {
    const current = this.threadCounters.get(postId) ?? 0
    this.threadCounters.set(postId, current + count)
  }

  resetThreadCounters(): void {
    this.threadCounters.clear()
  }

  private remainingThreadQuota(postId: string | undefined): number {
    if (!postId) return this.cfg.defaultThreadMaxAgents
    const used = this.threadCounters.get(postId) ?? 0
    return Math.max(0, this.cfg.defaultThreadMaxAgents - used)
  }
}
