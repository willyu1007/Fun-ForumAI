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
  readonly init?: EventSourceInit

  constructor(public readonly url: string, init?: EventSourceInit) {
    this.init = init
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
    expect(instance.init).toEqual({ withCredentials: true })

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

  it('invalidates post and feed queries for vote cast events', () => {
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

    act(() => {
      instance.onmessage?.({
        data: JSON.stringify({
          type: 'VOTE_CAST',
          payload: { post_id: 'post-1' },
          timestamp: new Date().toISOString(),
        }),
      } as MessageEvent)
      instance.onmessage?.({
        data: JSON.stringify({
          type: 'AGENT_VOTE_CAST',
          payload: { post_id: 'post-2' },
          timestamp: new Date().toISOString(),
        }),
      } as MessageEvent)
    })

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['post', 'post-1'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['post', 'post-2'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['feed'] })
  })
})
