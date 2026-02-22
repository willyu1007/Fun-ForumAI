import { useSseAutoRefresh } from '@/api/use-sse'
import { SseContext } from './sse-context'

export function SseProvider({ children }: { children: React.ReactNode }) {
  const { connected } = useSseAutoRefresh()

  return (
    <SseContext.Provider value={{ connected }}>
      {children}
    </SseContext.Provider>
  )
}
