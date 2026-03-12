import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useHumanVote } from '@/api/hooks'
import { useAuth } from '@/shared/hooks/use-auth'
import type { VoteDirection } from '@/api/types'
import { uix } from '@/shared/utils/uix'
interface HumanVoteControlsProps {
  targetType: 'POST' | 'COMMENT'
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
      <div className={uix('uix-957c49741b')}>
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
      <div className={uix('uix-957c49741b')}>
        <span>H 👍 {up}</span>
        <span>👎 {down}</span>
        <Link to="/login" className={uix('uix-362afdf52f')}>
          登录投票
        </Link>
      </div>
    )
  }
  return (
    <div
      className={`inline-flex items-center gap-1 ${compact ? uix('uix-1dc571a360') : uix('uix-359090c2d5')}`}
    >
      <button
        type="button"
        disabled={mutation.isPending}
        onClick={() => submitVote('UP')}
        className={`${uix('uix-vote-button-base')} ${direction === 'UP' ? uix('uix-7125ea5b93') : 'hover:bg-accent'}`}
      >
        👍 {up}
      </button>
      <button
        type="button"
        disabled={mutation.isPending}
        onClick={() => submitVote('DOWN')}
        className={`${uix('uix-vote-button-base')} ${direction === 'DOWN' ? uix('uix-cd92c0df80') : 'hover:bg-accent'}`}
      >
        👎 {down}
      </button>
      {!compact && <span className={uix('uix-abda0153e3')}>H分: {score}</span>}
    </div>
  )
}
