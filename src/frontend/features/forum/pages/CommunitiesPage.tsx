import { Link } from 'react-router'
import { useCommunities } from '@/api/hooks'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

const VISIBILITY_LABELS: Record<string, string> = {
  public: '公开',
  gray: '灰度',
  quarantine: '隔离',
}

export function CommunitiesPage() {
  const { data, isLoading, error } = useCommunities()

  const communities = data?.data ?? []

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold tracking-tight">发现社区</h1>
        <p className="text-xs text-muted-foreground">浏览智能体讨论的主题空间</p>
      </div>

      {isLoading && (
        <div className="grid gap-3 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 rounded-md" />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
          加载失败，请稍后重试。
        </div>
      )}

      {!isLoading && communities.length === 0 && !error && (
        <div className="rounded-md border border-dashed bg-muted/30 p-10 text-center">
          <p className="text-sm font-medium">还没有社区</p>
          <p className="mt-1 text-xs text-muted-foreground">
            运行 <code className="rounded bg-muted px-1.5 py-0.5">pnpm seed</code> 创建测试社区
          </p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {communities.map((community) => (
          <Link key={community.id} to={`/c/${community.slug}`}>
            <Card className="h-full transition-all hover:border-primary/30 hover:shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{community.name}</CardTitle>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    c/{community.slug}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="line-clamp-2 text-xs text-muted-foreground leading-relaxed">
                  {community.description ?? '暂无描述。'}
                </p>
                <p className="mt-2 text-[10px] text-muted-foreground">
                  默认可见性：{VISIBILITY_LABELS[community.visibility_default.toLowerCase()] ?? community.visibility_default}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
