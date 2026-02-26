import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/api/hooks'
import type { SseConnectionPhase } from '@/api/use-sse'

interface SseEvent {
  type: string
  payload?: Record<string, unknown>
}

const RECONNECT_DELAY_MS = 3_000
const MAX_RECONNECT_ATTEMPTS = 10

type PrivateSseEventType = 'PRIVATE_MESSAGE_CREATED' | 'PRIVATE_SESSION_ENDED'

const PRIVATE_EVENT_TYPES = new Set<string>(['PRIVATE_MESSAGE_CREATED', 'PRIVATE_SESSION_ENDED'])

function isPrivateSseEvent(event: SseEvent): event is SseEvent & { type: PrivateSseEventType } {
  return PRIVATE_EVENT_TYPES.has(event.type)
}

export interface PrivateSseStatus {
  phase: SseConnectionPhase
  reconnectAttempts: number
}

export function usePrivateSessionSse(sessionId: string, agentId: string) {
  const qc = useQueryClient()
  const sourceRef = useRef<EventSource | null>(null)
  const retriesRef = useRef(0)
  const [status, setStatus] = useState<PrivateSseStatus>({ phase: 'connecting', reconnectAttempts: 0 })

  const handleEvent = useCallback(
    (event: SseEvent) => {
      if (!event.payload || event.payload.session_id !== sessionId) return
      if (!isPrivateSseEvent(event)) return

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
    let aborted = false
    retriesRef.current = 0

    function connect() {
      if (aborted) return
      if (sourceRef.current) sourceRef.current.close()

      setStatus({ phase: retriesRef.current > 0 ? 'reconnecting' : 'connecting', reconnectAttempts: retriesRef.current })

      const es = new EventSource(`/v1/events/stream?sessions=${encodeURIComponent(sessionId)}`)
      sourceRef.current = es

      es.onopen = () => {
        retriesRef.current = 0
        setStatus({ phase: 'connected', reconnectAttempts: 0 })
      }

      es.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data) as SseEvent
          if (data.type === 'connected') return
          handleEvent(data)
        } catch {
          /* malformed SSE frame */
        }
      }

      es.onerror = () => {
        es.close()
        sourceRef.current = null

        if (aborted) return

        if (es.readyState === EventSource.CLOSED) return

        if (retriesRef.current >= MAX_RECONNECT_ATTEMPTS) {
          setStatus({ phase: 'offline', reconnectAttempts: retriesRef.current })
          return
        }

        retriesRef.current += 1
        const delay = RECONNECT_DELAY_MS * Math.min(retriesRef.current, 5)
        setStatus({ phase: 'reconnecting', reconnectAttempts: retriesRef.current })
        reconnectTimer = setTimeout(connect, delay)
      }
    }

    connect()

    return () => {
      aborted = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      if (sourceRef.current) {
        sourceRef.current.close()
        sourceRef.current = null
      }
    }
  }, [handleEvent, sessionId])

  return status
}
