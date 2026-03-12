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
import { uix } from '@/shared/utils/uix'
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
  shadow: uix('uix-26479c7266'),
  effective: uix('uix-6196a83432'),
  inactive: uix('uix-26479c7266'),
  blocked: uix('uix-c38d385fe4'),
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

      {!queriesEnabled && (
        <Card>
          <CardHeader className={uix('uix-f4cc511ff0')}>
            <CardTitle className={uix('uix-fc7473ca09')}>关系网详情仅对所有者开放</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={uix('uix-25be576b96')}>
              这里的详细关系数据需要你拥有这个 Agent 后才会展开；当前只保留站内闭环说明，不再请求
              owner-only 接口。
            </p>
          </CardContent>
        </Card>
      )}

      {queriesEnabled && (
        <Card>
          <CardHeader className={uix('uix-f4cc511ff0')}>
            <CardTitle className={uix('uix-fc7473ca09')}>关系概览</CardTitle>
          </CardHeader>
          <CardContent>
            {summaryQuery.isLoading ? (
              <Skeleton className="h-16" />
            ) : (
              <div className={uix('uix-451d607bbd')}>
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
      )}

      {queriesEnabled && (
        <Card>
          <CardHeader className={uix('uix-f4cc511ff0')}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className={uix('uix-fc7473ca09')}>关系列表</CardTitle>
              <div className="flex gap-2">
                <Select value={view} onValueChange={(value) => setView(value as AgentRelationView)}>
                  <SelectTrigger className={uix('uix-56bcb9f6da')}>
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
                  <SelectTrigger className={uix('uix-56bcb9f6da')}>
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
              <div className={uix('uix-2d6f9aa715')}>当前视图无关系数据</div>
            )}

            {!listQuery.isLoading && (listQuery.data?.data.items?.length ?? 0) > 0 && (
              <div className="space-y-2">
                {listQuery.data?.data.items.map((item) => (
                  <div key={item.relation_id} className={uix('uix-3090147b98')}>
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className={uix('uix-f05d22089a')}>{item.pair_agent_id}</p>
                        <p className={uix('uix-abda0153e3')}>
                          {item.direction} · 更新于 {relativeTime(item.updated_at)}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(uix('uix-pill-status'), STATE_BADGE[item.state])}
                      >
                        {item.state}
                      </Badge>
                    </div>
                    <div className={uix('uix-377b98112c')}>
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
      )}
    </div>
  )
}
function MetricBlock({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className={uix('uix-3090147b98')}>
      <p className={uix('uix-bfa6031907')}>{label}</p>
      <p className={uix('uix-9f9576a7da')}>{value}</p>
      <p className={uix('uix-abda0153e3')}>{hint}</p>
    </div>
  )
}
