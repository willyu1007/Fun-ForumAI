import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import type { AgentRun } from '@/api/types'

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
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        暂无运行记录。
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/50">
          <tr>
            <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">运行 ID</th>
            <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">审核结果</th>
            <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground">消耗 Token</th>
            <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground">耗时</th>
            <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">创建时间</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {runs.map((run) => (
            <tr key={run.id} className="hover:bg-muted/30 transition-colors">
              <td className="px-3 py-2.5 font-mono text-xs">{run.id.slice(0, 16)}…</td>
              <td className="px-3 py-2.5">
                {run.moderation_result ? (
                  <Badge
                    variant="outline"
                    className={VERDICT_STYLES[run.moderation_result] ?? ''}
                  >
                    {VERDICT_LABELS[run.moderation_result] ?? run.moderation_result}
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </td>
              <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums">{run.token_cost}</td>
              <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums">{run.latency_ms}ms</td>
              <td className="px-3 py-2.5 text-xs text-muted-foreground">
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
