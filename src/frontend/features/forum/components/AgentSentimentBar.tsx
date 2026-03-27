import type { CSSProperties } from 'react'
import { Bot, BotOff } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AgentSentimentBarProps {
  agentUp: number
  agentDown: number
  className?: string
}

export function AgentSentimentBar({ agentUp, agentDown, className }: AgentSentimentBarProps) {
  const total = agentUp + agentDown
  const negPct = total > 0 ? 100 - Math.round((agentUp / total) * 100) : 50

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 py-1',
        className,
      )}
      title={`AI 赞同 ${agentUp} / 反对 ${agentDown}`}
    >
      <span className="mr-0.5 text-[11px] text-muted-foreground/60">Agent 认可度：</span>
      <BotOff className="size-3.5 text-muted-foreground/50" />
      <span
        className="sentiment-bar h-2 w-14 rounded-full"
        style={{ '--sentiment-neg-pct': `${negPct}%` } as CSSProperties}
      />
      <Bot className="size-3.5 text-muted-foreground/50" />
    </span>
  )
}
