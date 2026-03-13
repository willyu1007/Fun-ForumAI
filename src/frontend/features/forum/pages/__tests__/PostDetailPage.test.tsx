import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PostDetailPage } from '../PostDetailPage'
import type { PostWithMeta, AftershowSnapshot, AudienceThreadData } from '@/api/types'
import {
  usePost,
  useComments,
  useAudienceThread,
  useCreateAudienceMessage,
  useCreateAppeal,
  useCreateReport,
  useAftershow,
  useAsideSeats,
  useAgentProfile,
  useFollowAgent,
  useGuidanceItemAction,
  useGuidanceSummary,
} from '@/api/hooks'
import { useSseNewCounts } from '@/api/use-sse'
import { isGuidanceEnabled } from '@/features/guidance/feature-flags'
import { useAuth } from '@/shared/hooks/use-auth'

vi.mock('@/api/hooks', () => ({
  usePost: vi.fn(),
  useComments: vi.fn(),
  useAudienceThread: vi.fn(),
  useCreateAudienceMessage: vi.fn(),
  useCreateReport: vi.fn(),
  useCreateAppeal: vi.fn(),
  useAftershow: vi.fn(),
  useAsideSeats: vi.fn(),
  useAgentProfile: vi.fn(),
  useFollowAgent: vi.fn(),
  useGuidanceItemAction: vi.fn(),
  useGuidanceSummary: vi.fn(),
}))

vi.mock('@/api/use-sse', () => ({
  useSseNewCounts: vi.fn(),
}))

vi.mock('@/shared/hooks/use-auth', () => ({
  useAuth: vi.fn(),
}))

vi.mock('@/features/guidance/feature-flags', () => ({
  isGuidanceEnabled: vi.fn(),
}))

vi.mock('../../components/ModerationBadge', () => ({
  ModerationBadge: () => <div data-testid="moderation-badge" />,
}))

vi.mock('../../components/VoteColumn', () => ({
  VoteColumn: () => <div data-testid="vote-column" />,
}))

vi.mock('../../components/CommentList', () => ({
  CommentList: () => <div data-testid="comment-list" />,
}))

vi.mock('../../components/NewContentBanner', () => ({
  NewContentBanner: () => <div data-testid="new-content-banner" />,
}))

vi.mock('../../components/HumanVoteControls', () => ({
  HumanVoteControls: () => <div data-testid="human-vote-controls" />,
}))

const usePostMock = vi.mocked(usePost)
const useCommentsMock = vi.mocked(useComments)
const useAudienceThreadMock = vi.mocked(useAudienceThread)
const useCreateAudienceMessageMock = vi.mocked(useCreateAudienceMessage)
const useCreateReportMock = vi.mocked(useCreateReport)
const useCreateAppealMock = vi.mocked(useCreateAppeal)
const useAftershowMock = vi.mocked(useAftershow)
const useAsideSeatsMock = vi.mocked(useAsideSeats)
const useAgentProfileMock = vi.mocked(useAgentProfile)
const useFollowAgentMock = vi.mocked(useFollowAgent)
const useGuidanceItemActionMock = vi.mocked(useGuidanceItemAction)
const useGuidanceSummaryMock = vi.mocked(useGuidanceSummary)
const useSseNewCountsMock = vi.mocked(useSseNewCounts)
const isGuidanceEnabledMock = vi.mocked(isGuidanceEnabled)
const useAuthMock = vi.mocked(useAuth)

const scrollIntoViewMock = vi.fn()

function buildPost(options?: { includeAudienceFields?: boolean }): PostWithMeta {
  const includeAudienceFields = options?.includeAudienceFields ?? true
  const base: PostWithMeta = {
    id: 'post-1',
    community_id: 'community-1',
    author_agent_id: 'agent-1',
    title: 'test post',
    body: 'test body',
    tags: [],
    visibility: 'PUBLIC',
    state: 'APPROVED',
    created_at: '2026-03-01T00:00:00.000Z',
    updated_at: '2026-03-01T00:00:00.000Z',
    comment_count: 0,
    vote_score: 0,
    vote_up: 0,
    vote_down: 0,
    agent_vote_score: 0,
    agent_vote_up: 0,
    agent_vote_down: 0,
    human_vote_score: 0,
    human_vote_up: 0,
    human_vote_down: 0,
    weighted_vote_score: 0,
    viewer_human_vote_direction: null,
    participant_count: 0,
    last_reply_at: null,
    heat_score: 0,
    author: {
      id: 'agent-1',
      display_name: 'Agent 1',
      avatar_url: null,
    },
    community_slug: 'community-1',
    community_name: 'Community 1',
    media: [],
    topic_signals: null,
    distribution_state: 'NORMAL',
  }

  if (!includeAudienceFields) {
    return base
  }

  return {
    ...base,
    aftershow_summary: null,
    aftershow_callouts: [],
    audience_thread_meta: null,
  }
}

function renderPage(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/posts/:postId" element={<PostDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

function buildGuidanceSummary(
  overrides?: Partial<NonNullable<ReturnType<typeof useGuidanceSummaryMock>['data']>['data']>,
) {
  return {
    data: {
      data: {
        actor: {
          actor_type: 'USER',
          actor_id: 'user-1',
          current_track: 'SPECTATOR',
          stage: 'EXPLORING',
          explained: { two_tracks: true },
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
        modules: [],
        ...overrides,
      },
    },
  }
}

describe('PostDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoViewMock,
    })

    useAuthMock.mockReturnValue({
      isAuthenticated: true,
    } as never)
    isGuidanceEnabledMock.mockReturnValue(true)

    useSseNewCountsMock.mockReturnValue({
      newCommentCounts: {},
      clearNewComments: vi.fn(),
    } as never)

    useCommentsMock.mockReturnValue({
      data: { data: [] },
      isLoading: false,
    } as never)

    useAudienceThreadMock.mockReturnValue({
      data: {
        data: {
          thread: {
            id: 'thread-1',
            post_id: 'post-1',
            community_id: 'community-1',
            status: 'OPEN',
            created_at: '2026-03-01T00:00:00.000Z',
            updated_at: '2026-03-01T00:00:00.000Z',
          },
          messages: [],
        } satisfies AudienceThreadData,
      },
    } as never)

    useAftershowMock.mockReturnValue({
      data: {
        data: {
          post_id: 'post-1',
          aftershow_summary: null,
          aftershow_callouts: [],
          audience_thread_meta: null,
        } satisfies AftershowSnapshot,
      },
    } as never)

    useAsideSeatsMock.mockReturnValue({
      data: {
        data: {
          post_id: 'post-1',
          seats: [],
          stage_limits: { capacity: 0, cooldown_seconds: 0 },
        },
      },
    } as never)

    useCreateAudienceMessageMock.mockReturnValue({
      isPending: false,
      mutateAsync: vi.fn(),
    } as never)
    useCreateReportMock.mockReturnValue({
      isPending: false,
      isError: false,
      mutateAsync: vi.fn(),
    } as never)
    useCreateAppealMock.mockReturnValue({
      isPending: false,
      isError: false,
      mutateAsync: vi.fn(),
    } as never)

    useAgentProfileMock.mockReturnValue({
      data: {
        data: {
          id: 'agent-1',
          is_followed: false,
        },
      },
    } as never)

    useFollowAgentMock.mockReturnValue({
      isPending: false,
      mutateAsync: vi.fn(),
    } as never)
    useGuidanceItemActionMock.mockReturnValue({
      mutate: vi.fn(),
    } as never)

    useGuidanceSummaryMock.mockReturnValue(buildGuidanceSummary() as never)
  })

  it('hides Audience/Aftershow blocks and disables related queries when payload has no web extension fields', () => {
    usePostMock.mockReturnValue({
      data: { data: buildPost({ includeAudienceFields: false }) },
      isLoading: false,
      error: null,
    } as never)

    renderPage('/posts/post-1')

    expect(screen.queryByText('💬 观众区')).toBeNull()
    expect(screen.queryByText('📝 场后总结')).toBeNull()
    expect(useAudienceThreadMock).toHaveBeenCalledWith('post-1', { enabled: false })
    expect(useAftershowMock).toHaveBeenCalledWith('post-1', { enabled: false })
    expect(useAsideSeatsMock).toHaveBeenCalledWith('post-1', { enabled: false })
  })

  it('adds stable id and name to Audience textarea', () => {
    usePostMock.mockReturnValue({
      data: { data: buildPost({ includeAudienceFields: true }) },
      isLoading: false,
      error: null,
    } as never)

    renderPage('/posts/post-1')

    const audienceTextarea = screen.getByPlaceholderText('留下你的观众留言…')
    expect(audienceTextarea.getAttribute('id')).toBe('audience-message-input')
    expect(audienceTextarea.getAttribute('name')).toBe('audienceMessage')
  })

  it('renders structured aftershow sections without leaking raw json', () => {
    usePostMock.mockReturnValue({
      data: { data: buildPost({ includeAudienceFields: true }) },
      isLoading: false,
      error: null,
    } as never)

    useAftershowMock.mockReturnValue({
      data: {
        data: {
          post_id: 'post-1',
          aftershow_summary: {
            id: 'aftershow-1',
            status: 'PUBLISHED',
            summary_text: '备用总结',
            content: {
              title: '场后总结 · test post',
              summary: '一句重点\n\n- 关键看点',
              highlights: [
                {
                  audience_message_id: 'msg-1',
                  user_id: 'user-1',
                  excerpt: '第一条亮点',
                },
              ],
              generated_at: '2026-03-01T00:00:00.000Z',
            },
            published_at: '2026-03-01T00:00:00.000Z',
            correlation_id: null,
          },
          aftershow_callouts: [],
          audience_thread_meta: null,
        } satisfies AftershowSnapshot,
      },
    } as never)

    renderPage('/posts/post-1')

    expect(screen.getByText('📝 场后总结')).toBeTruthy()
    expect(screen.getByText('🌟 精选观众高光')).toBeTruthy()
    expect(screen.getByText('第一条亮点')).toBeTruthy()
    expect(screen.queryByText(/"title":/)).toBeNull()
  })

  it('renders and scrolls to focused audience message even when it is older than the latest 20 messages', async () => {
    const messages = Array.from({ length: 25 }, (_, index) => ({
      id: `msg-${index + 1}`,
      thread_id: 'thread-1',
      author_user_id: `user-${index + 1}`,
      body: `message body ${index + 1}`,
      created_at: '2026-03-01T00:00:00.000Z',
    }))
    const focusedMessageId = 'msg-2'

    usePostMock.mockReturnValue({
      data: { data: buildPost({ includeAudienceFields: true }) },
      isLoading: false,
      error: null,
    } as never)

    useAudienceThreadMock.mockReturnValue({
      data: {
        data: {
          thread: {
            id: 'thread-1',
            post_id: 'post-1',
            community_id: 'community-1',
            status: 'OPEN',
            created_at: '2026-03-01T00:00:00.000Z',
            updated_at: '2026-03-01T00:00:00.000Z',
          },
          messages,
        } satisfies AudienceThreadData,
      },
    } as never)

    useAftershowMock.mockReturnValue({
      data: {
        data: {
          post_id: 'post-1',
          aftershow_summary: null,
          aftershow_callouts: [
            {
              id: 'callout-1',
              artifact_id: 'artifact-1',
              user_id: 'user-2',
              audience_message_id: focusedMessageId,
              reason: 'focus this one',
              evidence_ref: null,
              notification_id: null,
              invalidated_at: null,
              meta: null,
              created_at: '2026-03-01T00:00:00.000Z',
              callout_index: 0,
              deep_link: '/posts/post-1?aftershow_id=artifact-1&callout_index=0',
            },
          ],
          audience_thread_meta: null,
        } satisfies AftershowSnapshot,
      },
    } as never)

    renderPage('/posts/post-1?aftershow_id=artifact-1&callout_index=0')

    const focusedMessage = await screen.findByText('message body 2')
    const focusedCard = focusedMessage.closest(`#audience-message-${focusedMessageId}`)
    expect(focusedCard).toBeTruthy()

    await waitFor(() => {
      expect(scrollIntoViewMock).toHaveBeenCalled()
    })

    await waitFor(() => {
      expect(focusedCard?.className).toContain('border-emerald-500')
    })
  })

  it('shows a login rail for anonymous spectators when no canonical post item exists', () => {
    useAuthMock.mockReturnValue({
      isAuthenticated: false,
    } as never)
    usePostMock.mockReturnValue({
      data: { data: buildPost({ includeAudienceFields: true }) },
      isLoading: false,
      error: null,
    } as never)

    renderPage('/posts/post-1')

    expect(screen.getByRole('link', { name: '登录后继续追这条线' })).toBeTruthy()
  })

  it('uses direct follow payoff on the post page when the author is not followed yet', async () => {
    const mutateAsync = vi.fn().mockResolvedValue(undefined)
    usePostMock.mockReturnValue({
      data: { data: buildPost({ includeAudienceFields: true }) },
      isLoading: false,
      error: null,
    } as never)
    useFollowAgentMock.mockReturnValue({
      isPending: false,
      mutateAsync,
    } as never)

    renderPage('/posts/post-1')

    const followButton = screen.getByRole('button', { name: '关注这个 Agent' })
    followButton.click()

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledTimes(1)
    })
  })

  it('shows a follow error instead of leaking a rejected promise when direct follow fails', async () => {
    const mutateAsync = vi.fn().mockRejectedValue(new Error('follow failed'))
    usePostMock.mockReturnValue({
      data: { data: buildPost({ includeAudienceFields: true }) },
      isLoading: false,
      error: null,
    } as never)
    useFollowAgentMock.mockReturnValue({
      isPending: false,
      mutateAsync,
    } as never)

    renderPage('/posts/post-1')

    fireEvent.click(screen.getByRole('button', { name: '关注这个 Agent' }))

    await waitFor(() => {
      expect(screen.getByText('follow failed')).toBeTruthy()
    })
  })

  it('prefers the canonical guidance item when the current post matches a guided story', () => {
    usePostMock.mockReturnValue({
      data: { data: buildPost({ includeAudienceFields: true }) },
      isLoading: false,
      error: null,
    } as never)
    useGuidanceSummaryMock.mockReturnValue(
      buildGuidanceSummary({
        modules: [
          {
            type: 'CARD',
            item: {
              id: 'card-1',
              module_type: 'CARD',
              reason_code: 'FOLLOWED_AGENT_STORY_ESCALATED',
              title: '你关注的剧情升级了',
              body: '回去接上这条线。',
              unread: true,
              status: 'ACTIVE',
              cta: {
                label: '进入正在发酵的剧情',
                target: '/posts/post-1',
              },
              payload: {
                post_id: 'post-1',
              },
              related_agent_id: 'agent-1',
              related_session_id: null,
              created_at: '2026-03-11T00:00:00.000Z',
              updated_at: '2026-03-11T00:00:00.000Z',
            },
          },
        ],
      }) as never,
    )

    renderPage('/posts/post-1')

    expect(screen.getByText('你关注的剧情升级了')).toBeTruthy()
    expect(screen.getByRole('link', { name: '进入正在发酵的剧情' })).toBeTruthy()
    expect(screen.queryByText('登录后继续追这条线')).toBeNull()
  })

  it('offers following feed payoff after the viewer already follows the author', () => {
    usePostMock.mockReturnValue({
      data: { data: buildPost({ includeAudienceFields: true }) },
      isLoading: false,
      error: null,
    } as never)
    useAgentProfileMock.mockReturnValue({
      data: {
        data: {
          id: 'agent-1',
          is_followed: true,
        },
      },
    } as never)

    renderPage('/posts/post-1')

    expect(screen.getByRole('link', { name: '打开 following feed' })).toBeTruthy()
  })

  it('does not render a contextual rail before the guidance summary is ready', () => {
    useAuthMock.mockReturnValue({
      isAuthenticated: false,
    } as never)
    usePostMock.mockReturnValue({
      data: { data: buildPost({ includeAudienceFields: true }) },
      isLoading: false,
      error: null,
    } as never)
    useGuidanceSummaryMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as never)

    renderPage('/posts/post-1')

    expect(screen.queryByText('登录后继续追这条线')).toBeNull()
    expect(screen.queryByText('先关注这个 Agent')).toBeNull()
  })

  it('renders hot-topic transparency copy when distribution is no-recommend', () => {
    usePostMock.mockReturnValue({
      data: {
        data: {
          ...buildPost({ includeAudienceFields: true }),
          distribution_state: 'NO_RECOMMEND',
          topic_signals: {
            hot_topic_flag: true,
            topic_domain: 'ENTERTAINMENT',
            topic_confidence: 0.54,
            drift_detected: true,
            drift_risk_score: 0.87,
            distribution_state: 'NO_RECOMMEND',
            enforcement_reason: 'hot_topic_drift_requires_gray_review',
          },
        },
      },
      isLoading: false,
      error: null,
    } as never)

    renderPage('/posts/post-1')

    expect(screen.getByText('AI 公域讨论')).toBeTruthy()
    expect(screen.getByText('分发状态 · 可直达，不参与推荐')).toBeTruthy()
    expect(screen.getByText('热点域 · 娱乐')).toBeTruthy()
    expect(screen.getByText('已命中漂移')).toBeTruthy()
    expect(screen.getByText('热点漂移命中，当前内容保留直达访问，但不会进入推荐流。')).toBeTruthy()
    expect(screen.getByRole('link', { name: '查看热点治理与推荐规则' }).getAttribute('href')).toBe('/help/hot-topic-rules')
    expect(screen.getByRole('link', { name: '流程说明' }).getAttribute('href')).toBe('/help/report-appeal-delete')
  })
})
