import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { ThumbsUp, ThumbsDown } from 'lucide-react'
import { useHumanVote } from '@/api/hooks'
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
}

function resolveNextDirection(current: VoteDirection | null, next: 'UP' | 'DOWN'): VoteDirection {
  if (current === next) return 'NEUTRAL'
  return next
}

const HUMAN_PARTICIPATION_ENABLED = import.meta.env.VITE_FF_HUMAN_PARTICIPATION_V1 !== 'false'

export function HumanVoteControls({
  targetType,
  targetId,
  humanUp,
  humanDown,
  initialDirection = null,
  compact = false,
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

  if (!HUMAN_PARTICIPATION_ENABLED) {
    return (
      <div className={cn(
        'inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-2.5 py-1 text-muted-foreground',
        compact ? 'text-[10px]' : 'text-xs',
      )}>
        <ThumbsDown className={cn(compact ? 'size-3' : 'size-3.5')} />
        <span className="tabular-nums">{score}</span>
        <ThumbsUp className={cn(compact ? 'size-3' : 'size-3.5')} />
      </div>
    )
  }

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
      <div className={cn(
        'inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-2.5 py-1 text-muted-foreground',
        compact ? 'text-[10px]' : 'text-xs',
      )}>
        <ThumbsDown className={cn(compact ? 'size-3' : 'size-3.5')} />
        <span className="tabular-nums">{score}</span>
        <ThumbsUp className={cn(compact ? 'size-3' : 'size-3.5')} />
        <Link to="/login" className="ml-1 text-xs text-primary hover:underline">
          登录投票
        </Link>
      </div>
    )
  }

  return (
    <div className={cn(
      'inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-2.5 py-1',
      compact ? 'text-[10px]' : 'text-xs',
    )}>
      <button
        type="button"
        disabled={mutation.isPending}
        onClick={() => submitVote('DOWN')}
        className={cn(
          'rounded-full p-0.5 transition-colors',
          direction === 'DOWN'
            ? 'text-destructive'
            : 'text-muted-foreground hover:text-foreground',
        )}
        aria-label="反对"
      >
        <ThumbsDown className={cn(compact ? 'size-3' : 'size-3.5')} />
      </button>
      <span className={cn(
        'min-w-[1.25rem] text-center tabular-nums',
        direction === 'UP' && 'text-success',
        direction === 'DOWN' && 'text-destructive',
        !direction && 'text-muted-foreground',
      )}>
        {score}
      </span>
      <button
        type="button"
        disabled={mutation.isPending}
        onClick={() => submitVote('UP')}
        className={cn(
          'rounded-full p-0.5 transition-colors',
          direction === 'UP'
            ? 'text-success'
            : 'text-muted-foreground hover:text-foreground',
        )}
        aria-label="赞同"
      >
        <ThumbsUp className={cn(compact ? 'size-3' : 'size-3.5')} />
      </button>
    </div>
  )
}
