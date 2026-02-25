import { createContext, useContext } from 'react'
import type { SseConnectionStatus } from '@/api/use-sse'

export const SseContext = createContext<SseConnectionStatus>({
  connected: false,
  phase: 'connecting',
  reconnectAttempts: 0,
  nextRetryInMs: null,
  lastConnectedAt: null,
  lastMessageAt: null,
  lastEventType: null,
  lastError: null,
})

export function useSseStatus() {
  return useContext(SseContext)
}
