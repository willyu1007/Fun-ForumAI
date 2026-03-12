import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import type { AgentRun } from '@/api/types'
import { uix } from '@/shared/utils/uix'
interface RunHistoryTableProps {
  runs: AgentRun[]
  isLoading?: boolean
}
const VERDICT_STYLES: Record<string, string> = {
  APPROVE: 'bg-emerald-50 text-emerald-700',
  FOLD: 'bg-amber-50 text-amber-700',
  QUARANTINE: 'bg-red-50 text-red-700',
  REJECT: 'bg-red-100 text-red-800',
}
const VERDICT_LABELS: Record<string, string> = {
  APPROVE: '通过',
  FOLD: '折叠',
  QUARANTINE: '隔离',
  REJECT: '拒绝',
}
export function RunHistoryTable({ runs, isLoading }: RunHistoryTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-10" />
        ))}
      </div>
    )
  }
  if (runs.length === 0) {
    return <p className={uix('uix-05e9bff609')}>暂无运行记录。</p>
  }
  return (
    <div className={uix('uix-6d0a7fc15e')}>
      <table className={uix('uix-8af758bc0a')}>
        <thead className={uix('uix-73a6145db6')}>
          <tr>
            <th className={uix('uix-ba64a3ceb4')}>运行 ID</th>
            <th className={uix('uix-ba64a3ceb4')}>审核结果</th>
            <th className={uix('uix-0c8817292f')}>消耗 Token</th>
            <th className={uix('uix-0c8817292f')}>耗时</th>
            <th className={uix('uix-ba64a3ceb4')}>创建时间</th>
          </tr>
        </thead>
        <tbody className={uix('uix-fa6acbf81d')}>
          {runs.map((run) => (
            <tr key={run.id} className="hover:bg-muted/30 transition-colors">
              <td className={uix('uix-51296f529d')}>{run.id.slice(0, 16)}…</td>
              <td className={uix('uix-4a41357faa')}>
                {run.moderation_result ? (
                  <Badge variant="outline" className={VERDICT_STYLES[run.moderation_result] ?? ''}>
                    {VERDICT_LABELS[run.moderation_result] ?? run.moderation_result}
                  </Badge>
                ) : (
                  <span className={uix('uix-25be576b96')}>—</span>
                )}
              </td>
              <td className={uix('uix-4fad9d900f')}>{run.token_cost}</td>
              <td className={uix('uix-4fad9d900f')}>{run.latency_ms}ms</td>
              <td className={uix('uix-be6e2555e0')}>
                {new Date(run.created_at).toLocaleString('zh-CN', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
