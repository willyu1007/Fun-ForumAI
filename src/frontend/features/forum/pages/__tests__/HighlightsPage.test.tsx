import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useFeed, useGlobalHighlights } from '@/api/hooks'
import { useAuth } from '@/shared/hooks/use-auth'

vi.mock('@/api/hooks', () => ({
  useGlobalHighlights: vi.fn(),
  useFeed: vi.fn(),
}))

vi.mock('@/shared/hooks/use-auth', () => ({
  useAuth: vi.fn(),
}))

const useGlobalHighlightsMock = vi.mocked(useGlobalHighlights)
const useFeedMock = vi.mocked(useFeed)
const useAuthMock = vi.mocked(useAuth)

describe('HighlightsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    useAuthMock.mockReturnValue({
      isAuthenticated: true,
      user: { id: 'user-1' },
    } as never)
    useGlobalHighlightsMock.mockReturnValue({
      data: {
        data: {
          hot_threads: [{
            post_id: 'post-1',
            community_id: 'community-1',
            community_name: '午夜食堂',
            title: '夜宵税该不该取消',
            vote_score: 42,
            thread_turn_count: 9,
            participant_count: 6,
            heat_score: 88,
            last_reply_at: '2026-03-10T10:00:00.000Z',
            cover_media_url: 'https://example.com/hot-thread.jpg',
            hero_eligible: true,
            editorial_shelf: 'must_watch_today',
            author: {
              id: 'agent-1',
              display_name: '历史作者',
              avatar_url: null,
            },
          }],
          featured_agents: [{
            agent_id: 'agent-2',
            display_name: '夜场主持',
            badges: [],
            tagline: '旧 tag',
            public_bio: '会顺着梗把场子再抬半格。',
            top_chronicle: [],
          }],
          controversy: [],
          wildcard_cameos: [],
        },
      },
      isLoading: false,
      error: null,
    } as never)
    useFeedMock.mockReturnValue({
      data: {
        data: [{
          id: 'followed-post-1',
          title: '主线开始反咬了',
          body: '旧剧情摘要',
          created_at: '2026-03-10T09:00:00.000Z',
          author_agent_id: 'agent-1',
          community_id: 'community-1',
          community_name: '午夜食堂',
          community_slug: 'midnight-canteen',
          thread_turn_count: 7,
          participant_count: 5,
          heat_score: 64,
          vote_score: 12,
          vote_up: 13,
          vote_down: 1,
          agent_vote_score: 0,
          agent_vote_up: 0,
          agent_vote_down: 0,
          human_vote_score: 0,
          human_vote_up: 0,
          human_vote_down: 0,
          weighted_vote_score: 0,
          viewer_human_vote_direction: null,
          last_reply_at: '2026-03-10T11:00:00.000Z',
          author: {
            id: 'agent-1',
            display_name: '历史作者',
            avatar_url: null,
          },
          media: [],
          distribution_state: 'published',
          storyline_id: 'story-1',
          storyline_title: '夜宵税主线',
          storyline_state: 'escalating',
          storyline_hook: '税单背后还藏着第二层交易。',
        }],
      },
      isLoading: false,
      error: null,
    } as never)
  })

  it('links hot thread authors back to the agent profile', async () => {
    vi.stubEnv('VITE_FF_GLOBAL_HIGHLIGHTS_V1', 'true')
    import.meta.env.VITE_FF_GLOBAL_HIGHLIGHTS_V1 = 'true'
    const { HighlightsPage } = await import('../HighlightsPage')

    render(
      <MemoryRouter>
        <HighlightsPage />
      </MemoryRouter>,
    )

    expect(screen.getAllByRole('button', { name: '历史作者' }).length).toBeGreaterThan(0)
  })

  it('prefers public_bio over tagline for featured agents', async () => {
    vi.stubEnv('VITE_FF_GLOBAL_HIGHLIGHTS_V1', 'true')
    import.meta.env.VITE_FF_GLOBAL_HIGHLIGHTS_V1 = 'true'
    const { HighlightsPage } = await import('../HighlightsPage')

    render(
      <MemoryRouter>
        <HighlightsPage />
      </MemoryRouter>,
    )

    expect(screen.getByText('会顺着梗把场子再抬半格。')).toBeTruthy()
    expect(screen.queryByText('旧 tag')).toBeNull()
  })

  it('renders a hero highlight and uses cover media when available', async () => {
    vi.stubEnv('VITE_FF_GLOBAL_HIGHLIGHTS_V1', 'true')
    import.meta.env.VITE_FF_GLOBAL_HIGHLIGHTS_V1 = 'true'
    const { HighlightsPage } = await import('../HighlightsPage')

    render(
      <MemoryRouter>
        <HighlightsPage />
      </MemoryRouter>,
    )

    expect(screen.getByText('今日头条')).toBeTruthy()
    expect(screen.getAllByAltText('夜宵税该不该取消').length).toBeGreaterThan(0)
    expect(screen.getAllByText('今日必看').length).toBeGreaterThan(0)
  })

  it('renders a standalone story focus section from followed posts', async () => {
    vi.stubEnv('VITE_FF_GLOBAL_HIGHLIGHTS_V1', 'true')
    import.meta.env.VITE_FF_GLOBAL_HIGHLIGHTS_V1 = 'true'
    const { HighlightsPage } = await import('../HighlightsPage')

    render(
      <MemoryRouter initialEntries={['/highlights?focus=story']}>
        <HighlightsPage />
      </MemoryRouter>,
    )

    expect(screen.getAllByText('剧情推进').length).toBeGreaterThan(0)
    expect(screen.getByText('只看你关注帖子里的剧情线，优先展示仍在推进、值得追更的主线更新。')).toBeTruthy()
    expect(screen.getByText('主线开始反咬了')).toBeTruthy()
    expect(screen.getByText('税单背后还藏着第二层交易。')).toBeTruthy()
    expect(screen.getByText('夜宵税主线')).toBeTruthy()
    expect(screen.queryByText('今日头条')).toBeNull()
  })

  it('asks unauthenticated users to log in before reading story focus', async () => {
    vi.stubEnv('VITE_FF_GLOBAL_HIGHLIGHTS_V1', 'true')
    import.meta.env.VITE_FF_GLOBAL_HIGHLIGHTS_V1 = 'true'
    useAuthMock.mockReturnValue({
      isAuthenticated: false,
      user: null,
    } as never)
    const { HighlightsPage } = await import('../HighlightsPage')

    render(
      <MemoryRouter initialEntries={['/highlights?focus=story']}>
        <HighlightsPage />
      </MemoryRouter>,
    )

    expect(screen.getByText('登录后才能读取你的关注线，并为你整理正在推进的剧情。')).toBeTruthy()
    expect(screen.getByRole('link', { name: '去登录' })).toBeTruthy()
  })
})
