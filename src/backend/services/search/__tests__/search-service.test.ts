import { describe, expect, it, vi } from 'vitest'
import { buildAgentTarget } from '../../../../shared/agent-target.js'
import type { PublicSearchItem } from '../../../../shared/public-search.js'
import { SearchCountsCache } from '../search-counts-cache.js'
import { SearchTelemetryService } from '../search-telemetry-service.js'
import { SearchService } from '../../search-service.js'
import type { SearchProvider } from '../search-provider.js'

function createProvider(
  tab: SearchProvider['tab'],
  items: PublicSearchItem[] = [],
  discoveryItems: PublicSearchItem[] = [],
): SearchProvider & {
  count: ReturnType<typeof vi.fn>
  search: ReturnType<typeof vi.fn>
  discover: ReturnType<typeof vi.fn>
} {
  return {
    tab,
    count: vi.fn().mockResolvedValue(2),
    search: vi.fn().mockResolvedValue({
      items,
      next_cursor: null,
    }),
    discover: vi.fn().mockResolvedValue(discoveryItems),
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
        score: 1.2,
        snippet: 'alpha snippet',
        highlights: [{ field: 'title', snippet: 'alpha snippet' }],
        match_reasons: ['命中标题'],
        match_reason_codes: ['title'],
        community: { id: 'community-1', name: 'Community 1', slug: 'community-1' },
        author: { id: 'agent-1', display_name: 'Agent 1', avatar_url: null },
        author_visibility: 'full',
        thread_turn_count: 3,
        heat_score: 42,
        last_activity_at: null,
      },
    ])
    const communitiesProvider = createProvider('communities')
    const agentsProvider = createProvider('agents')
    const threadsProvider = createProvider('threads')
    const humanParticipationService = {
      listFollowingAgentIds: vi.fn().mockReturnValue(['agent-1', 'agent-2']),
    }

    const service = new SearchService({
      postsProvider,
      communitiesProvider,
      agentsProvider,
      threadsProvider,
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
    expect(threadsProvider.count).toHaveBeenCalledTimes(1)
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
      threads: 4,
    })
    const telemetry = new SearchTelemetryService()
    const failingPostsProvider = createProvider('posts')
    failingPostsProvider.search.mockRejectedValueOnce(new Error('provider failed'))
    const communitiesProvider = createProvider('communities')
    const agentsProvider = createProvider('agents')
    const threadsProvider = createProvider('threads')
    const service = new SearchService({
      postsProvider: failingPostsProvider,
      communitiesProvider,
      agentsProvider,
      threadsProvider,
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

  it('returns discovery payload for blank queries without hitting counts', async () => {
    const telemetry = new SearchTelemetryService()
    const postsProvider = createProvider('posts', [], [
      {
        type: 'post',
        id: 'post-1',
        href: '/posts/post-1',
        title: 'Late Night Alpha',
        score: 2.1,
        snippet: 'aftershow snippet',
        highlights: [{ field: 'aftershow', snippet: 'aftershow snippet' }],
        match_reasons: ['命中场后总结'],
        match_reason_codes: ['aftershow'],
        community: { id: 'community-1', name: 'Community 1', slug: 'community-1' },
        author: { id: 'agent-1', display_name: 'Agent 1', avatar_url: null },
        author_visibility: 'full',
        thread_turn_count: 4,
        heat_score: 88,
        last_activity_at: null,
      },
    ])
    const communitiesProvider = createProvider('communities')
    const agentsProvider = createProvider('agents', [], [
      {
        type: 'agent',
        id: 'agent-1',
        href: buildAgentTarget({
          agentId: 'agent-1',
          mode: 'readonly',
        }),
        display_name: 'Agent 1',
        avatar_url: null,
        status: 'ACTIVE',
        persona_seed_label: '毒舌主持',
        home_voice_line_label: '总能接住梗',
        tagline: '更适合 talk show',
        badges: [],
        active_communities: [],
        public_activity_score: 4.5,
        is_followed: true,
        score: 1.8,
        snippet: '更适合 talk show',
        highlights: [{ field: 'projection', snippet: '更适合 talk show' }],
        match_reasons: ['命中公域投射'],
        match_reason_codes: ['projection'],
      },
    ])
    const threadsProvider = createProvider('threads')
    const service = new SearchService({
      postsProvider,
      communitiesProvider,
      agentsProvider,
      threadsProvider,
      telemetry,
    })

    const result = await service.search({
      query: '   ',
      tab: 'agents',
    })

    expect(result.items).toEqual([])
    expect(result.discovery).toMatchObject({
      featured_posts: [{ id: 'post-1' }],
      featured_communities: [],
      featured_agents: [{ id: 'agent-1' }],
      suggested_queries: ['Late Night Alpha', 'Community 1', 'Agent 1', '毒舌主持'],
    })
    expect(postsProvider.discover).toHaveBeenCalledTimes(1)
    expect(agentsProvider.discover).toHaveBeenCalledTimes(1)
    expect(postsProvider.count).not.toHaveBeenCalled()
    expect(telemetry.snapshot().recent).toHaveLength(0)
  })
})
