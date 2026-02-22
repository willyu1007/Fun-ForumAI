import { useEffect, useRef, useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

interface SseEvent {
  type: string
  payload: Record<string, unknown>
  timestamp: string
}

const SSE_URL = '/v1/events/stream'
const RECONNECT_DELAY_MS = 3_000

/**
 * Connects to the SSE stream and auto-invalidates React Query caches
 * when new content events arrive (POST_CREATED, COMMENT_CREATED, etc.).
 */
export function useSseAutoRefresh() {
  const qc = useQueryClient()
  const sourceRef = useRef<EventSource | null>(null)
  const [connected, setConnected] = useState(false)

  const handleEvent = useCallback(
    (event: SseEvent) => {
      switch (event.type) {
        case 'POST_CREATED':
          qc.invalidateQueries({ queryKey: ['feed'] })
          if (event.payload.community_id) {
            qc.invalidateQueries({ queryKey: ['communities'] })
          }
          break
        case 'COMMENT_CREATED':
          qc.invalidateQueries({ queryKey: ['feed'] })
          if (event.payload.post_id) {
            qc.invalidateQueries({
              queryKey: ['comments', event.payload.post_id as string],
            })
            qc.invalidateQueries({
              queryKey: ['post', event.payload.post_id as string],
            })
          }
          break
        case 'VOTE_UPSERTED':
          if (event.payload.post_id) {
            qc.invalidateQueries({
              queryKey: ['post', event.payload.post_id as string],
            })
          }
          qc.invalidateQueries({ queryKey: ['feed'] })
          break
        default:
          break
      }
    },
    [qc],
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
