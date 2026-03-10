import type { ReactNode } from 'react'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { queryKeys } from '@/api/query-keys'
import { useChatRoomSse } from '../use-chat-room-sse'

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

describe('useChatRoomSse', () => {
  const originalEventSource = globalThis.EventSource

  beforeEach(() => {
    FakeEventSource.instances = []
    globalThis.EventSource = FakeEventSource as unknown as typeof EventSource
  })

  afterEach(() => {
    globalThis.EventSource = originalEventSource
  })

  it('invalidates highlight and room queries for program events', () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    renderHook(() => useChatRoomSse('room-1'), {
      wrapper: createWrapper(queryClient),
    })

    const instance = FakeEventSource.instances[0]
    expect(instance.url).toContain('/v1/events/stream?rooms=room-1')

    act(() => {
      instance.onmessage?.({
        data: JSON.stringify({
          type: 'ROOM_HIGHLIGHT_CREATED',
          payload: { room_id: 'room-1' },
          timestamp: new Date().toISOString(),
        }),
      } as MessageEvent)
    })

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.roomHighlightsRoot('room-1') })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.roomLiveSnapshot('room-1') })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.roomMessages('room-1') })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['rooms'] })
  })
})
