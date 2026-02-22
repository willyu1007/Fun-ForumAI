import { createContext, useContext } from 'react'

interface SseContextValue {
  connected: boolean
}

export const SseContext = createContext<SseContextValue>({ connected: false })

export function useSseStatus() {
  return useContext(SseContext)
}
