import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { useInfiniteQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FeedPage } from '../FeedPage'
import { useHealth } from '@/api/hooks'
import { useSseNewCounts } from '@/api/use-sse'
import { useAuth } from '@/shared/hooks/use-auth'
import { useFeedViewStore } from '@/shared/stores/feed-view-store'

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query')
  return {
    ...actual,
    useInfiniteQuery: vi.fn(),
  }
})

vi.mock('@/api/hooks', () => ({
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
    followingOnly,
    showSortControls,
    showViewControls,
    className,
    trailingContent,
  }: {
    followingOnly?: boolean
    showSortControls?: boolean
    showViewControls?: boolean
    className?: string
    trailingContent?: ReactNode
  }) => (
    <div
      data-testid="feed-toolbar"
      data-sort-controls={showSortControls ? 'true' : 'false'}
      data-view-controls={showViewControls ? 'true' : 'false'}
      data-class-name={className ?? ''}
    >
      {followingOnly ? 'following' : 'all'}
      {trailingContent}
    </div>
  ),
}))

vi.mock('../../components/NewContentBanner', () => ({
  NewContentBanner: () => <div data-testid="new-content-banner" />,
}))

vi.mock('@/shared/components/LoadMore', () => ({
  LoadMore: () => <div data-testid="load-more" />,
}))

const useInfiniteQueryMock = vi.mocked(useInfiniteQuery)
const useHealthMock = vi.mocked(useHealth)
const useSseNewCountsMock = vi.mocked(useSseNewCounts)
const useAuthMock = vi.mocked(useAuth)
const useFeedViewStoreMock = vi.mocked(useFeedViewStore)

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

    useHealthMock.mockReturnValue({ error: null } as never)
    useSseNewCountsMock.mockReturnValue({
      newPostCount: 0,
      clearNewPosts: vi.fn(),
    } as never)
    useAuthMock.mockReturnValue({ isAuthenticated: true } as never)
    useFeedViewStoreMock.mockReturnValue({ view: 'card' } as never)
  })

  it('renders feed toolbar with sort controls for authenticated users', () => {
    renderPage('/')

    const toolbars = screen.getAllByTestId('feed-toolbar')
    expect(toolbars).toHaveLength(1)
    expect(toolbars[0].getAttribute('data-sort-controls')).toBe('true')
    expect(toolbars[0].getAttribute('data-view-controls')).toBe('true')
    expect(screen.getByRole('link', { name: '推荐' }).getAttribute('href')).toBe('/recommended')
    expect(screen.getByTestId('page-right-rail')).toBeTruthy()
  })

  it('keeps sort controls visible for unauthenticated users', () => {
    useAuthMock.mockReturnValue({ isAuthenticated: false } as never)

    renderPage('/')

    const toolbar = screen.getByTestId('feed-toolbar')
    expect(toolbar.getAttribute('data-sort-controls')).toBe('true')
    expect(toolbar.getAttribute('data-view-controls')).toBe('true')
  })
})
