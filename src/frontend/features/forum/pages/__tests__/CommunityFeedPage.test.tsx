import { render, screen } from '@testing-library/react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CommunityFeedPage } from '../CommunityFeedPage'
import { useCommunityBySlug } from '@/api/hooks'
import {
  useFollowCommunity,
  useFollowingCommunitiesList,
  useMyAgents,
  useUnfollowCommunity,
} from '@/api/hooks/user'
import { useSseNewCounts } from '@/api/use-sse'
import { useAuth } from '@/shared/hooks/use-auth'
import { useFeedViewStore } from '@/shared/stores/feed-view-store'

vi.mock('@tanstack/react-query', () => ({
  useInfiniteQuery: vi.fn(),
}))

vi.mock('@/api/hooks', () => ({
  useCommunityBySlug: vi.fn(),
}))

vi.mock('@/api/hooks/user', () => ({
  useMyAgents: vi.fn(),
  useFollowingCommunitiesList: vi.fn(),
  useFollowCommunity: vi.fn(),
  useUnfollowCommunity: vi.fn(),
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

vi.mock('@/widgets/shell/ShellRightRail', () => ({
  ShellRightRail: () => <div data-testid="page-right-rail" />,
}))

vi.mock('../../components/PostCard', () => ({
  PostCard: () => <div data-testid="post-card" />,
}))

vi.mock('../../components/PostCompact', () => ({
  PostCompact: () => <div data-testid="post-compact" />,
}))

vi.mock('../../components/FeedToolbar', () => ({
  FeedToolbar: ({
    showSortControls,
    showViewControls,
  }: {
    showSortControls?: boolean
    showViewControls?: boolean
  }) => (
    <div
      data-testid="feed-toolbar"
      data-sort-controls={showSortControls ? 'true' : 'false'}
      data-view-controls={showViewControls ? 'true' : 'false'}
    />
  ),
}))

vi.mock('../../components/NewContentBanner', () => ({
  NewContentBanner: () => <div data-testid="new-content-banner" />,
}))

vi.mock('@/shared/components/LoadMore', () => ({
  LoadMore: () => <div data-testid="load-more" />,
}))

const useInfiniteQueryMock = vi.mocked(useInfiniteQuery)
const useCommunityBySlugMock = vi.mocked(useCommunityBySlug)
const useMyAgentsMock = vi.mocked(useMyAgents)
const useFollowingCommunitiesListMock = vi.mocked(useFollowingCommunitiesList)
const useFollowCommunityMock = vi.mocked(useFollowCommunity)
const useUnfollowCommunityMock = vi.mocked(useUnfollowCommunity)
const useSseNewCountsMock = vi.mocked(useSseNewCounts)
const useAuthMock = vi.mocked(useAuth)
const useFeedViewStoreMock = vi.mocked(useFeedViewStore)

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/c/night-show']}>
      <Routes>
        <Route path="/c/:slug" element={<CommunityFeedPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('CommunityFeedPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    useAuthMock.mockReturnValue({ isAuthenticated: true } as never)
    useMyAgentsMock.mockReturnValue({ data: { data: [] } } as never)
    useFollowingCommunitiesListMock.mockReturnValue({
      data: { data: [] },
      isLoading: false,
    } as never)
    useFollowCommunityMock.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as never)
    useUnfollowCommunityMock.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as never)
    useFeedViewStoreMock.mockReturnValue({ view: 'card' } as never)
    useSseNewCountsMock.mockReturnValue({
      newPostCount: 0,
      clearNewPosts: vi.fn(),
    } as never)
    useInfiniteQueryMock.mockReturnValue({
      data: {
        pages: [{ data: [], meta: { cursor: null } }],
      },
      isLoading: false,
      error: null,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    } as never)
  })

  it('renders community hot-topic banner from rules_json', () => {
    useCommunityBySlugMock.mockReturnValue({
      data: {
        id: 'community-1',
        name: 'Night Show',
        slug: 'night-show',
        description: 'Agent talk show',
        rules_json: {
          hot_topic_policy_v1: {
            mode: 'MANUAL_REVIEW_ONLY',
            allowed_domains: ['ENTERTAINMENT', 'SPORTS'],
            scene_modes: {},
            user_copy: {
              community_banner: '热点内容会先做灰度复核。',
            },
          },
        },
        visibility_default: 'PUBLIC',
        created_at: '2026-03-10T10:00:00.000Z',
        updated_at: '2026-03-10T10:00:00.000Z',
      },
      isLoading: false,
    } as never)

    renderPage()

    expect(screen.getByTestId('community-hero-banner')).toBeTruthy()
    expect(screen.getByAltText('Community Banner').getAttribute('src')).toMatch(/^\/community-banners\/.+\.webp$/)
    expect(screen.getAllByText('Night Show').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: '订阅社区' })).toBeTruthy()
    const inviteButton = screen.getByRole('button', { name: '邀请智能体，让我的智能体加入社区' })
    expect(screen.queryByRole('button', { name: /关注/ })).toBeNull()
    expect(inviteButton).toBeTruthy()
    expect(screen.getByRole('button', { name: '社区更多操作' })).toBeTruthy()
    expect(screen.queryByText('c/night-show')).toBeNull()
    expect(screen.queryByText('Agent talk show')).toBeNull()
    expect(screen.queryByText('公开')).toBeNull()
    expect(screen.getByText('热点模式 · 灰度复核')).toBeTruthy()
    expect(screen.getByText('允许 · 娱乐')).toBeTruthy()
    expect(screen.getByText('允许 · 体育')).toBeTruthy()
    expect(screen.getByText(/本社区允许围观的热点域：娱乐、体育/)).toBeTruthy()
    expect(screen.getByText('热点内容会先做灰度复核。')).toBeTruthy()
    expect(screen.getByRole('link', { name: '查看热点治理规则与推荐说明' }).getAttribute('href')).toBe('/help/hot-topic-rules')
  })

  it('scrolls to the top when entering a community page', () => {
    useCommunityBySlugMock.mockReturnValue({
      data: {
        id: 'community-1',
        name: 'Night Show',
        slug: 'night-show',
        description: 'Agent talk show',
        rules_json: null,
        visibility_default: 'PUBLIC',
        created_at: '2026-03-10T10:00:00.000Z',
        updated_at: '2026-03-10T10:00:00.000Z',
      },
      isLoading: false,
    } as never)

    renderPage()

    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'auto' })
  })

  it('shows subscribed state when the community is already followed', () => {
    useFollowingCommunitiesListMock.mockReturnValue({
      data: {
        data: [{ id: 'community-1', name: 'Night Show', slug: 'night-show' }],
      },
      isLoading: false,
    } as never)
    useCommunityBySlugMock.mockReturnValue({
      data: {
        id: 'community-1',
        name: 'Night Show',
        slug: 'night-show',
        description: 'Agent talk show',
        rules_json: null,
        visibility_default: 'PUBLIC',
        created_at: '2026-03-10T10:00:00.000Z',
        updated_at: '2026-03-10T10:00:00.000Z',
      },
      isLoading: false,
    } as never)

    renderPage()

    expect(screen.getByRole('button', { name: '已订阅' })).toBeTruthy()
  })

  it('renders only the mobile feed toolbar for authenticated users', () => {
    useCommunityBySlugMock.mockReturnValue({
      data: {
        id: 'community-1',
        name: 'Night Show',
        slug: 'night-show',
        description: 'Agent talk show',
        rules_json: null,
        visibility_default: 'PUBLIC',
        created_at: '2026-03-10T10:00:00.000Z',
        updated_at: '2026-03-10T10:00:00.000Z',
      },
      isLoading: false,
    } as never)

    renderPage()

    expect(screen.getByTestId('community-hero-banner')).toBeTruthy()
    const toolbars = screen.getAllByTestId('feed-toolbar')
    expect(toolbars).toHaveLength(1)
    expect(toolbars[0]?.getAttribute('data-sort-controls')).toBe('true')
    expect(toolbars[0]?.getAttribute('data-view-controls')).toBe('true')
    expect(screen.getByTestId('page-right-rail')).toBeTruthy()
  })

  it('keeps sort controls visible for unauthenticated visitors', () => {
    useAuthMock.mockReturnValue({ isAuthenticated: false } as never)
    useCommunityBySlugMock.mockReturnValue({
      data: {
        id: 'community-1',
        name: 'Night Show',
        slug: 'night-show',
        description: 'Agent talk show',
        rules_json: null,
        visibility_default: 'PUBLIC',
        created_at: '2026-03-10T10:00:00.000Z',
        updated_at: '2026-03-10T10:00:00.000Z',
      },
      isLoading: false,
    } as never)

    renderPage()

    const toolbar = screen.getByTestId('feed-toolbar')
    expect(toolbar.getAttribute('data-sort-controls')).toBe('true')
    expect(toolbar.getAttribute('data-view-controls')).toBe('true')
  })

  it('keeps community appearance controls read-only in the header menu', () => {
    useCommunityBySlugMock.mockReturnValue({
      data: {
        id: 'community-1',
        name: 'Night Show',
        slug: 'night-show',
        description: 'Agent talk show',
        rules_json: null,
        visibility_default: 'PUBLIC',
        created_at: '2026-03-10T10:00:00.000Z',
        updated_at: '2026-03-10T10:00:00.000Z',
      },
      isLoading: false,
    } as never)

    renderPage()

    expect(screen.queryByRole('button', { name: '自定义社区头像' })).toBeNull()
    expect(screen.queryByRole('button', { name: '自定义社区背景' })).toBeNull()
    expect(screen.getByRole('button', { name: '社区更多操作' })).toBeTruthy()
  })
})
