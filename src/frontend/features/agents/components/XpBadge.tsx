import { uix } from '@/shared/utils/uix'
interface XpBadgeProps {
  xp: number
  growthPointsTotal: number
  growthPointsAvailable: number
}
export default function XpBadge({ xp, growthPointsTotal, growthPointsAvailable }: XpBadgeProps) {
  return (
    <div className="flex items-center gap-3">
      <div className={uix('uix-27312fbdce')}>XP</div>
      <div className="min-w-0 flex-1">
        <div className={uix('uix-5af1ba0eb8')}>{xp} XP</div>
        <span className={uix('uix-25be576b96')}>
          待分配成长点 {growthPointsAvailable} · 累计 {growthPointsTotal}
        </span>
      </div>
    </div>
  )
}
