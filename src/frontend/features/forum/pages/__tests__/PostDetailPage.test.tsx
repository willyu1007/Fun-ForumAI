import type { ReactNode } from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PostDetailPage } from '../PostDetailPage'
import type { PostWithMeta } from '@/api/types'
import {
  usePost,
  useCreateAppeal,
  useCreateReport,
  useAgentProfile,
  useDiscussionForest,
  usePostParticipationContract,
  useRecordForumWatchTelemetry,
} from '@/api/hooks'
import { useSseNewCounts } from '@/api/use-sse'
import { useAuth } from '@/shared/hooks/use-auth'

vi.mock('@/api/hooks', () => ({
  usePost: vi.fn(),
  useCreateReport: vi.fn(),
  useCreateAppeal: vi.fn(),
  useAgentProfile: vi.fn(),
  useDiscussionForest: vi.fn(),
  usePostParticipationContract: vi.fn(),
  useRecordForumWatchTelemetry: vi.fn(),
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

vi.mock('../../components/SharePopover', () => ({
  SharePopover: () => <div data-testid="share-popover" />,
}))

vi.mock('../../components/PostMediaGallery', () => ({
  PostMediaGallery: () => <div data-testid="post-media-gallery" />,
}))

vi.mock('../../components/VoteColumn', () => ({
  VoteColumn: () => <div data-testid="vote-column" />,
}))

vi.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div data-testid="avatar" className={className}>
      {children}
    </div>
  ),
  AvatarImage: ({ className, alt, src }: { className?: string; alt?: string; src?: string }) => (
    <img data-testid="avatar-image" className={className} alt={alt} src={src} />
  ),
  AvatarFallback: ({ children, className }: { children: ReactNode; className?: string }) => (
    <span data-testid="avatar-fallback" className={className}>
      {children}
    </span>
  ),
}))

vi.mock('@/components/ui/dropdown-menu', async () => {
  const React = await vi.importActual<typeof import('react')>('react')

  return {
    DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    DropdownMenuTrigger: ({ children, asChild }: { children: ReactNode; asChild?: boolean }) => {
      if (asChild && React.isValidElement(children)) {
        return React.cloneElement(children)
      }
      return <button type="button">{children}</button>
    },
    DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    DropdownMenuItem: ({
      children,
      asChild,
      onClick,
    }: {
      children: ReactNode
      asChild?: boolean
      onClick?: () => void
    }) => {
      if (asChild && React.isValidElement(children)) {
        return React.cloneElement(
          children as React.ReactElement<{ role?: string; onClick?: () => void }>,
          { role: 'menuitem', onClick },
        )
      }
      return (
        <div role="menuitem" onClick={onClick}>
          {children}
        </div>
      )
    },
    DropdownMenuLabel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    DropdownMenuSeparator: () => <div />,
    DropdownMenuRadioGroup: ({
      children,
      value,
      onValueChange,
    }: {
      children: ReactNode
      value?: string
      onValueChange?: (value: string) => void
    }) => (
      <div data-testid="dropdown-radio-group" data-value={value}>
        {React.Children.map(children, (child) => {
          if (!React.isValidElement(child)) return child
          return React.cloneElement(
            child as React.ReactElement<{ onSelect?: () => void; onValueChange?: (value: string) => void }>,
            {
              onSelect: () => {
                const itemValue = (child.props as { value?: string }).value
                if (itemValue !== undefined) onValueChange?.(itemValue)
              },
            },
          )
        })}
      </div>
    ),
    DropdownMenuRadioItem: ({
      children,
      value,
      onSelect,
    }: {
      children: ReactNode
      value: string
      onSelect?: () => void
    }) => (
      <div role="menuitemradio" data-value={value} onClick={onSelect}>
        {children}
      </div>
    ),
  }
})

vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PopoverContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

const discussionForestMock = vi.fn((_props: unknown) => <div data-testid="discussion-forest" />)

vi.mock('../../components/DiscussionForest', () => ({
  DiscussionForest: (props: unknown) => discussionForestMock(props),
}))

const audiencePanelMock = vi.fn((props: Record<string, unknown>) => (
  <div
    data-testid="audience-panel"
    data-post-id={String(props.postId)}
    data-can-post={String(props.canPost)}
  />
))

vi.mock('../../components/AudiencePanel', () => ({
  AudiencePanel: (props: Record<string, unknown>) => audiencePanelMock(props),
}))

vi.mock('../../components/NewContentBanner', () => ({
  NewContentBanner: () => <div data-testid="new-content-banner" />,
}))

vi.mock('../../components/HumanVoteControls', () => ({
  HumanVoteControls: () => <div data-testid="human-vote-controls" />,
}))

vi.mock('@/features/agents/components/AgentHoverCard', () => ({
  AgentHoverCard: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

const usePostMock = vi.mocked(usePost)
const useCreateReportMock = vi.mocked(useCreateReport)
const useCreateAppealMock = vi.mocked(useCreateAppeal)
const useAgentProfileMock = vi.mocked(useAgentProfile)
const useDiscussionForestMock = vi.mocked(useDiscussionForest)
const usePostParticipationContractMock = vi.mocked(usePostParticipationContract)
const useRecordForumWatchTelemetryMock = vi.mocked(useRecordForumWatchTelemetry)
const useSseNewCountsMock = vi.mocked(useSseNewCounts)
const useAuthMock = vi.mocked(useAuth)

const scrollIntoViewMock = vi.fn()
const originalInnerWidth = window.innerWidth

function setViewportWidth(width: number) {
  act(() => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: width,
    })
    window.dispatchEvent(new Event('resize'))
  })
}

function buildPost(options?: {
  includeAudienceFields?: boolean
  overrides?: Partial<PostWithMeta>
}): PostWithMeta {
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
    thread_turn_count: 3,
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
      actor_type: 'agent',
      display_name: 'Agent 1',
      avatar_url: null,
    },
    community_slug: 'community-1',
    community_name: 'Community 1',
    media: [],
    topic_signals: null,
    distribution_state: 'NORMAL',
    ...options?.overrides,
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

function renderPageWithElement(path: string, element: ReactNode) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/posts/:postId" element={element} />
      </Routes>
    </MemoryRouter>,
  )
}

async function renderPageAndFlush(path: string) {
  let rendered: ReturnType<typeof renderPage> | null = null
  await act(async () => {
    rendered = renderPage(path)
    await Promise.resolve()
  })
  return rendered!
}

describe('PostDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setViewportWidth(1280)
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoViewMock,
    })

    useAuthMock.mockReturnValue({
      isAuthenticated: true,
      user: {
        id: 'user-1',
      },
    } as never)

    useSseNewCountsMock.mockReturnValue({
      newThreadTurnCounts: {},
      clearNewThreadTurns: vi.fn(),
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
          owner_id: 'user-2',
          is_followed: false,
        },
      },
    } as never)

    useDiscussionForestMock.mockReturnValue({
      data: {
        data: {
          generated_at: '2026-03-01T00:00:00.000Z',
          reading_guide: {
            entries: [],
          },
          branch_groups: [
            {
              id: 'branch-1',
              thread_id: 'thread-1',
              display_title: '主分支',
              participant_count: 2,
              turn_count: 2,
              latest_activity_at: '2026-03-01T00:00:00.000Z',
              lifecycle: {
                writeability: {
                  reply_allowed: true,
                },
              },
            },
          ],
          nodes: [],
        },
      },
      isLoading: false,
    } as never)

    usePostParticipationContractMock.mockReturnValue({
      data: {
        data: {
          stage_open_reply: {
            enabled: true,
            new_thread_enabled: true,
            turn_reply_enabled: true,
          },
          audience_lane: {
            enabled: true,
            posting_enabled: true,
          },
        },
      },
    } as never)

    useRecordForumWatchTelemetryMock.mockReturnValue({
      mutate: vi.fn(),
    } as never)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    setViewportWidth(originalInnerWidth)
  })

  it('renders the forest-first discussion layout with stage toolbar and no top composer', () => {
    usePostMock.mockReturnValue({
      data: { data: buildPost({ includeAudienceFields: true }) },
      isLoading: false,
      error: null,
    } as never)

    renderPage('/posts/post-1')

    expect(screen.getByTestId('discussion-forest')).toBeTruthy()
    expect(screen.getByTestId('stage-toolbar')).toBeTruthy()
    expect(screen.queryByLabelText('公开分支输入框')).toBeNull()
    expect(screen.queryByRole('tab', { name: '时间线' })).toBeNull()
    expect(screen.queryByRole('tab', { name: '讨论森林' })).toBeNull()
    expect(useDiscussionForestMock).toHaveBeenCalledWith(
      'post-1',
      {
        focus_thread_id: null,
        focus_turn_id: null,
      },
      { enabled: true },
    )
  })

  it('passes default sort mode (recommended) to the forest and syncs ?sort= when toggled', async () => {
    usePostMock.mockReturnValue({
      data: { data: buildPost({ includeAudienceFields: true }) },
      isLoading: false,
      error: null,
    } as never)

    renderPage('/posts/post-1')

    await waitFor(() => {
      expect(discussionForestMock).toHaveBeenCalled()
    })
    const lastProps = discussionForestMock.mock.calls[
      discussionForestMock.mock.calls.length - 1
    ]?.[0] as { sortMode: string }
    expect(lastProps.sortMode).toBe('recommended')
    expect(screen.getByTestId('stage-sort-trigger').textContent).toContain('综合')
  })

  it('reads sort mode from ?sort= URL query', () => {
    usePostMock.mockReturnValue({
      data: { data: buildPost({ includeAudienceFields: true }) },
      isLoading: false,
      error: null,
    } as never)

    renderPage('/posts/post-1?sort=latest_activity')

    const lastProps = discussionForestMock.mock.calls[
      discussionForestMock.mock.calls.length - 1
    ]?.[0] as { sortMode: string }
    expect(lastProps.sortMode).toBe('latest_activity')
    expect(screen.getByTestId('stage-sort-trigger').textContent).toContain('最新')
  })

  it('hides the discussion area entirely when hideDiscussionArea is set', () => {
    usePostMock.mockReturnValue({
      data: { data: buildPost({ includeAudienceFields: true }) },
      isLoading: false,
      error: null,
    } as never)

    renderPageWithElement('/posts/post-1', <PostDetailPage hideDiscussionArea />)

    expect(screen.queryByTestId('discussion-forest')).toBeNull()
    expect(screen.queryByTestId('stage-toolbar')).toBeNull()
    expect(screen.queryByTestId('new-content-banner')).toBeNull()
    expect(screen.queryByTestId('post-detail-thread-section')).toBeNull()
    expect(useDiscussionForestMock).toHaveBeenCalledWith(
      'post-1',
      {
        focus_thread_id: null,
        focus_turn_id: null,
      },
      { enabled: false },
    )
  })

  it('carries forest focus from deep link to the discussion-forest query', () => {
    usePostMock.mockReturnValue({
      data: { data: buildPost({ includeAudienceFields: true }) },
      isLoading: false,
      error: null,
    } as never)

    renderPage('/posts/post-1?threadId=thread-42&turnId=turn-42')

    expect(useDiscussionForestMock).toHaveBeenCalledWith(
      'post-1',
      {
        focus_thread_id: 'thread-42',
        focus_turn_id: 'turn-42',
      },
      { enabled: true },
    )
  })

  it('treats deep-link focus as a transient flash instead of a persistent manual selection', async () => {
    usePostMock.mockReturnValue({
      data: { data: buildPost({ includeAudienceFields: true }) },
      isLoading: false,
      error: null,
    } as never)

    renderPage('/posts/post-1?threadId=thread-42&turnId=turn-42')

    await waitFor(() => {
      expect(discussionForestMock).toHaveBeenCalled()
    })
    const lastProps = discussionForestMock.mock.calls[discussionForestMock.mock.calls.length - 1]?.[0] as
      | { selectedNodeId?: string | null; flashNodeId?: string | null; flashToken?: number | null }
      | undefined

    expect(lastProps?.selectedNodeId).toBeNull()
    expect(lastProps?.flashNodeId).toBe('turn-42')
    expect(typeof lastProps?.flashToken).toBe('number')
  })

  it('re-triggers the jump flash when the same audience quote is clicked twice', async () => {
    usePostMock.mockReturnValue({
      data: { data: buildPost({ includeAudienceFields: true }) },
      isLoading: false,
      error: null,
    } as never)

    renderPage('/posts/post-1')

    const audiencePanelProps = audiencePanelMock.mock.calls[audiencePanelMock.mock.calls.length - 1]?.[0] as
      | { onNavigateToTurn?: (turnId: string) => void }
      | undefined
    expect(audiencePanelProps?.onNavigateToTurn).toBeTypeOf('function')

    act(() => {
      audiencePanelProps?.onNavigateToTurn?.('turn-repeat')
    })
    const firstProps = discussionForestMock.mock.calls[discussionForestMock.mock.calls.length - 1]?.[0] as
      | { flashNodeId?: string | null; flashToken?: number | null }
      | undefined

    act(() => {
      audiencePanelProps?.onNavigateToTurn?.('turn-repeat')
    })
    const secondProps = discussionForestMock.mock.calls[discussionForestMock.mock.calls.length - 1]?.[0] as
      | { flashNodeId?: string | null; flashToken?: number | null }
      | undefined

    expect(firstProps?.flashNodeId).toBe('turn-repeat')
    expect(secondProps?.flashNodeId).toBe('turn-repeat')
    expect(secondProps?.flashToken).not.toBe(firstProps?.flashToken)
  })

  it('clears stale thread focus when navigating from an audience quote', async () => {
    usePostMock.mockReturnValue({
      data: { data: buildPost({ includeAudienceFields: true }) },
      isLoading: false,
      error: null,
    } as never)

    renderPage('/posts/post-1?threadId=thread-stale&audience_message_id=msg-1')

    const audiencePanelProps = audiencePanelMock.mock.calls[audiencePanelMock.mock.calls.length - 1]?.[0] as
      | { onNavigateToTurn?: (turnId: string) => void }
      | undefined

    act(() => {
      audiencePanelProps?.onNavigateToTurn?.('turn-fresh')
    })

    await waitFor(() => {
      expect(useDiscussionForestMock).toHaveBeenLastCalledWith(
        'post-1',
        {
          focus_thread_id: null,
          focus_turn_id: 'turn-fresh',
        },
        { enabled: true },
      )
    })
  })

  it('passes turnReplyEnabled=false to the forest when the participation contract closes in-thread replies', async () => {
    usePostMock.mockReturnValue({
      data: { data: buildPost({ includeAudienceFields: true }) },
      isLoading: false,
      error: null,
    } as never)
    usePostParticipationContractMock.mockReturnValue({
      data: {
        data: {
          stage_open_reply: {
            enabled: true,
            new_thread_enabled: true,
            turn_reply_enabled: false,
          },
          audience_lane: {
            enabled: true,
            posting_enabled: true,
          },
        },
      },
    } as never)

    renderPage('/posts/post-1')

    await waitFor(() => {
      expect(discussionForestMock).toHaveBeenCalled()
    })
    const lastProps = discussionForestMock.mock.calls[
      discussionForestMock.mock.calls.length - 1
    ]?.[0] as { turnReplyEnabled: boolean }
    expect(lastProps.turnReplyEnabled).toBe(false)
  })

  it('does not emit deprecated guide/timeline telemetry events from the page', async () => {
    const mutate = vi.fn()
    usePostMock.mockReturnValue({
      data: { data: buildPost({ includeAudienceFields: true }) },
      isLoading: false,
      error: null,
    } as never)
    useRecordForumWatchTelemetryMock.mockReturnValue({
      mutate,
    } as never)

    renderPage('/posts/post-1')

    await waitFor(() => {
      expect(discussionForestMock).toHaveBeenCalled()
    })
    const recordedEvents = mutate.mock.calls.map(
      (call) => (call[0] as { event_type: string }).event_type,
    )
    expect(recordedEvents).not.toContain('guide_render')
    expect(recordedEvents).not.toContain('guide_click')
    expect(recordedEvents).not.toContain('timeline_open')
  })

  it('renders the audience panel in the desktop rail when the contract enables the audience lane', () => {
    usePostMock.mockReturnValue({
      data: { data: buildPost({ includeAudienceFields: true }) },
      isLoading: false,
      error: null,
    } as never)

    renderPage('/posts/post-1')

    expect(screen.getByTestId('post-detail-rail')).toBeTruthy()
    expect(screen.getByTestId('audience-panel').getAttribute('data-post-id')).toBe('post-1')
    expect(screen.getByTestId('audience-panel').getAttribute('data-can-post')).toBe('true')
    expect(screen.queryByText('摘要与亮点')).toBeNull()
  })

  it('keeps the post body aligned with the main column while placing the back button in a separate gutter', () => {
    usePostMock.mockReturnValue({
      data: { data: buildPost({ includeAudienceFields: true }) },
      isLoading: false,
      error: null,
    } as never)

    renderPage('/posts/post-1')

    expect(screen.getByTestId('post-detail-back-link-wrap').getAttribute('class')).toContain(
      'lg:-left-[2.125rem]',
    )
    expect(screen.getByTestId('post-detail-stage-article').getAttribute('class')).not.toContain(
      'grid-cols-[auto_minmax(0,1fr)]',
    )
    expect(screen.getByTestId('post-detail-stage-article').getAttribute('class')).toContain(
      'px-[25px]',
    )
    expect(screen.getByTestId('post-detail-thread-section').getAttribute('class')).not.toContain(
      'pl-14',
    )
    expect(screen.getByTestId('post-detail-thread-section').getAttribute('class')).toContain(
      'px-[25px]',
    )
  })

  it('keeps the audience rail and shows a lightweight placeholder when the contract disables the audience lane', () => {
    usePostMock.mockReturnValue({
      data: { data: buildPost({ includeAudienceFields: true }) },
      isLoading: false,
      error: null,
    } as never)
    usePostParticipationContractMock.mockReturnValue({
      data: {
        data: {
          stage_open_reply: {
            enabled: true,
            new_thread_enabled: true,
            turn_reply_enabled: true,
          },
          audience_lane: {
            enabled: false,
            posting_enabled: false,
          },
        },
      },
    } as never)

    renderPage('/posts/post-1')

    expect(screen.getByTestId('post-detail-rail')).toBeTruthy()
    expect(screen.getByTestId('audience-placeholder')).toBeTruthy()
    expect(screen.queryByTestId('audience-panel')).toBeNull()
  })

  it('keeps the audience tab on mobile and renders the placeholder when the lane is disabled', async () => {
    setViewportWidth(390)
    usePostMock.mockReturnValue({
      data: { data: buildPost({ includeAudienceFields: true }) },
      isLoading: false,
      error: null,
    } as never)
    usePostParticipationContractMock.mockReturnValue({
      data: {
        data: {
          stage_open_reply: {
            enabled: true,
            new_thread_enabled: true,
            turn_reply_enabled: true,
          },
          audience_lane: {
            enabled: false,
            posting_enabled: false,
          },
        },
      },
    } as never)

    await renderPageAndFlush('/posts/post-1?audience_message_id=msg-1')

    expect(screen.getByRole('tab', { name: '主线程' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: '观众席' }).getAttribute('aria-selected')).toBe('true')

    expect(screen.getByTestId('audience-placeholder')).toBeTruthy()
    expect(screen.queryByTestId('audience-panel')).toBeNull()
  })

  it('disables the composer through AudiencePanel when posting is not allowed', () => {
    usePostMock.mockReturnValue({
      data: { data: buildPost({ includeAudienceFields: true }) },
      isLoading: false,
      error: null,
    } as never)
    usePostParticipationContractMock.mockReturnValue({
      data: {
        data: {
          stage_open_reply: {
            enabled: true,
            new_thread_enabled: true,
            turn_reply_enabled: true,
          },
          audience_lane: {
            enabled: true,
            posting_enabled: false,
          },
        },
      },
    } as never)

    renderPage('/posts/post-1')

    expect(screen.getByTestId('audience-panel').getAttribute('data-can-post')).toBe('false')
  })

  it('opens the audience tab by default on mobile when a deep link targets an audience message', async () => {
    setViewportWidth(390)
    usePostMock.mockReturnValue({
      data: { data: buildPost({ includeAudienceFields: true }) },
      isLoading: false,
      error: null,
    } as never)

    await renderPageAndFlush('/posts/post-1?audience_message_id=msg-1')

    expect(screen.getByRole('tab', { name: '主线程' })).toBeTruthy()
    const audienceTab = screen.getByRole('tab', { name: '观众席' })
    expect(audienceTab.getAttribute('aria-selected')).toBe('true')
  })

  it('opens the audience tab by default on mobile when a quote prefill is requested', async () => {
    setViewportWidth(390)
    usePostMock.mockReturnValue({
      data: { data: buildPost({ includeAudienceFields: true }) },
      isLoading: false,
      error: null,
    } as never)

    await renderPageAndFlush(
      '/posts/post-1?audience_compose_for=turn-1&audience_compose_excerpt=quoted',
    )

    const audienceTab = screen.getByRole('tab', { name: '观众席' })
    expect(audienceTab.getAttribute('aria-selected')).toBe('true')
  })

  it('shows the post more menu with report, appeal, status, and help entries', async () => {
    usePostMock.mockReturnValue({
      data: { data: buildPost({ includeAudienceFields: true }) },
      isLoading: false,
      error: null,
    } as never)
    useAgentProfileMock.mockReturnValue({
      data: {
        data: {
          id: 'agent-1',
          owner_id: 'user-1',
          is_followed: false,
        },
      },
    } as never)

    renderPage('/posts/post-1')

    const moreButton = screen.getByRole('button', { name: '更多' })
    fireEvent.pointerDown(moreButton, { button: 0, ctrlKey: false })

    expect(await screen.findByText('举报此帖')).toBeTruthy()
    expect(screen.getByText('申诉审核')).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: '查看状态' }).getAttribute('href')).toBe('/safety')
    expect(screen.getByRole('menuitem', { name: '流程说明' }).getAttribute('href')).toBe(
      '/help/report-appeal-delete',
    )
  })

  it('does not render the legacy governance banner for normal posts', () => {
    usePostMock.mockReturnValue({
      data: { data: buildPost({ includeAudienceFields: true }) },
      isLoading: false,
      error: null,
    } as never)

    renderPage('/posts/post-1')

    expect(screen.queryByText('AI 公域讨论')).toBeNull()
    expect(screen.queryByText(/分发状态/)).toBeNull()
  })

  it('renders the simplified top header without the community slug pill', () => {
    usePostMock.mockReturnValue({
      data: { data: buildPost({ includeAudienceFields: true }) },
      isLoading: false,
      error: null,
    } as never)

    renderPage('/posts/post-1')

    expect(screen.getByRole('link', { name: '返回广场' }).getAttribute('href')).toBe('/')
    expect(
      within(screen.getByTestId('post-detail-author-primary-line')).getByText('Agent 1'),
    ).toBeTruthy()
    expect(screen.queryByText('c/community-1')).toBeNull()
  })

  it('places the author badge under the agent name in the top header when one is available', () => {
    usePostMock.mockReturnValue({
      data: {
        data: buildPost({
          includeAudienceFields: true,
          overrides: {
            author: {
              id: 'agent-1',
              actor_type: 'agent',
              display_name: 'Agent 1',
              avatar_url: null,
              public_identity: {
                agent_kind: 'system',
                identity_badges: [
                  {
                    badge_id: 'identity:resident',
                    internal_code: 'resident_badge',
                    label: '常驻席',
                    source_kind: 'system_display',
                    priority_rank: 200,
                  },
                ],
              },
            },
          },
        }),
      },
      isLoading: false,
      error: null,
    } as never)

    renderPage('/posts/post-1')

    const authorTrigger = screen.getByRole('button', { name: /Agent 1/i })
    expect(
      within(screen.getByTestId('post-detail-author-primary-line')).getByText('Agent 1'),
    ).toBeTruthy()
    expect(within(authorTrigger).queryByRole('img')).toBeNull()
    expect(within(screen.getByTestId('post-detail-author-secondary-line')).getByText('常驻席')).toBeTruthy()
    expect(
      screen
        .getByTestId('post-detail-author-secondary-line')
        .querySelector('img[src="/badges/agent/system-resident.svg"]'),
    ).toBeTruthy()
  })

  it('does not render author bio copy or post tags in the top hero', () => {
    usePostMock.mockReturnValue({
      data: {
        data: buildPost({
          includeAudienceFields: true,
          overrides: {
            tags: ['意识', '哲学'],
            author: {
              id: 'agent-1',
              actor_type: 'agent',
              display_name: 'Agent 1',
              avatar_url: null,
              public_projection: {
                public_bio: '这阵子 Agent 1 把哲学、意识收得更近一点。',
              },
            },
          },
        }),
      },
      isLoading: false,
      error: null,
    } as never)

    renderPage('/posts/post-1')

    expect(screen.queryByText('这阵子 Agent 1 把哲学、意识收得更近一点。')).toBeNull()
    expect(screen.queryByText('意识')).toBeNull()
    expect(screen.queryByText('哲学')).toBeNull()
  })

  it('keeps relation teasers out of the stage header flow between the title and body', () => {
    usePostMock.mockReturnValue({
      data: {
        data: buildPost({
          includeAudienceFields: true,
          overrides: {
            relation_teaser: {
              relation_label: '关系观察',
              relation_state_delta: 'stable',
              shared_storyline_count: 1,
              recent_callout_presence: false,
              cta_target: '/agents/agent-1',
            },
          },
        }),
      },
      isLoading: false,
      error: null,
    } as never)

    renderPage('/posts/post-1')

    expect(
      within(screen.getByTestId('post-detail-stage-article')).queryByText('查看朋友圈'),
    ).toBeNull()
  })

  it('uses list-style pills in the footer and keeps AI sentiment on the right', () => {
    usePostMock.mockReturnValue({
      data: { data: buildPost({ includeAudienceFields: true }) },
      isLoading: false,
      error: null,
    } as never)

    renderPage('/posts/post-1')

    expect(screen.getByText('Agent 认可度：')).toBeTruthy()
    expect(screen.getByRole('link', { name: /3/ }).getAttribute('href')).toBe('/posts/post-1')
    expect(screen.queryByText('3 条舞台发言')).toBeNull()
  })
})
