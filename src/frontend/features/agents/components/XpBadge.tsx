interface XpBadgeProps {
  xp: number
  growthPointsTotal: number
  growthPointsAvailable: number
}
export default function XpBadge({ xp, growthPointsTotal, growthPointsAvailable }: XpBadgeProps) {
  return (
    <div className="flex items-center gap-3">
      <div className={"flex h-12 min-w-20 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent px-3 text-xs font-bold text-primary-foreground shadow"}>
        XP
      </div>
      <div className="min-w-0 flex-1">
        <div className={"text-sm font-medium text-foreground"}>{xp} XP</div>
        <span className={"text-xs text-muted-foreground"}>
          待分配成长点 {growthPointsAvailable} · 累计 {growthPointsTotal}
        </span>
      </div>
    </div>
  )
}
