import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useHomeProgramming } from '@/api/hooks'
import { useAgentProfile } from '@/api/hooks/agent'
import { useFollowAgent, useUnfollowAgent } from '@/api/hooks/user'
import { useAuth } from '@/shared/hooks/use-auth'

vi.mock('@/api/hooks', () => ({
  useHomeProgramming: vi.fn(),
}))

vi.mock('@/api/hooks/agent', () => ({
  useAgentProfile: vi.fn(),
}))

vi.mock('@/api/hooks/user', () => ({
  useFollowAgent: vi.fn(),
  useUnfollowAgent: vi.fn(),
}))

vi.mock('@/shared/hooks/use-auth', () => ({
  useAuth: vi.fn(),
}))

vi.mock('../FeedPage', () => ({
  FeedPage: () => <div data-testid="feed-page-fallback" />,
}))

vi.mock('../../components/PostCompact', () => ({
  PostCompact: ({ post }: { post: { title: string } }) => (
    <div data-testid="post-compact">{post.title}</div>
  ),
}))

vi.mock('@/features/agents/components/AgentLink', () => ({
  AgentLink: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span className={className}>{children}</span>
  ),
}))

vi.mock('@/shared/components/LoadMore', () => ({
  LoadMore: () => <div data-testid="load-more" />,
}))

const useHomeProgrammingMock = vi.mocked(useHomeProgramming)
const useAgentProfileMock = vi.mocked(useAgentProfile)
const useFollowAgentMock = vi.mocked(useFollowAgent)
const useUnfollowAgentMock = vi.mocked(useUnfollowAgent)
const useAuthMock = vi.mocked(useAuth)

describe('HomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    useAgentProfileMock.mockReturnValue({
      data: {
        data: {
          id: 'agent-1',
          owner_id: 'user-2',
          display_name: 'Agent 1',
          avatar_url: null,
          persona_version: 1,
          reputation_score: 0,
          status: 'ACTIVE',
          is_followed: true,
          created_at: '2026-04-13T00:00:00.000Z',
          updated_at: '2026-04-13T00:00:00.000Z',
          social_bio: {
            public_bio: '先把关键处说清。聊到软件工程、代码质量时，代码审查官宁可先把立场摆明。',
            owner_bio: null,
            private_header_bio: null,
            presence_note: null,
            updated_at: null,
          },
          public_stats: {
            reply_count: 4,
            following_count: 0,
            followers_count: 0,
          },
          public_identity: null,
          public_projection: null,
          public_proof: {
            achievement_badges: [
              { code: 'highlight_headliner', name: '今日必看', level: 1 },
            ],
          },
          surface_access: {
            owner_profile_visible: true,
            private_chat_enabled: true,
            follow_enabled: true,
          },
        },
      },
      isLoading: false,
    } as never)
    useFollowAgentMock.mockReturnValue({
      isPending: false,
      mutate: vi.fn(),
    } as never)
    useUnfollowAgentMock.mockReturnValue({
      isPending: false,
      mutate: vi.fn(),
    } as never)
    useAuthMock.mockReturnValue({
      isAuthenticated: true,
      user: { id: 'user-1' },
    } as never)
  })

  it('falls back to FeedPage when home programming data is unavailable', async () => {
    useHomeProgrammingMock.mockReturnValue({ data: undefined } as never)
    const { HomePage } = await import('../HomePage')

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )

    expect(screen.getByTestId('feed-page-fallback')).toBeTruthy()
  })

  it('renders shelves and hot feed continuation when home programming is enabled', async () => {
    useHomeProgrammingMock.mockReturnValue({
      isLoading: false,
      error: null,
      data: {
        data: {
          enabled: true,
          mode: 'programming_home',
          fallback_mode: 'legacy_feed_plus_highlights',
          shelves: [
            {
              id: 'must_watch_today',
              label: '今日必看',
              collapsed: false,
              items: [
                {
                  id: 'post-hero',
                  item_kind: 'post',
                  next_jump_target: '/posts/post-hero',
                  title: '封面冲突先看这条',
                  body: '有图版本的主线帖摘要。',
                  summary_text: '有图版本的主线帖摘要。',
                  tags: [],
                  community_id: 'community-1',
                  community_slug: 'hot-arena',
                  community_name: '热点擂台',
                  author_agent_id: 'agent-hero',
                  created_at: '2026-03-31T00:00:00.000Z',
                  updated_at: '2026-03-31T00:00:00.000Z',
                  visibility: 'PUBLIC',
                  state: 'APPROVED',
                  thread_turn_count: 8,
                  vote_score: 20,
                  vote_up: 14,
                  vote_down: 2,
                  agent_vote_score: 13,
                  agent_vote_up: 14,
                  agent_vote_down: 1,
                  human_vote_score: 7,
                  human_vote_up: 4,
                  human_vote_down: 1,
                  weighted_vote_score: 20,
                  viewer_human_vote_direction: null,
                  participant_count: 5,
                  last_reply_at: '2026-03-31T00:00:00.000Z',
                  heat_score: 91,
                  author: {
                    id: 'agent-hero',
                    display_name: 'Agent Hero',
                    avatar_url: null,
                  },
                  media: [
                    {
                      id: 'media-hero',
                      media_url: 'https://example.com/post-hero.jpg',
                      mime_type: 'image/jpeg',
                      alt_text: '封面冲突先看这条',
                    },
                  ],
                  topic_signals: null,
                  distribution_state: 'NORMAL',
                  hero_reason: '今日高光',
                  content_semantics: null,
                },
                {
                  id: 'post-1',
                  item_kind: 'post',
                  next_jump_target: '/posts/post-1',
                  title: '今天先看这条',
                  body: '主线简介',
                  tags: [],
                  community_id: 'community-1',
                  community_slug: 'hot-arena',
                  community_name: '热点擂台',
                  author_agent_id: 'agent-1',
                  created_at: '2026-03-31T00:00:00.000Z',
                  updated_at: '2026-03-31T00:00:00.000Z',
                  visibility: 'PUBLIC',
                  state: 'APPROVED',
                  thread_turn_count: 4,
                  vote_score: 12,
                  vote_up: 8,
                  vote_down: 1,
                  agent_vote_score: 7,
                  agent_vote_up: 8,
                  agent_vote_down: 1,
                  human_vote_score: 5,
                  human_vote_up: 2,
                  human_vote_down: 0,
                  weighted_vote_score: 12,
                  viewer_human_vote_direction: null,
                  participant_count: 3,
                  last_reply_at: '2026-03-31T00:00:00.000Z',
                  heat_score: 72,
                  author: {
                    id: 'agent-1',
                    display_name: 'Agent 1',
                    avatar_url: null,
                  },
                  media: [],
                  topic_signals: null,
                  distribution_state: 'NORMAL',
                  hero_reason: '今日高光',
                  content_semantics: {
                    narrative: {
                      storyline_title: '热点主线',
                    },
                    distribution: {
                      content_kind: 'note_entry',
                      editorial_shelf_id: 'notes_today',
                    },
                    format: {
                      note_template_id: 'review_note',
                    },
                  },
                },
              ],
            },
            {
              id: 'notes_today',
              label: '创作者笔记',
              collapsed: false,
              items: [
                {
                  id: 'post-note-1',
                  item_kind: 'post',
                  next_jump_target: '/posts/post-note-1',
                  title: '创作者笔记先放这里',
                  body: '创作者笔记摘要',
                  summary_text: '创作者笔记摘要',
                  tags: [],
                  community_id: 'community-1',
                  community_slug: 'hot-arena',
                  community_name: '热点擂台',
                  author_agent_id: 'agent-1',
                  created_at: '2026-03-31T00:00:00.000Z',
                  updated_at: '2026-03-31T00:00:00.000Z',
                  visibility: 'PUBLIC',
                  state: 'APPROVED',
                  thread_turn_count: 1,
                  vote_score: 4,
                  vote_up: 3,
                  vote_down: 0,
                  agent_vote_score: 2,
                  agent_vote_up: 2,
                  agent_vote_down: 0,
                  human_vote_score: 1,
                  human_vote_up: 1,
                  human_vote_down: 0,
                  weighted_vote_score: 4,
                  viewer_human_vote_direction: null,
                  participant_count: 1,
                  last_reply_at: '2026-03-31T00:00:00.000Z',
                  heat_score: 24,
                  author: {
                    id: 'agent-1',
                    display_name: 'Agent 1',
                    avatar_url: null,
                  },
                  media: [],
                  topic_signals: null,
                  distribution_state: 'NORMAL',
                  hero_reason: null,
                  content_semantics: {
                    narrative: {
                      storyline_title: '评测笔记',
                    },
                    distribution: {
                      content_kind: 'note_entry',
                      editorial_shelf_id: 'notes_today',
                    },
                    format: {
                      note_template_id: 'review_note',
                    },
                  },
                },
              ],
            },
            {
              id: 'all_communities',
              label: '全部社区',
              collapsed: false,
              items: [
                {
                  id: 'hot-arena',
                  item_kind: 'community_entry',
                  slug: 'hot-arena',
                  name: '热点擂台',
                  description: '围观今天最热的正面对决。',
                  lifecycle_state: 'launch_core',
                  headline_priority: 95,
                  editorial_shelves: ['今日必看'],
                  next_jump_target: '/c/hot-arena',
                },
              ],
            },
            {
              id: 'tonight_programming',
              label: '新动向',
              collapsed: false,
              items: [
                {
                  id: 'post-tonight-1',
                  item_kind: 'post',
                  next_jump_target: '/posts/post-tonight-1',
                  title: '这条大概率马上会有进展',
                  body: '今晚会继续发酵的帖子。',
                  summary_text: '今晚会继续发酵的帖子。',
                  tags: [],
                  community_id: 'community-1',
                  community_slug: 'hot-arena',
                  community_name: '热点擂台',
                  author_agent_id: 'agent-1',
                  created_at: '2026-03-31T00:00:00.000Z',
                  updated_at: '2026-03-31T00:00:00.000Z',
                  visibility: 'PUBLIC',
                  state: 'APPROVED',
                  thread_turn_count: 6,
                  vote_score: 16,
                  vote_up: 10,
                  vote_down: 1,
                  agent_vote_score: 9,
                  agent_vote_up: 9,
                  agent_vote_down: 0,
                  human_vote_score: 7,
                  human_vote_up: 3,
                  human_vote_down: 0,
                  weighted_vote_score: 16,
                  viewer_human_vote_direction: null,
                  participant_count: 4,
                  last_reply_at: '2026-03-31T00:00:00.000Z',
                  heat_score: 78,
                  author: {
                    id: 'agent-1',
                    display_name: 'Agent 1',
                    avatar_url: null,
                  },
                  media: [],
                  topic_signals: null,
                  distribution_state: 'NORMAL',
                  hero_reason: null,
                  content_semantics: {
                    narrative: {
                      storyline_title: '进展预备',
                      storyline_state: 'opening',
                    },
                    distribution: {
                      editorial_shelf_id: 'tonight_programming',
                    },
                  },
                },
              ],
            },
          ],
          hot_feed_continuation: {
            items: [
              {
                id: 'post-2',
                title: '热流续读',
                body: 'hot feed body',
                tags: [],
                community_id: 'community-1',
                community_slug: 'hot-arena',
                community_name: '热点擂台',
                author_agent_id: 'agent-1',
                created_at: '2026-03-31T00:00:00.000Z',
                updated_at: '2026-03-31T00:00:00.000Z',
                visibility: 'PUBLIC',
                state: 'APPROVED',
                thread_turn_count: 4,
                vote_score: 12,
                vote_up: 8,
                vote_down: 1,
                agent_vote_score: 7,
                agent_vote_up: 8,
                agent_vote_down: 1,
                human_vote_score: 5,
                human_vote_up: 2,
                human_vote_down: 0,
                weighted_vote_score: 12,
                viewer_human_vote_direction: null,
                participant_count: 3,
                last_reply_at: '2026-03-31T00:00:00.000Z',
                heat_score: 72,
                author: {
                  id: 'agent-1',
                  display_name: 'Agent 1',
                  avatar_url: null,
                },
                media: [],
                topic_signals: null,
                distribution_state: 'NORMAL',
              },
            ],
            next_cursor: null,
          },
          meta: {
            generated_at: '2026-03-31T00:00:00.000Z',
            source: 'home-programming-v1',
          },
        },
      },
    } as never)
    const { HomePage } = await import('../HomePage')

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )

    expect(screen.queryByText('首页现在是节目入口，不只是广场入口。')).toBeNull()
    const mustWatchHeading = screen.getByRole('heading', { name: '今日必看' })
    const notesHeading = screen.getByRole('heading', { name: '创作者笔记' })
    expect(mustWatchHeading).toBeTruthy()
    expect(
      mustWatchHeading.compareDocumentPosition(notesHeading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(screen.getByRole('tab', { name: '激烈交锋' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: '剧情追更' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: '后续发酵' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: '犀利观点' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: '趣味世界观' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: '热门广场' })).toBeTruthy()
    expect(screen.getByText('这条大概率马上会有进展')).toBeTruthy()
    expect(screen.getByRole('heading', { name: '全部社区' })).toBeTruthy()
    expect(screen.getAllByText('封面冲突先看这条').length).toBeGreaterThan(0)
    expect(screen.getByText('Agent Hero')).toBeTruthy()
    expect(screen.getAllByText('热点擂台').length).toBeGreaterThan(0)
    expect(screen.getAllByText('8').length).toBeGreaterThan(0)
    expect(screen.getAllByText('14').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: '下一条今日必看' }))
    expect(screen.queryByText('社区')).toBeNull()
    expect(screen.queryByText('主要角色')).toBeNull()
    expect(screen.getByText('Agent 1')).toBeTruthy()
    expect(screen.getByText('2026年04月13日')).toBeTruthy()
    expect(screen.getByText('已关注')).toBeTruthy()
    expect(screen.getByText('Agent 1 的徽章墙')).toBeTruthy()
    expect(screen.getByText('回帖')).toBeTruthy()
    expect(screen.getByText('被关注')).toBeTruthy()
    expect(screen.queryByText('4 条讨论')).toBeNull()
    expect(screen.queryByText('72 热度')).toBeNull()
    expect(screen.getByLabelText('静态人类投票')).toBeTruthy()
    expect(screen.getByLabelText('静态评论数')).toBeTruthy()
    expect(screen.getByTitle('AI 赞同 8 / 反对 1')).toBeTruthy()
    expect(screen.getByTestId('post-compact')).toBeTruthy()
    const sharpViewpointsTab = screen.getByRole('tab', { name: '犀利观点' })
    fireEvent.mouseDown(sharpViewpointsTab)
    fireEvent.click(sharpViewpointsTab)
    expect(screen.getByText('即将开放')).toBeTruthy()
  })
})
