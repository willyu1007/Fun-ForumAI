import { Link, useSearchParams } from 'react-router'
import { useCommunities } from '@/api/hooks'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { COMMUNITY_VISIBILITY_LABELS } from '@/shared/utils/public-ui-glossary'
import {
  COMMUNITY_CATEGORY_LABELS,
  COMMUNITY_CATEGORY_ORDER,
  resolveCommunityCategory,
  type CommunityCategory,
} from '@/shared/utils/community-shell-meta'
import { cn } from '@/lib/utils'

const ALL_FILTER = { key: 'all' as const, label: '全部' }
const CATEGORY_FILTERS = COMMUNITY_CATEGORY_ORDER.map((key) => ({
  key,
  label: COMMUNITY_CATEGORY_LABELS[key],
}))
const FILTERS = [ALL_FILTER, ...CATEGORY_FILTERS]

export function CommunitiesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { data, isLoading, error } = useCommunities()
  const activeCategory = searchParams.get('category') as CommunityCategory | null
  const communities = (data?.data ?? []).filter((community) =>
    activeCategory ? resolveCommunityCategory(community) === activeCategory : true,
  )

  const handleFilterClick = (key: string) => {
    const next = new URLSearchParams(searchParams)
    if (key === 'all') {
      next.delete('category')
    } else {
      next.set('category', key)
    }
    setSearchParams(next, { replace: true })
  }

  const activeKey = activeCategory ?? 'all'

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">探索社区</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          浏览不同分类下的社区，找到你感兴趣的话题。
        </p>
      </div>

      {/* Reddit-style horizontal pill filters */}
      <nav className="flex flex-wrap gap-2" aria-label="社区分类筛选">
        {FILTERS.map((filter) => (
          <button
            key={filter.key}
            type="button"
            onClick={() => handleFilterClick(filter.key)}
            className={cn(
              'inline-flex items-center rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
              activeKey === filter.key
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-foreground',
            )}
          >
            {filter.label}
          </button>
        ))}
      </nav>

      {isLoading && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-xl border p-6 text-center text-sm text-muted-foreground">
          加载失败，请稍后重试。
        </div>
      )}

      {!isLoading && communities.length === 0 && !error && (
        <div className="rounded-xl border border-dashed bg-muted/30 p-10 text-center">
          <p className="text-sm font-medium">还没有社区</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {activeCategory
              ? `「${COMMUNITY_CATEGORY_LABELS[activeCategory]}」分类下暂无社区。`
              : '运行 pnpm seed 创建测试社区。'}
          </p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {communities.map((community) => {
          const category = resolveCommunityCategory(community)
          return (
            <Link key={community.id} to={`/c/${community.slug}`}>
              <Card className="h-full rounded-xl transition-all hover:border-primary/30 hover:shadow-sm">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-sm leading-snug">{community.name}</CardTitle>
                    <Badge variant="secondary" className="shrink-0 text-[10px]">
                      {COMMUNITY_CATEGORY_LABELS[category]}
                    </Badge>
                  </div>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    c/{community.slug}
                  </span>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {community.description ?? '暂无描述。'}
                  </p>
                  <p className="mt-2 text-[10px] text-muted-foreground">
                    默认可见性：
                    {COMMUNITY_VISIBILITY_LABELS[community.visibility_default.toLowerCase()] ??
                      community.visibility_default}
                  </p>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
