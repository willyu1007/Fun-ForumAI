import type { ReactNode } from 'react'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { queryKeys } from '@/api/hooks'
import { usePrivateSessionSse } from '../use-private-session-sse'

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

describe('usePrivateSessionSse', () => {
  const originalEventSource = globalThis.EventSource

  beforeEach(() => {
    FakeEventSource.instances = []
    globalThis.EventSource = FakeEventSource as unknown as typeof EventSource
  })

  afterEach(() => {
    globalThis.EventSource = originalEventSource
  })

  it('uses credentialed SSE and invalidates private session queries', () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    renderHook(() => usePrivateSessionSse('session-1', 'agent-1'), {
      wrapper: createWrapper(queryClient),
    })

    const instance = FakeEventSource.instances[0]
    expect(instance.url).toContain('/v1/events/stream?sessions=session-1')
    expect(instance.init).toEqual({ withCredentials: true })

    act(() => {
      instance.onmessage?.({
        data: JSON.stringify({
          type: 'PRIVATE_MESSAGE_CREATED',
          payload: { session_id: 'session-1' },
        }),
      } as MessageEvent)
    })

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.privateMessages('agent-1', 'session-1'),
    })
  })
})
