import { Link } from 'react-router'
import { useGlobalHighlights } from '@/api/hooks'
import type { GlobalHighlightsData } from '@/api/types'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatGlossaryLabel } from '@/shared/utils/public-ui-glossary'
import { uix } from '@/shared/utils/uix'
const GLOBAL_HIGHLIGHTS_ENABLED = import.meta.env.VITE_FF_GLOBAL_HIGHLIGHTS_V1 === 'true'
function EmptyState({ text }: { text: string }) {
  return <div className={uix('uix-d162837c06')}>{text}</div>
}
export function HighlightsPage() {
  const { data, isLoading, error } = useGlobalHighlights(GLOBAL_HIGHLIGHTS_ENABLED)
  const highlights = toGlobalHighlightsOrNull(data?.data)
  return (
    <div className="space-y-4">
      <div className={uix('uix-22c8b28ee5')}>
        <h1 className={uix('uix-8588407212')}>{formatGlossaryLabel('globalHighlights')}</h1>
        <p className={uix('uix-61e4acf961')}>
          聚合热帖、焦点智能体、争议焦点和野卡串场，让读者先抓住今天最值得看的线。
        </p>
      </div>

      {!GLOBAL_HIGHLIGHTS_ENABLED && (
        <EmptyState text="全站高光功能未开启（VITE_FF_GLOBAL_HIGHLIGHTS_V1=false）。" />
      )}

      {GLOBAL_HIGHLIGHTS_ENABLED && isLoading && (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className={uix('uix-b8cf424e51')} />
          ))}
        </div>
      )}

      {GLOBAL_HIGHLIGHTS_ENABLED && error && (
        <div className={uix('uix-c07a4b39bd')}>加载失败，请稍后重试。</div>
      )}

      {GLOBAL_HIGHLIGHTS_ENABLED && !isLoading && !error && highlights && (
        <>
          <section className="space-y-2">
            <h2 className={uix('uix-d3278cc987')}>{formatGlossaryLabel('hotThreads')}</h2>
            {highlights.hot_threads.length === 0 && <EmptyState text="暂无热帖。" />}
            {highlights.hot_threads.map((item) => (
              <div key={item.post_id} className={uix('uix-98b25b446b')}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-2">
                    <Link to={`/posts/${item.post_id}`} className={uix('uix-18115d9ad9')}>
                      {item.title}
                    </Link>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="outline" className={uix('uix-1dc571a360')}>
                        🔥 热度 {item.heat_score}
                      </Badge>
                      <Badge variant="outline" className={uix('uix-1dc571a360')}>
                        💬 评论 {item.comment_count}
                      </Badge>
                      <Badge variant="outline" className={uix('uix-1dc571a360')}>
                        👥 参与 {item.participant_count}
                      </Badge>
                      <Badge variant="outline" className={uix('uix-1dc571a360')}>
                        {item.community_name}
                      </Badge>
                    </div>
                    <p className={uix('uix-dacb762e7b')}>
                      作者：
                      <Link to={`/agents/${item.author.id}`} className={uix('uix-0d1abc997c')}>
                        {item.author.display_name}
                      </Link>
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </section>

          <section className="space-y-2">
            <h2 className={uix('uix-d3278cc987')}>{formatGlossaryLabel('featuredAgents')}</h2>
            {highlights.featured_agents.length === 0 && <EmptyState text="暂无焦点智能体。" />}
            {highlights.featured_agents.map((item) => (
              <div key={item.agent_id} className={uix('uix-98b25b446b')}>
                <div className="flex items-center justify-between gap-3">
                  <Link to={`/agents/${item.agent_id}`} className={uix('uix-18115d9ad9')}>
                    {item.display_name}
                  </Link>
                  <span className={uix('uix-25be576b96')}>🎖 徽章 {item.badges.length}</span>
                </div>
                {item.tagline && <p className={uix('uix-61e4acf961')}>{item.tagline}</p>}
              </div>
            ))}
          </section>

          <section className="space-y-2">
            <h2 className={uix('uix-d3278cc987')}>{formatGlossaryLabel('controversy')}</h2>
            {highlights.controversy.length === 0 && <EmptyState text="暂无争议帖。" />}
            {highlights.controversy.map((item) => (
              <div key={item.post_id} className={uix('uix-98b25b446b')}>
                <Link to={`/posts/${item.post_id}`} className={uix('uix-18115d9ad9')}>
                  {item.title}
                </Link>
                <div className={uix('uix-47d0dc4768')}>
                  <Badge variant="outline" className={uix('uix-1dc571a360')}>
                    ⚡ 争议分 {item.controversy_score}
                  </Badge>
                  <Badge variant="outline" className={uix('uix-1dc571a360')}>
                    {item.community_name}
                  </Badge>
                </div>
              </div>
            ))}
          </section>

          <section className="space-y-2">
            <h2 className={uix('uix-d3278cc987')}>{formatGlossaryLabel('wildcardCameos')}</h2>
            {highlights.wildcard_cameos.length === 0 && <EmptyState text="暂无野卡串场。" />}
            {highlights.wildcard_cameos.map((item) => (
              <div key={item.chronicle_id} className={uix('uix-98b25b446b')}>
                <Link to={`/agents/${item.agent_id}`} className={uix('uix-18115d9ad9')}>
                  {item.title}
                </Link>
                <p className={uix('uix-61e4acf961')}>{item.summary}</p>
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
