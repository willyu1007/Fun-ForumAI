import type { CSSProperties, ReactNode } from 'react'
import { Bot, BotOff, ThumbsDown, ThumbsUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface AgentSentimentBarProps {
  agentUp: number
  agentDown: number
  className?: string
  variant?: 'bar' | 'numeric' | 'net'
  appearance?: 'pill' | 'plain'
  showLabel?: boolean
  size?: 'md' | 'lg'
}

function AgentSentimentTooltip({
  agentUp,
  agentDown,
  children,
}: {
  agentUp: number
  agentDown: number
  children: ReactNode
}) {
  return (
    <TooltipProvider delayDuration={800}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">{children}</span>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          sideOffset={6}
          hideArrow
          className="w-60 max-w-60 border border-border bg-popover text-popover-foreground shadow-md text-wrap whitespace-normal break-words"
        >
          <div className="space-y-1.5 leading-relaxed">
            <p className="font-medium text-foreground">Agent 喜爱程度</p>
            <p>
              <strong>智能体</strong>对主贴内容的投票，左侧为反对，右侧为赞同。
            </p>
            <p className="text-muted-foreground">
              当前：反对 {agentDown}，赞同 {agentUp}
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
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
      <AgentSentimentTooltip agentUp={agentUp} agentDown={agentDown}>
        <span
          className={cn(
            'inline-flex items-center leading-none text-xs text-muted-foreground',
            appearance === 'pill' && 'gap-1 rounded-full bg-primary/10 px-2.5 py-1',
            appearance === 'plain' && (size === 'lg' ? 'gap-2 text-[13px]' : 'gap-1.5'),
            className,
          )}
        >
          <span className="sr-only">Agent 喜爱程度</span>
          <ThumbsDown className={cn(size === 'lg' ? 'size-4' : 'size-3.5', 'text-muted-foreground/55')} />
          <span className="tabular-nums text-foreground/80">
            {agentDown} / {agentUp}
          </span>
          <ThumbsUp className={cn(size === 'lg' ? 'size-4' : 'size-3.5', 'text-muted-foreground/55')} />
        </span>
      </AgentSentimentTooltip>
    )
  }

  if (variant === 'net') {
    const net = agentUp - agentDown
    const iconBoxClassName = size === 'lg' ? 'h-[18px] w-[18px]' : 'h-4 w-4'
    const iconClassName = size === 'lg' ? 'size-[18px]' : 'size-4'
    const valueBoxClassName = size === 'lg'
      ? 'h-[18px] min-w-[1.25rem] text-[13px]'
      : 'h-4 min-w-[1.25rem] text-xs'

    return (
      <AgentSentimentTooltip agentUp={agentUp} agentDown={agentDown}>
        <span
          className={cn(
            'inline-flex items-center leading-none',
            appearance === 'pill' && 'rounded-full bg-primary/10 px-2 py-1',
            appearance === 'plain' && 'text-muted-foreground',
            size === 'lg' ? 'h-5 gap-0.5 text-[13px]' : 'gap-0.5 text-xs',
            className,
          )}
        >
          <span className={cn('inline-flex shrink-0 items-center justify-center', iconBoxClassName)}>
            <BotOff className={cn(iconClassName, 'text-muted-foreground/50')} />
          </span>
          <span
            className={cn(
              valueBoxClassName,
              'inline-flex items-center justify-center text-center tabular-nums leading-none',
              net > 0 && 'text-success',
              net < 0 && 'text-destructive',
              net === 0 && 'text-muted-foreground',
            )}
          >
            {net > 0 ? `+${net}` : `${net}`}
          </span>
          <span className={cn('inline-flex shrink-0 items-center justify-center', iconBoxClassName)}>
            <Bot className={cn(iconClassName, 'text-muted-foreground/50')} />
          </span>
        </span>
      </AgentSentimentTooltip>
    )
  }

  return (
    <AgentSentimentTooltip agentUp={agentUp} agentDown={agentDown}>
      <span
        className={cn(
          'inline-flex items-center gap-1.5 py-1 leading-none',
          className,
        )}
      >
        {showLabel ? (
          <span className="mr-0.5 hidden text-[11px] text-muted-foreground/60 xl:inline">
            Agent 认可度：
          </span>
        ) : null}
        <BotOff className="size-3.5 text-muted-foreground/50" />
        <span
          className="sentiment-bar h-2 w-14 rounded-full"
          style={{ '--sentiment-neg-pct': `${negPct}%` } as CSSProperties}
        />
        <Bot className="size-3.5 text-muted-foreground/50" />
      </span>
    </AgentSentimentTooltip>
  )
}
