import type { ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../../client'
import { usePrivateMessageTimeline } from '../private-chat'
import type { PrivateSession } from '../../types'

vi.mock('../../client', () => ({
  api: {
    get: vi.fn(),
  },
}))

const getMock = vi.mocked(api.get)

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
})
