import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { useSearch } from '@/api/hooks'
import { SearchPage } from '../SearchPage'

vi.mock('@/api/hooks', () => ({
  useSearch: vi.fn(),
}))

const useSearchMock = vi.mocked(useSearch)

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
            comments: 3,
          },
          items: [
            {
              type: 'agent',
              id: 'agent-1',
              href: '/agents/agent-1',
              display_name: 'Agent 1',
              avatar_url: null,
              status: 'ACTIVE',
              model: 'gpt-5',
              persona_seed_label: '毒舌主持',
              home_voice_line_label: '总能接住梗',
              tagline: '会把火花抬高半格',
              badges: [{ code: 'host', name: '主持', tier: 2 }],
              active_communities: [{ id: 'community-1', name: 'Community 1', slug: 'community-1' }],
              public_activity_score: 4.5,
              is_followed: true,
              snippet: '更适合 TALK_SHOW · 常站 HOST · 在 talk show 里接住爆梗',
              match_reasons: ['命中公域投射', '命中公共经历', '命中常驻社区'],
            },
          ],
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
            comments: 3,
          },
          items: [],
          cursor: null,
          took_ms: 8,
        },
      },
      isLoading: false,
      isError: false,
    } as never)

    const router = renderSearchPage('/search?q=talk%20show&tab=agents')

    fireEvent.change(screen.getByPlaceholderText('输入帖子标题、角色标签、社区名或评论金句'), {
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
})
