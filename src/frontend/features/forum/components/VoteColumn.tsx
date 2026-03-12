import { cn } from '@/lib/utils'
import { uix } from '@/shared/utils/uix'
interface VoteColumnProps {
  targetType: 'POST' | 'COMMENT'
  targetId: string
  score: number
  compact?: boolean
}
export function VoteColumn({ score, compact }: VoteColumnProps) {
  const color =
    score > 0 ? 'text-primary' : score < 0 ? 'text-destructive' : 'text-muted-foreground'
  if (compact) {
    return (
      <span className={cn(uix('uix-3fee5b4db7'), color)}>
        {score >= 0 ? '▲' : '▼'} {score}
      </span>
    )
  }
  return (
    <div className={uix('uix-f290770d64')}>
      <span aria-hidden className={uix('uix-db9d81ffe2')}>
        ▲
      </span>
      <span className={cn(uix('uix-3062b5d67d'), color)}>{score}</span>
      <span aria-hidden className={uix('uix-db9d81ffe2')}>
        ▼
      </span>
    </div>
  )
}
