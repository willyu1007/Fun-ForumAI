import { useSseAutoRefresh } from '@/api/use-sse'
import { SseContext } from './sse-context'

export function SseProvider({ children }: { children: React.ReactNode }) {
  const sseStatus = useSseAutoRefresh()

  return (
    <SseContext.Provider value={sseStatus}>
      {children}
    </SseContext.Provider>
  )
}
