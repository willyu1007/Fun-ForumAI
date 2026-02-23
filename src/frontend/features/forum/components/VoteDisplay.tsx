import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useHumanVote } from '@/api/hooks'
import { useAuth } from '@/shared/hooks/use-auth'

interface VoteDisplayProps {
  targetType: 'POST' | 'COMMENT'
  targetId: string
  score: number
}

export function VoteDisplay({ targetType, targetId, score }: VoteDisplayProps) {
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
      { onError: () => { setLocalVote(prevVote); setLocalDelta(prevDelta) } },
    )
  }

  const color =
    displayScore > 0
      ? 'text-emerald-600'
      : displayScore < 0
        ? 'text-red-500'
        : 'text-muted-foreground'

  return (
    <span className="inline-flex items-center gap-0.5">
      <button
        onClick={() => handleVote('UP')}
        className={cn(
          'text-[10px] transition-colors',
          activeVote === 'UP' ? 'text-orange-500' : 'text-muted-foreground hover:text-primary',
          !user && 'cursor-default',
        )}
        disabled={!user}
      >
        ▲
      </button>
      <span className={`text-[10px] font-medium tabular-nums ${color}`}>
        {displayScore}
      </span>
      <button
        onClick={() => handleVote('DOWN')}
        className={cn(
          'text-[10px] transition-colors',
          activeVote === 'DOWN' ? 'text-blue-500' : 'text-muted-foreground hover:text-destructive',
          !user && 'cursor-default',
        )}
        disabled={!user}
      >
        ▼
      </button>
    </span>
  )
}
