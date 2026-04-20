import type { ReactNode } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AudiencePanel } from '../AudiencePanel'
import {
  useAudienceThread,
  useCreateAudienceMessage,
  useDeleteAudienceMessage,
  useToggleAudienceMessageLike,
  useCreateReport,
} from '@/api/hooks'
import type { AudienceMessageWithReplies } from '@/api/types'

vi.mock('@/api/hooks', () => ({
  useAudienceThread: vi.fn(),
  useCreateAudienceMessage: vi.fn(),
  useDeleteAudienceMessage: vi.fn(),
  useToggleAudienceMessageLike: vi.fn(),
  useCreateReport: vi.fn(),
}))

vi.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children, className }: { children: ReactNode; className?: string }) => (
    <span data-testid="avatar" className={className}>
      {children}
    </span>
  ),
  AvatarImage: (props: Record<string, unknown>) => <img data-testid="avatar-image" {...(props as object)} />,
  AvatarFallback: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}))

vi.mock('@/components/ui/dropdown-menu', async () => {
  const React = await vi.importActual<typeof import('react')>('react')
  return {
    DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    DropdownMenuTrigger: ({ children, asChild }: { children: ReactNode; asChild?: boolean }) => {
      if (asChild && React.isValidElement(children)) return React.cloneElement(children)
      return <button type="button">{children}</button>
    },
    DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    DropdownMenuItem: ({
      children,
      onSelect,
      disabled,
      ...rest
    }: {
      children: ReactNode
      onSelect?: (event: { preventDefault: () => void }) => void
      disabled?: boolean
    } & Record<string, unknown>) => (
      <button
        type="button"
        role="menuitem"
        disabled={disabled}
        onClick={() => onSelect?.({ preventDefault: () => {} })}
        {...(rest as object)}
      >
        {children}
      </button>
    ),
    DropdownMenuRadioGroup: ({
      children,
      value,
      onValueChange,
    }: {
      children: ReactNode
      value?: string
      onValueChange?: (value: string) => void
    }) => (
      <div data-testid="sort-radio-group" data-value={value}>
        {React.Children.map(children, (child) => {
          if (!React.isValidElement(child)) return child
          return React.cloneElement(
            child as React.ReactElement<{ onSelect?: () => void }>,
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

const useAudienceThreadMock = vi.mocked(useAudienceThread)
const useCreateAudienceMessageMock = vi.mocked(useCreateAudienceMessage)
const useDeleteAudienceMessageMock = vi.mocked(useDeleteAudienceMessage)
const useToggleAudienceMessageLikeMock = vi.mocked(useToggleAudienceMessageLike)
const useCreateReportMock = vi.mocked(useCreateReport)

function makeMessage(
  overrides: Partial<AudienceMessageWithReplies> & { id: string },
): AudienceMessageWithReplies {
  return {
    thread_id: 'thread-1',
    body: 'hello',
    author: {
      id: 'user-42',
      display_name: 'Neo',
      avatar_url: null,
    },
    parent_message_id: null,
    quoted_turn: null,
    like_count: 0,
    viewer_has_liked: false,
    deleted_at: null,
    created_at: '2026-03-01T00:00:00.000Z',
    updated_at: '2026-03-01T00:00:00.000Z',
    replies: [],
    ...overrides,
  }
}

function setThread(messages: AudienceMessageWithReplies[]) {
  useAudienceThreadMock.mockReturnValue({
    data: { data: { thread: null, sort: 'latest', messages } },
    isLoading: false,
  } as never)
}

describe('AudiencePanel', () => {
  const createMutate = vi.fn()
  const deleteMutate = vi.fn()
  const toggleLikeMutate = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    setThread([])
    useCreateAudienceMessageMock.mockReturnValue({
      mutateAsync: createMutate,
      isPending: false,
    } as never)
    useDeleteAudienceMessageMock.mockReturnValue({
      mutateAsync: deleteMutate,
      isPending: false,
    } as never)
    useToggleAudienceMessageLikeMock.mockReturnValue({
      mutateAsync: toggleLikeMutate,
      isPending: false,
    } as never)
    useCreateReportMock.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as never)
  })

  afterEach(() => {
    createMutate.mockReset()
    deleteMutate.mockReset()
    toggleLikeMutate.mockReset()
  })

  it('shows an empty-state hint when there are no messages', () => {
    render(
      <AudiencePanel postId="post-1" isAuthenticated canPost viewerUserId="user-1" />,
    )
    expect(screen.getByText('还没有观众留言，成为第一个开口的人吧。')).toBeTruthy()
  })

  it('renders a message with author, relative time, and like count', () => {
    setThread([
      makeMessage({
        id: 'msg-1',
        body: 'hello there',
        author: { id: 'user-42', display_name: 'Neo', avatar_url: null },
        like_count: 3,
      }),
    ])
    render(<AudiencePanel postId="post-1" isAuthenticated canPost viewerUserId="user-1" />)
    expect(screen.getByText('Neo')).toBeTruthy()
    expect(screen.getByText('hello there')).toBeTruthy()
    expect(screen.getByTestId('audience-like-button').textContent).toContain('3')
  })

  it('expands composer on click and submits a message with quoted turn', async () => {
    createMutate.mockResolvedValue({
      data: { result: 'ACCEPTED', message: null },
    })
    const onConsume = vi.fn()
    render(
      <AudiencePanel
        postId="post-1"
        isAuthenticated
        canPost
        viewerUserId="user-1"
        composePrefill={{ turn_id: 'turn-1', excerpt: 'quoted body', author_display_name: 'A1' }}
        onConsumePrefill={onConsume}
      />,
    )
    const textarea = await screen.findByTestId('audience-composer-textarea')
    fireEvent.change(textarea, { target: { value: 'my thought' } })
    fireEvent.click(screen.getByTestId('audience-composer-submit'))
    await waitFor(() => {
      expect(createMutate).toHaveBeenCalled()
    })
    const payload = createMutate.mock.calls[0][0]
    expect(payload.body).toBe('my thought')
    expect(payload.quoted_turn).toEqual({
      turn_id: 'turn-1',
      excerpt: 'quoted body',
      author_display_name: 'A1',
    })
    expect(onConsume).toHaveBeenCalled()
  })

  it('toggles a like using the mutation hook', () => {
    setThread([makeMessage({ id: 'msg-1', like_count: 0, viewer_has_liked: false })])
    toggleLikeMutate.mockResolvedValue({
      data: { message_id: 'msg-1', like_count: 1, viewer_has_liked: true },
    })
    render(<AudiencePanel postId="post-1" isAuthenticated canPost viewerUserId="user-1" />)
    fireEvent.click(screen.getByTestId('audience-like-button'))
    expect(toggleLikeMutate).toHaveBeenCalledWith({ messageId: 'msg-1', liked: true })
  })

  it('shows a delete entry for author-owned messages and deletes on click', () => {
    setThread([
      makeMessage({
        id: 'msg-1',
        author: { id: 'user-1', display_name: 'Me', avatar_url: null },
      }),
    ])
    render(<AudiencePanel postId="post-1" isAuthenticated canPost viewerUserId="user-1" />)
    const deleteItem = screen.getByTestId('audience-delete-item')
    fireEvent.click(deleteItem)
    expect(deleteMutate).toHaveBeenCalledWith('msg-1')
  })

  it('hides delete but shows report for messages owned by others', () => {
    setThread([
      makeMessage({
        id: 'msg-1',
        author: { id: 'user-42', display_name: 'Neo', avatar_url: null },
      }),
    ])
    render(<AudiencePanel postId="post-1" isAuthenticated canPost viewerUserId="user-1" />)
    expect(screen.queryByTestId('audience-delete-item')).toBeNull()
    expect(screen.getByTestId('audience-report-item')).toBeTruthy()
  })

  it('renders a one-level reply when the message has replies', () => {
    setThread([
      makeMessage({
        id: 'msg-1',
        body: 'parent msg',
        replies: [
          {
            ...makeMessage({ id: 'reply-1', body: 'child reply' }),
            parent_message_id: 'msg-1',
          },
        ],
      }),
    ])
    render(<AudiencePanel postId="post-1" isAuthenticated canPost viewerUserId="user-1" />)
    expect(screen.getByText('child reply')).toBeTruthy()
  })

  it('navigates to the source turn when a quoted chip is clicked', () => {
    setThread([
      makeMessage({
        id: 'msg-1',
        quoted_turn: {
          turn_id: 'turn-9',
          excerpt: 'origin',
          author_display_name: 'A7',
        },
      }),
    ])
    const onNav = vi.fn()
    render(
      <AudiencePanel
        postId="post-1"
        isAuthenticated
        canPost
        viewerUserId="user-1"
        onNavigateToTurn={onNav}
      />,
    )
    fireEvent.click(screen.getByTestId('audience-quote-chip'))
    expect(onNav).toHaveBeenCalledWith('turn-9')
  })

  it('renders deleted body placeholder when the message is soft-deleted', () => {
    setThread([
      makeMessage({
        id: 'msg-1',
        deleted_at: '2026-03-01T00:00:00.000Z',
      }),
    ])
    render(<AudiencePanel postId="post-1" isAuthenticated canPost viewerUserId="user-1" />)
    expect(screen.getByText('该留言已被删除。')).toBeTruthy()
  })

  it('disables the composer opener when posting is disallowed', () => {
    render(<AudiencePanel postId="post-1" isAuthenticated canPost={false} viewerUserId="user-1" />)
    const opener = screen.getByTestId('audience-composer-open') as HTMLButtonElement
    expect(opener.disabled).toBe(true)
    expect(opener.textContent).toContain('当前帖子不开放观众留言')
  })

  it('changes sort to top via dropdown and refetches', async () => {
    render(<AudiencePanel postId="post-1" isAuthenticated canPost viewerUserId="user-1" />)
    const topItem = screen.getByRole('menuitemradio', { name: '热门' })
    await act(async () => {
      fireEvent.click(topItem)
    })
    const lastCall = useAudienceThreadMock.mock.calls[useAudienceThreadMock.mock.calls.length - 1]
    expect(lastCall?.[1]?.sort).toBe('top')
  })
})
