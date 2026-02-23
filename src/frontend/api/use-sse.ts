import { useEffect, useRef, useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { create } from 'zustand'

interface SseEvent {
  type: string
  payload: Record<string, unknown>
  timestamp: string
}

const SSE_URL = '/v1/events/stream'
const RECONNECT_DELAY_MS = 3_000

interface SseNewCountsState {
  newPostCount: number
  newCommentCounts: Record<string, number>
  incrementPosts: () => void
  incrementComments: (postId: string) => void
  clearNewPosts: () => void
  clearNewComments: (postId: string) => void
}

export const useSseNewCounts = create<SseNewCountsState>((set) => ({
  newPostCount: 0,
  newCommentCounts: {},
  incrementPosts: () => set((s) => ({ newPostCount: s.newPostCount + 1 })),
  incrementComments: (postId: string) =>
    set((s) => ({
      newCommentCounts: {
        ...s.newCommentCounts,
        [postId]: (s.newCommentCounts[postId] || 0) + 1,
      },
    })),
  clearNewPosts: () => set({ newPostCount: 0 }),
  clearNewComments: (postId: string) =>
    set((s) => {
      const next = { ...s.newCommentCounts }
      delete next[postId]
      return { newCommentCounts: next }
    }),
}))

export function useSseAutoRefresh() {
  const qc = useQueryClient()
  const sourceRef = useRef<EventSource | null>(null)
  const [connected, setConnected] = useState(false)
  const incrementPosts = useSseNewCounts((s) => s.incrementPosts)
  const incrementComments = useSseNewCounts((s) => s.incrementComments)

  const handleEvent = useCallback(
    (event: SseEvent) => {
      switch (event.type) {
        case 'POST_CREATED':
          incrementPosts()
          break
        case 'COMMENT_CREATED':
          if (event.payload.post_id) {
            incrementComments(event.payload.post_id as string)
          }
          break
        case 'VOTE_UPSERTED':
          if (event.payload.post_id) {
            qc.invalidateQueries({ queryKey: ['post', event.payload.post_id as string] })
          }
          qc.invalidateQueries({ queryKey: ['feed'] })
          break
        default:
          break
      }
    },
    [qc, incrementPosts, incrementComments],
  )

  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout>

    function connect() {
      if (sourceRef.current) {
        sourceRef.current.close()
      }

      const es = new EventSource(SSE_URL)
      sourceRef.current = es

      es.onopen = () => {
        setConnected(true)
      }

      es.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data) as SseEvent
          if (data.type === 'connected') return
          handleEvent(data)
        } catch {
          // ignore malformed events
        }
      }

      es.onerror = () => {
        setConnected(false)
        es.close()
        sourceRef.current = null
        reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS)
      }
    }

    connect()

    return () => {
      clearTimeout(reconnectTimer)
      if (sourceRef.current) {
        sourceRef.current.close()
        sourceRef.current = null
      }
    }
  }, [handleEvent])

  return { connected }
}
