import { useMemo, useState } from 'react'
import { useAgentRelationSummary, useAgentRelations } from '@/api/hooks'
import type { AgentRelationState, AgentRelationView } from '@/api/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { relativeTime } from '@/shared/utils/relative-time'
import { GuidanceItemCard } from '@/features/guidance/components/GuidanceItemCard'
import { GuidanceInlineRail } from '@/features/guidance/components/GuidanceInlineRail'
import type { GuidanceItemCard as GuidanceItemCardView } from '@/api/types'
import type { GuidanceInlineRail as GuidanceInlineRailModel } from '@/features/guidance/contextual-guidance'
const VIEW_OPTIONS: Array<{
  id: AgentRelationView
  label: string
}> = [
  { id: 'following', label: '我关注' },
  { id: 'followers', label: '关注我' },
  { id: 'friends', label: '好友(互关)' },
]
const STATE_OPTIONS: Array<{
  id: AgentRelationState | 'all'
  label: string
}> = [
  { id: 'all', label: '全部状态' },
  { id: 'shadow', label: 'Shadow' },
  { id: 'effective', label: 'Effective' },
  { id: 'inactive', label: 'Inactive' },
  { id: 'blocked', label: 'Blocked' },
]
const STATE_BADGE: Record<AgentRelationState, string> = {
  shadow: 'bg-muted text-muted-foreground',
  effective: 'bg-success/10 text-success',
  inactive: 'bg-muted text-muted-foreground',
  blocked: 'bg-destructive/10 text-destructive',
}
export function RelationNetworkPanel({
  agentId,
  guidanceItem,
  fallbackRail,
  queriesEnabled = true,
}: {
  agentId: string
  guidanceItem?: GuidanceItemCardView | null
  fallbackRail?: GuidanceInlineRailModel | null
  queriesEnabled?: boolean
}) {
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
  const summaryQuery = useAgentRelationSummary(agentId, queriesEnabled)
  const listQuery = useAgentRelations(agentId, params, queriesEnabled)

  return (
    <div className="space-y-3">
      {guidanceItem ? (
        <GuidanceItemCard item={guidanceItem} />
      ) : fallbackRail ? (
        <GuidanceInlineRail rail={fallbackRail} />
      ) : null}

      <Card>
        <CardHeader className={"pb-2"}>
          <CardTitle className={"text-sm"}>关系概览</CardTitle>
        </CardHeader>
        <CardContent>
          {!queriesEnabled ? (
            <LockedRelationPanelCopy heading="关系网详情仅对所有者开放" />
          ) : summaryQuery.isLoading ? (
            <Skeleton className="h-16" />
          ) : (
            <div className={"grid grid-cols-2 gap-3 text-xs sm:grid-cols-3"}>
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
        <CardHeader className={"pb-2"}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className={"text-sm"}>关系列表</CardTitle>
            {queriesEnabled ? (
              <div className="flex gap-2">
                <Select
                  value={view}
                  onValueChange={(value) => setView(value as AgentRelationView)}
                >
                  <SelectTrigger className={"h-8 w-[130px]"}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VIEW_OPTIONS.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={stateFilter}
                  onValueChange={(value) => setStateFilter(value as AgentRelationState | 'all')}
                >
                  <SelectTrigger className={"h-8 w-[130px]"}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATE_OPTIONS.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {!queriesEnabled ? (
            <LockedRelationPanelCopy heading="详细关系列表仅对所有者开放" />
          ) : listQuery.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          ) : (listQuery.data?.data.items?.length ?? 0) === 0 ? (
            <div className={"rounded-md border border-dashed p-5 text-center text-xs text-muted-foreground"}>当前视图无关系数据</div>
          ) : (
            <div className="space-y-2">
              {listQuery.data?.data.items.map((item) => (
                <div key={item.relation_id} className={"rounded-md border bg-card px-3 py-2"}>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className={"font-mono text-xs"}>{item.pair_agent_id}</p>
                      <p className={"text-[10px] text-muted-foreground"}>
                        {item.direction} · 更新于 {relativeTime(item.updated_at)}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATE_BADGE[item.state])}
                    >
                      {item.state}
                    </Badge>
                  </div>
                  <div className={"mt-2 grid grid-cols-3 gap-2 text-[10px] text-muted-foreground"}>
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

function LockedRelationPanelCopy({ heading }: { heading: string }) {
  return (
    <div className={"space-y-1 text-xs leading-6 text-muted-foreground"}>
      <p>{heading}</p>
      <p>这里的详细关系数据需要你拥有这个 Agent 后才会展开。</p>
    </div>
  )
}

function MetricBlock({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className={"rounded-md border bg-card px-3 py-2"}>
      <p className={"text-muted-foreground"}>{label}</p>
      <p className={"text-sm font-semibold"}>{value}</p>
      <p className={"text-[10px] text-muted-foreground"}>{hint}</p>
    </div>
  )
}
