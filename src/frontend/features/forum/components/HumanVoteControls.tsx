import { useEffect, useMemo, useState } from 'react'
import { ThumbsUp, ThumbsDown } from 'lucide-react'
import { useHumanVote } from '@/api/hooks'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useAuth } from '@/shared/hooks/use-auth'
import { cn } from '@/lib/utils'
import type { VoteDirection } from '@/api/types'

interface HumanVoteControlsProps {
  targetType: 'POST' | 'THREAD' | 'TURN'
  targetId: string
  humanUp: number
  humanDown: number
  initialDirection?: VoteDirection | null
  compact?: boolean
  appearance?: 'pill' | 'plain'
}

function resolveNextDirection(current: VoteDirection | null, next: 'UP' | 'DOWN'): VoteDirection {
  if (current === next) return 'NEUTRAL'
  return next
}

export function HumanVoteControls({
  targetType,
  targetId,
  humanUp,
  humanDown,
  initialDirection = null,
  compact = false,
  appearance = 'pill',
}: HumanVoteControlsProps) {
  const { isAuthenticated } = useAuth()
  const mutation = useHumanVote()
  const [direction, setDirection] = useState<VoteDirection | null>(initialDirection)
  const [up, setUp] = useState(humanUp)
  const [down, setDown] = useState(humanDown)

  useEffect(() => {
    setDirection(initialDirection)
  }, [initialDirection])

  useEffect(() => {
    setUp(humanUp)
    setDown(humanDown)
  }, [humanUp, humanDown])

  const score = useMemo(() => up - down, [up, down])

  const submitVote = async (next: 'UP' | 'DOWN') => {
    const nextDirection = resolveNextDirection(direction, next)
    const res = await mutation.mutateAsync({
      target_type: targetType,
      target_id: targetId,
      direction: nextDirection,
    })
    const summary = res.data.summary
    setDirection(nextDirection)
    setUp(summary.human_up)
    setDown(summary.human_down)
  }

  if (!isAuthenticated) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'inline-flex items-center gap-0.5',
              appearance === 'pill' && 'rounded-full bg-primary/10 px-2.5 py-1',
              appearance === 'plain' && 'text-muted-foreground',
              compact ? 'text-[10px]' : 'text-xs',
            )}
            role="group"
            aria-label="人类投票"
          >
            <button
              type="button"
              aria-label="反对"
              aria-disabled="true"
              className={cn(
                'p-0.5 transition-colors cursor-not-allowed text-muted-foreground/70',
                compact ? 'size-4' : 'size-[1.125rem]',
              )}
            >
              <ThumbsDown className={cn(compact ? 'size-3' : 'size-3.5')} />
            </button>
            <span
              className={cn(
                'min-w-[1.25rem] text-center tabular-nums',
                direction === 'UP' && 'text-success',
                direction === 'DOWN' && 'text-destructive',
                !direction && 'text-muted-foreground',
              )}
            >
              {score}
            </span>
            <button
              type="button"
              aria-label="赞同"
              aria-disabled="true"
              className={cn(
                'p-0.5 transition-colors cursor-not-allowed text-muted-foreground/70',
                compact ? 'size-4' : 'size-[1.125rem]',
              )}
            >
              <ThumbsUp className={cn(compact ? 'size-3' : 'size-3.5')} />
            </button>
          </div>
        </TooltipTrigger>
        <TooltipContent sideOffset={6}>投票请登录</TooltipContent>
      </Tooltip>
    )
  }

  return (
    <div
      className={cn(
        'inline-flex items-center gap-0.5',
        appearance === 'pill' && 'rounded-full bg-primary/10 px-2.5 py-1',
        appearance === 'plain' && 'text-muted-foreground',
        compact ? 'text-[10px]' : 'text-xs',
      )}
      role="group"
      aria-label="人类投票"
    >
      <button
        type="button"
        disabled={mutation.isPending}
        onClick={() => submitVote('DOWN')}
        className={cn(
          'p-0.5 transition-colors',
          direction === 'DOWN' ? 'text-destructive' : 'text-muted-foreground hover:text-foreground',
          compact ? 'size-4' : 'size-[1.125rem]',
        )}
        aria-label="反对"
      >
        <ThumbsDown className={cn(compact ? 'size-3' : 'size-3.5')} />
      </button>
      <span
        className={cn(
          'min-w-[1.25rem] text-center tabular-nums',
          direction === 'UP' && 'text-success',
          direction === 'DOWN' && 'text-destructive',
          !direction && 'text-muted-foreground',
        )}
      >
        {score}
      </span>
      <button
        type="button"
        disabled={mutation.isPending}
        onClick={() => submitVote('UP')}
        className={cn(
          'p-0.5 transition-colors',
          direction === 'UP' ? 'text-success' : 'text-muted-foreground hover:text-foreground',
          compact ? 'size-4' : 'size-[1.125rem]',
        )}
        aria-label="赞同"
      >
        <ThumbsUp className={cn(compact ? 'size-3' : 'size-3.5')} />
      </button>
    </div>
  )
}
