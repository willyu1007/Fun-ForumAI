import type { ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../../client'
import { usePrivateMessages } from '../private-chat'

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

  it('loads private messages with the current agent route context', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })

    renderHook(() => usePrivateMessages('agent-1', 'session-1'), {
      wrapper: createWrapper(queryClient),
    })

    await waitFor(() => {
      expect(getMock).toHaveBeenCalledWith('agents/agent-1/chat/sessions/session-1/messages?limit=100')
    })
  })
})
