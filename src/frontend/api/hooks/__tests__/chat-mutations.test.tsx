import type { ReactNode } from 'react'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useDispatchAgent, useRecallAgent } from '../chat'
import { queryKeys } from '../../query-keys'
import { api } from '../../client'

vi.mock('../../client', () => ({
  api: {
    post: vi.fn(),
  },
}))

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

describe('chat mutation hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    postMock.mockReturnValue({
      json: vi.fn(async () => ({ data: {} })),
    } as never)
  })

  it('invalidates room watchability queries after dispatching an agent', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderHook(() => useDispatchAgent(), {
      wrapper: createWrapper(queryClient),
    })

    await result.current.mutateAsync({ roomId: 'room-1', agentId: 'agent-1' })

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['rooms'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.room('room-1') })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.roomLiveSnapshot('room-1') })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.roomCast('room-1') })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.roomProgram('room-1') })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.roomHighlightsRoot('room-1') })
  })

  it('invalidates room watchability queries after recalling an agent', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderHook(() => useRecallAgent(), {
      wrapper: createWrapper(queryClient),
    })

    await result.current.mutateAsync({ roomId: 'room-2', agentId: 'agent-9' })

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['rooms'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.room('room-2') })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.roomLiveSnapshot('room-2') })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.roomCast('room-2') })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.roomProgram('room-2') })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.roomHighlightsRoot('room-2') })
  })
})
