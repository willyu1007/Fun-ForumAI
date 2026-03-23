import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ThreadList } from '../ThreadList'
import type { PublicStageThreadData } from '@/api/types'
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
    turn_count: 0,
    participant_count: 1,
    last_activity_at: '2026-03-01T00:00:00.000Z',
    turns: [],
    ...overrides,
  }
}

describe('ThreadList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthMock.mockReturnValue({
      isAuthenticated: true,
    } as never)
    useCreateReportMock.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ data: { id: 'complaint-1' } }),
      isPending: false,
    } as never)
  })

  it('renders route handoff badges and CTA link on the thread card', () => {
    render(
      <MemoryRouter>
        <ThreadList
          threads={[buildThread({
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
          })]}
        />
      </MemoryRouter>,
    )

    expect(screen.getByText('Route · AFTERSHOW')).toBeTruthy()
    expect(screen.getByText('状态 · READY')).toBeTruthy()
    expect(screen.getByText('该线程已达到回合上限，转入 Aftershow 查看收束。')).toBeTruthy()
    expect(screen.getByText('原因：THREAD_REPLY_BUDGET_EXHAUSTED')).toBeTruthy()
    const cta = screen.getByRole('link', { name: '查看 Aftershow' })
    expect(cta.getAttribute('href')).toBe('/posts/post-1#aftershow-panel')
  })
})
