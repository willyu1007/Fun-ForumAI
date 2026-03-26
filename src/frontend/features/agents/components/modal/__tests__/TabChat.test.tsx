import type { ReactNode } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrivateMessage, PrivateSession } from '@/api/types'
import { TabChat } from '../TabChat'

const useAgentProfileMock = vi.fn()
const useCreateReportMock = vi.fn()
const useGuidanceInboxMock = vi.fn()
const usePrivateSessionsMock = vi.fn()
const usePrivateMessageTimelineMock = vi.fn()
const useCreatePrivateSessionMock = vi.fn()
const useSendPrivateMessageMock = vi.fn()
const useUploadPrivateMessageAttachmentMock = vi.fn()
const useEndPrivateSessionMock = vi.fn()
const messageInputToolbarState = {
  disabled: false,
  hasAttachment: false,
  ending: false,
}

vi.mock('@/api/hooks', () => ({
  useAgentProfile: (agentId: string) => useAgentProfileMock(agentId),
  useCreateReport: () => useCreateReportMock(),
  useGuidanceInbox: () => useGuidanceInboxMock(),
  usePrivateSessions: (agentId: string) => usePrivateSessionsMock(agentId),
  usePrivateMessageTimeline: (agentId: string, sessions: PrivateSession[]) =>
    usePrivateMessageTimelineMock(agentId, sessions),
  useCreatePrivateSession: (agentId: string) => useCreatePrivateSessionMock(agentId),
  useSendPrivateMessage: (agentId: string, sessionId: string) =>
    useSendPrivateMessageMock(agentId, sessionId),
  useUploadPrivateMessageAttachment: (agentId: string, sessionId: string) =>
    useUploadPrivateMessageAttachmentMock(agentId, sessionId),
  useEndPrivateSession: (agentId: string, sessionId: string) =>
    useEndPrivateSessionMock(agentId, sessionId),
}))

vi.mock('@/features/private-chat/components/MessageInput', () => ({
  MessageInput: ({
    sessionEnded,
    toolbar,
  }: {
    sessionEnded?: boolean
    toolbar?: (context: {
      openFilePicker: () => void
      captureScreenshot: () => void
      insertText: (value: string) => void
      disabled: boolean
      hasAttachment: boolean
      onEndSession: () => void
      ending: boolean
    }) => ReactNode
  }) => (
    <div data-testid="message-input" data-session-ended={sessionEnded ? 'true' : 'false'}>
      {toolbar?.({
        openFilePicker: vi.fn(),
        captureScreenshot: vi.fn(),
        insertText: vi.fn(),
        disabled: messageInputToolbarState.disabled,
        hasAttachment: messageInputToolbarState.hasAttachment,
        onEndSession: vi.fn(),
        ending: messageInputToolbarState.ending,
      })}
    </div>
  ),
}))

vi.mock('@/features/private-chat/hooks/use-private-session-sse', () => ({
  usePrivateSessionSse: () => undefined,
}))

vi.mock('@/features/guidance/components/GuidanceItemCard', () => ({
  GuidanceItemCard: () => null,
}))

vi.mock('@/features/guidance/feature-flags', () => ({
  isGuidanceEnabled: () => false,
}))

vi.mock('@/shared/hooks/use-auth', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      email: 'owner@example.com',
      displayName: 'Owner',
      avatarUrl: null,
      planTier: 'FREE',
      role: 'user',
    },
    isAuthenticated: true,
  }),
}))

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, ...props }: React.ComponentProps<'div'>) => <div {...props}>{children}</div>,
}))

vi.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children, ...props }: React.ComponentProps<'div'>) => <div {...props}>{children}</div>,
  AvatarImage: (props: React.ComponentProps<'img'>) => <img {...props} />,
  AvatarFallback: ({ children, ...props }: React.ComponentProps<'div'>) => <div {...props}>{children}</div>,
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: React.ComponentProps<'span'>) => <span {...props}>{children}</span>,
}))

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: (props: React.ComponentProps<'div'>) => <div {...props} />,
}))

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <>{children}</>,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children, ...props }: React.ComponentProps<'div'>) => <div {...props}>{children}</div>,
  DropdownMenuItem: ({ children, onSelect, asChild: _asChild, ...props }: React.ComponentProps<'button'> & { asChild?: boolean; onSelect?: (event: Event & { preventDefault: () => void }) => void }) => (
    <button
      type="button"
      {...props}
      onClick={() => onSelect?.({ preventDefault() {} } as Event & { preventDefault: () => void })}
    >
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: () => null,
}))

function buildSession(input: {
  id: string
  agentId: string
  status: PrivateSession['status']
  startedAt: string
}): PrivateSession {
  return {
    id: input.id,
    agent_id: input.agentId,
    human_user_id: 'user-1',
    status: input.status,
    initiator: 'HUMAN',
    trigger_type: null,
    trigger_ref: null,
    started_at: input.startedAt,
    ended_at: input.status === 'ACTIVE' ? null : '2026-03-24T11:00:00.000Z',
    digest_status: 'COMPLETED',
  }
}

function buildMessage(sessionId: string, content: string, createdAt: string): PrivateMessage {
  return {
    id: `${sessionId}-${content}`,
    session_id: sessionId,
    author_type: 'HUMAN',
    content,
    attachments: [],
    delivery_status: 'DELIVERED',
    moderation_metadata: null,
    created_at: createdAt,
  }
}

function renderWithRouter(ui: ReactNode) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

describe('TabChat timeline layout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    messageInputToolbarState.disabled = false
    messageInputToolbarState.hasAttachment = false
    messageInputToolbarState.ending = false
    ;(HTMLElement.prototype as { scrollIntoView?: (arg?: unknown) => void }).scrollIntoView = vi.fn()

    useCreateReportMock.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    })
    useGuidanceInboxMock.mockReturnValue({ data: { data: { items: [] } } })
    useCreatePrivateSessionMock.mockReturnValue({
      mutateAsync: vi.fn(async () => ({ data: { id: 'session-agent-2-new' } })),
      isPending: false,
      isError: false,
      error: null,
    })
    useSendPrivateMessageMock.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    })
    useUploadPrivateMessageAttachmentMock.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    })
    useEndPrivateSessionMock.mockReturnValue({
      mutateAsync: vi.fn(),
      isSuccess: false,
      isError: false,
      error: null,
    })
    useAgentProfileMock.mockImplementation((agentId: string) => ({
      data: {
        data: {
          id: agentId,
          display_name: agentId === 'agent-1' ? '合规助手' : '辩论大师',
        },
      },
      isLoading: false,
    }))

    usePrivateSessionsMock.mockImplementation((agentId: string) => ({
      data: {
        data: {
          items:
            agentId === 'agent-1'
              ? [
                  buildSession({
                    id: 'session-agent-1-active',
                    agentId,
                    status: 'ACTIVE',
                    startedAt: '2026-03-25T09:00:00.000Z',
                  }),
                ]
              : [
                  buildSession({
                    id: 'session-agent-2-empty',
                    agentId,
                    status: 'ENDED',
                    startedAt: '2026-03-23T09:00:00.000Z',
                  }),
                  buildSession({
                    id: 'session-agent-2-ended',
                    agentId,
                    status: 'ENDED',
                    startedAt: '2026-03-24T09:00:00.000Z',
                  }),
                  buildSession({
                    id: 'session-agent-2-active',
                    agentId,
                    status: 'ACTIVE',
                    startedAt: '2026-03-25T09:30:00.000Z',
                  }),
                ],
        },
      },
      isLoading: false,
    }))

    usePrivateMessageTimelineMock.mockImplementation((_agentId: string, sessions: PrivateSession[]) => ({
      items: sessions.map((session) => ({
        session,
        messages:
          session.id === 'session-agent-2-empty'
            ? []
            : session.id === 'session-agent-2-ended'
              ? [buildMessage(session.id, '第一轮记录', '2026-03-24T09:10:00.000Z')]
              : session.id === 'session-agent-2-active'
                ? [buildMessage(session.id, '第二轮记录', '2026-03-25T09:40:00.000Z')]
                : [buildMessage(session.id, '当前记录', '2026-03-25T09:10:00.000Z')],
      })),
      isLoading: false,
      isError: false,
      error: null,
    }))
  })

  it('switches to the new agent timeline instead of reusing the previous agent session state', async () => {
    const view = renderWithRouter(<TabChat agentId="agent-1" />)

    await waitFor(() => {
      expect(usePrivateMessageTimelineMock).toHaveBeenCalledWith(
        'agent-1',
        expect.arrayContaining([expect.objectContaining({ id: 'session-agent-1-active' })]),
      )
    })

    usePrivateMessageTimelineMock.mockClear()

    act(() => {
      view.rerender(
        <MemoryRouter>
          <TabChat agentId="agent-2" />
        </MemoryRouter>,
      )
    })

    await waitFor(() => {
        expect(usePrivateMessageTimelineMock).toHaveBeenCalledWith(
          'agent-2',
          expect.arrayContaining([
            expect.objectContaining({ id: 'session-agent-2-empty' }),
            expect.objectContaining({ id: 'session-agent-2-ended' }),
            expect.objectContaining({ id: 'session-agent-2-active' }),
          ]),
      )
    })

    expect(screen.getByTestId('session-timeline-session-agent-2-active').getAttribute('data-active')).toBe('true')
    expect(screen.queryByTestId('session-timeline-session-agent-1-active')).toBeNull()
  })

  it('renders a single timeline and exposes lightweight composer tools without a history menu', async () => {
    renderWithRouter(<TabChat agentId="agent-2" />)

    await waitFor(() => {
      expect(screen.getByTestId('session-timeline-session-agent-2-ended')).toBeTruthy()
    })

    expect(screen.getByTestId('session-timeline-session-agent-2-active')).toBeTruthy()
    expect(screen.queryByTestId('session-timeline-session-agent-2-empty')).toBeNull()
    expect(screen.getByTestId('composer-emoji-trigger')).toBeTruthy()
    expect(screen.getByTestId('composer-attachment-trigger')).toBeTruthy()
    expect(screen.getByTestId('composer-screenshot-trigger')).toBeTruthy()
    expect(screen.getByTestId('composer-search-trigger')).toBeTruthy()
    expect(screen.getByTestId('composer-new-session-trigger')).toBeTruthy()
    expect(screen.getByTestId('composer-more-trigger')).toBeTruthy()
    expect(screen.queryByTestId('composer-history-trigger')).toBeNull()
  })

  it('keeps upload and screenshot hover copy available when an attachment already exists', async () => {
    messageInputToolbarState.hasAttachment = true

    renderWithRouter(<TabChat agentId="agent-2" />)

    await waitFor(() => {
      expect(screen.getByTestId('composer-attachment-trigger')).toBeTruthy()
    })

    const attachmentTrigger = screen.getByTestId('composer-attachment-trigger')
    const screenshotTrigger = screen.getByTestId('composer-screenshot-trigger')

    expect(attachmentTrigger.getAttribute('title')).toBe('当前一次只能附一张图片，先移除现有图片后再上传。')
    expect(attachmentTrigger.getAttribute('aria-disabled')).toBe('true')
    expect(attachmentTrigger.className).toContain('opacity-70')
    expect(screenshotTrigger.getAttribute('title')).toBe('当前一次只能附一张图片，先移除现有图片后再截图。')
    expect(screenshotTrigger.getAttribute('aria-disabled')).toBe('true')
    expect(screenshotTrigger.className).toContain('opacity-70')
  })

  it('opens the inline search without showing the old empty-state helper copy', async () => {
    renderWithRouter(<TabChat agentId="agent-2" />)

    await waitFor(() => {
      expect(screen.getByTestId('composer-search-trigger')).toBeTruthy()
    })

    fireEvent.click(screen.getByTestId('composer-search-trigger'))

    expect(screen.getByPlaceholderText('搜索这段聊天')).toBeTruthy()
    expect(screen.queryByText('输入关键词')).toBeNull()
  })

  it('opens private chat rules inside the modal instead of navigating away', async () => {
    renderWithRouter(<TabChat agentId="agent-2" />)

    await waitFor(() => {
      expect(screen.getByTestId('composer-more-trigger')).toBeTruthy()
    })

    expect(screen.getByTestId('private-chat-rules-panel').className).toContain('pointer-events-none')

    fireEvent.click(screen.getByRole('button', { name: '查看私聊规则' }))

    expect(screen.getByTestId('private-chat-rules-panel').className).toContain('pointer-events-auto')
    expect(screen.getByText('私聊实名审核要求')).toBeTruthy()
    expect(screen.getByTestId('composer-more-trigger').getAttribute('title')).toBeNull()
  })

  it('keeps composing against the active session even when that fresh session has no visible messages yet', async () => {
    usePrivateMessageTimelineMock.mockImplementation((_agentId: string, sessions: PrivateSession[]) => ({
      items: sessions.map((session) => ({
        session,
        messages:
          session.id === 'session-agent-2-ended'
            ? [buildMessage(session.id, '上一轮记录', '2026-03-24T09:10:00.000Z')]
            : [],
      })),
      isLoading: false,
      isError: false,
      error: null,
    }))

    renderWithRouter(<TabChat agentId="agent-2" />)

    await waitFor(() => {
      expect(screen.getByTestId('message-input').getAttribute('data-session-ended')).toBe('false')
    })

    expect(useSendPrivateMessageMock).toHaveBeenLastCalledWith('agent-2', 'session-agent-2-active')
  })

  it('keeps the chat shell vertically constrained so the thread area can scroll', async () => {
    renderWithRouter(<TabChat agentId="agent-2" />)

    await waitFor(() => {
      expect(screen.getByTestId('session-timeline-session-agent-2-active')).toBeTruthy()
    })

    expect(screen.getByTestId('private-chat-root').className).toContain('min-h-0')
    expect(screen.getByTestId('private-chat-root').className).toContain('overflow-hidden')
    expect(screen.getByTestId('private-chat-main-area').className).toContain('min-h-0')
    expect(screen.getByTestId('private-chat-main-area').className).toContain('overflow-hidden')
    expect(screen.getByTestId('private-chat-thread-scroll-area').className).toContain('min-h-0')
  })
})
