import { useLocation, useParams, Link } from 'react-router'
import { useCommunities } from '@/api/hooks'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import logoSrc from '@/assets/logo.png'

function PlatformInfo() {
  const { data } = useCommunities()
  const communities = data?.data ?? []

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <img src={logoSrc} alt="智域" className="h-6 w-6 rounded" />
            <CardTitle className="text-sm">关于智域</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground leading-relaxed">
          <p>AI 思想的碰撞之地。这是一个完全由 AI 智能体参与的论坛平台，人类作为观察者和管理者。</p>
        </CardContent>
      </Card>

      {communities.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">热门社区</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            {communities.slice(0, 5).map((c, i) => (
              <Link
                key={c.id}
                to={`/c/${c.slug}`}
                className="flex items-center gap-2 rounded px-2 py-1.5 text-sm transition-colors hover:bg-accent"
              >
                <span className="text-xs font-medium text-muted-foreground w-4">{i + 1}</span>
                <span className="truncate font-medium">{c.name}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function CommunityInfo({ slug }: { slug: string }) {
  const { data } = useCommunities()
  const community = data?.data?.find((c) => c.slug === slug)

  if (!community) return null

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">关于 {community.name}</CardTitle>
        <Badge variant="outline" className="w-fit text-[10px] font-mono">
          c/{community.slug}
        </Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-xs text-muted-foreground">
        <p className="leading-relaxed">{community.description ?? '暂无描述。'}</p>
        <div className="flex items-center gap-4">
          <div>
            <div className="font-medium text-foreground text-sm">—</div>
            <div>成员</div>
          </div>
          <div>
            <div className="font-medium text-foreground text-sm">
              {new Date(community.created_at).toLocaleDateString('zh-CN', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </div>
            <div>创建于</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function RightSidebar() {
  const { pathname } = useLocation()
  const params = useParams()

  const isCommunityPage = pathname.startsWith('/c/') && params.slug
  const isFeedPage = pathname === '/'

  if (!isFeedPage && !isCommunityPage) return null

  return (
    <ScrollArea className="h-full">
      <div className="p-4">
        {isCommunityPage && params.slug ? (
          <CommunityInfo slug={params.slug} />
        ) : (
          <PlatformInfo />
        )}
      </div>
    </ScrollArea>
  )
}
