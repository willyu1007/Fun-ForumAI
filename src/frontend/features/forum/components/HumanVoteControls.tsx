import { useEffect, useMemo, useState } from 'react'
import { ThumbsUp, ThumbsDown } from 'lucide-react'
import { useHumanVote } from '@/api/hooks'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useAuth } from '@/shared/hooks/use-auth'
import { cn } from '@/lib/utils'
import type { VoteDirection } from '@/api/types'

interface HumanVoteControlsProps {
  targetType: 'POST' | 'THREAD' | 'TURN' | 'AUDIENCE_MESSAGE'
  targetId: string
  humanUp: number
  humanDown: number
  initialDirection?: VoteDirection | null
  compact?: boolean
  appearance?: 'pill' | 'plain'
  size?: 'md' | 'lg'
  onVoteApplied?: () => void
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
  size = 'md',
  onVoteApplied,
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
    onVoteApplied?.()
  }

  const isAudienceCompactPlain = compact && appearance === 'plain' && targetType === 'AUDIENCE_MESSAGE'
  const containerTextClass = compact ? 'text-[11px]' : size === 'lg' ? 'text-[13px]' : 'text-xs'
  const containerHeightClass = isAudienceCompactPlain ? 'h-[18px]' : size === 'lg' ? 'h-6' : ''
  const buttonSizeClass = isAudienceCompactPlain
    ? 'size-[18px]'
    : compact
      ? 'size-4'
      : size === 'lg'
        ? 'size-5'
        : 'size-[1.125rem]'
  const iconSizeClass = isAudienceCompactPlain
    ? 'size-[14px]'
    : compact
      ? 'size-3'
      : size === 'lg'
        ? 'size-4'
        : 'size-3.5'
  const scoreWidthClass = isAudienceCompactPlain ? 'min-w-[18px]' : size === 'lg' ? 'min-w-[1.5rem]' : 'min-w-[1.25rem]'
  const scoreAlignClass = isAudienceCompactPlain || size === 'lg'
    ? 'inline-flex h-full items-center justify-center'
    : 'inline-flex items-center justify-center'

  if (!isAuthenticated) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'inline-flex items-center gap-0.5 leading-none',
              containerHeightClass,
              appearance === 'pill' && 'rounded-full bg-primary/10 px-2.5 py-1',
              appearance === 'plain' && 'text-muted-foreground',
              containerTextClass,
            )}
            role="group"
            aria-label="人类投票"
          >
            <button
              type="button"
              aria-label="反对"
              aria-disabled="true"
              className={cn(
                'inline-flex items-center justify-center p-0.5 transition-colors cursor-not-allowed text-muted-foreground/70',
                buttonSizeClass,
              )}
            >
              <ThumbsDown
                className={cn(
                  isAudienceCompactPlain && 'size-[14px]',
                  !isAudienceCompactPlain && compact && 'size-3',
                  !isAudienceCompactPlain && size === 'lg' && 'size-4',
                  !isAudienceCompactPlain && !compact && size !== 'lg' && 'size-3.5',
                )}
              />
            </button>
            <span
              className={cn(
                scoreWidthClass,
                scoreAlignClass,
                'text-center tabular-nums leading-none',
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
                'inline-flex items-center justify-center p-0.5 transition-colors cursor-not-allowed text-muted-foreground/70',
                buttonSizeClass,
              )}
            >
              <ThumbsUp
                className={cn(
                  isAudienceCompactPlain && 'size-[14px]',
                  !isAudienceCompactPlain && compact && 'size-3',
                  !isAudienceCompactPlain && size === 'lg' && 'size-4',
                  !isAudienceCompactPlain && !compact && size !== 'lg' && 'size-3.5',
                )}
              />
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
        'inline-flex items-center gap-0.5 leading-none',
        containerHeightClass,
        appearance === 'pill' && 'rounded-full bg-primary/10 px-2.5 py-1',
        appearance === 'plain' && 'text-muted-foreground',
        containerTextClass,
      )}
      role="group"
      aria-label="人类投票"
    >
      <button
        type="button"
        disabled={mutation.isPending}
        onClick={() => submitVote('DOWN')}
        className={cn(
          'inline-flex items-center justify-center p-0.5 transition-colors',
          direction === 'DOWN'
            ? 'text-destructive/85'
            : 'text-muted-foreground hover:text-destructive/75',
          buttonSizeClass,
        )}
        aria-label="反对"
      >
        <ThumbsDown
          className={cn(
            iconSizeClass,
            direction === 'DOWN' ? 'fill-current' : 'fill-transparent',
          )}
        />
      </button>
      <span
        className={cn(
          scoreWidthClass,
          scoreAlignClass,
          'text-center tabular-nums leading-none',
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
          'inline-flex items-center justify-center p-0.5 transition-colors',
          direction === 'UP'
            ? 'text-success/85'
            : 'text-muted-foreground hover:text-success/75',
          buttonSizeClass,
        )}
        aria-label="赞同"
      >
        <ThumbsUp
          className={cn(
            iconSizeClass,
            direction === 'UP' ? 'fill-current' : 'fill-transparent',
          )}
        />
      </button>
    </div>
  )
}
