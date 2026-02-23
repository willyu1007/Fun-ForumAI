import { useEffect, useRef, useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/api/hooks'
import type { ChatMessage } from '@/api/types'

interface SseEvent {
  type: string
  payload: Record<string, unknown>
  timestamp: string
}

const RECONNECT_DELAY_MS = 3_000

export function useChatRoomSse(roomId: string) {
  const qc = useQueryClient()
  const sourceRef = useRef<EventSource | null>(null)
  const [typingAgents, setTypingAgents] = useState<Set<string>>(new Set())

  const handleEvent = useCallback(
    (event: SseEvent) => {
      switch (event.type) {
        case 'MESSAGE_CREATED': {
          const msg = event.payload.message as ChatMessage
          if (msg && event.payload.room_id === roomId) {
            qc.invalidateQueries({ queryKey: queryKeys.roomMessages(roomId) })
          }
          break
        }
        case 'ROOM_MEMBER_JOINED':
        case 'ROOM_MEMBER_LEFT':
          if (event.payload.room_id === roomId) {
            qc.invalidateQueries({ queryKey: queryKeys.room(roomId) })
          }
          break
        case 'ROOM_STATUS_CHANGED':
          if (event.payload.room_id === roomId) {
            qc.invalidateQueries({ queryKey: queryKeys.room(roomId) })
          }
          qc.invalidateQueries({ queryKey: ['rooms'] })
          break
        case 'AGENT_TYPING':
          if (event.payload.room_id === roomId) {
            setTypingAgents((prev) => {
              const next = new Set(prev)
              next.add(event.payload.agent_id as string)
              return next
            })
          }
          break
        case 'AGENT_STOP_TYPING':
          if (event.payload.room_id === roomId) {
            setTypingAgents((prev) => {
              const next = new Set(prev)
              next.delete(event.payload.agent_id as string)
              return next
            })
          }
          break
      }
    },
    [qc, roomId],
  )

  useEffect(() => {
    if (!roomId) return

    let reconnectTimer: ReturnType<typeof setTimeout>

    function connect() {
      if (sourceRef.current) sourceRef.current.close()

      const es = new EventSource(`/v1/events/stream?rooms=${roomId}`)
      sourceRef.current = es

      es.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data) as SseEvent
          if (data.type === 'connected') return
          handleEvent(data)
        } catch {
          // ignore
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
      clearTimeout(reconnectTimer)
      if (sourceRef.current) {
        sourceRef.current.close()
        sourceRef.current = null
      }
    }
  }, [roomId, handleEvent])

  return { typingAgents }
}
