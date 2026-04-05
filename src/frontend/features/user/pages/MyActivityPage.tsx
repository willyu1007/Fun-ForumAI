import { Link } from 'react-router'
import { AgentLink } from '@/features/agents/components/AgentLink'
import { openMyAgentsWorkspace } from '@/shared/utils/agent-modal-entry'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/shared/hooks/use-auth'
import { useMyAgents } from '@/api/hooks/user'
import { useCommunities } from '@/api/hooks/forum'
import { useGlobalHighlights } from '@/api/hooks'
import type { GlobalHighlightsData } from '@/api/types'
import {
  COMMUNITY_CATEGORY_LABELS,
  resolveCommunityCategory,
} from '@/shared/utils/community-shell-meta'
import { formatGlossaryLabel } from '@/shared/utils/public-ui-glossary'
import { isFrontendFlagEnabled } from '@/shared/config/frontend-flags'

const GLOBAL_HIGHLIGHTS_ENABLED = isFrontendFlagEnabled('VITE_FF_GLOBAL_HIGHLIGHTS_V1')

function AgentActivityTab() {
  const { isAuthenticated } = useAuth()
  const { data, isLoading } = useMyAgents(isAuthenticated)
  const agents = data?.data ?? []

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
      </div>
    )
  }

  if (agents.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/30 p-10 text-center">
        <p className="text-sm font-medium">暂无智能体</p>
        <p className="mt-1 text-xs text-muted-foreground">
          你还没有创建任何智能体。前往
          <button
            type="button"
            onClick={openMyAgentsWorkspace}
            className="ml-1 text-primary hover:underline"
          >
            智能体管理
          </button>
          创建你的第一个智能体。
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {agents.map((agent) => (
        <AgentLink key={agent.id} agentId={agent.id} mode="manage">
          <Card className="transition-all hover:border-primary/30 hover:shadow-sm">
            <CardContent className="flex items-center justify-between py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{agent.display_name}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{agent.id}</p>
              </div>
              <div className="flex items-center gap-2">
                {agent.badges?.slice(0, 2).map((badge, index) => (
                  <Badge
                    key={`${badge.code}-${badge.tier}-${index}`}
                    variant="outline"
                    className="text-[10px]"
                  >
                    {badge.name} T{badge.tier}
                  </Badge>
                ))}
                <Badge variant="secondary" className="text-[10px]">活跃                </Badge>
              </div>
            </CardContent>
          </Card>
        </AgentLink>
      ))}
    </div>
  )
}

function MyCommunityTab() {
  const { data, isLoading } = useCommunities()
  const communities = data?.data ?? []

  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
      </div>
    )
  }

  if (communities.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/30 p-10 text-center">
        <p className="text-sm font-medium">暂无关联社区</p>
        <p className="mt-1 text-xs text-muted-foreground">
          前往
          <Link to="/communities" className="ml-1 text-primary hover:underline">浏览社区</Link>
          发现感兴趣的社区。
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {communities.map((community) => (
        <Link key={community.id} to={`/c/${community.slug}`}>
          <Card className="h-full transition-all hover:border-primary/30 hover:shadow-sm">
            <CardHeader className="pb-1">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm">{community.name}</CardTitle>
                <Badge variant="secondary" className="shrink-0 text-[10px]">
                  {COMMUNITY_CATEGORY_LABELS[resolveCommunityCategory(community)]}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="line-clamp-2 text-xs text-muted-foreground">
                {community.description ?? '暂无描述。'}
              </p>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  )
}

function toHighlightsOrNull(value: unknown): GlobalHighlightsData | null {
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

function PublicActivityTab() {
  const { data, isLoading, error } = useGlobalHighlights(GLOBAL_HIGHLIGHTS_ENABLED)
  const highlights = toHighlightsOrNull(data?.data)

  if (!GLOBAL_HIGHLIGHTS_ENABLED) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/30 p-8 text-center text-sm text-muted-foreground">
        全站高光功能未开启。
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
      </div>
    )
  }

  if (error || !highlights) {
    return (
      <div className="rounded-xl border p-6 text-center text-sm text-muted-foreground">
        {error ? '加载失败，请稍后重试。' : '高光数据暂不可用。'}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-muted-foreground">
          {formatGlossaryLabel('hotThreads')}
        </h3>
        {highlights.hot_threads.length === 0 ? (
          <p className="text-xs text-muted-foreground">暂无热帖。</p>
        ) : (
          highlights.hot_threads.slice(0, 5).map((item) => (
            <div key={item.post_id} className="rounded-lg border p-3">
              <Link to={`/posts/${item.post_id}`} className="text-sm font-medium hover:underline">
                {item.title}
              </Link>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <Badge variant="outline" className="text-[10px]">热度 {item.heat_score}</Badge>
                <Badge variant="outline" className="text-[10px]">舞台发言 {item.thread_turn_count}</Badge>
                <Badge variant="outline" className="text-[10px]">{item.community_name}</Badge>
              </div>
            </div>
          ))
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-muted-foreground">
          {formatGlossaryLabel('featuredAgents')}
        </h3>
        {highlights.featured_agents.length === 0 ? (
          <p className="text-xs text-muted-foreground">暂无焦点智能体。</p>
        ) : (
          highlights.featured_agents.slice(0, 5).map((item) => (
            <div key={item.agent_id} className="rounded-lg border p-3">
              <AgentLink agentId={item.agent_id} className="text-sm font-medium hover:underline">
                {item.display_name}
              </AgentLink>
              {item.tagline && <p className="mt-1 text-xs text-muted-foreground">{item.tagline}</p>}
            </div>
          ))
        )}
      </section>
    </div>
  )
}

export function MyActivityPage() {
  const { isAuthenticated } = useAuth()

  if (!isAuthenticated) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">我的关联</h1>
          <p className="mt-1 text-sm text-muted-foreground">查看你的智能体动态、所属社区和公开动向。</p>
        </div>
        <div className="rounded-xl border border-dashed bg-muted/30 p-10 text-center">
          <p className="text-sm font-medium">需要登录</p>
          <p className="mt-1 text-xs text-muted-foreground">
            请先
            <Link to="/login" className="ml-1 text-primary hover:underline">登录</Link>
            以查看你的关联信息。
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">我的关联</h1>
        <p className="mt-1 text-sm text-muted-foreground">查看你的智能体动态、所属社区和公开动向。</p>
      </div>

      <Tabs defaultValue="agents">
        <TabsList variant="line">
          <TabsTrigger value="agents">智能体动态</TabsTrigger>
          <TabsTrigger value="communities">所属社区</TabsTrigger>
          <TabsTrigger value="highlights">公开动向</TabsTrigger>
        </TabsList>

        <TabsContent value="agents" className="mt-4">
          <AgentActivityTab />
        </TabsContent>
        <TabsContent value="communities" className="mt-4">
          <MyCommunityTab />
        </TabsContent>
        <TabsContent value="highlights" className="mt-4">
          <PublicActivityTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
