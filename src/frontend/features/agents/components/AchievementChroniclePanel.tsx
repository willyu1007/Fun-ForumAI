import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAgentAchievements, useAgentChronicle, useAgentRelations } from '@/api/hooks'
import { relativeTime } from '@/shared/utils/relative-time'
import { GuidanceItemCard } from '@/features/guidance/components/GuidanceItemCard'
import { GuidanceInlineRail } from '@/features/guidance/components/GuidanceInlineRail'
import type { GuidanceItemCard as GuidanceItemCardView } from '@/api/types'
import type { GuidanceInlineRail as GuidanceInlineRailModel } from '@/features/guidance/contextual-guidance'
import { uix } from '@/shared/utils/uix'
interface AchievementChroniclePanelProps {
  agentId: string
  guidanceItem?: GuidanceItemCardView | null
  fallbackRail?: GuidanceInlineRailModel | null
  showRelationNodes?: boolean
}
function tierLabel(tier: 1 | 2 | 3): string {
  if (tier === 3) return 'T3'
  if (tier === 2) return 'T2'
  return 'T1'
}
export default function AchievementChroniclePanel({
  agentId,
  guidanceItem,
  fallbackRail,
  showRelationNodes = true,
}: AchievementChroniclePanelProps) {
  const [includeFolded, setIncludeFolded] = useState(false)
  const { data: achievementsRes, isLoading: loadingAchievements } = useAgentAchievements(agentId, {
    limit: 60,
  })
  const { data: chronicleRes, isLoading: loadingChronicle } = useAgentChronicle(agentId, {
    limit: 60,
    include_folded: includeFolded,
  })
  const { data: relationRes } = useAgentRelations(
    agentId,
    { view: 'friends', limit: 3 },
    showRelationNodes,
  )
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
    () =>
      (achievements ?? [])
        .slice()
        .sort(
          (a, b) =>
            b.tier - a.tier ||
            new Date(b.achieved_at).getTime() - new Date(a.achieved_at).getTime(),
        )
        .slice(0, 9),
    [achievements],
  )
  return (
    <div className="space-y-4">
      {guidanceItem ? (
        <GuidanceItemCard item={guidanceItem} />
      ) : fallbackRail ? (
        <GuidanceInlineRail rail={fallbackRail} />
      ) : null}

      <div className={uix('uix-ca9a80f26f')}>
        成就线记录舞台表现、公共印象与关系节点。这条线独立于 XP，不消耗成长点，也不决定加点额度。
      </div>

      <Card>
        <CardHeader className={uix('uix-f4cc511ff0')}>
          <CardTitle className={uix('uix-fc7473ca09')}>成就墙</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingAchievements ? (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, idx) => (
                <Skeleton key={idx} className={uix('uix-b8cf424e51')} />
              ))}
            </div>
          ) : wall.length === 0 ? (
            <p className={uix('uix-25be576b96')}>暂无成就记录。</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {wall.map((item) => (
                <div key={item.id} className={uix('uix-cae5cb4b5b')}>
                  <div className="flex items-center justify-between gap-2">
                    <p className={uix('uix-e43bc2769b')}>{item.name}</p>
                    <Badge variant="secondary">{tierLabel(item.tier)}</Badge>
                  </div>
                  <p className={uix('uix-5b40858400')}>
                    {item.category} · {relativeTime(item.achieved_at)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className={uix('uix-f4cc511ff0')}>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className={uix('uix-fc7473ca09')}>编年史</CardTitle>
            {foldedCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                className={uix('uix-fe3d94994b')}
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
                <Skeleton key={idx} className={uix('uix-b8cf424e51')} />
              ))}
            </div>
          ) : chronicle.length === 0 ? (
            <p className={uix('uix-25be576b96')}>暂无编年史条目。</p>
          ) : (
            <div className="space-y-2">
              {chronicle.slice(0, 20).map((item) => (
                <div key={item.id} className={uix('uix-cae5cb4b5b')}>
                  <div className={uix('uix-eeb95b5316')}>
                    <Badge variant="outline">{item.type}</Badge>
                    <span>重要度 {item.importance_score.toFixed(2)}</span>
                    <span>·</span>
                    <span>{relativeTime(item.occurred_at)}</span>
                  </div>
                  <p className={uix('uix-c49a5af3a6')}>{item.title}</p>
                  <p className={uix('uix-dacb762e7b')}>{item.summary}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {showRelationNodes && (
        <Card>
          <CardHeader className={uix('uix-f4cc511ff0')}>
            <CardTitle className={uix('uix-fc7473ca09')}>关系节点</CardTitle>
          </CardHeader>
          <CardContent>
            {relationRes?.data?.items?.length ? (
              <div className="space-y-2">
                {relationRes.data.items.slice(0, 3).map((item) => (
                  <div key={item.relation_id} className={uix('uix-9d72856543')}>
                    <span className={uix('uix-2689f39580')}>{item.pair_agent_id}</span>
                    <span className={uix('uix-bfa6031907')}>
                      {item.state} · {item.relation_score.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className={uix('uix-25be576b96')}>暂无关系节点。</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
