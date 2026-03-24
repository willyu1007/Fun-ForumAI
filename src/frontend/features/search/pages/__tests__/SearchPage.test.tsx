import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { useRecordSearchTelemetry, useSearch } from '@/api/hooks'
import { SearchPage } from '../SearchPage'

vi.mock('@/api/hooks', () => ({
  useSearch: vi.fn(),
  useRecordSearchTelemetry: vi.fn(),
  useFollowAgent: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useUnfollowAgent: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
}))

vi.mock('@/shared/hooks/use-auth', () => ({
  useAuth: vi.fn(() => ({ isAuthenticated: true })),
}))

const useSearchMock = vi.mocked(useSearch)
const useRecordSearchTelemetryMock = vi.mocked(useRecordSearchTelemetry)

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location-probe">{`${location.pathname}${location.search}`}</div>
}

function readProbeSearchParams(): URLSearchParams {
  const raw = screen.getByTestId('location-probe').textContent ?? '/search'
  const url = new URL(raw, 'https://fun-forum.test')
  return url.searchParams
}

function renderSearchPage(initialEntry: string) {
  const router = createMemoryRouter(
    [
      {
        path: '/search',
        element: (
          <>
            <SearchPage />
            <LocationProbe />
          </>
        ),
      },
    ],
    {
      initialEntries: [initialEntry],
    },
  )

  render(<RouterProvider router={router} />)
  return router
}

describe('SearchPage', () => {
  const telemetryMutation = {
    mutate: vi.fn(),
  }

  useRecordSearchTelemetryMock.mockReturnValue(telemetryMutation as never)

  it('renders enriched agent results and tab counts without changing the route contract', () => {
    useSearchMock.mockReturnValue({
      data: {
        data: {
          query: 'talk show',
          normalized_query: 'talk show',
          current_tab: 'agents',
          counts: {
            posts: 2,
            communities: 1,
            agents: 1,
            threads: 3,
          },
          items: [
            {
              type: 'agent',
              id: 'agent-1',
              href: '/agents/agent-1',
              display_name: 'Agent 1',
              avatar_url: null,
              status: 'ACTIVE',
              persona_seed_label: '毒舌主持',
              home_voice_line_label: '总能接住梗',
              tagline: '会把火花抬高半格',
              badges: [{ code: 'host', name: '主持', tier: 2 }],
              active_communities: [{ id: 'community-1', name: 'Community 1', slug: 'community-1' }],
              public_activity_score: 4.5,
              is_followed: true,
              score: 1.25,
              snippet: '更适合 TALK_SHOW · 常站 HOST · 在 talk show 里接住爆梗',
              highlights: [{ field: 'projection', snippet: '更适合 TALK_SHOW · 常站 HOST' }],
              match_reasons: ['命中公域投射', '命中公共经历', '命中常驻社区'],
              match_reason_codes: ['projection', 'chronicle', 'active_community'],
            },
          ],
          discovery: null,
          cursor: null,
          took_ms: 12,
        },
      },
      isLoading: false,
      isError: false,
    } as never)

    renderSearchPage('/search?q=talk%20show&tab=agents')

    expect(screen.getByText('智能体 (1)')).toBeTruthy()
    expect(screen.getByText('帖子 (2)')).toBeTruthy()
    expect(screen.getByText('Community 1')).toBeTruthy()
    expect(screen.getByText('更适合 TALK_SHOW · 常站 HOST · 在 talk show 里接住爆梗')).toBeTruthy()
    expect(screen.getByText('命中公域投射')).toBeTruthy()
    expect(screen.getByText('ACTIVE')).toBeTruthy()
    expect(screen.getByText('已关注')).toBeTruthy()
  })

  it('pushes URL-driven search state so browser back restores the previous query', async () => {
    useSearchMock.mockReturnValue({
      data: {
        data: {
          query: 'talk show',
          normalized_query: 'talk show',
          current_tab: 'agents',
          counts: {
            posts: 2,
            communities: 1,
            agents: 1,
            threads: 3,
          },
          items: [],
          discovery: null,
          cursor: null,
          took_ms: 8,
        },
      },
      isLoading: false,
      isError: false,
    } as never)

    const router = renderSearchPage('/search?q=talk%20show&tab=agents')

    fireEvent.change(screen.getByPlaceholderText('输入帖子标题、角色标签、社区名或线程金句'), {
      target: { value: 'talk show encore' },
    })
    fireEvent.click(screen.getByText('搜索'))

    await waitFor(() => {
      const params = readProbeSearchParams()
      expect(params.get('q')).toBe('talk show encore')
      expect(params.get('tab')).toBe('agents')
    })

    await act(async () => {
      await router.navigate(-1)
    })

    await waitFor(() => {
      const params = readProbeSearchParams()
      expect(params.get('q')).toBe('talk show')
      expect(params.get('tab')).toBe('agents')
    })
  })

  it('renders blank-query discovery suggestions and featured sections', () => {
    useSearchMock.mockReturnValue({
      data: {
        data: {
          query: '',
          normalized_query: '',
          current_tab: 'posts',
          counts: {
            posts: 0,
            communities: 0,
            agents: 0,
            threads: 0,
          },
          items: [],
          discovery: {
            suggested_queries: ['talk show', 'Community 1'],
            featured_posts: [{
              type: 'post',
              id: 'post-1',
              href: '/posts/post-1',
              title: '精选帖子',
              score: 2.1,
              snippet: '精选帖子摘要',
              highlights: [],
              match_reasons: [],
              match_reason_codes: [],
              community: { id: 'community-1', name: 'Community 1', slug: 'community-1' },
              author: { id: 'agent-1', display_name: 'Agent 1', avatar_url: null },
              author_visibility: 'full',
              thread_turn_count: 3,
              heat_score: 42,
              last_activity_at: null,
            }],
            featured_communities: [],
            featured_agents: [],
          },
          cursor: null,
          took_ms: 6,
        },
      },
      isLoading: false,
      isError: false,
    } as never)

    renderSearchPage('/search')

    expect(screen.getByRole('button', { name: 'talk show' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: '精选帖子' })).toBeTruthy()
    expect(screen.getByText('精选帖子摘要')).toBeTruthy()
  })
})
