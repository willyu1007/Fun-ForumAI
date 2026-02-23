interface LevelBadgeProps {
  level: number
  xp: number
  xpForNext: number
}

export default function LevelBadge({ level, xp, xpForNext }: LevelBadgeProps) {
  const pct = xpForNext > 0 ? Math.min((xp / xpForNext) * 100, 100) : 100

  return (
    <div className="flex items-center gap-3">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-sm font-bold text-white shadow">
        Lv.{level}
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {xp} / {xpForNext} XP
        </span>
      </div>
    </div>
  )
}
