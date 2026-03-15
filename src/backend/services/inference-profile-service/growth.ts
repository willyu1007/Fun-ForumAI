import type { InferenceProfileServiceDeps } from './types.js'

export async function loadGrowthSummary(
  deps: InferenceProfileServiceDeps,
  agentId: string,
): Promise<{ growthPointsTotal: number }> {
  if (!deps.xpService) return { growthPointsTotal: 0 }
  const summary = await deps.xpService.getXpSummary(agentId)
  return {
    growthPointsTotal: summary.growth_points_total,
  }
}

export async function detectRecentRespec(
  deps: InferenceProfileServiceDeps,
  agentId: string,
): Promise<boolean> {
  const events = await deps.statsRepo.listEvents(agentId, { limit: 20 })
  const windowStart = Date.now() - 24 * 60 * 60 * 1000
  return events.items.some(
    (event) =>
      event.event_type === 'POINTS_SPENT' &&
      event.created_at.getTime() >= windowStart &&
      toNumber(event.delta_json.spent_points) >= 8,
  )
}

function toNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}
