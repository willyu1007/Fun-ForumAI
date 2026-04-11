import { useEffect, useRef, useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/api/hooks'
import type { ChatMessage } from '@/api/types'
import type { SseConnectionPhase } from '@/api/use-sse'
import { sseEnabled } from '@/shared/config/frontend-capabilities'

interface SseEvent {
  type: string
  payload: Record<string, unknown>
  timestamp: string
}

const RECONNECT_DELAY_MS = 3_000
const MAX_RECONNECT_ATTEMPTS = 10
type RoomSseEventType =
  | 'MESSAGE_CREATED'
  | 'ROOM_MEMBER_JOINED'
  | 'ROOM_MEMBER_LEFT'
  | 'ROOM_STATUS_CHANGED'
  | 'AGENT_TYPING'
  | 'AGENT_STOP_TYPING'
  | 'ROOM_BEAT_CHANGED'
  | 'ROOM_CAST_UPDATED'
  | 'ROOM_HIGHLIGHT_CREATED'
  | 'ROOM_LIVE_SNAPSHOT_UPDATED'
  | 'ROOM_CONTROL_STATE_UPDATED'

const ROOM_EVENT_TYPES = new Set<string>([
  'MESSAGE_CREATED',
  'ROOM_MEMBER_JOINED',
  'ROOM_MEMBER_LEFT',
  'ROOM_STATUS_CHANGED',
  'AGENT_TYPING',
  'AGENT_STOP_TYPING',
  'ROOM_BEAT_CHANGED',
  'ROOM_CAST_UPDATED',
  'ROOM_HIGHLIGHT_CREATED',
  'ROOM_LIVE_SNAPSHOT_UPDATED',
  'ROOM_CONTROL_STATE_UPDATED',
])

function isRoomSseEvent(event: SseEvent): event is SseEvent & { type: RoomSseEventType } {
  return ROOM_EVENT_TYPES.has(event.type)
}

export interface ChatRoomSseStatus {
  phase: SseConnectionPhase
  reconnectAttempts: number
}

export function useChatRoomSse(roomId: string) {
  const sseDisabled = !sseEnabled
  const qc = useQueryClient()
  const sourceRef = useRef<EventSource | null>(null)
  const retriesRef = useRef(0)
  const [typingAgents, setTypingAgents] = useState<Set<string>>(new Set())
  const [status, setStatus] = useState<ChatRoomSseStatus>({
    phase: sseDisabled ? 'offline' : 'connecting',
    reconnectAttempts: 0,
  })

  const handleEvent = useCallback(
    (event: SseEvent) => {
      if (!isRoomSseEvent(event)) return

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
            qc.invalidateQueries({ queryKey: queryKeys.roomHighlightsRoot(roomId) })
          }
          qc.invalidateQueries({ queryKey: ['rooms'] })
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
        case 'ROOM_BEAT_CHANGED':
          if (event.payload.room_id === roomId) {
            qc.invalidateQueries({ queryKey: queryKeys.roomLiveSnapshot(roomId) })
            qc.invalidateQueries({ queryKey: queryKeys.roomProgram(roomId) })
            qc.invalidateQueries({ queryKey: queryKeys.roomMessages(roomId) })
          }
          qc.invalidateQueries({ queryKey: ['rooms'] })
          break
        case 'ROOM_CAST_UPDATED':
          if (event.payload.room_id === roomId) {
            qc.invalidateQueries({ queryKey: queryKeys.roomCast(roomId) })
            qc.invalidateQueries({ queryKey: queryKeys.roomLiveSnapshot(roomId) })
          }
          qc.invalidateQueries({ queryKey: ['rooms'] })
          break
        case 'ROOM_HIGHLIGHT_CREATED':
          if (event.payload.room_id === roomId) {
            qc.invalidateQueries({ queryKey: queryKeys.roomHighlightsRoot(roomId) })
            qc.invalidateQueries({ queryKey: queryKeys.roomLiveSnapshot(roomId) })
            qc.invalidateQueries({ queryKey: queryKeys.roomMessages(roomId) })
          }
          qc.invalidateQueries({ queryKey: ['rooms'] })
          break
        case 'ROOM_LIVE_SNAPSHOT_UPDATED':
          if (event.payload.room_id === roomId) {
            qc.invalidateQueries({ queryKey: queryKeys.roomLiveSnapshot(roomId) })
            qc.invalidateQueries({ queryKey: queryKeys.roomCast(roomId) })
            qc.invalidateQueries({ queryKey: queryKeys.roomProgram(roomId) })
            qc.invalidateQueries({ queryKey: queryKeys.roomHighlightsRoot(roomId) })
            qc.invalidateQueries({ queryKey: queryKeys.roomControlState(roomId) })
          }
          qc.invalidateQueries({ queryKey: ['rooms'] })
          break
        case 'ROOM_CONTROL_STATE_UPDATED':
          if (event.payload.room_id === roomId) {
            qc.invalidateQueries({ queryKey: queryKeys.roomControlState(roomId) })
            qc.invalidateQueries({ queryKey: queryKeys.roomProgram(roomId) })
            qc.invalidateQueries({ queryKey: queryKeys.roomCast(roomId) })
            qc.invalidateQueries({ queryKey: queryKeys.roomLiveSnapshot(roomId) })
            qc.invalidateQueries({ queryKey: queryKeys.roomHighlightsRoot(roomId) })
          }
          qc.invalidateQueries({ queryKey: ['rooms'] })
          break
      }
    },
    [qc, roomId],
  )

  useEffect(() => {
    if (!roomId) return
    if (sseDisabled) {
      setStatus({ phase: 'offline', reconnectAttempts: 0 })
      setTypingAgents(new Set())
      return
    }

    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let aborted = false
    retriesRef.current = 0

    function connect() {
      if (aborted) return
      if (sourceRef.current) sourceRef.current.close()

      setStatus({
        phase: retriesRef.current > 0 ? 'reconnecting' : 'connecting',
        reconnectAttempts: retriesRef.current,
      })

      const es = new EventSource(`/v1/events/stream?rooms=${roomId}`, {
        withCredentials: true,
      })
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
  }, [roomId, handleEvent, sseDisabled])

  return { typingAgents, status }
}
