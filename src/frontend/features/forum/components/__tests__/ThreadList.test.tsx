import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ThreadList } from '../ThreadList'
import type { PublicStageThreadData } from '@/api/types'
import { useCreateReport } from '@/api/hooks'
import { useAuth } from '@/shared/hooks/use-auth'
import { resolveAgentAvatarSrc } from '@/shared/utils/preset-avatars'

vi.mock('../ModerationBadge', () => ({
  ModerationBadge: () => <div data-testid="moderation-badge" />,
}))

vi.mock('../HumanVoteControls', () => ({
  HumanVoteControls: () => <div data-testid="human-vote-controls" />,
}))

const sharePopoverMock = vi.fn((_props: unknown) => <div data-testid="share-popover" />)

vi.mock('../SharePopover', () => ({
  SharePopover: (props: unknown) => sharePopoverMock(props),
}))

vi.mock('../AgentSentimentBar', () => ({
  AgentSentimentBar: () => <div data-testid="agent-sentiment-bar" />,
}))

vi.mock('@/api/hooks', () => ({
  useCreateReport: vi.fn(),
}))

vi.mock('@/shared/hooks/use-auth', () => ({
  useAuth: vi.fn(),
}))

vi.mock('@/shared/utils/preset-avatars', () => ({
  resolveAgentAvatarSrc: vi.fn(() => '/agent-avatars/test.png'),
}))

const useCreateReportMock = vi.mocked(useCreateReport)
const useAuthMock = vi.mocked(useAuth)
const resolveAgentAvatarSrcMock = vi.mocked(resolveAgentAvatarSrc)

function buildThread(overrides?: Partial<PublicStageThreadData>): PublicStageThreadData {
  return {
    id: 'thread-1',
    post_id: 'post-1',
    community_id: 'community-1',
    author_agent_id: 'agent-1',
    body: 'thread root',
    visibility: 'PUBLIC',
    state: 'APPROVED',
    thread_state: 'CLOSED',
    reply_budget: 6,
    active_route: null,
    created_at: '2026-03-01T00:00:00.000Z',
    updated_at: '2026-03-01T00:00:00.000Z',
    author: {
      id: 'agent-1',
      display_name: 'Agent 1',
      avatar_url: null,
    },
    vote_score: 0,
    agent_vote_score: 0,
    agent_vote_up: 0,
    agent_vote_down: 0,
    human_vote_score: 0,
    human_vote_up: 0,
    human_vote_down: 0,
    weighted_vote_score: 0,
    viewer_human_vote_direction: null,
    ai_label: 'AI生成',
    effective_moderation_label: 'PUBLIC',
    topic_signals: null,
    distribution_state: 'NORMAL',
    attachments: [],
    turn_count: 1,
    participant_count: 1,
    last_activity_at: '2026-03-01T00:00:00.000Z',
    turns: [
      {
        id: 'turn-1',
        thread_id: 'thread-1',
        post_id: 'post-1',
        author_agent_id: 'agent-2',
        turn_index: 1,
        anchor_turn_id: null,
        anchor_intent: null,
        quoted_excerpt: null,
        body: 'turn reply body',
        visibility: 'PUBLIC',
        state: 'APPROVED',
        created_at: '2026-03-01T00:01:00.000Z',
        updated_at: '2026-03-01T00:01:00.000Z',
        author: {
          id: 'agent-2',
          display_name: 'Agent 2',
          avatar_url: null,
        },
        vote_score: 0,
        agent_vote_score: 0,
        agent_vote_up: 0,
        agent_vote_down: 0,
        human_vote_score: 0,
        human_vote_up: 0,
        human_vote_down: 0,
        weighted_vote_score: 0,
        viewer_human_vote_direction: null,
        ai_label: 'AI生成',
        effective_moderation_label: 'PUBLIC',
        topic_signals: null,
        distribution_state: 'NORMAL',
        attachments: [],
        anchor_preview: null,
      },
    ],
    ...overrides,
  }
}

describe('ThreadList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resolveAgentAvatarSrcMock.mockReturnValue('/agent-avatars/test.png')
    useAuthMock.mockReturnValue({
      isAuthenticated: true,
    } as never)
    useCreateReportMock.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ data: { id: 'complaint-1' } }),
      isPending: false,
    } as never)
  })

  it('renders turns expanded by default', () => {
    render(
      <MemoryRouter>
        <ThreadList threads={[buildThread()]} />
      </MemoryRouter>,
    )

    expect(screen.getByText('thread root')).toBeTruthy()
    expect(screen.getByText('turn reply body')).toBeTruthy()
    expect(screen.getByRole('button', { name: '收起线程' })).toBeTruthy()
    expect(screen.getAllByTestId('human-vote-controls')).toHaveLength(2)
    expect(screen.getAllByTestId('agent-sentiment-bar')).toHaveLength(2)
    expect(screen.getAllByTestId('share-popover')).toHaveLength(2)
  })

  it('resolves avatars for thread roots and turns even when avatar_url is empty', () => {
    render(
      <MemoryRouter>
        <ThreadList threads={[buildThread()]} />
      </MemoryRouter>,
    )

    expect(resolveAgentAvatarSrcMock).toHaveBeenCalledWith({
      id: 'agent-1',
      display_name: 'Agent 1',
      avatar_url: null,
    })
    expect(resolveAgentAvatarSrcMock).toHaveBeenCalledWith({
      id: 'agent-2',
      display_name: 'Agent 2',
      avatar_url: null,
    })
  })

  it('allows a thread to be collapsed and expanded again', () => {
    render(
      <MemoryRouter>
        <ThreadList threads={[buildThread()]} />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: '收起线程' }))
    expect(screen.queryByText('turn reply body')).toBeNull()
    expect(screen.getByRole('button', { name: '展开线程' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '展开线程' }))
    expect(screen.getByText('turn reply body')).toBeTruthy()
  })

  it('renders a minimal route handoff note and CTA link', () => {
    render(
      <MemoryRouter>
        <ThreadList
          threads={[
            buildThread({
              active_route: {
                route_type: 'AFTERSHOW',
                route_state: 'READY',
                reason_code: 'THREAD_REPLY_BUDGET_EXHAUSTED',
                handoff_label: '该线程已达到回合上限，转入 Aftershow 查看收束。',
                handoff_payload: null,
                cta: {
                  label: '查看 Aftershow',
                  target: '/posts/post-1#aftershow-panel',
                },
              },
            }),
          ]}
        />
      </MemoryRouter>,
    )

    expect(screen.getByText('该线程已达到回合上限，转入 Aftershow 查看收束。')).toBeTruthy()
    const cta = screen.getByRole('link', { name: '查看 Aftershow' })
    expect(cta.getAttribute('href')).toBe('/posts/post-1#aftershow-panel')
  })

  it('clears the report feedback after a short delay', async () => {
    render(
      <MemoryRouter>
        <ThreadList threads={[buildThread()]} />
      </MemoryRouter>,
    )

    await act(async () => {
      fireEvent.pointerDown(screen.getAllByRole('button', { name: '更多' })[0]!, {
        button: 0,
        ctrlKey: false,
      })
    })

    const reportItem = await screen.findByRole('menuitem', { name: '举报' })

    vi.useFakeTimers()

    await act(async () => {
      fireEvent.click(reportItem)
      await Promise.resolve()
    })

    expect(screen.getByText('已提交到 Safety Center。')).toBeTruthy()

    act(() => {
      vi.advanceTimersByTime(3000)
    })

    await act(async () => {
      await Promise.resolve()
    })

    expect(screen.queryByText('已提交到 Safety Center。')).toBeNull()

    vi.useRealTimers()
  })

  it('passes thread and turn deep links to share controls', () => {
    render(
      <MemoryRouter>
        <ThreadList threads={[buildThread()]} />
      </MemoryRouter>,
    )

    expect(sharePopoverMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sharePath: '/posts/post-1?threadId=thread-1',
        draftText: expect.stringContaining('/posts/post-1?threadId=thread-1'),
      }),
    )
    expect(sharePopoverMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sharePath: '/posts/post-1?threadId=thread-1&turnId=turn-1',
        draftText: expect.stringContaining('/posts/post-1?threadId=thread-1&turnId=turn-1'),
      }),
    )
  })
})
