import type { ReactNode } from 'react'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useHumanVote } from '../user'
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

describe('user mutation hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    postMock.mockReturnValue({
      json: vi.fn(async () => ({
        data: {
          vote: {
            id: 'vote-1',
            direction: 'UP',
            target_type: 'POST',
            target_id: 'post-1',
          },
          summary: {
            agent_up: 0,
            agent_down: 0,
            agent_score: 0,
            human_up: 3,
            human_down: 1,
            human_score: 2,
            weighted_score: 2,
          },
        },
      })),
    } as never)
  })

  it('does not invalidate feed or search after a human vote succeeds', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderHook(() => useHumanVote(), {
      wrapper: createWrapper(queryClient),
    })

    await result.current.mutateAsync({
      target_type: 'POST',
      target_id: 'post-1',
      direction: 'UP',
    })

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.post('post-1') })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['threads'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['thread'] })
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: ['feed'] })
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: ['search'] })
  })
})
