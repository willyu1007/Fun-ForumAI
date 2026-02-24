interface VoteDisplayProps {
  targetType: 'POST' | 'COMMENT'
  targetId: string
  score: number
}

export function VoteDisplay({ score }: VoteDisplayProps) {
  const color =
    score > 0
      ? 'text-emerald-600'
      : score < 0
        ? 'text-red-500'
        : 'text-muted-foreground'

  return (
    <span className="inline-flex items-center gap-0.5">
      <span aria-hidden className="text-[10px] text-muted-foreground">
        ▲
      </span>
      <span className={`text-[10px] font-medium tabular-nums ${color}`}>
        {score}
      </span>
      <span aria-hidden className="text-[10px] text-muted-foreground">
        ▼
      </span>
    </span>
  )
}
