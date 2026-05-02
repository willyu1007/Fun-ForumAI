import type { ReactNode } from 'react'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCreateAgent, useDeleteAgent } from '../agent'
import { queryKeys } from '../../query-keys'
import { api } from '../../client'

vi.mock('../../client', () => ({
  api: {
    post: vi.fn(),
    delete: vi.fn(),
  },
}))

const postMock = vi.mocked(api.post)
const deleteMock = vi.mocked(api.delete)

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )
  }
}

describe('agent mutation hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    postMock.mockReturnValue({
      json: vi.fn(async () => ({
        data: {
          id: 'agent-2',
          display_name: 'New Agent',
          owner_id: 'user-1',
        },
      })),
    } as never)
    deleteMock.mockReturnValue({
      json: vi.fn(async () => ({
        data: {
          id: 'agent-1',
          status: 'DELETED',
          deleted_at: '2026-04-11T06:23:45.802Z',
        },
      })),
    } as never)
  })

  it('updates the owned-agent cache immediately after create succeeds', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    queryClient.setQueryData(queryKeys.myAgents, {
      data: [
        {
          id: 'agent-1',
          display_name: 'Existing Agent',
          owner_id: 'user-1',
        },
      ],
    })

    const { result } = renderHook(() => useCreateAgent(), {
      wrapper: createWrapper(queryClient),
    })

    await result.current.mutateAsync({
      display_name: 'New Agent',
    })

    expect(queryClient.getQueryData(queryKeys.myAgents)).toEqual({
      data: [
        {
          id: 'agent-2',
          display_name: 'New Agent',
          owner_id: 'user-1',
        },
        {
          id: 'agent-1',
          display_name: 'Existing Agent',
          owner_id: 'user-1',
        },
      ],
    })
    expect(queryClient.getQueryData(queryKeys.agentProfile('agent-2'))).toEqual({
      data: {
        id: 'agent-2',
        display_name: 'New Agent',
        owner_id: 'user-1',
      },
    })

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['feed'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.myAgents })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['search'] })
  })

  it('cancels and removes owner-only queries before invalidating public surfaces after delete', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    const cancelSpy = vi.spyOn(queryClient, 'cancelQueries')
    const removeSpy = vi.spyOn(queryClient, 'removeQueries')
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderHook(() => useDeleteAgent('agent-1'), {
      wrapper: createWrapper(queryClient),
    })

    await result.current.mutateAsync()

    expect(cancelSpy).toHaveBeenCalledWith({ queryKey: queryKeys.privateSessions('agent-1') })
    expect(cancelSpy).toHaveBeenCalledWith({ queryKey: queryKeys.ownerLifeOverview('agent-1') })
    expect(cancelSpy).toHaveBeenCalledWith({ queryKey: queryKeys.ownerChronicleFeedRoot('agent-1') })
    expect(cancelSpy).toHaveBeenCalledWith({ queryKey: queryKeys.ownerNurtureSuggestions('agent-1') })

    expect(removeSpy).toHaveBeenCalledWith({ queryKey: queryKeys.privateSessions('agent-1') })
    expect(removeSpy).toHaveBeenCalledWith({ queryKey: queryKeys.ownerLifeOverview('agent-1') })
    expect(removeSpy).toHaveBeenCalledWith({ queryKey: queryKeys.ownerChronicleFeedRoot('agent-1') })
    expect(removeSpy).toHaveBeenCalledWith({ queryKey: queryKeys.ownerNurtureSuggestions('agent-1') })

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.myAgents })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.agentProfile('agent-1') })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['search'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['feed'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.agentHighlights('agent-1') })

    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: queryKeys.privateSessions('agent-1') })
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: queryKeys.ownerLifeOverview('agent-1') })
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: queryKeys.ownerChronicleFeedRoot('agent-1') })
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: queryKeys.ownerNurtureSuggestions('agent-1') })
  })
})
