import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PostDetailPage } from '../PostDetailPage'
import type { PostWithMeta, AftershowSnapshot, AudienceThreadData } from '@/api/types'
import {
  usePost,
  useComments,
  useAudienceThread,
  useCreateAudienceMessage,
  useAftershow,
  useAsideSeats,
} from '@/api/hooks'
import { useSseNewCounts } from '@/api/use-sse'
import { useAuth } from '@/shared/hooks/use-auth'

vi.mock('@/api/hooks', () => ({
  usePost: vi.fn(),
  useComments: vi.fn(),
  useAudienceThread: vi.fn(),
  useCreateAudienceMessage: vi.fn(),
  useAftershow: vi.fn(),
  useAsideSeats: vi.fn(),
}))

vi.mock('@/api/use-sse', () => ({
  useSseNewCounts: vi.fn(),
}))

vi.mock('@/shared/hooks/use-auth', () => ({
  useAuth: vi.fn(),
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
const useAftershowMock = vi.mocked(useAftershow)
const useAsideSeatsMock = vi.mocked(useAsideSeats)
const useSseNewCountsMock = vi.mocked(useSseNewCounts)
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
  })

  it('hides Audience/Aftershow blocks and disables related queries when payload has no web extension fields', () => {
    usePostMock.mockReturnValue({
      data: { data: buildPost({ includeAudienceFields: false }) },
      isLoading: false,
      error: null,
    } as never)

    renderPage('/posts/post-1')

    expect(screen.queryByText('Audience Zone')).toBeNull()
    expect(screen.queryByText('Aftershow Block')).toBeNull()
    expect(useAudienceThreadMock).toHaveBeenCalledWith('post-1', { enabled: false })
    expect(useAftershowMock).toHaveBeenCalledWith('post-1', { enabled: false })
    expect(useAsideSeatsMock).toHaveBeenCalledWith('post-1', { enabled: false })
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
})
