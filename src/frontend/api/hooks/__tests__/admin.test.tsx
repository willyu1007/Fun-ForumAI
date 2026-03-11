import type { ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useRuntimeFeatures } from '../admin'
import { api } from '../../client'

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

describe('admin hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns a disabled runtime snapshot when the backend feature flag responds with 403', async () => {
    getMock.mockReturnValue({
      json: vi.fn(async () => {
        throw { response: { status: 403 } }
      }),
    } as never)

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })
    const { result } = renderHook(() => useRuntimeFeatures(), {
      wrapper: createWrapper(queryClient),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data?.meta?.disabled).toBe(true)
    expect(result.current.data?.data.guidance).toMatchObject({
      flags: {
        guidance_v1: false,
        guidance_recall_v1: false,
      },
      bell: {
        unread_count: 0,
        active_count: 0,
      },
    })
  })
})
