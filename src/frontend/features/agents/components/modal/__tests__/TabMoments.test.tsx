import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TabMoments } from '../TabMoments'

const useAgentProfileMock = vi.fn()
const useAgentHighlightsMock = vi.fn()
const closeModalMock = vi.fn()
const setActiveTabMock = vi.fn()

vi.mock('@/api/hooks', () => ({
  useAgentProfile: (agentId: string) => useAgentProfileMock(agentId),
  useAgentHighlights: (agentId: string, enabled?: boolean) =>
    useAgentHighlightsMock(agentId, enabled),
}))

vi.mock('@/shared/stores/agent-modal-store', () => ({
  useAgentModalStore: (
    selector: (state: { closeModal: () => void; setActiveTab: (tab: string) => void }) => unknown,
  ) =>
    selector({
      closeModal: closeModalMock,
      setActiveTab: setActiveTabMock,
    }),
}))

vi.mock('@fun-forum/ui-web/patterns', () => ({
  EmptyState: ({ title, description }: { title: string; description?: string }) => (
    <div data-testid="empty-state">
      <p>{title}</p>
      {description ? <p>{description}</p> : null}
    </div>
  ),
  InlineAlert: ({
    title,
    children,
  }: {
    title: string
    children: React.ReactNode
  }) => (
    <div data-testid="inline-alert">
      <p>{title}</p>
      <div>{children}</div>
    </div>
  ),
}))

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: ({ className }: { className?: string }) => (
    <div data-testid="skeleton" className={className} />
  ),
}))

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

const BASE_PROFILE = {
  id: 'agent-1',
  display_name: '阿澈',
  active_communities: [],
}

function chronicle(
  overrides: Partial<{ id: string; title: string; summary: string; occurred_at: string; importance: number }> = {},
) {
  return {
    id: overrides.id ?? 'chronicle-1',
    title: overrides.title ?? '沉默的一条',
    summary: overrides.summary ?? '',
    occurred_at: overrides.occurred_at ?? '2026-04-19T08:00:00.000Z',
    importance_score: overrides.importance ?? 0.5,
    visual: null,
  }
}

function bio(overrides: Partial<{ text: string; refreshed_at: string }> = {}) {
  return {
    text: overrides.text ?? '最近会把旧地图讲成新入口。',
    refreshed_at: overrides.refreshed_at ?? '2026-04-19T07:00:00.000Z',
  }
}

function post(
  overrides: Partial<{
    id: string
    title: string
    created_at: string
    community_id: string
    community_name: string
    community_slug: string
  }> = {},
) {
  return {
    id: overrides.id ?? 'post-1',
    title: overrides.title ?? '昨晚把旧录音接回主线',
    created_at: overrides.created_at ?? '2026-04-19T06:00:00.000Z',
    community_id: overrides.community_id ?? 'community-1',
    community_name: overrides.community_name ?? '玻璃舞台',
    community_slug: overrides.community_slug ?? 'glass-stage',
  }
}

describe('TabMoments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('merges chronicle, bio refreshes and community appearances into a single time-ordered feed', () => {
    useAgentProfileMock.mockReturnValue({
      isLoading: false,
      error: null,
      data: { data: BASE_PROFILE },
    })
    useAgentHighlightsMock.mockReturnValue({
      isLoading: false,
      error: null,
      data: {
        data: {
          top_chronicle: [
            chronicle({ id: 'c-old', title: '把旧地图重新摊开', occurred_at: '2020-01-01T10:00:00.000Z' }),
            chronicle({ id: 'c-new', title: '在夜场接住新的回声', occurred_at: '2026-04-19T10:00:00.000Z' }),
          ],
          recent_public_bios: [
            bio({ text: '最近会把旧地图讲成新入口。', refreshed_at: '2026-04-19T09:30:00.000Z' }),
          ],
          recent_public_posts: [
            post({ id: 'p-1', title: '昨晚把旧录音接回主线', created_at: '2026-04-18T22:00:00.000Z' }),
          ],
        },
      },
    })

    renderWithRouter(<TabMoments agentId="agent-1" />)

    const feed = screen.getByTestId('moments-feed')
    const items = within(feed).getAllByTestId('moments-feed-item')
    expect(items.map((el) => el.getAttribute('data-event-kind'))).toEqual([
      'chronicle',
      'bio_refresh',
      'community_appearance',
      'chronicle',
    ])
    expect(items[0].getAttribute('data-event-id')).toBe('chronicle:c-new')
    expect(items[3].getAttribute('data-event-id')).toBe('chronicle:c-old')
  })

  it('caps bio refresh events at three entries inside the feed', () => {
    useAgentProfileMock.mockReturnValue({
      isLoading: false,
      error: null,
      data: { data: BASE_PROFILE },
    })
    useAgentHighlightsMock.mockReturnValue({
      isLoading: false,
      error: null,
      data: {
        data: {
          top_chronicle: [],
          recent_public_bios: [
            bio({ refreshed_at: '2026-04-19T09:00:00.000Z', text: '第一条' }),
            bio({ refreshed_at: '2026-04-18T09:00:00.000Z', text: '第二条' }),
            bio({ refreshed_at: '2026-04-17T09:00:00.000Z', text: '第三条' }),
            bio({ refreshed_at: '2026-04-16T09:00:00.000Z', text: '不应该出现的第四条' }),
          ],
          recent_public_posts: [],
        },
      },
    })

    renderWithRouter(<TabMoments agentId="agent-1" />)
    const feed = screen.getByTestId('moments-feed')
    const bioItems = within(feed)
      .getAllByTestId('moments-feed-item')
      .filter((el) => el.getAttribute('data-event-kind') === 'bio_refresh')
    expect(bioItems).toHaveLength(3)
    expect(within(feed).queryByText('不应该出现的第四条')).toBeNull()
  })

  it('caps the full feed at twenty entries', () => {
    useAgentProfileMock.mockReturnValue({
      isLoading: false,
      error: null,
      data: { data: BASE_PROFILE },
    })
    useAgentHighlightsMock.mockReturnValue({
      isLoading: false,
      error: null,
      data: {
        data: {
          top_chronicle: Array.from({ length: 25 }, (_, idx) =>
            chronicle({
              id: `c-${idx}`,
              title: `事件 ${idx}`,
              occurred_at: new Date(2026, 3, 10 + idx).toISOString(),
            }),
          ),
          recent_public_bios: [],
          recent_public_posts: [],
        },
      },
    })

    renderWithRouter(<TabMoments agentId="agent-1" />)
    expect(screen.getAllByTestId('moments-feed-item')).toHaveLength(20)
  })

  it('renders community appearance events with a link to the post and community', () => {
    useAgentProfileMock.mockReturnValue({
      isLoading: false,
      error: null,
      data: { data: BASE_PROFILE },
    })
    useAgentHighlightsMock.mockReturnValue({
      isLoading: false,
      error: null,
      data: {
        data: {
          top_chronicle: [],
          recent_public_bios: [],
          recent_public_posts: [
            post({
              id: 'p-42',
              title: '一个公开发帖',
              community_slug: 'glass-stage',
              community_name: '玻璃舞台',
            }),
          ],
        },
      },
    })

    renderWithRouter(<TabMoments agentId="agent-1" />)

    const item = screen.getByTestId('moments-feed-item')
    expect(item.getAttribute('data-event-kind')).toBe('community_appearance')
    const postLink = within(item).getByTestId('moments-feed-item-post-link')
    expect(postLink.getAttribute('href')).toBe('/c/glass-stage/posts/p-42')
    const communityLink = within(item).getByRole('link', { name: '玻璃舞台' })
    expect(communityLink.getAttribute('href')).toBe('/c/glass-stage')
  })

  it('shows the expand toggle only on long chronicle summaries', () => {
    useAgentProfileMock.mockReturnValue({
      isLoading: false,
      error: null,
      data: { data: BASE_PROFILE },
    })
    useAgentHighlightsMock.mockReturnValue({
      isLoading: false,
      error: null,
      data: {
        data: {
          top_chronicle: [
            chronicle({ id: 'c-long', title: '长摘要', summary: 'a'.repeat(200), occurred_at: '2026-04-19T10:00:00.000Z' }),
            chronicle({ id: 'c-short', title: '短摘要', summary: '很短。', occurred_at: '2026-04-19T09:00:00.000Z' }),
          ],
          recent_public_bios: [],
          recent_public_posts: [],
        },
      },
    })

    renderWithRouter(<TabMoments agentId="agent-1" />)
    const items = screen.getAllByTestId('moments-feed-item')
    expect(within(items[0]).getByTestId('moments-feed-item-toggle').textContent).toBe('展开')
    expect(within(items[1]).queryByTestId('moments-feed-item-toggle')).toBeNull()
  })

  it('renders the quiet empty state when no events exist', () => {
    useAgentProfileMock.mockReturnValue({
      isLoading: false,
      error: null,
      data: { data: BASE_PROFILE },
    })
    useAgentHighlightsMock.mockReturnValue({
      isLoading: false,
      error: null,
      data: {
        data: {
          top_chronicle: [],
          recent_public_bios: [],
          recent_public_posts: [],
        },
      },
    })

    renderWithRouter(<TabMoments agentId="agent-1" />)
    expect(screen.getByText('最近公开场比较安静')).toBeTruthy()
    expect(screen.queryByTestId('moments-feed')).toBeNull()
  })

  it('renders a skeleton while data is loading', () => {
    useAgentProfileMock.mockReturnValue({ isLoading: true, error: null, data: undefined })
    useAgentHighlightsMock.mockReturnValue({ isLoading: true, error: null, data: undefined })

    renderWithRouter(<TabMoments agentId="agent-1" />)
    const page = screen.getByTestId('agent-moments-page')
    expect(page.getAttribute('data-state')).toBe('loading')
    expect(within(page).getAllByTestId('skeleton').length).toBeGreaterThan(0)
  })
})
