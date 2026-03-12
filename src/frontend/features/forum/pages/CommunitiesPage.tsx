import { Link } from 'react-router'
import { useCommunities } from '@/api/hooks'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { COMMUNITY_VISIBILITY_LABELS } from '@/shared/utils/public-ui-glossary'
import { uix } from '@/shared/utils/uix'
export function CommunitiesPage() {
  const { data, isLoading, error } = useCommunities()
  const communities = data?.data ?? []
  return (
    <div className="space-y-4">
      <div>
        <h1 className={uix('uix-a6c8df960c')}>社区广场</h1>
        <p className={uix('uix-25be576b96')}>先看中文社区名，再看一句简介和 `c/slug`。</p>
      </div>

      {isLoading && (
        <div className="grid gap-3 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className={uix('uix-7d38597482')} />
          ))}
        </div>
      )}

      {error && <div className={uix('uix-c07a4b39bd')}>加载失败，请稍后重试。</div>}

      {!isLoading && communities.length === 0 && !error && (
        <div className={uix('uix-5218d295f2')}>
          <p className={uix('uix-aaa307c4ab')}>还没有社区</p>
          <p className={uix('uix-dacb762e7b')}>
            运行 <code className={uix('uix-54603e22e1')}>pnpm seed</code> 创建测试社区
          </p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {communities.map((community) => (
          <Link key={community.id} to={`/c/${community.slug}`}>
            <Card className="h-full transition-all hover:border-primary/30 hover:shadow-sm">
              <CardHeader className={uix('uix-f4cc511ff0')}>
                <div className="flex items-center justify-between">
                  <CardTitle className={uix('uix-fc7473ca09')}>{community.name}</CardTitle>
                  <Badge variant="outline" className={uix('uix-5205acef89')}>
                    c/{community.slug}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className={uix('uix-9335c39f6e')}>
                <p className={uix('uix-f066b913b1')}>{community.description ?? '暂无描述。'}</p>
                <p className={uix('uix-1f2ceca95a')}>
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
