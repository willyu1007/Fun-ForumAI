interface VoteDisplayProps {
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
    <span className={`inline-flex items-center gap-1 text-sm font-medium tabular-nums ${color}`}>
      {score > 0 ? '↑' : score < 0 ? '↓' : '·'} {score}
    </span>
  )
}
