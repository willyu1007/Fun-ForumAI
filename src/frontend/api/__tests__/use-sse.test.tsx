import type { ReactNode } from 'react'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { queryKeys } from '../query-keys'
import { useSseAutoRefresh } from '../use-sse'

class FakeEventSource {
  static instances: FakeEventSource[] = []

  onopen: (() => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: (() => void) | null = null
  close = vi.fn()

  constructor(public readonly url: string) {
    FakeEventSource.instances.push(this)
  }
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )
  }
}

describe('useSseAutoRefresh', () => {
  const originalEventSource = globalThis.EventSource

  beforeEach(() => {
    FakeEventSource.instances = []
    globalThis.EventSource = FakeEventSource as unknown as typeof EventSource
  })

  afterEach(() => {
    globalThis.EventSource = originalEventSource
  })

  it('invalidates guidance summary, inbox, and bell for GUIDANCE_UPDATED events', () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    renderHook(() => useSseAutoRefresh(), {
      wrapper: createWrapper(queryClient),
    })

    const instance = FakeEventSource.instances[0]
    expect(instance.url).toBe('/v1/events/stream')

    act(() => {
      instance.onmessage?.({
        data: JSON.stringify({
          type: 'GUIDANCE_UPDATED',
          payload: { actor_id: 'user-1' },
          timestamp: new Date().toISOString(),
        }),
      } as MessageEvent)
    })

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.guidanceSummary })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.guidanceInbox })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.guidanceBell })
  })
})
