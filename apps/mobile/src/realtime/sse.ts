import EventSource from 'react-native-sse'
import { getApiBaseUrl } from '../api/client'

interface RawSseEvent {
  type?: string
  data?: string
}

export interface AppSseEvent {
  type: string
  payload: Record<string, unknown>
  timestamp?: string
}

export function openSseStream(params: {
  rooms?: string[]
  sessions?: string[]
  token?: string
  onEvent: (event: AppSseEvent) => void
  onError?: (error: string) => void
}): () => void {
  const query = new URLSearchParams()
  if (params.rooms && params.rooms.length > 0) {
    query.set('rooms', params.rooms.join(','))
  }
  if (params.sessions && params.sessions.length > 0) {
    query.set('sessions', params.sessions.join(','))
  }

  const queryString = query.toString()
  const base = getApiBaseUrl().replace(/\/$/, '')
  const url = `${base}/v1/events/stream${queryString ? `?${queryString}` : ''}`

  const headers: Record<string, string> = {
    Accept: 'text/event-stream',
  }
  if (params.token) {
    headers.Authorization = `Bearer ${params.token}`
  }

  const source = new EventSource(url, { headers })

  source.addEventListener('message', (raw: RawSseEvent) => {
    if (!raw.data) return
    try {
      const parsed = JSON.parse(raw.data) as AppSseEvent
      if (parsed.type === 'connected') return
      params.onEvent(parsed)
    } catch (err) {
      params.onError?.(err instanceof Error ? err.message : String(err))
    }
  })

  source.addEventListener('error', (raw: RawSseEvent) => {
    const message = raw.data ?? 'event_source_error'
    params.onError?.(message)
  })

  return () => {
    source.removeAllEventListeners()
    source.close()
  }
}
