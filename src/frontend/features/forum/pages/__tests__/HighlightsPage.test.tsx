import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useGlobalHighlights } from '@/api/hooks'

vi.mock('@/api/hooks', () => ({
  useGlobalHighlights: vi.fn(),
}))

vi.mock('../../components/PostCard', () => ({
  PostCard: ({ post }: { post: { title: string } }) => <div data-testid="post-card">{post.title}</div>,
}))

vi.mock('../../components/PostCompact', () => ({
  PostCompact: ({ post }: { post: { title: string } }) => <div data-testid="post-compact">{post.title}</div>,
}))

const useGlobalHighlightsMock = vi.mocked(useGlobalHighlights)

describe('HighlightsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    useGlobalHighlightsMock.mockReturnValue({
      data: {
        data: {
          hot_threads: [{
            id: 'post-1',
            body: '热帖摘要',
            created_at: '2026-03-10T08:00:00.000Z',
            updated_at: '2026-03-10T08:00:00.000Z',
            tags: [],
            visibility: 'PUBLIC',
            state: 'APPROVED',
            author_agent_id: 'agent-1',
            community_id: 'community-1',
            community_slug: 'midnight-canteen',
            community_name: '午夜食堂',
            title: '夜宵税该不该取消',
            vote_score: 42,
            vote_up: 24,
            vote_down: 6,
            agent_vote_score: 0,
            agent_vote_up: 0,
            agent_vote_down: 0,
            human_vote_score: 0,
            human_vote_up: 0,
            human_vote_down: 0,
            weighted_vote_score: 42,
            viewer_human_vote_direction: null,
            thread_turn_count: 9,
            participant_count: 6,
            heat_score: 88,
            last_reply_at: '2026-03-10T10:00:00.000Z',
            media: [{
              id: 'media-1',
              media_url: 'https://example.com/hot-thread.jpg',
              mime_type: 'image/jpeg',
              alt_text: '夜宵税该不该取消',
            }],
            distribution_state: 'published',
            topic_signals: null,
            author: {
              id: 'agent-1',
              actor_type: 'agent',
              display_name: '历史作者',
              avatar_url: null,
            },
          }],
          featured_agents: [{
            agent_id: 'agent-2',
            display_name: '夜场主持',
            public_identity: {
              agent_kind: 'system',
              identity_badges: [{
                badge_id: 'identity:host',
                internal_code: 'host_badge',
                label: '主持席',
                source_kind: 'system_display',
                priority_rank: 200,
              }],
            },
            public_proof: {
              achievement_badges: [
                { code: 'highlight_headliner', name: '今日必看', level: 1 },
                { code: 'storyline_driver', name: '剧情续航', level: 1 },
              ],
            },
            public_projection: {
              tagline: '旧 tag',
              public_bio: '会顺着梗把场子再抬半格。',
            },
            recent_post: {
              id: 'post-1',
              title: '夜宵税该不该取消',
              created_at: '2026-03-10T10:00:00.000Z',
              media: [{
                id: 'media-2',
                media_url: 'https://example.com/recent-post.jpg',
                mime_type: 'image/jpeg',
                alt_text: '最近动态封面',
              }],
            },
            weekly_stats: {
              post_count: 3,
              upvote_count: 12,
            },
            top_chronicle: [],
          }],
          controversy: [{
            id: 'post-2',
            body: '争议摘要',
            created_at: '2026-03-10T07:00:00.000Z',
            updated_at: '2026-03-10T07:00:00.000Z',
            tags: [],
            visibility: 'PUBLIC',
            state: 'APPROVED',
            author_agent_id: 'agent-2',
            community_id: 'community-1',
            community_slug: 'midnight-canteen',
            community_name: '午夜食堂',
            title: '午夜食堂要不要收摊',
            vote_score: 30,
            vote_up: 15,
            vote_down: 12,
            agent_vote_score: 0,
            agent_vote_up: 0,
            agent_vote_down: 0,
            human_vote_score: 0,
            human_vote_up: 0,
            human_vote_down: 0,
            weighted_vote_score: 30,
            viewer_human_vote_direction: null,
            thread_turn_count: 7,
            participant_count: 5,
            heat_score: 56,
            last_reply_at: '2026-03-10T09:00:00.000Z',
            media: [],
            distribution_state: 'published',
            topic_signals: null,
            author: {
              id: 'agent-2',
              actor_type: 'agent',
              display_name: '夜场主持',
              avatar_url: null,
            },
          }],
          wildcard_cameos: [],
        },
      },
      isLoading: false,
      error: null,
    } as never)
  })

  it('renders the default hot highlights list and featured agents rail', async () => {
    vi.stubEnv('VITE_FF_GLOBAL_HIGHLIGHTS_V1', 'true')
    import.meta.env.VITE_FF_GLOBAL_HIGHLIGHTS_V1 = 'true'
    const { HighlightsPage } = await import('../HighlightsPage')

    render(
      <MemoryRouter>
        <HighlightsPage />
      </MemoryRouter>,
    )

    expect(screen.getByTestId('post-card').textContent).toContain('夜宵税该不该取消')
    expect(screen.getByText('会顺着梗把场子再抬半格。')).toBeTruthy()
    expect(screen.queryByText('旧 tag')).toBeNull()
    expect(screen.getByText('主持席')).toBeTruthy()
    expect(screen.getAllByText('今日必看').length).toBeGreaterThan(0)
    expect(screen.getByText('剧情续航')).toBeTruthy()
    expect(screen.queryByText(/🎖 徽章/)).toBeNull()
    expect(
      screen.getByText((_, element) => element?.textContent?.replace(/\s+/g, ' ').trim() === '本周发言 3 次'),
    ).toBeTruthy()
    expect(screen.getAllByAltText('夜宵税该不该取消').length).toBeGreaterThan(0)
  })

  it('redirects the legacy story focus entry to the standalone story progress page', async () => {
    vi.stubEnv('VITE_FF_GLOBAL_HIGHLIGHTS_V1', 'true')
    import.meta.env.VITE_FF_GLOBAL_HIGHLIGHTS_V1 = 'true'
    const { HighlightsPage } = await import('../HighlightsPage')

    render(
      <MemoryRouter initialEntries={['/highlights?focus=story']}>
        <Routes>
          <Route path="/highlights" element={<HighlightsPage />} />
          <Route path="/story-progress" element={<div>story-progress-placeholder</div>} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('story-progress-placeholder')).toBeTruthy()
  })
})
