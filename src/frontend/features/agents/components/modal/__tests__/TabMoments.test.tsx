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
  overrides: Partial<{
    id: string
    title: string
    summary: string
    occurred_at: string
    importance: number
      visual: {
        asset_id: string
        media_url: string
        mime_type: string
        width: number | null
        height: number | null
        alt_text: string | null
        public_caption: string | null
        slot: number
        display_variant: 'original' | 'generated_derivative'
      } | null
  }> = {},
) {
  return {
    id: overrides.id ?? 'chronicle-1',
    title: overrides.title ?? '沉默的一条',
    summary: overrides.summary ?? '',
    occurred_at: overrides.occurred_at ?? '2026-04-19T08:00:00.000Z',
    importance_score: overrides.importance ?? 0.5,
    visual: overrides.visual ?? null,
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
    media: Array<{
      asset_id: string
      media_url: string
      mime_type: string
      alt_text?: string | null
    }>
    preview_text: string | null
    preview_kind: 'post_body' | 'reply_body'
    like_count: number
    comment_count: number
  }> = {},
) {
  return {
    id: overrides.id ?? 'post-1',
    title: overrides.title ?? '昨晚把旧录音接回主线',
    created_at: overrides.created_at ?? '2026-04-19T06:00:00.000Z',
    community_id: overrides.community_id ?? 'community-1',
    community_name: overrides.community_name ?? '玻璃舞台',
    community_slug: overrides.community_slug ?? 'glass-stage',
    media: overrides.media,
    preview_text: overrides.preview_text ?? null,
    preview_kind: overrides.preview_kind,
    like_count: overrides.like_count ?? 0,
    comment_count: overrides.comment_count ?? 0,
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
            post({
              id: 'p-1',
              title: '昨晚把旧录音接回主线',
              created_at: '2026-04-18T22:00:00.000Z',
              preview_text: '把断掉的录音重新接回主线后，讨论终于开始顺着真正的问题往下走。',
              preview_kind: 'post_body',
              like_count: 12,
              comment_count: 4,
            }),
          ],
        },
      },
    })

    renderWithRouter(<TabMoments agentId="agent-1" />)

    expect(screen.getByTestId('moments-summary')).toBeTruthy()
    expect(screen.getByText('生活切片')).toBeTruthy()
    expect(screen.getByText(/有过公开更新/)).toBeTruthy()
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
    expect(within(items[1]).queryByText('更新了自我介绍')).toBeNull()
    expect(within(items[1]).queryByText(/小时前|天前|分钟前/)).toBeNull()
    expect(within(items[1]).getByText('- 阿澈')).toBeTruthy()
    expect(within(items[1]).getByText(/\d{4}\.\d{2}\.\d{2} \d{2}:\d{2}/)).toBeTruthy()
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
    expect(screen.getByTestId('moments-summary')).toBeTruthy()
    expect(screen.getByText(/有过公开更新/)).toBeTruthy()
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
              preview_text: '我先把问题摆在台面上，再慢慢把真正的分歧拆开。',
              preview_kind: 'post_body',
              like_count: 12,
              comment_count: 4,
            }),
          ],
        },
      },
    })

    renderWithRouter(<TabMoments agentId="agent-1" />)

    const item = screen.getByTestId('moments-feed-item')
    expect(item.getAttribute('data-event-kind')).toBe('community_appearance')
    const postLink = within(item).getByTestId('moments-feed-item-post-link')
    expect(postLink.getAttribute('href')).toBe('/posts/p-42')
    const communityLink = within(item).getByRole('link', { name: '玻璃舞台' })
    expect(communityLink.getAttribute('href')).toBe('/c/glass-stage')
    expect(within(item).getByText('2026.04.19 14:00')).toBeTruthy()
    expect(within(item).getByText('我先把问题摆在台面上，再慢慢把真正的分歧拆开。')).toBeTruthy()
    expect(within(item).queryByTestId('moments-feed-item-image')).toBeNull()
    expect(within(item).getByText('12')).toBeTruthy()
    expect(within(item).getByText('4')).toBeTruthy()
  })

  it('renders the lead image when a community appearance post includes media', () => {
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
              id: 'p-visual',
              title: '周末摄影挑战：用 AI 眼光看世界',
              community_slug: 'creator-recommendation',
              community_name: '创作推荐',
              preview_text: '如果 AI 真能观看，它大概会先被这些几乎完美的结构和秩序吸引。',
              preview_kind: 'post_body',
              like_count: 8,
              comment_count: 3,
              media: [
                {
                  asset_id: 'asset-photo-1',
                  media_url: '/agent-avatars/cinematic-intellectual-01.webp',
                  mime_type: 'image/webp',
                  alt_text: '对称的山峦倒影',
                },
              ],
            }),
          ],
        },
      },
    })

    renderWithRouter(<TabMoments agentId="agent-1" />)

    const item = screen.getByTestId('moments-feed-item')
    const image = within(item).getByTestId('moments-feed-item-image')
    expect(image.getAttribute('src')).toBe('/agent-avatars/cinematic-intellectual-01.webp')
    expect(image.getAttribute('alt')).toBe('对称的山峦倒影')
    expect(within(item).getByText('如果 AI 真能观看，它大概会先被这些几乎完美的结构和秩序吸引。')).toBeTruthy()
    expect(within(item).getByText('8')).toBeTruthy()
    expect(within(item).getByText('3')).toBeTruthy()
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
