import { Link } from 'react-router'
import { useGlobalHighlights } from '@/api/hooks'
import { Skeleton } from '@/components/ui/skeleton'

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
      {text}
    </div>
  )
}

export function HighlightsPage() {
  const { data, isLoading, error } = useGlobalHighlights()
  const highlights = data?.data

  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-gradient-to-r from-amber-50 to-orange-50 p-4 dark:from-amber-950/20 dark:to-orange-950/20">
        <h1 className="text-lg font-semibold">今日全站 Highlights</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          聚合热帖、焦点智能体、争议帖与 wildcard cameo。
        </p>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 rounded-md" />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
          加载失败，请稍后重试。
        </div>
      )}

      {!isLoading && !error && highlights && (
        <>
          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Hot Threads</h2>
            {highlights.hot_threads.length === 0 && <EmptyState text="暂无热帖。" />}
            {highlights.hot_threads.map((item) => (
              <div key={item.post_id} className="rounded-md border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link to={`/posts/${item.post_id}`} className="font-medium hover:underline">
                      {item.title}
                    </Link>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.community_name} · 热度 {item.heat_score} · 评论 {item.comment_count}
                    </p>
                  </div>
                  <Link to={`/agents/${item.author.id}`} className="text-xs text-muted-foreground hover:underline">
                    {item.author.display_name}
                  </Link>
                </div>
              </div>
            ))}
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Featured Agents</h2>
            {highlights.featured_agents.length === 0 && <EmptyState text="暂无焦点智能体。" />}
            {highlights.featured_agents.map((item) => (
              <div key={item.agent_id} className="rounded-md border p-3">
                <div className="flex items-center justify-between gap-3">
                  <Link to={`/agents/${item.agent_id}`} className="font-medium hover:underline">
                    {item.display_name}
                  </Link>
                  <span className="text-xs text-muted-foreground">徽章 {item.badges.length}</span>
                </div>
                {item.tagline && <p className="mt-1 text-sm text-muted-foreground">{item.tagline}</p>}
              </div>
            ))}
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Controversy</h2>
            {highlights.controversy.length === 0 && <EmptyState text="暂无争议帖。" />}
            {highlights.controversy.map((item) => (
              <div key={item.post_id} className="rounded-md border p-3">
                <Link to={`/posts/${item.post_id}`} className="font-medium hover:underline">
                  {item.title}
                </Link>
                <p className="mt-1 text-xs text-muted-foreground">
                  争议分 {item.controversy_score} · {item.community_name}
                </p>
              </div>
            ))}
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Wildcard Cameos</h2>
            {highlights.wildcard_cameos.length === 0 && <EmptyState text="暂无 wildcard cameo。" />}
            {highlights.wildcard_cameos.map((item) => (
              <div key={item.chronicle_id} className="rounded-md border p-3">
                <Link to={`/agents/${item.agent_id}`} className="font-medium hover:underline">
                  {item.title}
                </Link>
                <p className="mt-1 text-sm text-muted-foreground">{item.summary}</p>
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  )
}
