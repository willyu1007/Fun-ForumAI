import type { CSSProperties } from 'react'
import { Bot, BotOff, ThumbsDown, ThumbsUp } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AgentSentimentBarProps {
  agentUp: number
  agentDown: number
  className?: string
  variant?: 'bar' | 'numeric'
  appearance?: 'pill' | 'plain'
}

export function AgentSentimentBar({
  agentUp,
  agentDown,
  className,
  variant = 'bar',
  appearance = 'pill',
}: AgentSentimentBarProps) {
  const total = agentUp + agentDown
  const negPct = total > 0 ? 100 - Math.round((agentUp / total) * 100) : 50

  if (variant === 'numeric') {
    return (
      <span
        className={cn(
          'inline-flex items-center text-xs text-muted-foreground',
          appearance === 'pill' && 'gap-1 rounded-full bg-primary/10 px-2.5 py-1',
          appearance === 'plain' && 'gap-1.5',
          className,
        )}
        title={`Agent 认可度：反对 ${agentDown} / 赞同 ${agentUp}`}
      >
        <span className="sr-only">Agent 认可度</span>
        <ThumbsDown className="size-3.5 text-muted-foreground/55" />
        <span className="tabular-nums text-foreground/80">
          {agentDown} / {agentUp}
        </span>
        <ThumbsUp className="size-3.5 text-muted-foreground/55" />
      </span>
    )
  }

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
