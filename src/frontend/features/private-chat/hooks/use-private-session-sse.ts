import { useCallback, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/api/hooks'

interface SseEvent {
  type: string
  payload: Record<string, unknown>
}

const RECONNECT_DELAY_MS = 3_000

export function usePrivateSessionSse(sessionId: string, agentId: string) {
  const qc = useQueryClient()
  const sourceRef = useRef<EventSource | null>(null)

  const handleEvent = useCallback(
    (event: SseEvent) => {
      if (event.payload.session_id !== sessionId) return

      if (event.type === 'PRIVATE_MESSAGE_CREATED') {
        qc.invalidateQueries({ queryKey: queryKeys.privateMessages(sessionId) })
      }

      if (event.type === 'PRIVATE_SESSION_ENDED') {
        qc.invalidateQueries({ queryKey: queryKeys.privateMessages(sessionId) })
        qc.invalidateQueries({ queryKey: queryKeys.privateSessions(agentId) })
      }
    },
    [agentId, qc, sessionId],
  )

  useEffect(() => {
    if (!sessionId) return

    let reconnectTimer: ReturnType<typeof setTimeout> | null = null

    function connect() {
      if (sourceRef.current) sourceRef.current.close()

      const es = new EventSource(`/v1/events/stream?sessions=${encodeURIComponent(sessionId)}`)
      sourceRef.current = es

      es.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data) as SseEvent
          if (data.type === 'connected') return
          handleEvent(data)
        } catch {
          // ignore malformed SSE events
        }
      }

      es.onerror = () => {
        es.close()
        sourceRef.current = null
        reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS)
      }
    }

    connect()

    return () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer)
      }
      if (sourceRef.current) {
        sourceRef.current.close()
        sourceRef.current = null
      }
    }
  }, [handleEvent, sessionId])
}

