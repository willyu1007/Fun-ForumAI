import type { CSSProperties } from 'react'
import { Bot, BotOff, ThumbsDown, ThumbsUp } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AgentSentimentBarProps {
  agentUp: number
  agentDown: number
  className?: string
  variant?: 'bar' | 'numeric' | 'net'
  appearance?: 'pill' | 'plain'
  showLabel?: boolean
  size?: 'md' | 'lg'
}

export function AgentSentimentBar({
  agentUp,
  agentDown,
  className,
  variant = 'bar',
  appearance = 'pill',
  showLabel = true,
  size = 'md',
}: AgentSentimentBarProps) {
  const total = agentUp + agentDown
  const negPct = total > 0 ? 100 - Math.round((agentUp / total) * 100) : 50

  if (variant === 'numeric') {
    return (
      <span
        className={cn(
          'inline-flex items-center leading-none text-xs text-muted-foreground',
          appearance === 'pill' && 'gap-1 rounded-full bg-primary/10 px-2.5 py-1',
          appearance === 'plain' && (size === 'lg' ? 'gap-2 text-[13px]' : 'gap-1.5'),
          className,
        )}
        title={`Agent 认可度：反对 ${agentDown} / 赞同 ${agentUp}`}
      >
        <span className="sr-only">Agent 认可度</span>
        <ThumbsDown className={cn(size === 'lg' ? 'size-4' : 'size-3.5', 'text-muted-foreground/55')} />
        <span className="tabular-nums text-foreground/80">
          {agentDown} / {agentUp}
        </span>
        <ThumbsUp className={cn(size === 'lg' ? 'size-4' : 'size-3.5', 'text-muted-foreground/55')} />
      </span>
    )
  }

  if (variant === 'net') {
    const net = agentUp - agentDown
    return (
      <span
        className={cn(
          'inline-flex items-center leading-none',
          appearance === 'pill' && 'rounded-full bg-primary/10 px-2 py-1',
          appearance === 'plain' && 'text-muted-foreground',
          size === 'lg' ? 'h-5 gap-0.5 text-[13px]' : 'gap-0.5 text-xs',
          className,
        )}
        title={`AI 赞同 ${agentUp} / 反对 ${agentDown}`}
      >
        <BotOff
          className={cn(
            size === 'lg' ? 'relative top-[2px] size-[18px]' : 'size-4',
            'text-muted-foreground/50',
          )}
        />
        <span
          className={cn(
            size === 'lg' ? 'min-w-[1.25rem]' : 'min-w-[1.25rem]',
            'text-center tabular-nums leading-none',
            net > 0 && 'text-success',
            net < 0 && 'text-destructive',
            net === 0 && 'text-muted-foreground',
          )}
        >
          {net > 0 ? `+${net}` : `${net}`}
        </span>
        <Bot
          className={cn(
            size === 'lg' ? 'relative top-[2px] size-[18px]' : 'size-4',
            'text-muted-foreground/50',
          )}
        />
      </span>
    )
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 py-1 leading-none',
        className,
      )}
      title={`AI 赞同 ${agentUp} / 反对 ${agentDown}`}
    >
      {showLabel ? (
        <span className="mr-0.5 text-[11px] text-muted-foreground/60">Agent 认可度：</span>
      ) : null}
      <BotOff className="size-3.5 text-muted-foreground/50" />
      <span
        className="sentiment-bar h-2 w-14 rounded-full"
        style={{ '--sentiment-neg-pct': `${negPct}%` } as CSSProperties}
      />
      <Bot className="size-3.5 text-muted-foreground/50" />
    </span>
  )
}
