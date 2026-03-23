import { describe, expect, it, vi } from 'vitest'
import type { PublicSearchItem } from '../../../../shared/public-search.js'
import { SearchCountsCache } from '../search-counts-cache.js'
import { SearchTelemetryService } from '../search-telemetry-service.js'
import { SearchService } from '../../search-service.js'
import type { SearchProvider } from '../search-provider.js'

function createProvider(
  tab: SearchProvider['tab'],
  items: PublicSearchItem[] = [],
): SearchProvider & { count: ReturnType<typeof vi.fn>; search: ReturnType<typeof vi.fn> } {
  return {
    tab,
    count: vi.fn().mockResolvedValue(2),
    search: vi.fn().mockResolvedValue({
      items,
      next_cursor: null,
    }),
  }
}

describe('SearchService', () => {
  it('caches counts by normalized query and passes followed agents to providers', async () => {
    let now = 1_000
    const countsCache = new SearchCountsCache({
      ttl_ms: 15_000,
      now: () => now,
    })
    const telemetry = new SearchTelemetryService()
    const postsProvider = createProvider('posts', [
      {
        type: 'post',
        id: 'post-1',
        href: '/posts/post-1',
        title: 'alpha',
        snippet: 'alpha snippet',
        match_reasons: ['命中标题'],
        community: { id: 'community-1', name: 'Community 1', slug: 'community-1' },
        author: { id: 'agent-1', display_name: 'Agent 1', avatar_url: null },
        comment_count: 3,
        heat_score: 42,
        last_activity_at: null,
      },
    ])
    const communitiesProvider = createProvider('communities')
    const agentsProvider = createProvider('agents')
    const commentsProvider = createProvider('comments')
    const humanParticipationService = {
      listFollowingAgentIds: vi.fn().mockReturnValue(['agent-1', 'agent-2']),
    }

    const service = new SearchService({
      postsProvider,
      communitiesProvider,
      agentsProvider,
      commentsProvider,
      humanParticipationService,
      countsCache,
      telemetry,
    })

    await service.search({
      query: '  alpha  ',
      tab: 'posts',
      viewer_user_id: 'user-1',
    })

    now += 1_000

    await service.search({
      query: 'alpha',
      tab: 'posts',
      viewer_user_id: 'user-1',
    })

    expect(postsProvider.count).toHaveBeenCalledTimes(1)
    expect(communitiesProvider.count).toHaveBeenCalledTimes(1)
    expect(agentsProvider.count).toHaveBeenCalledTimes(1)
    expect(commentsProvider.count).toHaveBeenCalledTimes(1)
    expect(postsProvider.search).toHaveBeenCalledTimes(2)
    expect(postsProvider.search.mock.calls[0]?.[0].followed_agent_ids?.has('agent-1')).toBe(true)
    expect(humanParticipationService.listFollowingAgentIds).toHaveBeenCalledTimes(2)

    const telemetrySnapshot = telemetry.snapshot()
    expect(telemetrySnapshot.recent[0]?.counts_cache_hit).toBe(true)
    expect(telemetrySnapshot.recent[1]?.counts_cache_hit).toBe(false)
  })

  it('records cache-hit state on failed searches', async () => {
    const countsCache = new SearchCountsCache()
    countsCache.set('alpha', {
      posts: 2,
      communities: 1,
      agents: 3,
      comments: 4,
    })
    const telemetry = new SearchTelemetryService()
    const failingPostsProvider = createProvider('posts')
    failingPostsProvider.search.mockRejectedValueOnce(new Error('provider failed'))
    const communitiesProvider = createProvider('communities')
    const agentsProvider = createProvider('agents')
    const commentsProvider = createProvider('comments')
    const service = new SearchService({
      postsProvider: failingPostsProvider,
      communitiesProvider,
      agentsProvider,
      commentsProvider,
      countsCache,
      telemetry,
    })

    await expect(service.search({
      query: 'alpha',
      tab: 'posts',
    })).rejects.toThrow('provider failed')

    expect(telemetry.snapshot().recent[0]).toMatchObject({
      status: 'error',
      counts_cache_hit: true,
      tab: 'posts',
    })
  })
})
