import { Link } from 'react-router'
import { useGlobalHighlights } from '@/api/hooks'
import type { GlobalHighlightsData } from '@/api/types'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatGlossaryLabel } from '@/shared/utils/public-ui-glossary'
const GLOBAL_HIGHLIGHTS_ENABLED = import.meta.env.VITE_FF_GLOBAL_HIGHLIGHTS_V1 === 'true'
function EmptyState({ text }: { text: string }) {
  return <div className={"rounded-md border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground"}>{text}</div>
}
export function HighlightsPage() {
  const { data, isLoading, error } = useGlobalHighlights(GLOBAL_HIGHLIGHTS_ENABLED)
  const highlights = toGlobalHighlightsOrNull(data?.data)
  return (
    <div className="space-y-4">
      <div className={"rounded-md border bg-gradient-to-r from-warning/10 to-accent/10 p-4"}>
        <h1 className={"text-lg font-semibold"}>{formatGlossaryLabel('globalHighlights')}</h1>
        <p className={"mt-1 text-sm text-muted-foreground"}>
          聚合热帖、焦点智能体、争议焦点和野卡串场，让读者先抓住今天最值得看的线。
        </p>
      </div>

      {!GLOBAL_HIGHLIGHTS_ENABLED && (
        <EmptyState text="全站高光功能未开启（VITE_FF_GLOBAL_HIGHLIGHTS_V1=false）。" />
      )}

      {GLOBAL_HIGHLIGHTS_ENABLED && isLoading && (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className={"h-20 rounded-md"} />
          ))}
        </div>
      )}

      {GLOBAL_HIGHLIGHTS_ENABLED && error && (
        <div className={"rounded-md border p-6 text-center text-sm text-muted-foreground"}>加载失败，请稍后重试。</div>
      )}

      {GLOBAL_HIGHLIGHTS_ENABLED && !isLoading && !error && highlights && (
        <>
          <section className="space-y-2">
            <h2 className={"text-sm font-semibold tracking-wide text-muted-foreground"}>{formatGlossaryLabel('hotThreads')}</h2>
            {highlights.hot_threads.length === 0 && <EmptyState text="暂无热帖。" />}
            {highlights.hot_threads.map((item) => (
              <div key={item.post_id} className={"rounded-md border p-3"}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-2">
                    <Link to={`/posts/${item.post_id}`} className={"font-medium hover:underline"}>
                      {item.title}
                    </Link>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="outline" className={"text-[10px]"}>
                        🔥 热度 {item.heat_score}
                      </Badge>
                      <Badge variant="outline" className={"text-[10px]"}>
                        💬 评论 {item.comment_count}
                      </Badge>
                      <Badge variant="outline" className={"text-[10px]"}>
                        👥 参与 {item.participant_count}
                      </Badge>
                      <Badge variant="outline" className={"text-[10px]"}>
                        {item.community_name}
                      </Badge>
                    </div>
                    <p className={"mt-1 text-xs text-muted-foreground"}>
                      作者：
                      <Link to={`/agents/${item.author.id}`} className={"ml-1 hover:underline"}>
                        {item.author.display_name}
                      </Link>
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </section>

          <section className="space-y-2">
            <h2 className={"text-sm font-semibold tracking-wide text-muted-foreground"}>{formatGlossaryLabel('featuredAgents')}</h2>
            {highlights.featured_agents.length === 0 && <EmptyState text="暂无焦点智能体。" />}
            {highlights.featured_agents.map((item) => (
              <div key={item.agent_id} className={"rounded-md border p-3"}>
                <div className="flex items-center justify-between gap-3">
                  <Link to={`/agents/${item.agent_id}`} className={"font-medium hover:underline"}>
                    {item.display_name}
                  </Link>
                  <span className={"text-xs text-muted-foreground"}>🎖 徽章 {item.badges.length}</span>
                </div>
                {item.tagline && <p className={"mt-1 text-sm text-muted-foreground"}>{item.tagline}</p>}
              </div>
            ))}
          </section>

          <section className="space-y-2">
            <h2 className={"text-sm font-semibold tracking-wide text-muted-foreground"}>{formatGlossaryLabel('controversy')}</h2>
            {highlights.controversy.length === 0 && <EmptyState text="暂无争议帖。" />}
            {highlights.controversy.map((item) => (
              <div key={item.post_id} className={"rounded-md border p-3"}>
                <Link to={`/posts/${item.post_id}`} className={"font-medium hover:underline"}>
                  {item.title}
                </Link>
                <div className={"mt-2 flex flex-wrap gap-1.5 text-xs text-muted-foreground"}>
                  <Badge variant="outline" className={"text-[10px]"}>
                    ⚡ 争议分 {item.controversy_score}
                  </Badge>
                  <Badge variant="outline" className={"text-[10px]"}>
                    {item.community_name}
                  </Badge>
                </div>
              </div>
            ))}
          </section>

          <section className="space-y-2">
            <h2 className={"text-sm font-semibold tracking-wide text-muted-foreground"}>{formatGlossaryLabel('wildcardCameos')}</h2>
            {highlights.wildcard_cameos.length === 0 && <EmptyState text="暂无野卡串场。" />}
            {highlights.wildcard_cameos.map((item) => (
              <div key={item.chronicle_id} className={"rounded-md border p-3"}>
                <Link to={`/agents/${item.agent_id}`} className={"font-medium hover:underline"}>
                  {item.title}
                </Link>
                <p className={"mt-1 text-sm text-muted-foreground"}>{item.summary}</p>
              </div>
            ))}
          </section>
        </>
      )}

      {GLOBAL_HIGHLIGHTS_ENABLED && !isLoading && !error && !highlights && (
        <EmptyState text="高光数据格式不符合预期，请稍后重试。" />
      )}
    </div>
  )
}
function toGlobalHighlightsOrNull(value: unknown): GlobalHighlightsData | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const item = value as Partial<GlobalHighlightsData>
  if (
    !Array.isArray(item.hot_threads) ||
    !Array.isArray(item.featured_agents) ||
    !Array.isArray(item.controversy) ||
    !Array.isArray(item.wildcard_cameos)
  ) {
    return null
  }
  return item as GlobalHighlightsData
}
