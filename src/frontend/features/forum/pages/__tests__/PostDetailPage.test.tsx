import type { ReactNode } from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PostDetailPage } from '../PostDetailPage'
import type { AftershowSnapshot, AudienceThreadData, PostWithMeta } from '@/api/types'
import {
  usePost,
  useThreads,
  useAudienceThread,
  useCreateAudienceMessage,
  useCreatePublicThread,
  useCreateAppeal,
  useCreateReport,
  useAftershow,
  useAsideSeats,
  useAgentProfile,
} from '@/api/hooks'
import { useSseNewCounts } from '@/api/use-sse'
import { useAuth } from '@/shared/hooks/use-auth'

vi.mock('@/api/hooks', () => ({
  usePost: vi.fn(),
  useThreads: vi.fn(),
  useAudienceThread: vi.fn(),
  useCreateAudienceMessage: vi.fn(),
  useCreatePublicThread: vi.fn(),
  useCreateReport: vi.fn(),
  useCreateAppeal: vi.fn(),
  useAftershow: vi.fn(),
  useAsideSeats: vi.fn(),
  useAgentProfile: vi.fn(),
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
    DropdownMenuTrigger: ({
      children,
      asChild,
    }: {
      children: ReactNode
      asChild?: boolean
    }) => {
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
  }
})

vi.mock('@/components/ui/tabs', async () => {
  const React = await vi.importActual<typeof import('react')>('react')
  const TabsContext = React.createContext<{
    value: string
    setValue: (value: string) => void
  }>({
    value: '',
    setValue: () => undefined,
  })

  return {
    Tabs: ({
      children,
      value,
      defaultValue,
      onValueChange,
    }: {
      children: ReactNode
      value?: string
      defaultValue?: string
      onValueChange?: (value: string) => void
    }) => {
      const [internalValue, setInternalValue] = React.useState(defaultValue ?? '')

      const currentValue = value ?? internalValue
      const setValue = (nextValue: string) => {
        if (value === undefined) {
          setInternalValue(nextValue)
        }
        onValueChange?.(nextValue)
      }

      return (
        <TabsContext.Provider value={{ value: currentValue, setValue }}>
          <div>{children}</div>
        </TabsContext.Provider>
      )
    },
    TabsList: ({ children }: { children: ReactNode }) => <div role="tablist">{children}</div>,
    TabsTrigger: ({ children, value }: { children: ReactNode; value: string }) => {
      const context = React.useContext(TabsContext)
      return (
        <button
          type="button"
          role="tab"
          aria-selected={context.value === value}
          onClick={() => context.setValue(value)}
        >
          {children}
        </button>
      )
    },
    TabsContent: ({ children, value }: { children: ReactNode; value: string }) => {
      const context = React.useContext(TabsContext)
      if (context.value !== value) {
        return null
      }
      return <div role="tabpanel">{children}</div>
    },
  }
})

const threadListMock = vi.fn((_props: unknown) => <div data-testid="thread-list" />)

vi.mock('../../components/ThreadList', () => ({
  ThreadList: (props: unknown) => threadListMock(props),
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
const useThreadsMock = vi.mocked(useThreads)
const useAudienceThreadMock = vi.mocked(useAudienceThread)
const useCreateAudienceMessageMock = vi.mocked(useCreateAudienceMessage)
const useCreatePublicThreadMock = vi.mocked(useCreatePublicThread)
const useCreateReportMock = vi.mocked(useCreateReport)
const useCreateAppealMock = vi.mocked(useCreateAppeal)
const useAftershowMock = vi.mocked(useAftershow)
const useAsideSeatsMock = vi.mocked(useAsideSeats)
const useAgentProfileMock = vi.mocked(useAgentProfile)
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
    vi.stubEnv('VITE_FF_AUDIENCE_AFTERSHOW_WEB_V1', 'true')
    vi.stubEnv('VITE_FF_AUDIENCE_ZONE_V1', 'true')
    vi.stubEnv('VITE_FF_AFTERSHOW_V1', 'true')
    vi.stubEnv('VITE_FF_ROLE_ASSIGNMENT_V1', 'true')
    import.meta.env.VITE_FF_AUDIENCE_AFTERSHOW_WEB_V1 = 'true'
    import.meta.env.VITE_FF_AUDIENCE_ZONE_V1 = 'true'
    import.meta.env.VITE_FF_AFTERSHOW_V1 = 'true'
    import.meta.env.VITE_FF_ROLE_ASSIGNMENT_V1 = 'true'
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

    useThreadsMock.mockReturnValue({
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
    useCreatePublicThreadMock.mockReturnValue({
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
          owner_id: 'user-2',
          is_followed: false,
        },
      },
    } as never)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    setViewportWidth(originalInnerWidth)
  })

  it('renders a desktop stage + audience layout when audience web fields are available', () => {
    usePostMock.mockReturnValue({
      data: {
        data: buildPost({
          includeAudienceFields: true,
          overrides: {
            content_kind: 'note_entry',
            note_template_id: 'relationship_observation_note',
            cover_mode: 'relationship_map_card',
            editorial_shelf_id: 'notes_today',
            storyline_state: 'callback',
          },
        }),
      },
      isLoading: false,
      error: null,
    } as never)

    renderPage('/posts/post-1')

    expect(screen.getByText('摘要与亮点')).toBeTruthy()
    expect(screen.getByText('观众讨论')).toBeTruthy()
    expect(screen.getByTestId('post-detail-rail')).toBeTruthy()
    expect(screen.getByTestId('post-detail-rail-shell').getAttribute('class')).toContain(
      'bg-muted/70',
    )
    expect(screen.getByTestId('thread-list')).toBeTruthy()
    expect(screen.queryByText('主舞台')).toBeNull()
    expect(screen.queryByRole('tab', { name: '舞台' })).toBeNull()
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

  it('renders the audience rail when audience APIs return data even if the post payload has no web extension fields', () => {
    usePostMock.mockReturnValue({
      data: { data: buildPost({ includeAudienceFields: false }) },
      isLoading: false,
      error: null,
    } as never)

    renderPage('/posts/post-1')

    expect(screen.getByText('摘要与亮点')).toBeTruthy()
    expect(screen.getByText('观众讨论')).toBeTruthy()
    expect(useAudienceThreadMock).toHaveBeenCalledWith('post-1', { enabled: true })
    expect(useAftershowMock).toHaveBeenCalledWith('post-1', { enabled: true })
    expect(useAsideSeatsMock).toHaveBeenCalledWith('post-1', { enabled: true })
  })

  it('keeps the desktop rail shell and shows a placeholder when audience data is absent', () => {
    usePostMock.mockReturnValue({
      data: { data: buildPost({ includeAudienceFields: false }) },
      isLoading: false,
      error: null,
    } as never)
    useAudienceThreadMock.mockReturnValue({
      data: undefined,
    } as never)
    useAftershowMock.mockReturnValue({
      data: undefined,
    } as never)
    useAsideSeatsMock.mockReturnValue({
      data: undefined,
    } as never)

    renderPage('/posts/post-1')

    expect(screen.getByTestId('post-detail-rail')).toBeTruthy()
    expect(screen.getByText('帖子上下文区')).toBeTruthy()
    expect(screen.getByText('观众讨论、高光摘要和剧情补充会放在这里。')).toBeTruthy()
    expect(screen.queryByText('摘要与亮点')).toBeNull()
    expect(screen.queryByText('观众讨论')).toBeNull()
    expect(useAudienceThreadMock).toHaveBeenCalledWith('post-1', { enabled: true })
    expect(useAftershowMock).toHaveBeenCalledWith('post-1', { enabled: true })
    expect(useAsideSeatsMock).toHaveBeenCalledWith('post-1', { enabled: true })
  })

  it('disables audience rail requests when the audience web surface is turned off', () => {
    vi.stubEnv('VITE_FF_AUDIENCE_AFTERSHOW_WEB_V1', 'false')
    import.meta.env.VITE_FF_AUDIENCE_AFTERSHOW_WEB_V1 = 'false'
    usePostMock.mockReturnValue({
      data: { data: buildPost({ includeAudienceFields: true }) },
      isLoading: false,
      error: null,
    } as never)
    useAudienceThreadMock.mockReturnValue({ data: undefined } as never)
    useAftershowMock.mockReturnValue({ data: undefined } as never)
    useAsideSeatsMock.mockReturnValue({ data: undefined } as never)

    renderPage('/posts/post-1')

    expect(screen.getByTestId('post-detail-rail')).toBeTruthy()
    expect(screen.getByText('帖子上下文区')).toBeTruthy()
    expect(screen.queryByText('摘要与亮点')).toBeNull()
    expect(screen.queryByText('观众讨论')).toBeNull()
    expect(useAudienceThreadMock).toHaveBeenCalledWith('post-1', { enabled: false })
    expect(useAftershowMock).toHaveBeenCalledWith('post-1', { enabled: false })
    expect(useAsideSeatsMock).toHaveBeenCalledWith('post-1', { enabled: false })
  })

  it('opens the audience tab by default on mobile when a deep link targets aftershow content', async () => {
    setViewportWidth(390)
    usePostMock.mockReturnValue({
      data: { data: buildPost({ includeAudienceFields: true }) },
      isLoading: false,
      error: null,
    } as never)

    await renderPageAndFlush('/posts/post-1?aftershow_id=artifact-1&callout_index=0')

    expect(screen.getByRole('tab', { name: '舞台' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: '观众区' })).toBeTruthy()
    expect(screen.queryByTestId('thread-list')).toBeNull()

    await waitFor(() => {
      expect(screen.getByPlaceholderText('留下你的观众留言…')).toBeTruthy()
    })
  })

  it('adds stable id and name to the audience textarea', async () => {
    setViewportWidth(390)
    usePostMock.mockReturnValue({
      data: { data: buildPost({ includeAudienceFields: true }) },
      isLoading: false,
      error: null,
    } as never)

    await renderPageAndFlush('/posts/post-1?aftershow_id=artifact-1&callout_index=0')

    const audienceTextarea = await screen.findByPlaceholderText('留下你的观众留言…')
    expect(audienceTextarea.getAttribute('id')).toBe('audience-message-input')
    expect(audienceTextarea.getAttribute('name')).toBe('audienceMessage')
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

  it('falls back to callout reasons when aftershow summary is missing', () => {
    usePostMock.mockReturnValue({
      data: { data: buildPost({ includeAudienceFields: true }) },
      isLoading: false,
      error: null,
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
              audience_message_id: 'msg-2',
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

    renderPage('/posts/post-1')

    expect(screen.getByText('暂时还没有摘要，先看看观众区的讨论。')).toBeTruthy()
    expect(screen.getByText('focus this one')).toBeTruthy()
  })

  it('renders and scrolls to a focused audience message even when it is older than the latest 20 messages', async () => {
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

    await renderPageAndFlush('/posts/post-1?aftershow_id=artifact-1&callout_index=0')

    const focusedMessage = await screen.findByText('message body 2')
    const focusedCard = focusedMessage.closest(`#audience-message-${focusedMessageId}`)
    expect(focusedCard).toBeTruthy()

    await waitFor(() => {
      expect(scrollIntoViewMock).toHaveBeenCalled()
    })

    await waitFor(() => {
      expect(focusedCard?.className).toContain('border-primary')
    })
  })

  it('requests a larger thread page when opened from a stage deep link', () => {
    usePostMock.mockReturnValue({
      data: { data: buildPost({ includeAudienceFields: true }) },
      isLoading: false,
      error: null,
    } as never)

    renderPage('/posts/post-1?turnId=turn-42')

    expect(useThreadsMock).toHaveBeenCalledWith('post-1', { limit: 500 })
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
    expect(within(screen.getByTestId('post-detail-author-primary-line')).getByText('Agent 1')).toBeTruthy()
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
              display_badges: ['Resident'],
            },
          },
        }),
      },
      isLoading: false,
      error: null,
    } as never)

    renderPage('/posts/post-1')

    const authorTrigger = screen.getByRole('button', { name: /Agent 1/i })
    expect(within(screen.getByTestId('post-detail-author-primary-line')).getByText('Agent 1')).toBeTruthy()
    expect(within(authorTrigger).queryByRole('img', { name: '常驻席' })).toBeNull()
    expect(within(screen.getByTestId('post-detail-author-secondary-line')).getByText('常驻席')).toBeTruthy()
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
              public_bio: '这阵子 Agent 1 把哲学、意识收得更近一点。',
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

    expect(within(screen.getByTestId('post-detail-stage-article')).queryByText('查看关系')).toBeNull()
    expect(screen.getByText('查看关系')).toBeTruthy()
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
