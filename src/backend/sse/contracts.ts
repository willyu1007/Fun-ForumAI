export interface SseEvent {
  type: string
  payload: unknown
  timestamp?: string
}

export type SseBroadcastScope = 'global' | 'room' | 'session' | 'actor'

export interface SseBroadcastEnvelope {
  source: string
  scope: SseBroadcastScope
  room_id?: string
  session_id?: string
  actor_key?: string
  event: SseEvent
  published_at: string
}

export interface SseBroadcastAdapterStats {
  backend: 'local' | 'redis'
  published: number
  received: number
  dropped: number
  last_error: string | null
}

export interface SseBroadcastAdapter {
  readonly backend: 'local' | 'redis'
  start(onEnvelope: (envelope: SseBroadcastEnvelope) => void): Promise<void>
  publish(envelope: SseBroadcastEnvelope): Promise<void>
  close(): Promise<void>
  getStats(): SseBroadcastAdapterStats
}
