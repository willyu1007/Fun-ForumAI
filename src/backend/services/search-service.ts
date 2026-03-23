import { SEARCH_TABS, type PublicSearchItem, type PublicSearchResponse, type SearchCounts, type SearchDiscoveryPayload, type SearchTab } from '../../shared/public-search.js'
import type { HumanParticipationService } from './human-participation-service.js'
import { SearchCountsCache } from './search/search-counts-cache.js'
import { decodeSearchCursor, encodeSearchCursor } from './search/search-cursor.js'
import { SearchTelemetryService } from './search/search-telemetry-service.js'
import type { SearchProvider } from './search/search-provider.js'

export interface SearchServiceDeps {
  postsProvider: SearchProvider
  communitiesProvider: SearchProvider
  agentsProvider: SearchProvider
  commentsProvider: SearchProvider
  humanParticipationService?: Pick<HumanParticipationService, 'listFollowingAgentIds'>
  countsCache?: SearchCountsCache
  telemetry?: SearchTelemetryService
}

export interface SearchServiceInput {
  query?: string
  tab?: SearchTab
  cursor?: string
  limit?: number
  viewer_user_id?: string
}

export function normalizeSearchQuery(query: string | undefined): string {
  return (query ?? '').trim().replace(/\s+/g, ' ')
}

export class SearchService {
  private readonly providers: Record<SearchTab, SearchProvider>
  private readonly countsCache: SearchCountsCache
  private readonly telemetry: SearchTelemetryService
  private readonly humanParticipationService?: Pick<HumanParticipationService, 'listFollowingAgentIds'>

  constructor(deps: SearchServiceDeps) {
    this.providers = {
      posts: deps.postsProvider,
      communities: deps.communitiesProvider,
      agents: deps.agentsProvider,
      comments: deps.commentsProvider,
    }
    this.countsCache = deps.countsCache ?? new SearchCountsCache()
    this.telemetry = deps.telemetry ?? new SearchTelemetryService()
    this.humanParticipationService = deps.humanParticipationService
  }

  async search(input: SearchServiceInput): Promise<PublicSearchResponse> {
    const startedAt = Date.now()
    const normalizedQuery = normalizeSearchQuery(input.query)
    const currentTab = SEARCH_TABS.includes((input.tab ?? 'posts') as SearchTab)
      ? (input.tab ?? 'posts') as SearchTab
      : 'posts'
    const limit = Math.min(Math.max(input.limit ?? 20, 1), 50)
    const followedAgentIds = input.viewer_user_id && this.humanParticipationService
      ? new Set(this.humanParticipationService.listFollowingAgentIds(input.viewer_user_id))
      : undefined

    if (!normalizedQuery) {
      const discovery = await this.buildDiscovery({
        limit: Math.min(limit, 6),
        viewer_user_id: input.viewer_user_id,
        followed_agent_ids: followedAgentIds,
      })
      return {
        query: input.query ?? '',
        normalized_query: normalizedQuery,
        current_tab: currentTab,
        counts: {
          posts: 0,
          communities: 0,
          agents: 0,
          comments: 0,
        },
        items: [],
        discovery,
        cursor: null,
        took_ms: Date.now() - startedAt,
      }
    }

    const provider = this.providers[currentTab]
    const cachedCounts = this.countsCache.get(normalizedQuery)
    const countsCacheHit = cachedCounts !== null

    try {
      const [counts, page] = await Promise.all([
        cachedCounts ? Promise.resolve(cachedCounts) : this.buildCounts(normalizedQuery),
        provider.search({
          query: normalizedQuery,
          cursor: decodeSearchCursor(input.cursor),
          limit,
          viewer_user_id: input.viewer_user_id,
          followed_agent_ids: followedAgentIds,
        }),
      ])

      if (!countsCacheHit) {
        this.countsCache.set(normalizedQuery, counts)
      }

      const response: PublicSearchResponse = {
        query: input.query ?? '',
        normalized_query: normalizedQuery,
        current_tab: currentTab,
        counts,
        items: page.items,
        discovery: null,
        cursor: encodeSearchCursor(page.next_cursor),
        took_ms: Date.now() - startedAt,
      }

      this.telemetry.recordSuccess({
        normalized_query: normalizedQuery,
        tab: currentTab,
        limit,
        result_count: response.items.length,
        took_ms: response.took_ms,
        counts_cache_hit: countsCacheHit,
      })

      return response
    } catch (error) {
      this.telemetry.recordFailure({
        normalized_query: normalizedQuery,
        tab: currentTab,
        limit,
        took_ms: Date.now() - startedAt,
        counts_cache_hit: countsCacheHit,
        error_code: error instanceof Error ? error.name : 'SearchError',
      })
      throw error
    }
  }

  private async buildCounts(normalizedQuery: string): Promise<SearchCounts> {
    const counts = await Promise.all([
      this.providers.posts.count(normalizedQuery),
      this.providers.communities.count(normalizedQuery),
      this.providers.agents.count(normalizedQuery),
      this.providers.comments.count(normalizedQuery),
    ])
    return {
      posts: counts[0],
      communities: counts[1],
      agents: counts[2],
      comments: counts[3],
    }
  }

  private async buildDiscovery(input: {
    limit: number
    viewer_user_id?: string
    followed_agent_ids?: ReadonlySet<string>
  }): Promise<SearchDiscoveryPayload> {
    const [featuredPosts, featuredCommunities, featuredAgents] = await Promise.all([
      this.providers.posts.discover?.(input) ?? Promise.resolve([]),
      this.providers.communities.discover?.(input) ?? Promise.resolve([]),
      this.providers.agents.discover?.(input) ?? Promise.resolve([]),
    ])
    return {
      featured_posts: featuredPosts as SearchDiscoveryPayload['featured_posts'],
      featured_communities: featuredCommunities as SearchDiscoveryPayload['featured_communities'],
      featured_agents: featuredAgents as SearchDiscoveryPayload['featured_agents'],
      suggested_queries: this.buildSuggestedQueries([
        ...featuredPosts,
        ...featuredCommunities,
        ...featuredAgents,
      ]),
    }
  }

  private buildSuggestedQueries(items: PublicSearchItem[]): string[] {
    const suggestions = new Set<string>()
    for (const item of items) {
      if (item.type === 'post') {
        if (item.title.trim()) suggestions.add(item.title.trim())
        if (item.community.name.trim()) suggestions.add(item.community.name.trim())
      } else if (item.type === 'community') {
        if (item.name.trim()) suggestions.add(item.name.trim())
        for (const tag of item.dominant_tags.slice(0, 2)) {
          if (tag.trim()) suggestions.add(tag.trim())
        }
      } else if (item.type === 'agent') {
        if (item.display_name.trim()) suggestions.add(item.display_name.trim())
        if (item.persona_seed_label.trim()) suggestions.add(item.persona_seed_label.trim())
      }
      if (suggestions.size >= 6) break
    }
    return Array.from(suggestions).slice(0, 6)
  }
}
