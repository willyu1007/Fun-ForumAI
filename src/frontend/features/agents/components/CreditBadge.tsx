import { useAgentCredit, useAgentCreditEvents } from '@/api/hooks'
import { useAuth } from '@/shared/hooks/use-auth'
import { uix } from '@/shared/utils/uix'
interface CreditBadgeProps {
  agentId: string
}
const riskColors: Record<string, string> = {
  low: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  high: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
}
function scoreColor(score: number) {
  if (score > 70) return 'text-green-600 dark:text-green-400'
  if (score >= 40) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}
function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins}分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}小时前`
  return `${Math.floor(hours / 24)}天前`
}
export default function CreditBadge({ agentId }: CreditBadgeProps) {
  const { isAuthenticated } = useAuth()
  const { data: creditRes, isLoading: creditLoading } = useAgentCredit(agentId)
  const { data: eventsRes, isLoading: eventsLoading } = useAgentCreditEvents(agentId, {
    enabled: isAuthenticated,
  })
  if (creditLoading) {
    return <div className={uix('uix-839cdd2e7e')}>加载信用数据…</div>
  }
  const credit = creditRes?.data
  if (!credit) return null
  const events = eventsRes?.data ?? []
  const riskCls = riskColors[credit.risk_level] ?? riskColors.medium
  return (
    <div className={uix('uix-63142bb52e')}>
      <div className="flex items-center justify-between">
        <h3 className={uix('uix-e83a7042bc')}>信用评分</h3>
        <span className={`${uix('uix-pill-status')} ${riskCls}`}>
          {credit.risk_level === 'low' && '低风险'}
          {credit.risk_level === 'medium' && '中风险'}
          {credit.risk_level === 'high' && '高风险'}
        </span>
      </div>

      <div className="flex items-baseline gap-2">
        <span className={`${uix('uix-score-xl')} tabular-nums ${scoreColor(credit.credit_score)}`}>
          {credit.credit_score}
        </span>
        <span className={uix('uix-25be576b96')}>/ 100</span>
      </div>

      {credit.violations > 0 && (
        <p className={uix('uix-25be576b96')}>
          违规次数: {credit.violations}
          {credit.last_violation_at && ` · 最近: ${relativeTime(credit.last_violation_at)}`}
        </p>
      )}

      {!eventsLoading && events.length > 0 && (
        <div>
          <p className={uix('uix-c814f31939')}>近期变动</p>
          <ul className="space-y-1.5">
            {events.map((ev) => (
              <li key={ev.id} className={uix('uix-7c3cd25611')}>
                <span className={uix('uix-83d681b46f')}>{ev.reason}</span>
                <span className={uix('uix-96acd79200')}>
                  <span className={ev.delta > 0 ? uix('uix-88509a11b7') : uix('uix-2a4ba0866f')}>
                    {ev.delta > 0 ? '+' : ''}
                    {ev.delta}
                  </span>
                  <span className={uix('uix-bfa6031907')}>{relativeTime(ev.created_at)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
