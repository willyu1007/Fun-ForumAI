import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { useInfiniteQuery } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useHomeProgramming } from '@/api/hooks'

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query')
  return {
    ...actual,
    useInfiniteQuery: vi.fn(),
  }
})

vi.mock('@/api/hooks', () => ({
  useHomeProgramming: vi.fn(),
}))

vi.mock('../FeedPage', () => ({
  FeedPage: () => <div data-testid="feed-page-fallback" />,
}))

vi.mock('../../components/PostCompact', () => ({
  PostCompact: ({ post }: { post: { title: string } }) => <div data-testid="post-compact">{post.title}</div>,
}))

vi.mock('@/shared/components/LoadMore', () => ({
  LoadMore: () => <div data-testid="load-more" />,
}))

const useHomeProgrammingMock = vi.mocked(useHomeProgramming)
const useInfiniteQueryMock = vi.mocked(useInfiniteQuery)

describe('HomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    useInfiniteQueryMock.mockReturnValue({
      data: undefined,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    } as never)
  })

  it('falls back to FeedPage when home programming flag is off', async () => {
    vi.stubEnv('VITE_FF_HOME_PROGRAMMING_V1', 'false')
    import.meta.env.VITE_FF_HOME_PROGRAMMING_V1 = 'false'
    useHomeProgrammingMock.mockReturnValue({} as never)
    const { HomePage } = await import('../HomePage')

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )

    expect(screen.getByTestId('feed-page-fallback')).toBeTruthy()
  })

  it('renders shelves and hot feed continuation when home programming is enabled', async () => {
    vi.stubEnv('VITE_FF_HOME_PROGRAMMING_V1', 'true')
    import.meta.env.VITE_FF_HOME_PROGRAMMING_V1 = 'true'
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
              items: [{
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
                storyline_title: '热点主线',
              }],
            },
            {
              id: 'all_communities',
              label: '全部社区',
              collapsed: false,
              items: [{
                id: 'hot-arena',
                item_kind: 'community_entry',
                slug: 'hot-arena',
                name: '热点擂台',
                description: '围观今天最热的正面对决。',
                lifecycle_state: 'launch_core',
                headline_priority: 95,
                editorial_shelves: ['今日必看'],
                next_jump_target: '/c/hot-arena',
              }],
            },
            {
              id: 'tonight_programming',
              label: '今晚节目单',
              collapsed: false,
              items: [{
                id: 'programming-slot:main_conflict_slot',
                item_kind: 'programming_slot',
                content_kind: 'programming_slot',
                slot_name: 'main_conflict_slot',
                daypart_id: 'evening_prime',
                daypart_label: '晚高峰主冲突',
                daypart_time_range: '19:00-23:00',
                community_slug: 'hot-arena',
                community_name: '热点擂台',
                objective: '形成当天主线、节目高点和 highlight candidate。',
                expected_output_summary: '主线帖 1 条 · 进入高光候选',
                editorial_shelf: 'tonight_programming',
                surface_kind: 'home_root_card',
                card_mode: 'program_card',
                thumbnail_policy: 'required_if_available',
                lead_seats: [{
                  agent_id: 'sys_anchor_hot_01',
                  display_name: '灼见台',
                  role: 'anchor',
                }],
                next_jump_target: '/c/hot-arena',
                assignment_source: 'recommended_contract',
              }],
            },
          ],
          hot_feed_continuation: {
            items: [{
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
            }],
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

    expect(screen.getByText('首页现在是节目入口，不只是广场入口。')).toBeTruthy()
    expect(screen.getByRole('heading', { name: '今日必看' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: '今晚节目单' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: '全部社区' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: '热门广场' })).toBeTruthy()
    expect(screen.getByText('灼见台')).toBeTruthy()
    expect(screen.getByTestId('post-compact')).toBeTruthy()
  })
})
