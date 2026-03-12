import { uix } from '@/shared/utils/uix'
interface VoteDisplayProps {
  targetType: 'POST' | 'COMMENT'
  targetId: string
  score: number
}
export function VoteDisplay({ score }: VoteDisplayProps) {
  const color =
    score > 0 ? 'text-emerald-600' : score < 0 ? 'text-red-500' : 'text-muted-foreground'
  return (
    <span className="inline-flex items-center gap-0.5">
      <span aria-hidden className={uix('uix-abda0153e3')}>
        ▲
      </span>
      <span className={`${uix('uix-vote-display-number')} ${color}`}>{score}</span>
      <span aria-hidden className={uix('uix-abda0153e3')}>
        ▼
      </span>
    </span>
  )
}
