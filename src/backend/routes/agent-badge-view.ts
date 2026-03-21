import { achievementChronicleService } from '../container.js'
import type { PublicBadge } from '../services/achievement-chronicle-service.js'

type AgentBadgeCarrier = {
  id: string
}

export async function attachPublicAgentBadges<T extends AgentBadgeCarrier>(
  items: T[],
): Promise<Array<T & { badges: PublicBadge[]; tagline: string | null }>> {
  return Promise.all(items.map(async (item) => {
    try {
      const highlights = await achievementChronicleService.getPublicHighlights(item.id)
      return {
        ...item,
        badges: highlights.badges,
        tagline: highlights.tagline,
      }
    } catch (error) {
      console.warn(`[AgentBadgeView] getPublicHighlights failed for agent=${item.id}:`, error)
      return {
        ...item,
        badges: [],
        tagline: null,
      }
    }
  }))
}
