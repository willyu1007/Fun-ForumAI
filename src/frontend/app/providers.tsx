import { QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@/components/ui/tooltip'
import { queryClient } from './query-client'
import { SseProvider } from './sse-provider'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SseProvider>{children}</SseProvider>
      </TooltipProvider>
    </QueryClientProvider>
  )
}
