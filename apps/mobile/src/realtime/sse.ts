import EventSource from 'react-native-sse'
import { getApiBaseUrl } from '../api/client'
import { isKnownEvent, type TypedSseEvent } from '../events'

interface RawSseEvent {
  type?: string
  data?: string
}

export type AppSseEvent = TypedSseEvent

export type SsePhase = 'connecting' | 'connected' | 'reconnecting' | 'closed' | 'error'

export interface SseStatus {
  phase: SsePhase
  reconnectAttempts: number
  lastError: string | null
}

const BASE_RECONNECT_MS = 2_000
const MAX_RECONNECT_ATTEMPTS = 8

export function openSseStream(params: {
  rooms?: string[]
  sessions?: string[]
  token?: string
  onEvent: (event: AppSseEvent) => void
  onError?: (error: string) => void
  onAuthError?: () => void
  onStatusChange?: (status: SseStatus) => void
}): () => void {
  let closed = false
  let retries = 0
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let currentSource: EventSource | null = null

  function emitStatus(phase: SsePhase, lastError: string | null = null) {
    params.onStatusChange?.({ phase, reconnectAttempts: retries, lastError })
  }

  function buildUrl(): string {
    const query = new URLSearchParams()
    if (params.rooms && params.rooms.length > 0) {
      query.set('rooms', params.rooms.join(','))
    }
    if (params.sessions && params.sessions.length > 0) {
      query.set('sessions', params.sessions.join(','))
    }
    const queryString = query.toString()
    const base = getApiBaseUrl().replace(/\/$/, '')
    return `${base}/v1/events/stream${queryString ? `?${queryString}` : ''}`
  }

  function connect() {
    if (closed) return

    emitStatus(retries > 0 ? 'reconnecting' : 'connecting')

    const headers: Record<string, string> = { Accept: 'text/event-stream' }
    if (params.token) headers.Authorization = `Bearer ${params.token}`

    const source = new EventSource(buildUrl(), { headers })
    currentSource = source

    source.addEventListener('message', (raw: RawSseEvent) => {
      if (!raw.data) return
      try {
        const parsed = JSON.parse(raw.data) as { type: string; payload?: Record<string, unknown>; timestamp?: string }
        if (parsed.type === 'connected') {
          retries = 0
          emitStatus('connected')
          return
        }
        if (isKnownEvent(parsed)) params.onEvent(parsed)
      } catch (err) {
        params.onError?.(err instanceof Error ? err.message : String(err))
      }
    })

    source.addEventListener('error', (raw: RawSseEvent) => {
      const message = raw.data ?? 'event_source_error'

      const isAuthError = message.includes('401') || message.includes('403')
        || message.includes('Unauthorized') || message.includes('Forbidden')
      if (isAuthError) {
        emitStatus('error', message)
        params.onAuthError?.()
        params.onError?.(message)
        return
      }

      source.removeAllEventListeners()
      source.close()
      currentSource = null

      if (closed || retries >= MAX_RECONNECT_ATTEMPTS) {
        emitStatus('error', message)
        params.onError?.(message)
        return
      }

      retries += 1
      const delay = BASE_RECONNECT_MS * Math.min(retries, 5)
      emitStatus('reconnecting', message)
      reconnectTimer = setTimeout(connect, delay)
    })
  }

  connect()

  return () => {
    closed = true
    emitStatus('closed')
    if (reconnectTimer) clearTimeout(reconnectTimer)
    if (currentSource) {
      currentSource.removeAllEventListeners()
      currentSource.close()
      currentSource = null
    }
  }
}
