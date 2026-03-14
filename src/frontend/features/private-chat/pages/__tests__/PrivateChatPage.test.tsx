import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PrivateChatPage } from '../PrivateChatPage'
import {
  useAgentProfile,
  useCreatePrivateSession,
  useCreateReport,
  useEndPrivateSession,
  useGuidanceInbox,
  usePrivateMessages,
  usePrivateSessions,
  useSendPrivateMessage,
} from '@/api/hooks'
import { isGuidanceEnabled } from '@/features/guidance/feature-flags'
import { usePrivateSessionSse } from '../../hooks/use-private-session-sse'

vi.mock('@/api/hooks', () => ({
  useAgentProfile: vi.fn(),
  useCreateReport: vi.fn(),
  useGuidanceInbox: vi.fn(),
  usePrivateSessions: vi.fn(),
  usePrivateMessages: vi.fn(),
  useCreatePrivateSession: vi.fn(),
  useSendPrivateMessage: vi.fn(),
  useEndPrivateSession: vi.fn(),
}))

vi.mock('../../hooks/use-private-session-sse', () => ({
  usePrivateSessionSse: vi.fn(),
}))

vi.mock('@/features/guidance/feature-flags', () => ({
  isGuidanceEnabled: vi.fn(),
}))

vi.mock('../components/MessageInput', () => ({
  MessageInput: () => <div data-testid="message-input" />,
}))

vi.mock('../components/SessionSidebar', () => ({
  SessionSidebar: () => <div data-testid="session-sidebar" />,
}))

vi.mock('@/features/guidance/components/GuidanceItemCard', () => ({
  GuidanceItemCard: () => <div data-testid="guidance-item-card" />,
}))

const useAgentProfileMock = vi.mocked(useAgentProfile)
const useCreateReportMock = vi.mocked(useCreateReport)
const useGuidanceInboxMock = vi.mocked(useGuidanceInbox)
const usePrivateSessionsMock = vi.mocked(usePrivateSessions)
const usePrivateMessagesMock = vi.mocked(usePrivateMessages)
const useCreatePrivateSessionMock = vi.mocked(useCreatePrivateSession)
const useSendPrivateMessageMock = vi.mocked(useSendPrivateMessage)
const useEndPrivateSessionMock = vi.mocked(useEndPrivateSession)
const isGuidanceEnabledMock = vi.mocked(isGuidanceEnabled)
const usePrivateSessionSseMock = vi.mocked(usePrivateSessionSse)

describe('PrivateChatPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Element.prototype.scrollIntoView = vi.fn()
    isGuidanceEnabledMock.mockReturnValue(false)
    usePrivateSessionSseMock.mockReturnValue({ phase: 'connected', reconnectAttempts: 0 })
    useAgentProfileMock.mockReturnValue({
      data: {
        data: {
          id: 'agent-1',
          display_name: 'Moon Agent',
        },
      },
      isLoading: false,
    } as never)
    usePrivateSessionsMock.mockReturnValue({
      data: {
        data: {
          items: [
            {
              id: 'session-1',
              agent_id: 'agent-1',
              human_user_id: 'user-1',
              status: 'ACTIVE',
              initiator: 'AGENT',
              trigger_type: 'VOTE_RECEIVED',
              trigger_ref: 'post-1',
              started_at: '2026-03-12T10:00:00.000Z',
              ended_at: null,
              digest_status: 'PENDING',
            },
          ],
        },
      },
      isLoading: false,
    } as never)
    usePrivateMessagesMock.mockReturnValue({
      data: {
        data: {
          items: [
            {
              id: 'message-1',
              session_id: 'session-1',
              author_type: 'AGENT',
              content: '想和你聊聊刚才那条动态。',
              created_at: '2026-03-12T10:00:01.000Z',
            },
          ],
        },
      },
      isLoading: false,
    } as never)
    useCreatePrivateSessionMock.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      isError: false,
    } as never)
    useSendPrivateMessageMock.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      isError: false,
    } as never)
    useEndPrivateSessionMock.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      isSuccess: false,
      isError: false,
    } as never)
    useGuidanceInboxMock.mockReturnValue({ data: undefined } as never)
    useCreateReportMock.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ data: { id: 'complaint-private-1' } }),
      isPending: false,
    } as never)
  })

  it('submits a private-session report from the proactive-session banner', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ data: { id: 'complaint-private-2' } })
    useCreateReportMock.mockReturnValue({
      mutateAsync,
      isPending: false,
    } as never)

    render(
      <MemoryRouter initialEntries={['/agents/agent-1/chat']}>
        <Routes>
          <Route path="/agents/:agentId/chat" element={<PrivateChatPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(usePrivateMessagesMock).toHaveBeenCalledWith('agent-1', 'session-1')
    expect(usePrivateSessionSseMock).toHaveBeenCalledWith('session-1', 'agent-1')

    expect(screen.getByRole('link', { name: '实名规则' }).getAttribute('href')).toBe('/help/private-chat-verification')

    fireEvent.click(await screen.findByRole('button', { name: '发起主动私信治理' }))

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        target_type: 'private_session',
        target_id: 'session-1',
        complaint_type: 'HARASSMENT_REPORT',
        reason_code: 'proactive_private_session_report',
        detail_text: 'Reported from private chat with Moon Agent: session-1',
      })
    })

    expect(await screen.findByText('私聊治理请求已提交，可在 Safety Center 查看处理进度。')).toBeTruthy()
  })
})
