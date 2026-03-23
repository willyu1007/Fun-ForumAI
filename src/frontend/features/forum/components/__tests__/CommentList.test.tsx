import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CommentList } from '../CommentList'
import type { Comment } from '@/api/types'
import { useCreateReport } from '@/api/hooks'
import { useAuth } from '@/shared/hooks/use-auth'

vi.mock('../ModerationBadge', () => ({
  ModerationBadge: () => <div data-testid="moderation-badge" />,
}))

vi.mock('../VoteDisplay', () => ({
  VoteDisplay: () => <div data-testid="vote-display" />,
}))

vi.mock('../HumanVoteControls', () => ({
  HumanVoteControls: () => <div data-testid="human-vote-controls" />,
}))

vi.mock('@/api/hooks', () => ({
  useCreateReport: vi.fn(),
}))

vi.mock('@/shared/hooks/use-auth', () => ({
  useAuth: vi.fn(),
}))

const useCreateReportMock = vi.mocked(useCreateReport)
const useAuthMock = vi.mocked(useAuth)
const scrollIntoViewMock = vi.fn()

function buildComment(
  body: string,
  overrides?: Partial<Comment> & { id?: string; parent_comment_id?: string | null },
): Comment {
  return {
    id: overrides?.id ?? 'comment-1',
    post_id: 'post-1',
    parent_comment_id: overrides?.parent_comment_id ?? null,
    author_agent_id: 'agent-1',
    body,
    visibility: 'PUBLIC',
    state: 'APPROVED',
    created_at: '2026-03-01T00:00:00.000Z',
    updated_at: '2026-03-01T00:00:00.000Z',
    author: {
      id: 'agent-1',
      display_name: 'Agent 1',
      avatar_url: null,
    },
    vote_score: 0,
    weighted_vote_score: 0,
    human_vote_up: 0,
    human_vote_down: 0,
    viewer_human_vote_direction: null,
    ...overrides,
  }
}

describe('CommentList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoViewMock,
    })
    useAuthMock.mockReturnValue({
      isAuthenticated: true,
    } as never)
    useCreateReportMock.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ data: { id: 'complaint-1' } }),
      isPending: false,
    } as never)
  })

  it('renders numbered comment bodies as a list instead of one long paragraph', () => {
    render(
      <MemoryRouter>
        <CommentList comments={[buildComment('一句结论\n\n1. 第一条\n2. 第二条')]} />
      </MemoryRouter>,
    )

    expect(screen.getByText('一句结论')).toBeTruthy()
    expect(screen.getByText('第一条')).toBeTruthy()
    expect(screen.getByText('第二条')).toBeTruthy()
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })

  it('submits a comment report and renders the safety-center callback copy', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ data: { id: 'complaint-2' } })
    useCreateReportMock.mockReturnValue({
      mutateAsync,
      isPending: false,
    } as never)

    render(
      <MemoryRouter>
        <CommentList comments={[buildComment('这条评论需要举报。')]} />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: '举报评论' }))

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        target_type: 'comment',
        target_id: 'comment-1',
        complaint_type: 'CONTENT_REPORT',
        reason_code: 'comment_report',
        detail_text: 'Reported from comment thread: comment-1 · 这条评论需要举报。',
      })
    })

    expect(await screen.findByText('评论举报已提交，可在 Safety Center 查看进度。')).toBeTruthy()
  })

  it('renders hot-topic drift copy for no-recommend comments', () => {
    render(
      <MemoryRouter>
        <CommentList
          comments={[{
            ...buildComment('这条评论被判定为热点漂移。'),
            distribution_state: 'NO_RECOMMEND',
            topic_signals: {
              hot_topic_flag: true,
              topic_domain: 'LIFESTYLE',
              topic_confidence: 0.48,
              drift_detected: true,
              drift_risk_score: 0.84,
              distribution_state: 'NO_RECOMMEND',
              enforcement_reason: 'hot_topic_drift_requires_gray_review',
            },
          }]}
        />
      </MemoryRouter>,
    )

    expect(screen.getByText('热点漂移命中，当前内容保留直达访问，但不会进入推荐流。')).toBeTruthy()
    expect(screen.getByText('识别域：生活方式 · 已命中漂移')).toBeTruthy()
  })

  it('renders the first public attachment below the comment body', () => {
    render(
      <MemoryRouter>
        <CommentList
          comments={[{
            ...buildComment('这条评论带了一张 supporting visual。'),
            attachments: [{
              asset_id: 'asset-1',
              media_url: 'https://example.com/comment-1.jpg',
              mime_type: 'image/jpeg',
              width: 1280,
              height: 720,
              alt_text: '评论配图 alt',
              public_caption: '评论配图 caption',
              slot: 0,
              display_variant: 'original',
            }],
          }]}
        />
      </MemoryRouter>,
    )

    expect(screen.getByRole('img', { name: '评论配图 alt' }).getAttribute('src')).toBe(
      'https://example.com/comment-1.jpg',
    )
    expect(screen.getByText('评论配图 caption')).toBeTruthy()
  })

  it('auto-expands and scrolls to the target comment from a search deep link', async () => {
    render(
      <MemoryRouter>
        <CommentList
          comments={[
            buildComment('根评论', { id: 'comment-1' }),
            buildComment('二级回复', { id: 'comment-2', parent_comment_id: 'comment-1' }),
            buildComment('三级回复', { id: 'comment-3', parent_comment_id: 'comment-2' }),
            buildComment('目标评论', { id: 'comment-4', parent_comment_id: 'comment-3' }),
          ]}
          targetCommentId="comment-4"
        />
      </MemoryRouter>,
    )

    expect(await screen.findByText('目标评论')).toBeTruthy()

    await waitFor(() => {
      expect(scrollIntoViewMock).toHaveBeenCalled()
    })
  })
})
