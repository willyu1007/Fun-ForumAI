import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAgentAchievements, useAgentChronicle, useAgentRelations } from '@/api/hooks'
import { relativeTime } from '@/shared/utils/relative-time'

interface AchievementChroniclePanelProps {
  agentId: string
}

function tierLabel(tier: 1 | 2 | 3): string {
  if (tier === 3) return 'T3'
  if (tier === 2) return 'T2'
  return 'T1'
}

export default function AchievementChroniclePanel({ agentId }: AchievementChroniclePanelProps) {
  const [includeFolded, setIncludeFolded] = useState(false)
  const { data: achievementsRes, isLoading: loadingAchievements } = useAgentAchievements(agentId, { limit: 60 })
  const { data: chronicleRes, isLoading: loadingChronicle } = useAgentChronicle(agentId, {
    limit: 60,
    include_folded: includeFolded,
  })
  const { data: relationRes } = useAgentRelations(agentId, { view: 'friends', limit: 3 })

  const achievements = achievementsRes?.data
  const chronicle = chronicleRes?.data ?? []
  const foldedCount = useMemo(() => {
    const raw = chronicleRes?.meta?.folded_count
    if (typeof raw === 'number') return raw
    if (typeof raw === 'string') {
      const parsed = Number.parseInt(raw, 10)
      return Number.isFinite(parsed) ? parsed : 0
    }
    return 0
  }, [chronicleRes?.meta?.folded_count])

  const wall = useMemo(
    () => (achievements ?? [])
      .slice()
      .sort((a, b) => b.tier - a.tier || new Date(b.achieved_at).getTime() - new Date(a.achieved_at).getTime())
      .slice(0, 9),
    [achievements],
  )

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">成就墙</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingAchievements ? (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, idx) => (
                <Skeleton key={idx} className="h-20 rounded-md" />
              ))}
            </div>
          ) : wall.length === 0 ? (
            <p className="text-xs text-muted-foreground">暂无成就记录。</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {wall.map((item) => (
                <div key={item.id} className="rounded-md border p-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">{item.name}</p>
                    <Badge variant="secondary">{tierLabel(item.tier)}</Badge>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {item.category} · {relativeTime(item.achieved_at)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm">编年史</CardTitle>
            {foldedCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setIncludeFolded((v) => !v)}
              >
                {includeFolded ? '隐藏折叠项' : `查看折叠项 (+${foldedCount})`}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loadingChronicle ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, idx) => (
                <Skeleton key={idx} className="h-20 rounded-md" />
              ))}
            </div>
          ) : chronicle.length === 0 ? (
            <p className="text-xs text-muted-foreground">暂无编年史条目。</p>
          ) : (
            <div className="space-y-2">
              {chronicle.slice(0, 20).map((item) => (
                <div key={item.id} className="rounded-md border p-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">{item.type}</Badge>
                    <span>重要度 {item.importance_score.toFixed(2)}</span>
                    <span>·</span>
                    <span>{relativeTime(item.occurred_at)}</span>
                  </div>
                  <p className="mt-1 text-sm font-medium">{item.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.summary}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">关系高光</CardTitle>
        </CardHeader>
        <CardContent>
          {relationRes?.data?.items?.length ? (
            <div className="space-y-2">
              {relationRes.data.items.slice(0, 3).map((item) => (
                <div key={item.relation_id} className="flex items-center justify-between rounded-md border p-2 text-xs">
                  <span className="font-medium">{item.pair_agent_id}</span>
                  <span className="text-muted-foreground">{item.state} · {item.relation_score.toFixed(2)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">暂无关系高光。</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
