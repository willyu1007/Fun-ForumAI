import type { ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../../client'
import { queryKeys } from '../../query-keys'
import { usePrivateMessageTimeline, useSendPrivateMessage } from '../private-chat'
import type { PrivateSession } from '../../types'

vi.mock('../../client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
  getApiErrorCode: (error: unknown) =>
    error && typeof error === 'object' && 'code' in error && typeof (error as { code?: unknown }).code === 'string'
      ? (error as { code: string }).code
      : null,
}))

const getMock = vi.mocked(api.get)
const postMock = vi.mocked(api.post)

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )
  }
}

describe('private chat hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getMock.mockReturnValue({
      json: vi.fn(async () => ({ data: { items: [] } })),
    } as never)
    postMock.mockReturnValue({
      json: vi.fn(async () => ({ data: { human_message: null, agent_reply: null } })),
    } as never)
  })

  it('loads the timeline with one message query per session', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })
    const sessions: PrivateSession[] = [
      {
        id: 'session-1',
        agent_id: 'agent-1',
        human_user_id: 'user-1',
        status: 'ACTIVE',
        initiator: 'HUMAN',
        trigger_type: null,
        trigger_ref: null,
        started_at: '2026-03-26T00:00:00.000Z',
        ended_at: null,
        digest_status: 'PENDING',
      },
      {
        id: 'session-2',
        agent_id: 'agent-1',
        human_user_id: 'user-1',
        status: 'ENDED',
        initiator: 'HUMAN',
        trigger_type: null,
        trigger_ref: null,
        started_at: '2026-03-26T01:00:00.000Z',
        ended_at: '2026-03-26T02:00:00.000Z',
        digest_status: 'COMPLETED',
      },
    ]

    const { result } = renderHook(() => usePrivateMessageTimeline('agent-1', sessions), {
      wrapper: createWrapper(queryClient),
    })

    await waitFor(() => {
      expect(getMock).toHaveBeenCalledWith('agents/agent-1/chat/sessions/session-1/messages?limit=100')
      expect(getMock).toHaveBeenCalledWith('agents/agent-1/chat/sessions/session-2/messages?limit=100')
      expect(result.current.items).toHaveLength(2)
    })
  })

  it('refreshes sessions when sending hits an inactive session error', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    const error = Object.assign(new Error('Session is not active'), { code: 'VALIDATION_ERROR' })
    postMock.mockReturnValue({
      json: vi.fn(async () => {
        throw error
      }),
    } as never)

    const { result } = renderHook(() => useSendPrivateMessage('agent-1', 'session-1'), {
      wrapper: createWrapper(queryClient),
    })

    await act(async () => {
      await expect(
        result.current.mutateAsync({ content: 'hello world' }),
      ).rejects.toThrow('Session is not active')
    })

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.privateSessions('agent-1'),
      })
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.privateMessages('agent-1', 'session-1'),
      })
    })
  })

  it('does not refresh sessions for unrelated send failures', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    const error = Object.assign(new Error('Upstream timeout'), { code: 'NETWORK_ERROR' })
    postMock.mockReturnValue({
      json: vi.fn(async () => {
        throw error
      }),
    } as never)

    const { result } = renderHook(() => useSendPrivateMessage('agent-1', 'session-1'), {
      wrapper: createWrapper(queryClient),
    })

    await act(async () => {
      await expect(
        result.current.mutateAsync({ content: 'hello world' }),
      ).rejects.toThrow('Upstream timeout')
    })

    expect(invalidateSpy).not.toHaveBeenCalledWith({
      queryKey: queryKeys.privateSessions('agent-1'),
    })
    expect(invalidateSpy).not.toHaveBeenCalledWith({
      queryKey: queryKeys.privateMessages('agent-1', 'session-1'),
    })
  })
})
