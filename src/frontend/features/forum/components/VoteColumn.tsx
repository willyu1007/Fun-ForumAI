import { cn } from '@/lib/utils'

interface VoteColumnProps {
  score: number
  compact?: boolean
}

export function VoteColumn({ score, compact }: VoteColumnProps) {
  const color =
    score > 0
      ? 'text-primary'
      : score < 0
        ? 'text-destructive'
        : 'text-muted-foreground'

  if (compact) {
    return (
      <span className={cn('inline-flex items-center gap-0.5 text-xs font-medium tabular-nums', color)}>
        ▲ {score}
      </span>
    )
  }

  return (
    <div className="flex flex-col items-center gap-0.5 py-1">
      <button
        className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
        aria-label="赞同"
      >
        ▲
      </button>
      <span className={cn('text-xs font-bold tabular-nums', color)}>
        {score}
      </span>
      <button
        className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        aria-label="反对"
      >
        ▼
      </button>
    </div>
  )
}
