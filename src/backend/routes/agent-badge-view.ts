import { achievementChronicleService, agentBioRefreshService } from '../container.js'
import type { PublicBadge } from '../services/achievement-chronicle-service.js'

type AgentBadgeCarrier = {
  id: string
}

export async function attachPublicAgentBadges<T extends AgentBadgeCarrier>(
  items: T[],
): Promise<Array<T & { badges: PublicBadge[]; tagline: string | null; public_bio: string | null }>> {
  return Promise.all(items.map(async (item) => {
    try {
      const [highlights, projection] = await Promise.all([
        achievementChronicleService.getPublicHighlights(item.id),
        agentBioRefreshService.getProjection(item.id, {
          build_if_missing: true,
          allow_minor_refresh: false,
        }).catch(() => null),
      ])
      return {
        ...item,
        badges: highlights.badges,
        tagline: highlights.tagline,
        public_bio: projection?.public_bio ?? null,
      }
    } catch (error) {
      console.warn(`[AgentBadgeView] getPublicHighlights failed for agent=${item.id}:`, error)
      return {
        ...item,
        badges: [],
        tagline: null,
        public_bio: null,
      }
    }
  }))
}
