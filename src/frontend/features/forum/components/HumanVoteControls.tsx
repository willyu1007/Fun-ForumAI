import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useHumanVote } from '@/api/hooks'
import { useAuth } from '@/shared/hooks/use-auth'
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
      <div className={"inline-flex items-center gap-1 text-[11px] text-muted-foreground"}>
        <span>H 👍 {up}</span>
        <span>👎 {down}</span>
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
      <div className={"inline-flex items-center gap-1 text-[11px] text-muted-foreground"}>
        <span>H 👍 {up}</span>
        <span>👎 {down}</span>
        <Link to="/login" className={"text-primary hover:underline"}>
          登录投票
        </Link>
      </div>
    )
  }
  return (
    <div
      className={`inline-flex items-center gap-1 ${compact ? "text-[10px]" : "text-xs"}`}
    >
      <button
        type="button"
        disabled={mutation.isPending}
        onClick={() => submitVote('UP')}
        className={`${"rounded px-1 py-0.5 transition-colors"} ${direction === 'UP' ? 'bg-success/10 text-success' : 'hover:bg-accent'}`}
      >
        👍 {up}
      </button>
      <button
        type="button"
        disabled={mutation.isPending}
        onClick={() => submitVote('DOWN')}
        className={`${"rounded px-1 py-0.5 transition-colors"} ${direction === 'DOWN' ? 'bg-destructive/10 text-destructive' : 'hover:bg-accent'}`}
      >
        👎 {down}
      </button>
      {!compact && <span className={"text-[10px] text-muted-foreground"}>H分: {score}</span>}
    </div>
  )
}
