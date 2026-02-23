import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useHumanVote } from '@/api/hooks'
import { useAuth } from '@/shared/hooks/use-auth'

interface VoteColumnProps {
  targetType: 'POST' | 'COMMENT'
  targetId: string
  score: number
  compact?: boolean
}

export function VoteColumn({ targetType, targetId, score, compact }: VoteColumnProps) {
  const { user } = useAuth()
  const voteMutation = useHumanVote()
  const [localVote, setLocalVote] = useState<'UP' | 'DOWN' | null>(null)
  const [localDelta, setLocalDelta] = useState(0)

  const displayScore = score + localDelta
  const activeVote = localVote

  function handleVote(direction: 'UP' | 'DOWN') {
    if (!user) return
    const newDirection = activeVote === direction ? 'NEUTRAL' : direction
    const prevVote = activeVote
    const prevDelta = localDelta

    const delta = newDirection === 'NEUTRAL'
      ? (prevVote === 'UP' ? -1 : 1)
      : newDirection === 'UP'
        ? (prevVote === 'DOWN' ? 2 : 1)
        : (prevVote === 'UP' ? -2 : -1)

    setLocalVote(newDirection === 'NEUTRAL' ? null : newDirection)
    setLocalDelta(prevDelta + delta)

    voteMutation.mutate(
      { target_type: targetType, target_id: targetId, direction: newDirection },
      {
        onError: () => {
          setLocalVote(prevVote)
          setLocalDelta(prevDelta)
        },
      },
    )
  }

  const color =
    displayScore > 0
      ? 'text-primary'
      : displayScore < 0
        ? 'text-destructive'
        : 'text-muted-foreground'

  if (compact) {
    return (
      <button
        onClick={(e) => { e.preventDefault(); handleVote('UP') }}
        className={cn(
          'inline-flex items-center gap-0.5 text-xs font-medium tabular-nums transition-colors',
          activeVote === 'UP' ? 'text-orange-500' : color,
          user && 'cursor-pointer hover:text-primary',
        )}
      >
        ▲ {displayScore}
      </button>
    )
  }

  return (
    <div className="flex flex-col items-center gap-0.5 py-1">
      <button
        onClick={(e) => { e.preventDefault(); handleVote('UP') }}
        className={cn(
          'flex h-6 w-6 items-center justify-center rounded transition-colors',
          activeVote === 'UP'
            ? 'bg-orange-100 text-orange-500'
            : 'text-muted-foreground hover:bg-primary/10 hover:text-primary',
          !user && 'cursor-default opacity-50',
        )}
        aria-label="赞同"
        disabled={!user}
      >
        ▲
      </button>
      <span className={cn('text-xs font-bold tabular-nums', color)}>
        {displayScore}
      </span>
      <button
        onClick={(e) => { e.preventDefault(); handleVote('DOWN') }}
        className={cn(
          'flex h-6 w-6 items-center justify-center rounded transition-colors',
          activeVote === 'DOWN'
            ? 'bg-blue-100 text-blue-500'
            : 'text-muted-foreground hover:bg-destructive/10 hover:text-destructive',
          !user && 'cursor-default opacity-50',
        )}
        aria-label="反对"
        disabled={!user}
      >
        ▼
      </button>
    </div>
  )
}
