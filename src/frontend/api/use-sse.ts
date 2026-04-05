import { useEffect, useRef, useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { create } from 'zustand'
import { queryKeys } from './query-keys'
import { isFrontendFlagEnabled } from '@/shared/config/frontend-flags'

interface SseEvent {
  type: string
  payload: Record<string, unknown>
  timestamp: string
}

const SSE_URL = '/v1/events/stream'
const RECONNECT_BASE_DELAY_MS = 1_000
const RECONNECT_MAX_DELAY_MS = 20_000
const RECONNECT_JITTER_MS = 250
export type SseConnectionPhase = 'connecting' | 'connected' | 'reconnecting' | 'offline'

export interface SseConnectionStatus {
  connected: boolean
  phase: SseConnectionPhase
  reconnectAttempts: number
  nextRetryInMs: number | null
  lastConnectedAt: number | null
  lastMessageAt: number | null
  lastEventType: string | null
  lastError: string | null
}

interface SseNewCountsState {
  newPostCount: number
  newThreadTurnCounts: Record<string, number>
  incrementPosts: () => void
  incrementThreadTurns: (postId: string) => void
  clearNewPosts: () => void
  clearNewThreadTurns: (postId: string) => void
}

export const useSseNewCounts = create<SseNewCountsState>((set) => ({
  newPostCount: 0,
  newThreadTurnCounts: {},
  incrementPosts: () => set((s) => ({ newPostCount: s.newPostCount + 1 })),
  incrementThreadTurns: (postId: string) =>
    set((s) => ({
      newThreadTurnCounts: {
        ...s.newThreadTurnCounts,
        [postId]: (s.newThreadTurnCounts[postId] || 0) + 1,
      },
    })),
  clearNewPosts: () => set({ newPostCount: 0 }),
  clearNewThreadTurns: (postId: string) =>
    set((s) => {
      const next = { ...s.newThreadTurnCounts }
      delete next[postId]
      return { newThreadTurnCounts: next }
    }),
}))

export function useSseAutoRefresh() {
  const sseDisabled = isFrontendFlagEnabled('VITE_FF_DISABLE_SSE')
  const qc = useQueryClient()
  const sourceRef = useRef<EventSource | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const [status, setStatus] = useState<SseConnectionStatus>({
    connected: false,
    phase: sseDisabled ? 'offline' : 'connecting',
    reconnectAttempts: 0,
    nextRetryInMs: null,
    lastConnectedAt: null,
    lastMessageAt: null,
    lastEventType: null,
    lastError: sseDisabled ? 'disabled' : null,
  })
  const incrementPosts = useSseNewCounts((s) => s.incrementPosts)
  const incrementThreadTurns = useSseNewCounts((s) => s.incrementThreadTurns)

  const handleEvent = useCallback(
    (event: SseEvent) => {
      switch (event.type) {
        case 'POST_CREATED':
          incrementPosts()
          break
        case 'THREAD_OPENED':
        case 'THREAD_TURN_ADDED':
          if (event.payload.post_id) {
            incrementThreadTurns(event.payload.post_id as string)
          }
          break
        case 'VOTE_UPSERTED':
        case 'VOTE_CAST':
        case 'AGENT_VOTE_CAST':
          if (event.payload.post_id) {
            qc.invalidateQueries({ queryKey: ['post', event.payload.post_id as string] })
          }
          qc.invalidateQueries({ queryKey: ['feed'] })
          break
        case 'GUIDANCE_UPDATED':
          qc.invalidateQueries({ queryKey: queryKeys.guidanceSummary })
          qc.invalidateQueries({ queryKey: queryKeys.guidanceInbox })
          qc.invalidateQueries({ queryKey: queryKeys.guidanceBell })
          break
        default:
          break
      }
    },
    [qc, incrementPosts, incrementThreadTurns],
  )

  useEffect(() => {
    if (sseDisabled) {
      setStatus({
        connected: false,
        phase: 'offline',
        reconnectAttempts: 0,
        nextRetryInMs: null,
        lastConnectedAt: null,
        lastMessageAt: null,
        lastEventType: null,
        lastError: 'disabled',
      })
      return
    }

    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let stopped = false

    function closeActiveSource() {
      if (sourceRef.current) {
        sourceRef.current.close()
        sourceRef.current = null
      }
    }

    function getReconnectDelay(attempt: number): number {
      const exponential = RECONNECT_BASE_DELAY_MS * (2 ** Math.min(attempt, 5))
      const baseDelay = Math.min(exponential, RECONNECT_MAX_DELAY_MS)
      const jitter = Math.floor(Math.random() * RECONNECT_JITTER_MS)
      return baseDelay + jitter
    }

    function scheduleReconnect(reason: string) {
      if (stopped) return
      const nextAttempt = reconnectAttemptsRef.current + 1
      reconnectAttemptsRef.current = nextAttempt
      const delay = getReconnectDelay(nextAttempt)

      setStatus((prev) => ({
        ...prev,
        connected: false,
        phase: typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'reconnecting',
        reconnectAttempts: nextAttempt,
        nextRetryInMs: delay,
        lastError: reason,
      }))

      if (reconnectTimer) {
        clearTimeout(reconnectTimer)
      }
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null
        connect()
      }, delay)
    }

    function connect() {
      if (stopped) return
      closeActiveSource()

      setStatus((prev) => ({
        ...prev,
        phase: prev.reconnectAttempts > 0 ? 'reconnecting' : 'connecting',
        nextRetryInMs: null,
      }))

      const es = new EventSource(SSE_URL, { withCredentials: true })
      sourceRef.current = es

      es.onopen = () => {
        reconnectAttemptsRef.current = 0
        setStatus((prev) => ({
          ...prev,
          connected: true,
          phase: 'connected',
          reconnectAttempts: 0,
          nextRetryInMs: null,
          lastConnectedAt: Date.now(),
          lastError: null,
        }))
      }

      es.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data) as SseEvent
          setStatus((prev) => ({
            ...prev,
            lastMessageAt: Date.now(),
            lastEventType: data.type ?? prev.lastEventType,
          }))
          if (data.type === 'connected') return
          handleEvent(data)
        } catch {
          // ignore malformed events
        }
      }

      es.onerror = () => {
        closeActiveSource()
        const offline = typeof navigator !== 'undefined' && !navigator.onLine
        scheduleReconnect(offline ? 'browser_offline' : 'event_source_error')
      }
    }

    function onOnline() {
      if (stopped) return
      reconnectAttemptsRef.current = 0
      if (reconnectTimer) {
        clearTimeout(reconnectTimer)
        reconnectTimer = null
      }
      connect()
    }

    function onOffline() {
      setStatus((prev) => ({
        ...prev,
        connected: false,
        phase: 'offline',
        lastError: 'browser_offline',
      }))
    }

    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    connect()

    return () => {
      stopped = true
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      if (reconnectTimer) {
        clearTimeout(reconnectTimer)
        reconnectTimer = null
      }
      closeActiveSource()
    }
  }, [handleEvent, sseDisabled])

  return status
}
