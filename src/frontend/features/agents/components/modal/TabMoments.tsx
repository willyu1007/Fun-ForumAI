import {
  DetailPageLayout,
  EmptyState,
  InlineAlert,
} from '@fun-forum/ui-web/patterns'
import { useAgentHighlights, useAgentProfile } from '@/api/hooks'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { relativeTime } from '@/shared/utils/relative-time'

export function TabMoments({ agentId }: { agentId: string }) {
  const profile = useAgentProfile(agentId)
  const highlights = useAgentHighlights(agentId, Boolean(agentId))

  const agent = profile.data?.data ?? null
  const publicHighlights = highlights.data?.data ?? null

  if (profile.isLoading || highlights.isLoading) {
    return (
      <DetailPageLayout
        title="公开高光"
        subtitle="正在整理这位角色的 public-safe 高光。"
      >
        <div className="space-y-3">
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
        </div>
      </DetailPageLayout>
    )
  }

  if (profile.error || !agent) {
    return (
      <DetailPageLayout
        title="公开高光"
        subtitle="未能加载该角色的公开高光。"
      >
        <EmptyState
          title="未找到该智能体。"
          description="可能已被删除、隐藏，或当前链接已经失效。"
        />
      </DetailPageLayout>
    )
  }

  if (highlights.error) {
    return (
      <DetailPageLayout
        title={`${agent.display_name} 的公开高光`}
        subtitle="只展示 public-safe 的成就与编年史摘要。"
      >
        <InlineAlert tone="warning" title="公开高光加载失败">
          请稍后再试。
        </InlineAlert>
      </DetailPageLayout>
    )
  }

  const topChronicle = publicHighlights?.top_chronicle ?? []
  const publicBio = publicHighlights?.public_bio ?? publicHighlights?.tagline ?? null
  const isEmpty = !publicHighlights
    || (publicHighlights.badges.length === 0
      && !publicBio
      && topChronicle.length === 0)

  return (
    <DetailPageLayout
      title={`${agent.display_name} 的公开高光`}
      subtitle="只展示 public-safe 的成就与编年史摘要。"
    >
      <div className="space-y-4" data-testid="agent-highlights-page">
        <Card className={"border-primary/20 bg-primary/5"}>
          <CardHeader className={"pb-2"}>
            <CardTitle className={"text-base"}>公开身份线索</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {publicHighlights?.badges.length ? (
              <div className="flex flex-wrap gap-1.5">
                {publicHighlights.badges.map((badge) => (
                  <Badge key={`${badge.code}-${badge.tier}`} variant="outline">
                    {badge.name} T{badge.tier}
                  </Badge>
                ))}
              </div>
            ) : null}
            {publicBio ? (
              <p className={"text-sm text-muted-foreground"}>{publicBio}</p>
            ) : (
              <p className={"text-sm text-muted-foreground"}>
                该角色暂时还没有足够稳定的公开高光摘要。
              </p>
            )}
          </CardContent>
        </Card>

        {isEmpty ? (
          <EmptyState
            title="暂无公开高光"
            description="这位角色还没有沉淀出可公开展示的成就或编年史视觉。"
          />
        ) : (
          <div className="grid gap-4">
            {topChronicle.map((entry) => (
              <Card key={entry.id} className={"overflow-hidden"}>
                {entry.visual && (
                  <figure className={"border-b bg-muted/20"}>
                    <img
                      src={entry.visual.media_url}
                      alt={entry.visual.alt_text ?? entry.visual.public_caption ?? entry.title}
                      className={"aspect-[16/9] w-full object-cover"}
                      loading="lazy"
                    />
                    {entry.visual.public_caption && (
                      <figcaption className={"px-4 py-2 text-xs text-muted-foreground"}>
                        {entry.visual.public_caption}
                      </figcaption>
                    )}
                  </figure>
                )}
                <CardHeader className={"pb-2"}>
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className={"text-base"}>{entry.title}</CardTitle>
                    <Badge variant="secondary">重要度 {entry.importance_score.toFixed(2)}</Badge>
                  </div>
                  <p className={"text-xs text-muted-foreground"}>{relativeTime(entry.occurred_at)}</p>
                </CardHeader>
                <CardContent>
                  <p className={"text-sm text-muted-foreground"}>{entry.summary}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DetailPageLayout>
  )
}
