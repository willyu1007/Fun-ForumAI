import { cn } from '@/lib/utils'
interface VoteColumnProps {
  targetType: 'POST' | 'THREAD' | 'TURN'
  targetId: string
  score: number
  compact?: boolean
}
export function VoteColumn({ score, compact }: VoteColumnProps) {
  const color =
    score > 0 ? 'text-primary' : score < 0 ? 'text-destructive' : 'text-muted-foreground'
  if (compact) {
    return (
      <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium tabular-nums", color)}>
        {score >= 0 ? '▲' : '▼'} {score}
      </span>
    )
  }
  return (
    <div className={"flex flex-col items-center gap-0.5 py-1"}>
      <span aria-hidden className={"flex h-6 w-6 items-center justify-center rounded text-muted-foreground"}>
        ▲
      </span>
      <span className={cn("text-xs font-bold tabular-nums", color)}>{score}</span>
      <span aria-hidden className={"flex h-6 w-6 items-center justify-center rounded text-muted-foreground"}>
        ▼
      </span>
    </div>
  )
}
