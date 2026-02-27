import { useMemo, useState } from 'react'
import { useAgentRelationSummary, useAgentRelations } from '@/api/hooks'
import type { AgentRelationState, AgentRelationView } from '@/api/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { relativeTime } from '@/shared/utils/relative-time'

const VIEW_OPTIONS: Array<{ id: AgentRelationView; label: string }> = [
  { id: 'following', label: '我关注' },
  { id: 'followers', label: '关注我' },
  { id: 'friends', label: '好友(互关)' },
]

const STATE_OPTIONS: Array<{ id: AgentRelationState | 'all'; label: string }> = [
  { id: 'all', label: '全部状态' },
  { id: 'shadow', label: 'Shadow' },
  { id: 'effective', label: 'Effective' },
  { id: 'inactive', label: 'Inactive' },
  { id: 'blocked', label: 'Blocked' },
]

const STATE_BADGE: Record<AgentRelationState, string> = {
  shadow: 'bg-slate-50 text-slate-700',
  effective: 'bg-emerald-50 text-emerald-700',
  inactive: 'bg-zinc-100 text-zinc-700',
  blocked: 'bg-red-50 text-red-700',
}

export function RelationNetworkPanel({ agentId }: { agentId: string }) {
  const [view, setView] = useState<AgentRelationView>('following')
  const [stateFilter, setStateFilter] = useState<AgentRelationState | 'all'>('all')

  const params = useMemo(
    () => ({
      view,
      ...(stateFilter !== 'all' ? { state: stateFilter } : {}),
      limit: 50,
    }),
    [view, stateFilter],
  )

  const summaryQuery = useAgentRelationSummary(agentId)
  const listQuery = useAgentRelations(agentId, params)

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">关系概览</CardTitle>
        </CardHeader>
        <CardContent>
          {summaryQuery.isLoading
            ? <Skeleton className="h-16" />
            : (
                <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
                  <MetricBlock
                    label="我关注"
                    value={`${summaryQuery.data?.data.following.effective ?? 0} / ${summaryQuery.data?.data.following.shadow ?? 0}`}
                    hint="effective / shadow"
                  />
                  <MetricBlock
                    label="关注我"
                    value={`${summaryQuery.data?.data.followers.effective ?? 0} / ${summaryQuery.data?.data.followers.shadow ?? 0}`}
                    hint="effective / shadow"
                  />
                  <MetricBlock
                    label="好友"
                    value={`${summaryQuery.data?.data.friends ?? 0}`}
                    hint="双向 effective"
                  />
                </div>
              )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-sm">关系列表</CardTitle>
            <div className="flex gap-2">
              <Select value={view} onValueChange={(value) => setView(value as AgentRelationView)}>
                <SelectTrigger className="h-8 w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VIEW_OPTIONS.map((option) => (
                    <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={stateFilter} onValueChange={(value) => setStateFilter(value as AgentRelationState | 'all')}>
                <SelectTrigger className="h-8 w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATE_OPTIONS.map((option) => (
                    <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {listQuery.isLoading && (
            <div className="space-y-2">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          )}

          {!listQuery.isLoading && (listQuery.data?.data.items?.length ?? 0) === 0 && (
            <div className="rounded-md border border-dashed p-5 text-center text-xs text-muted-foreground">
              当前视图无关系数据
            </div>
          )}

          {!listQuery.isLoading && (listQuery.data?.data.items?.length ?? 0) > 0 && (
            <div className="space-y-2">
              {listQuery.data?.data.items.map((item) => (
                <div key={item.relation_id} className="rounded-md border bg-card px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-mono text-xs">{item.pair_agent_id}</p>
                      <p className="text-[10px] text-muted-foreground">{item.direction} · 更新于 {relativeTime(item.updated_at)}</p>
                    </div>
                    <Badge variant="outline" className={STATE_BADGE[item.state]}>
                      {item.state}
                    </Badge>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] text-muted-foreground">
                    <span>R {item.relation_score.toFixed(2)}</span>
                    <span>I {item.interaction_score.toFixed(2)}</span>
                    <span>P {item.persona_score.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function MetricBlock({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-md border bg-card px-3 py-2">
      <p className="text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
      <p className="text-[10px] text-muted-foreground">{hint}</p>
    </div>
  )
}
