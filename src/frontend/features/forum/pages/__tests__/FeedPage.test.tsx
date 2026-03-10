import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { useInfiniteQuery } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FeedPage } from '../FeedPage'
import { useGlobalHighlights, useGuidanceClientEvent, useGuidanceSummary, useHealth } from '@/api/hooks'
import { useSseNewCounts } from '@/api/use-sse'
import { useAuth } from '@/shared/hooks/use-auth'
import { useFeedViewStore } from '@/shared/stores/feed-view-store'
import type { GuidanceSummaryData } from '@/api/types'

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query')
  return {
    ...actual,
    useInfiniteQuery: vi.fn(),
  }
})

vi.mock('@/api/hooks', () => ({
  useGlobalHighlights: vi.fn(),
  useGuidanceClientEvent: vi.fn(),
  useGuidanceSummary: vi.fn(),
  useHealth: vi.fn(),
}))

vi.mock('@/api/use-sse', () => ({
  useSseNewCounts: vi.fn(),
}))

vi.mock('@/shared/hooks/use-auth', () => ({
  useAuth: vi.fn(),
}))

vi.mock('@/shared/stores/feed-view-store', () => ({
  useFeedViewStore: vi.fn(),
}))

vi.mock('../../components/PostCard', () => ({
  PostCard: () => <div data-testid="post-card" />,
}))

vi.mock('../../components/PostCompact', () => ({
  PostCompact: () => <div data-testid="post-compact" />,
}))

vi.mock('../../components/FeedToolbar', () => ({
  FeedToolbar: ({ followingOnly }: { followingOnly?: boolean }) => (
    <div data-testid="feed-toolbar">{followingOnly ? 'following' : 'all'}</div>
  ),
}))

vi.mock('../../components/NewContentBanner', () => ({
  NewContentBanner: () => <div data-testid="new-content-banner" />,
}))

vi.mock('@/shared/components/LoadMore', () => ({
  LoadMore: () => <div data-testid="load-more" />,
}))

vi.mock('@/features/guidance/components/GuidanceItemCard', () => ({
  GuidanceItemCard: () => <div data-testid="guidance-item-card" />,
}))

const useInfiniteQueryMock = vi.mocked(useInfiniteQuery)
const useGlobalHighlightsMock = vi.mocked(useGlobalHighlights)
const useGuidanceClientEventMock = vi.mocked(useGuidanceClientEvent)
const useGuidanceSummaryMock = vi.mocked(useGuidanceSummary)
const useHealthMock = vi.mocked(useHealth)
const useSseNewCountsMock = vi.mocked(useSseNewCounts)
const useAuthMock = vi.mocked(useAuth)
const useFeedViewStoreMock = vi.mocked(useFeedViewStore)

function buildSummary(): { data: { data: GuidanceSummaryData } } {
  return {
    data: {
      data: {
        actor: {
          actor_type: 'VISITOR',
          actor_id: 'visitor-1',
          current_track: 'UNDECIDED',
          stage: 'NEW_VISITOR',
          explained: { two_tracks: false },
          completed: {
            followed_first_agent: false,
            used_following_feed: false,
            created_agent: false,
            started_private_chat: false,
            nurture_receipt_ready: false,
            watch_public_effect: false,
          },
          first_success: {
            achieved: false,
            at: null,
          },
          reveal: {
            style: false,
            instructions: false,
            advanced: false,
          },
          latest_owner_agent_id: null,
          latest_receipt_session_id: null,
        },
        modules: [
          {
            type: 'DUAL_ENTRY',
            reason_code: 'HOME_DUAL_ENTRY',
            hero_body: 'hero body',
            cards: [
              {
                track: 'SPECTATOR',
                title: '看剧情',
                promise: 'promise',
                entry_cta: {
                  label: '看今日高光',
                  target: '/highlights',
                  event_name: 'DUAL_ENTRY_CTA_CLICKED',
                  payload: { track: 'SPECTATOR' },
                },
                return_hook: 'return hook',
              },
            ],
          },
        ],
      },
    },
  }
}

function renderPage(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <FeedPage />
    </MemoryRouter>,
  )
}

describe('FeedPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    useInfiniteQueryMock.mockReturnValue({
      data: {
        pages: [
          {
            data: [],
            meta: { cursor: null },
          },
        ],
      },
      isLoading: false,
      error: null,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    } as never)

    useGlobalHighlightsMock.mockReturnValue({
      data: {
        data: {
          hot_threads: [],
          meta: {
            generated_at: '2026-03-10T00:00:00.000Z',
          },
        },
      },
    } as never)

    useHealthMock.mockReturnValue({ error: null } as never)
    useSseNewCountsMock.mockReturnValue({
      newPostCount: 0,
      clearNewPosts: vi.fn(),
    } as never)
    useAuthMock.mockReturnValue({ isAuthenticated: true } as never)
    useFeedViewStoreMock.mockReturnValue({ view: 'card' } as never)
  })

  it('reads following_only from the URL when rendering the home feed', () => {
    useGuidanceSummaryMock.mockImplementation(() => buildSummary() as never)
    useGuidanceClientEventMock.mockReturnValue({ mutate: vi.fn() } as never)

    renderPage('/?following_only=true')

    expect(screen.getByTestId('feed-toolbar').textContent).toBe('following')
  })

  it('tracks the dual-entry module only once per actor even when summary objects are refreshed', async () => {
    const mutate = vi.fn()
    useGuidanceSummaryMock.mockImplementation(() => buildSummary() as never)
    useGuidanceClientEventMock.mockReturnValue({ mutate } as never)

    const view = renderPage('/')

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledTimes(1)
    })

    view.rerender(
      <MemoryRouter initialEntries={['/']}>
        <FeedPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledTimes(1)
    })
  })
})
