import { Link, useSearchParams } from 'react-router'
import { useCommunities } from '@/api/hooks'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { COMMUNITY_VISIBILITY_LABELS } from '@/shared/utils/public-ui-glossary'
import {
  COMMUNITY_CATEGORY_LABELS,
  resolveCommunityCategory,
  type CommunityCategory,
} from '@/shared/utils/community-shell-meta'

export function CommunitiesPage() {
  const [searchParams] = useSearchParams()
  const { data, isLoading, error } = useCommunities()
  const category = searchParams.get('category') as CommunityCategory | null
  const communities = (data?.data ?? []).filter((community) =>
    category ? resolveCommunityCategory(community) === category : true,
  )
  const categoryLabel = category ? COMMUNITY_CATEGORY_LABELS[category] : null
  return (
    <div className="space-y-4">
      <div>
        <h1 className={"text-lg font-bold tracking-tight"}>社区广场</h1>
        <p className={"text-xs text-muted-foreground"}>
          {categoryLabel
            ? `当前正在浏览「${categoryLabel}」分类下的社区。`
            : '先看中文社区名，再看一句简介和 `c/slug`。'}
        </p>
      </div>

      {isLoading && (
        <div className="grid gap-3 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className={"h-28 rounded-md"} />
          ))}
        </div>
      )}

      {error && <div className={"rounded-md border p-6 text-center text-sm text-muted-foreground"}>加载失败，请稍后重试。</div>}

      {!isLoading && communities.length === 0 && !error && (
        <div className={"rounded-md border border-dashed bg-muted/30 p-10 text-center"}>
          <p className={"text-sm font-medium"}>还没有社区</p>
          <p className={"mt-1 text-xs text-muted-foreground"}>
            运行 <code className={"rounded bg-muted px-1.5 py-0.5"}>pnpm seed</code> 创建测试社区
          </p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {communities.map((community) => (
          <Link key={community.id} to={`/c/${community.slug}`}>
            <Card className="h-full transition-all hover:border-primary/30 hover:shadow-sm">
              <CardHeader className={"pb-2"}>
                <div className="flex items-center justify-between">
                  <CardTitle className={"text-sm"}>{community.name}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">
                      {COMMUNITY_CATEGORY_LABELS[resolveCommunityCategory(community)]}
                    </Badge>
                    <Badge variant="outline" className={"text-[10px] font-mono"}>
                      c/{community.slug}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className={"pt-0"}>
                <p className={"line-clamp-2 text-xs text-muted-foreground leading-relaxed"}>{community.description ?? '暂无描述。'}</p>
                <p className={"mt-2 text-[10px] text-muted-foreground"}>
                  默认可见性：
                  {COMMUNITY_VISIBILITY_LABELS[community.visibility_default.toLowerCase()] ??
                    community.visibility_default}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
