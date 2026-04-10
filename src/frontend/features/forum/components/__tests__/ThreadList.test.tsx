import type { ComponentProps } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ThreadList } from '../ThreadList'
import type {
  PublicStageThreadDetailData,
  PublicStageThreadSummaryData,
  PublicStageTurnData,
} from '@/api/types'
import { useCreatePublicTurn, useCreateReport, useThread } from '@/api/hooks'
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
  useCreatePublicTurn: vi.fn(),
  useThread: vi.fn(),
}))

vi.mock('@/shared/hooks/use-auth', () => ({
  useAuth: vi.fn(),
}))

vi.mock('@/shared/utils/preset-avatars', () => ({
  resolveAgentAvatarSrc: vi.fn(() => '/agent-avatars/test.png'),
}))

vi.mock('@/components/ui/dropdown-menu', async () => {
  const React = await vi.importActual<typeof import('react')>('react')

  return {
    DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DropdownMenuTrigger: ({
      children,
      asChild,
    }: {
      children: React.ReactNode
      asChild?: boolean
    }) => {
      if (asChild && React.isValidElement(children)) {
        return React.cloneElement(children)
      }
      return <button type="button">{children}</button>
    },
    DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DropdownMenuItem: ({
      children,
      asChild,
      onSelect,
      disabled,
    }: {
      children: React.ReactNode
      asChild?: boolean
      onSelect?: () => void
      disabled?: boolean
    }) => {
      if (asChild && React.isValidElement(children)) {
        return React.cloneElement(children as React.ReactElement<{ role?: string }>, { role: 'menuitem' })
      }
      return (
        <button
          type="button"
          role="menuitem"
          disabled={disabled}
          onClick={() => onSelect?.()}
        >
          {children}
        </button>
      )
    },
  }
})

const useCreateReportMock = vi.mocked(useCreateReport)
const useCreatePublicTurnMock = vi.mocked(useCreatePublicTurn)
const useThreadMock = vi.mocked(useThread)
const useAuthMock = vi.mocked(useAuth)
const resolveAgentAvatarSrcMock = vi.mocked(resolveAgentAvatarSrc)

function buildTurn(overrides?: Partial<PublicStageTurnData>): PublicStageTurnData {
  return {
    id: 'turn-1',
    thread_id: 'thread-1',
    post_id: 'post-1',
    author_actor_type: 'agent',
    author_agent_id: 'agent-2',
    author_user_id: null,
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
      actor_type: 'agent',
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
    ...overrides,
  }
}

function buildSummary(overrides?: Partial<PublicStageThreadSummaryData>): PublicStageThreadSummaryData {
  return {
    id: 'thread-1',
    post_id: 'post-1',
    community_id: 'community-1',
    author_actor_type: 'agent',
    author_agent_id: 'agent-1',
    author_user_id: null,
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
      actor_type: 'agent',
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
    starter_excerpt: 'thread root',
    latest_turn_id: 'turn-1',
    latest_turn_excerpt: 'latest turn excerpt',
    lifecycle: {
      writeability: {
        reply_allowed: true,
      },
    } as PublicStageThreadSummaryData['lifecycle'],
    ...overrides,
  }
}

function buildDetail(overrides?: Partial<PublicStageThreadDetailData>): PublicStageThreadDetailData {
  return {
    ...buildSummary(),
    turns: [buildTurn()],
    turns_meta: {
      requested_cursor: null,
      next_cursor: null,
      limit: 24,
      around_turn_id: null,
      returned_mode: 'full',
    },
    ...overrides,
  }
}

function renderThreadList(props?: Partial<ComponentProps<typeof ThreadList>>) {
  return render(
    <MemoryRouter>
      <ThreadList summaries={[buildSummary()]} {...props} />
    </MemoryRouter>,
  )
}

describe('ThreadList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    })
    resolveAgentAvatarSrcMock.mockReturnValue('/agent-avatars/test.png')
    useAuthMock.mockReturnValue({
      isAuthenticated: true,
    } as never)
    useCreateReportMock.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ data: { id: 'complaint-1' } }),
      isPending: false,
    } as never)
    useCreatePublicTurnMock.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ data: buildDetail() }),
      isPending: false,
    } as never)
    useThreadMock.mockReturnValue({
      data: { data: buildDetail() },
      isLoading: false,
    } as never)
  })

  it('renders thread summaries first and expands detail on demand', async () => {
    renderThreadList()

    expect(screen.getByText('thread root')).toBeTruthy()
    expect(screen.getByText('latest turn excerpt')).toBeTruthy()
    expect(screen.queryByText('turn reply body')).toBeNull()
    expect(screen.getByRole('button', { name: '展开线程' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '展开线程' }))

    expect(screen.getByText('turn reply body')).toBeTruthy()
    expect(screen.getByRole('button', { name: '收起线程' })).toBeTruthy()
  })

  it('loads targeted thread detail around the requested turn for deep links', () => {
    renderThreadList({
      targetThreadId: 'thread-1',
      targetTurnId: 'turn-1',
    })

    expect(useThreadMock).toHaveBeenCalledWith(
      'thread-1',
      {
        turn_limit: 40,
        around_turn_id: 'turn-1',
      },
      { enabled: true },
    )
    expect(screen.getByText('turn reply body')).toBeTruthy()
  })

  it('resolves avatars for thread roots and loaded turns even when avatar_url is empty', async () => {
    renderThreadList()

    fireEvent.click(screen.getByRole('button', { name: '展开线程' }))

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

  it('renders identity and proof chips for summaries and loaded turns', () => {
    useThreadMock.mockReturnValue({
      data: {
        data: buildDetail({
          author: {
            id: 'agent-1',
            actor_type: 'agent',
            display_name: 'Agent 1',
            avatar_url: null,
            public_identity: {
              agent_kind: 'owner',
              identity_badges: [{
                badge_id: 'identity:resident',
                internal_code: 'resident_badge',
                label: '常驻席',
                source_kind: 'default_display',
                priority_rank: 100,
              }],
              identity_visibility_role_id: 'resident',
            },
            public_proof: {
              achievement_badges: [{ code: 'highlight_headliner', name: '今日必看', level: 1 }],
            },
          },
          turns: [
            buildTurn({
              author: {
                id: 'agent-2',
                actor_type: 'agent',
                display_name: 'Agent 2',
                avatar_url: null,
                public_identity: {
                  agent_kind: 'system',
                  identity_badges: [{
                    badge_id: 'identity:host',
                    internal_code: 'host_badge',
                    label: '主持席',
                    source_kind: 'system_display',
                    priority_rank: 200,
                  }],
                  identity_visibility_role_id: 'host',
                },
                public_proof: {
                  achievement_badges: [{ code: 'storyline_driver', name: '剧情续航', level: 1 }],
                },
              },
            }),
          ],
        }),
      },
      isLoading: false,
    } as never)

    renderThreadList({
      summaries: [
        buildSummary({
          author: {
            id: 'agent-1',
            actor_type: 'agent',
            display_name: 'Agent 1',
            avatar_url: null,
            public_identity: {
              agent_kind: 'owner',
              identity_badges: [{
                badge_id: 'identity:resident',
                internal_code: 'resident_badge',
                label: '常驻席',
                source_kind: 'default_display',
                priority_rank: 100,
              }],
              identity_visibility_role_id: 'resident',
            },
            public_proof: {
              achievement_badges: [{ code: 'highlight_headliner', name: '今日必看', level: 1 }],
            },
          },
        }),
      ],
    })

    fireEvent.click(screen.getByRole('button', { name: '展开线程' }))

    expect(screen.getByText('常驻席')).toBeTruthy()
    expect(screen.getByText('主持席')).toBeTruthy()
    expect(screen.getByText('今日必看')).toBeTruthy()
    expect(screen.getByText('剧情续航')).toBeTruthy()
  })

  it('submits timeline replies through the viewer write contract', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ data: buildDetail() })
    useCreatePublicTurnMock.mockReturnValue({
      mutateAsync,
      isPending: false,
    } as never)
    const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(1234)

    try {
      renderThreadList({ enablePublicReplies: true })

      fireEvent.click(screen.getByRole('button', { name: '回复' }))
      fireEvent.change(screen.getByPlaceholderText('加入这条公开线程的回复…'), {
        target: { value: '来自时间线的公开回应' },
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: '发送回复' }))
      })

      expect(mutateAsync).toHaveBeenCalledWith({
        threadId: 'thread-1',
        postId: 'post-1',
        body: '来自时间线的公开回应',
        idempotency_key: 'viewer-timeline:post-1:thread-1:1234',
        source_context: {
          discovered_via: 'timeline',
          source_surface: 'post_detail',
          source_shelf: 'timeline',
        },
      })
    } finally {
      dateNowSpy.mockRestore()
    }
  })

  it('hides timeline reply controls when the thread lifecycle is route-only', () => {
    renderThreadList({
      enablePublicReplies: true,
      summaries: [
        buildSummary({
          active_route: {
            route_type: 'AFTERSHOW',
            route_state: 'READY',
            reason_code: 'THREAD_HANDOFFED',
            handoff_label: '这条线已经转去 Aftershow。',
            handoff_payload: null,
            cta: {
              label: '查看 Aftershow',
              target: '/posts/post-1#aftershow-panel',
            },
          } as PublicStageThreadSummaryData['active_route'],
          lifecycle: {
            writeability: {
              reply_allowed: false,
            },
          } as PublicStageThreadSummaryData['lifecycle'],
        }),
      ],
    })

    expect(screen.queryByRole('button', { name: '回复' })).toBeNull()
    expect(screen.queryByRole('link', { name: '登录后回复' })).toBeNull()
    expect(screen.getByRole('link', { name: '查看 Aftershow' }).getAttribute('href')).toBe(
      '/posts/post-1#aftershow-panel',
    )
  })

  it('hides timeline reply controls when the thread prefers route handoff despite reply_allowed staying true', () => {
    renderThreadList({
      enablePublicReplies: true,
      summaries: [
        buildSummary({
          active_route: {
            route_type: 'AFTERSHOW',
            route_state: 'READY',
            reason_code: 'THREAD_HANDOFFED',
            handoff_label: '这条线已经转去 Aftershow。',
            handoff_payload: null,
            cta: {
              label: '查看 Aftershow',
              target: '/posts/post-1#aftershow-panel',
            },
          } as PublicStageThreadSummaryData['active_route'],
          lifecycle: {
            writeability: {
              reply_allowed: true,
              preferred_action: 'FOLLOW_ROUTE',
            },
          } as PublicStageThreadSummaryData['lifecycle'],
        }),
      ],
    })

    expect(screen.queryByRole('button', { name: '回复' })).toBeNull()
    expect(screen.queryByRole('link', { name: '登录后回复' })).toBeNull()
    expect(screen.getByRole('link', { name: '查看 Aftershow' }).getAttribute('href')).toBe(
      '/posts/post-1#aftershow-panel',
    )
  })

  it('keeps timeline rendering stable when lifecycle metadata is absent', () => {
    renderThreadList({
      enablePublicReplies: true,
      summaries: [
        buildSummary({
          lifecycle: undefined as never,
        }),
      ],
    })

    expect(screen.getByText('thread root')).toBeTruthy()
    expect(screen.queryByRole('button', { name: '回复' })).toBeNull()
    expect(screen.queryByRole('link', { name: '登录后回复' })).toBeNull()
  })

  it('renders route handoff notes and clears report feedback after a short delay', async () => {
    renderThreadList({
      summaries: [
        buildSummary({
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
          } as PublicStageThreadSummaryData['active_route'],
        }),
      ],
    })

    expect(screen.getByText('该线程已达到回合上限，转入 Aftershow 查看收束。')).toBeTruthy()
    expect(screen.getByRole('link', { name: '查看 Aftershow' }).getAttribute('href')).toBe(
      '/posts/post-1#aftershow-panel',
    )

    vi.useFakeTimers()
    try {
      await act(async () => {
        fireEvent.click(screen.getByRole('menuitem', { name: '举报' }))
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
    } finally {
      vi.useRealTimers()
    }
  })

  it('passes thread and turn deep links to share controls', () => {
    renderThreadList()

    fireEvent.click(screen.getByRole('button', { name: '展开线程' }))

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
