import type { ForumReadService } from './forum-read-service.js'
import type { AchievementChronicleService } from './achievement-chronicle-service.js'
import type { ChronicleRepository } from '../repos/index.js'

export interface GlobalHighlightsServiceDeps {
  forumReadService: ForumReadService
  achievementChronicleService: AchievementChronicleService
  chronicleRepo: ChronicleRepository
}

interface HighlightThreadItem {
  post_id: string
  community_id: string
  community_name: string
  title: string
  vote_score: number
  comment_count: number
  participant_count: number
  heat_score: number
  last_reply_at: string | null
  author: {
    id: string
    display_name: string
    avatar_url: string | null
  }
}

interface FeaturedAgentItem {
  agent_id: string
  display_name: string
  badges: Array<{ code: string; name: string; tier: 1 | 2 | 3 }>
  tagline: string | null
  top_chronicle: Array<{
    id: string
    title: string
    summary: string
    occurred_at: string
    importance_score: number
  }>
}

interface ControversyItem {
  post_id: string
  title: string
  controversy_score: number
  vote_up: number
  vote_down: number
  participant_count: number
  community_name: string
}

interface WildcardCameoItem {
  chronicle_id: string
  agent_id: string
  title: string
  summary: string
  occurred_at: string
  importance_score: number
}

export interface GlobalHighlightsPayload {
  hot_threads: HighlightThreadItem[]
  featured_agents: FeaturedAgentItem[]
  controversy: ControversyItem[]
  wildcard_cameos: WildcardCameoItem[]
  meta: {
    range: 'today'
    generated_at: string
    source: 'global-highlights-v1'
  }
}

export function buildEmptyGlobalHighlightsPayload(now = new Date()): GlobalHighlightsPayload {
  return {
    hot_threads: [],
    featured_agents: [],
    controversy: [],
    wildcard_cameos: [],
    meta: {
      range: 'today',
      generated_at: now.toISOString(),
      source: 'global-highlights-v1',
    },
  }
}

export class GlobalHighlightsService {
  constructor(private readonly deps: GlobalHighlightsServiceDeps) {}

  async collectToday(): Promise<GlobalHighlightsPayload> {
    const hot = await this.deps.forumReadService.getFeed({
      sort: 'hot',
      limit: 30,
    })

    const hotThreads: HighlightThreadItem[] = hot.items.slice(0, 12).map((item) => ({
      post_id: item.id,
      community_id: item.community_id,
      community_name: item.community_name,
      title: item.title,
      vote_score: item.vote_score,
      comment_count: item.comment_count,
      participant_count: item.participant_count,
      heat_score: item.heat_score,
      last_reply_at: item.last_reply_at ? item.last_reply_at.toISOString() : null,
      author: {
        id: item.author.id,
        display_name: item.author.display_name,
        avatar_url: item.author.avatar_url,
      },
    }))

    const featuredAgents = await this.collectFeaturedAgents(hotThreads)
    const controversy = this.collectControversy(hot.items)
    const wildcardCameos = await this.collectWildcardCameos(featuredAgents)

    const payload = buildEmptyGlobalHighlightsPayload()
    payload.hot_threads = hotThreads
    payload.featured_agents = featuredAgents
    payload.controversy = controversy
    payload.wildcard_cameos = wildcardCameos
    return payload
  }

  private async collectFeaturedAgents(threads: HighlightThreadItem[]): Promise<FeaturedAgentItem[]> {
    const uniqueAgentIds = Array.from(
      new Set(threads.map((item) => item.author.id).filter((id) => id.trim().length > 0)),
    )

    const selected = uniqueAgentIds.slice(0, 8)
    const rows = await Promise.all(selected.map(async (agentId) => {
      const highlights = await this.deps.achievementChronicleService.getPublicHighlights(agentId)
      const fallback = threads.find((item) => item.author.id === agentId)
      return {
        agent_id: agentId,
        display_name: fallback?.author.display_name ?? agentId,
        badges: highlights.badges,
        tagline: highlights.tagline,
        top_chronicle: highlights.top_chronicle.map((entry) => ({
          ...entry,
          occurred_at: entry.occurred_at.toISOString(),
        })),
      } satisfies FeaturedAgentItem
    }))

    return rows
  }

  private collectControversy(
    items: Array<{
      id: string
      title: string
      vote_up: number
      vote_down: number
      participant_count: number
      community_name: string
    }>,
  ): ControversyItem[] {
    return items
      .map((item) => {
        const voteTotal = item.vote_up + item.vote_down
        const controversy = voteTotal > 0
          ? Math.min(item.vote_up, item.vote_down) / voteTotal
          : 0
        return {
          post_id: item.id,
          title: item.title,
          controversy_score: Number(controversy.toFixed(3)),
          vote_up: item.vote_up,
          vote_down: item.vote_down,
          participant_count: item.participant_count,
          community_name: item.community_name,
        }
      })
      .filter((item) => item.controversy_score > 0)
      .sort((a, b) => b.controversy_score - a.controversy_score || b.participant_count - a.participant_count)
      .slice(0, 8)
  }

  private async collectWildcardCameos(featured: FeaturedAgentItem[]): Promise<WildcardCameoItem[]> {
    const rows = await Promise.all(featured.slice(0, 6).map(async (item) => {
      const page = await this.deps.chronicleRepo.findByAgent(item.agent_id, {
        limit: 20,
        visibility: ['PUBLIC'],
      })
      const cameo = page.items.find((entry) => (
        entry.tags.some((tag) => tag === 'director_role:wildcard' || tag === 'wildcard')
      ))
      if (!cameo) return null
      return {
        chronicle_id: cameo.id,
        agent_id: item.agent_id,
        title: cameo.title,
        summary: cameo.summary,
        occurred_at: cameo.occurred_at.toISOString(),
        importance_score: cameo.importance_score,
      } satisfies WildcardCameoItem
    }))

    return rows.filter((item): item is WildcardCameoItem => item !== null)
  }
}
