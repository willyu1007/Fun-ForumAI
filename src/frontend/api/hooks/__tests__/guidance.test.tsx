import type { ReactNode } from 'react'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useGuidanceItemAction } from '../guidance'
import { api } from '../../client'
import { isGuidanceEnabled } from '@/features/guidance/feature-flags'

vi.mock('../../client', () => ({
  api: {
    post: vi.fn(),
  },
}))

vi.mock('@/features/guidance/feature-flags', () => ({
  isGuidanceEnabled: vi.fn(),
}))

const postMock = vi.mocked(api.post)
const isGuidanceEnabledMock = vi.mocked(isGuidanceEnabled)

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )
  }
}

describe('guidance mutation hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isGuidanceEnabledMock.mockReturnValue(true)
    postMock.mockReturnValue({
      json: vi.fn(async () => ({
        data: {
          id: 'item-1',
          module_type: 'CARD',
          reason_code: 'WATCH_PUBLIC_EFFECT',
          title: 'title',
          body: 'body',
          unread: false,
          status: 'ACTIVE',
          cta: null,
          payload: null,
          related_agent_id: null,
          related_session_id: null,
          created_at: '2026-03-10T00:00:00.000Z',
          updated_at: '2026-03-10T00:00:00.000Z',
        },
      })),
    } as never)
  })

  it('does not post or invalidate when item actions run while guidance is disabled', async () => {
    isGuidanceEnabledMock.mockReturnValue(false)
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderHook(() => useGuidanceItemAction(), {
      wrapper: createWrapper(queryClient),
    })

    const response = await result.current.mutateAsync({ item_id: 'item-disabled', action: 'open' })

    expect(postMock).not.toHaveBeenCalled()
    expect(invalidateSpy).not.toHaveBeenCalled()
    expect(response.data).toMatchObject({
      id: 'item-disabled',
      reason_code: 'GUIDANCE_DISABLED',
      status: 'DISMISSED',
    })
  })
})
