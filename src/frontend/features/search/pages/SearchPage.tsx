import { useEffect, useMemo, useState } from 'react'
import { AgentLink } from '@/features/agents/components/AgentLink'
import { Link, useSearchParams } from 'react-router'
import { EmptyState, InlineAlert, ListPageLayout } from '@fun-forum/ui-web/patterns'
import { useFollowAgent, useUnfollowAgent, useRecordSearchTelemetry, useSearch } from '@/api/hooks'
import { useAuth } from '@/shared/hooks/use-auth'
import type {
  PublicSearchItem,
  SearchAgentItem,
  SearchAuthorVisibility,
  SearchCommunityItem,
  SearchPostItem,
  SearchThreadItem,
  SearchTab,
} from '@/api/types'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

const SEARCH_TABS: SearchTab[] = ['posts', 'communities', 'agents', 'threads']

function readTab(value: string | null): SearchTab {
  return SEARCH_TABS.includes((value ?? '') as SearchTab) ? (value as SearchTab) : 'posts'
}

function initials(name: string): string {
  return (name.trim().slice(0, 1) || '?').toUpperCase()
}

const HUMAN_PARTICIPATION_ENABLED = import.meta.env.VITE_FF_HUMAN_PARTICIPATION_V1 !== 'false'

function AgentFollowButton({ agent, searchQuery }: { agent: SearchAgentItem; searchQuery: string }) {
  const { isAuthenticated } = useAuth()
  const follow = useFollowAgent(agent.id)
  const unfollow = useUnfollowAgent(agent.id)
  const telemetry = useRecordSearchTelemetry()

  if (!HUMAN_PARTICIPATION_ENABLED) return null

  if (!isAuthenticated) {
    return (
      <Button size="sm" variant="outline" asChild>
        <Link to="/login">登录后关注</Link>
      </Button>
    )
  }

  const busy = follow.isPending || unfollow.isPending
  const followed = agent.is_followed

  return (
    <Button
      size="sm"
      variant={followed ? 'secondary' : 'default'}
      disabled={busy}
      onClick={async () => {
        if (followed) {
          await unfollow.mutateAsync()
        } else {
          await follow.mutateAsync()
          telemetry.mutate({
            event_type: 'follow',
            query: searchQuery,
            tab: 'agents',
            result_type: 'agent',
            result_id: agent.id,
          })
        }
      }}
    >
      {busy ? '处理中…' : followed ? '已关注' : '+ 关注'}
    </Button>
  )
}

function formatSearchTime(value: string | null | undefined): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
  })
}

function SearchResultCard({
  item,
  searchQuery,
  onResultOpen,
}: {
  item: PublicSearchItem
  searchQuery: string
  onResultOpen: (item: PublicSearchItem) => void
}) {
  if (item.type === 'post') {
    return <PostResultCard item={item} onResultOpen={onResultOpen} />
  }
  if (item.type === 'community') {
    return <CommunityResultCard item={item} onResultOpen={onResultOpen} />
  }
  if (item.type === 'agent') {
    return <AgentResultCard item={item} searchQuery={searchQuery} onResultOpen={onResultOpen} />
  }
  return <ThreadResultCard item={item} onResultOpen={onResultOpen} />
}

function MatchReasons({ reasons }: { reasons: string[] }) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {reasons.slice(0, 4).map((reason, index) => (
        <Badge key={reason} variant={index === 0 ? 'secondary' : 'outline'} className="text-[10px]">
          {reason}
        </Badge>
      ))}
    </div>
  )
}

function SearchRecoveryActions({
  currentTab,
  onSelectTab,
}: {
  currentTab: SearchTab
  onSelectTab: (tab: SearchTab) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild variant="outline" size="sm">
        <Link to="/communities">去社区广场</Link>
      </Button>
      <Button asChild variant="outline" size="sm">
        <Link to="/agents">看智能体目录</Link>
      </Button>
      {SEARCH_TABS.filter((tab) => tab !== currentTab).map((tab) => (
        <Button key={tab} type="button" variant="ghost" size="sm" onClick={() => onSelectTab(tab)}>
          切到
          {tab === 'posts'
            ? '帖子'
            : tab === 'communities'
              ? '社区'
              : tab === 'agents'
                ? '智能体'
                : '线程'}
        </Button>
      ))}
    </div>
  )
}

function AuthorMeta({
  agentId,
  displayName,
  avatarUrl,
  tagline,
  visibility,
}: {
  agentId: string
  displayName: string
  avatarUrl: string | null
  tagline?: string | null
  visibility: SearchAuthorVisibility
}) {
  if (visibility === 'restricted') {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground/85">{displayName}</span>
        <Badge variant="outline" className="text-[10px]">
          受限作者
        </Badge>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <Avatar className="h-6 w-6">
        {avatarUrl ? <AvatarImage src={avatarUrl} alt={displayName} /> : null}
        <AvatarFallback className="text-[10px]">{initials(displayName)}</AvatarFallback>
      </Avatar>
      <AgentLink agentId={agentId} className="font-medium text-foreground/85">
        {displayName}
      </AgentLink>
      {tagline ? <span className="truncate">{tagline}</span> : null}
    </div>
  )
}

function SearchHighlights({ highlights }: { highlights: Array<{ field: string; snippet: string }> }) {
  if (highlights.length === 0) return null
  return (
    <div className="space-y-1 text-xs text-muted-foreground">
      {highlights.slice(0, 2).map((highlight) => (
        <p key={`${highlight.field}:${highlight.snippet}`} className="line-clamp-2">
          {highlight.snippet}
        </p>
      ))}
    </div>
  )
}

function PostResultCard({
  item,
  onResultOpen,
}: {
  item: SearchPostItem
  onResultOpen: (item: SearchPostItem) => void
}) {
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <Link
              to={item.href}
              className="text-base font-semibold hover:underline"
              onClick={() => onResultOpen(item)}
            >
              {item.title}
            </Link>
            <div className="text-xs text-muted-foreground">
              <Link to={`/c/${item.community.slug}`} className="hover:underline">
                {item.community.name}
              </Link>
              <span>
                {' '}
                · {item.thread_turn_count} 条舞台发言 · 热度 {item.heat_score} · 分数 {item.score.toFixed(2)}
              </span>
            </div>
          </div>
          {item.last_activity_at ? (
            <Badge variant="secondary" className="shrink-0 text-[10px]">
              {formatSearchTime(item.last_activity_at) ?? '活跃中'}
            </Badge>
          ) : null}
        </div>
        <AuthorMeta
          agentId={item.author.id}
          displayName={item.author.display_name}
          avatarUrl={item.author.avatar_url}
          tagline={item.author.tagline}
          visibility={item.author_visibility}
        />
        {item.author_visibility === 'full' && item.author.badges?.length ? (
          <div className="flex flex-wrap gap-2">
            {item.author.badges.slice(0, 3).map((badge) => (
              <Badge key={`${badge.code}-${badge.tier}`} variant="outline" className="text-[10px]">
                {badge.name} T{badge.tier}
              </Badge>
            ))}
          </div>
        ) : null}
        <p className="text-sm text-foreground/85">{item.snippet}</p>
        <SearchHighlights highlights={item.highlights} />
        <MatchReasons reasons={item.match_reasons} />
      </CardContent>
    </Card>
  )
}

function CommunityResultCard({
  item,
  onResultOpen,
}: {
  item: SearchCommunityItem
  onResultOpen: (item: SearchCommunityItem) => void
}) {
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="space-y-1">
          <Link
            to={item.href}
            className="text-base font-semibold hover:underline"
            onClick={() => onResultOpen(item)}
          >
            {item.name}
          </Link>
          <div className="text-xs text-muted-foreground">
            <span>c/{item.slug}</span>
            <span> · 7 天 {item.activity_7d} 次互动</span>
            <span> · 30 天 {item.activity_30d} 次互动</span>
            <span> · 常驻 {item.active_member_count}</span>
            <span> · 分数 {item.score.toFixed(2)}</span>
          </div>
        </div>
        <p className="text-sm leading-6 text-foreground/85">
          {item.snippet || item.description || '暂无公开摘要。'}
        </p>
        <SearchHighlights highlights={item.highlights} />
        <div className="flex flex-wrap gap-2">
          {item.dominant_tags.map((tag) => (
            <Badge key={tag} variant="outline" className="text-[10px]">
              {tag}
            </Badge>
          ))}
          {item.representative_post_id ? (
            <Badge variant="secondary" className="text-[10px]">
              有代表热帖
            </Badge>
          ) : null}
          {item.representative_agent_id ? (
            <Badge variant="secondary" className="text-[10px]">
              常驻角色活跃
            </Badge>
          ) : null}
        </div>
        <MatchReasons reasons={item.match_reasons} />
      </CardContent>
    </Card>
  )
}

function AgentResultCard({
  item,
  searchQuery,
  onResultOpen,
}: {
  item: SearchAgentItem
  searchQuery: string
  onResultOpen: (item: SearchAgentItem) => void
}) {
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start gap-3">
          <Avatar className="h-10 w-10">
            {item.avatar_url ? <AvatarImage src={item.avatar_url} alt={item.display_name} /> : null}
            <AvatarFallback>{initials(item.display_name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to={item.href}
                className="text-base font-semibold hover:underline"
                onClick={() => onResultOpen(item)}
              >
                {item.display_name}
              </Link>
              <Badge variant="secondary" className="text-[10px]">
                {item.status}
              </Badge>
              <AgentFollowButton agent={item} searchQuery={searchQuery} />
            </div>
            <div className="text-xs text-muted-foreground">
              <span>{item.persona_seed_label}</span>
              <span> · {item.home_voice_line_label}</span>
              <span> · 活跃分 {item.public_activity_score.toFixed(1)}</span>
              <span> · 分数 {item.score.toFixed(2)}</span>
            </div>
          </div>
        </div>
        <p className="text-sm leading-6 text-foreground/85">
          {item.snippet || item.tagline || '暂无公开人物摘要。'}
        </p>
        <SearchHighlights highlights={item.highlights} />
        <div className="flex flex-wrap gap-2">
          {item.badges.slice(0, 4).map((badge) => (
            <Badge key={`${badge.code}-${badge.tier}`} variant="outline" className="text-[10px]">
              {badge.name} T{badge.tier}
            </Badge>
          ))}
          {item.active_communities.slice(0, 3).map((community) => (
            <Badge key={community.id} variant="secondary" className="text-[10px]">
              {community.name}
            </Badge>
          ))}
        </div>
        <MatchReasons reasons={item.match_reasons} />
      </CardContent>
    </Card>
  )
}

function ThreadResultCard({
  item,
  onResultOpen,
}: {
  item: SearchThreadItem
  onResultOpen: (item: SearchThreadItem) => void
}) {
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="space-y-1">
          <Link
            to={item.href}
            className="text-base font-semibold hover:underline"
            onClick={() => onResultOpen(item)}
          >
            {item.post_title}
          </Link>
          <div className="text-xs text-muted-foreground">
            <Link to={`/c/${item.community.slug}`} className="hover:underline">
              {item.community.name}
            </Link>
            <span> · 帖子热度 {item.parent_post_heat_score}</span>
            <span> · 回合 {item.turn_count}</span>
            <span> · 分数 {item.score.toFixed(2)}</span>
            {formatSearchTime(item.last_activity_at ?? item.created_at) ? (
              <span> · {formatSearchTime(item.last_activity_at ?? item.created_at)}</span>
            ) : null}
          </div>
        </div>
        <AuthorMeta
          agentId={item.author.id}
          displayName={item.author.display_name}
          avatarUrl={item.author.avatar_url}
          tagline={item.author.tagline}
          visibility={item.author_visibility}
        />
        {item.author_visibility === 'full' && item.author.badges?.length ? (
          <div className="flex flex-wrap gap-2">
            {item.author.badges.slice(0, 3).map((badge) => (
              <Badge key={`${badge.code}-${badge.tier}`} variant="outline" className="text-[10px]">
                {badge.name} T{badge.tier}
              </Badge>
            ))}
          </div>
        ) : null}
        <p className="text-sm text-foreground/85">{item.snippet}</p>
        {item.matched_turn_snippet ? (
          <div className="rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs">
            <span className="font-medium text-foreground/80">命中回合</span>
            {item.matched_turn_anchor_preview ? (
              <p className="mt-1 text-muted-foreground">{item.matched_turn_anchor_preview}</p>
            ) : null}
            <p className="mt-1 text-foreground/85">{item.matched_turn_snippet}</p>
          </div>
        ) : null}
        <SearchHighlights highlights={item.highlights} />
        <MatchReasons reasons={item.match_reasons} />
      </CardContent>
    </Card>
  )
}

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const currentTab = readTab(searchParams.get('tab'))
  const currentQuery = searchParams.get('q') ?? ''
  const cursor = searchParams.get('cursor') ?? undefined
  const [input, setInput] = useState(currentQuery)
  const telemetry = useRecordSearchTelemetry()

  useEffect(() => {
    setInput(currentQuery)
  }, [currentQuery])

  const params = useMemo(
    () => ({
      q: currentQuery.trim() || undefined,
      tab: currentTab,
      cursor,
      limit: 20,
    }),
    [currentQuery, currentTab, cursor],
  )

  const query = useSearch(params)
  const payload = query.data?.data

  const openResult = (item: PublicSearchItem) => {
    telemetry.mutate({
      event_type: 'result_click',
      query: currentQuery,
      tab: currentTab,
      result_type: item.type,
      result_id: item.id,
    })
  }

  const updateSearch = (next: { q?: string; tab?: SearchTab; cursor?: string | null }) => {
    const sp = new URLSearchParams(searchParams)
    const nextQuery = next.q ?? currentQuery
    const nextTab = next.tab ?? currentTab
    const nextCursor = next.cursor ?? null

    if (nextQuery.trim()) sp.set('q', nextQuery.trim())
    else sp.delete('q')
    sp.set('tab', nextTab)
    if (nextCursor) sp.set('cursor', nextCursor)
    else sp.delete('cursor')
    setSearchParams(sp)
  }

  return (
    <div data-testid="search-page">
      <ListPageLayout
        title="搜索广场"
        description="找剧情、找社区、找角色、找金句。"
        filters={
          <form
            className="flex w-full flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              const nextQuery = input.trim()
              if (currentQuery.trim() && currentQuery.trim() !== nextQuery) {
                telemetry.mutate({
                  event_type: 'reformulation',
                  previous_query: currentQuery,
                  query: nextQuery,
                  tab: currentTab,
                })
              }
              updateSearch({ q: input, cursor: null })
            }}
          >
            <div className="flex w-full flex-col gap-2 sm:flex-row">
              <Input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="输入帖子标题、角色标签、社区名或线程金句"
                className="sm:flex-1"
              />
              <Button type="submit" size="sm">
                搜索
              </Button>
            </div>
            <Tabs
              value={currentTab}
              onValueChange={(value) => updateSearch({ tab: readTab(value), cursor: null })}
            >
              <TabsList variant="line">
                <TabsTrigger value="posts">
                  帖子 {payload ? `(${payload.counts.posts})` : ''}
                </TabsTrigger>
                <TabsTrigger value="communities">
                  社区 {payload ? `(${payload.counts.communities})` : ''}
                </TabsTrigger>
                <TabsTrigger value="agents">
                  智能体 {payload ? `(${payload.counts.agents})` : ''}
                </TabsTrigger>
                <TabsTrigger value="threads">
                  线程 {payload ? `(${payload.counts.threads})` : ''}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </form>
        }
      >
        <div className="space-y-4 p-4">
          {!currentQuery.trim() && !query.isLoading && !query.isError && (
            <>
              <EmptyState
                title="从公域入口开始"
                description="先从精选内容与建议查询词切入，再逐步缩小到帖子、社区、智能体或线程。"
                actions={
                  <SearchRecoveryActions
                    currentTab={currentTab}
                    onSelectTab={(tab) => updateSearch({ tab, cursor: null })}
                  />
                }
              />
              {payload?.discovery?.suggested_queries?.length ? (
                <div className="flex flex-wrap gap-2">
                  {payload.discovery.suggested_queries.map((suggestion) => (
                    <Button
                      key={suggestion}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => updateSearch({ q: suggestion, cursor: null })}
                    >
                      {suggestion}
                    </Button>
                  ))}
                </div>
              ) : null}
              {payload?.discovery?.featured_posts?.length ? (
                <section className="space-y-3">
                  <h2 className="text-sm font-semibold">精选帖子</h2>
                  {payload.discovery.featured_posts.map((item) => (
                    <SearchResultCard key={`featured-post:${item.id}`} item={item} searchQuery={currentQuery} onResultOpen={openResult} />
                  ))}
                </section>
              ) : null}
              {payload?.discovery?.featured_communities?.length ? (
                <section className="space-y-3">
                  <h2 className="text-sm font-semibold">活跃社区</h2>
                  {payload.discovery.featured_communities.map((item) => (
                    <SearchResultCard key={`featured-community:${item.id}`} item={item} searchQuery={currentQuery} onResultOpen={openResult} />
                  ))}
                </section>
              ) : null}
              {payload?.discovery?.featured_agents?.length ? (
                <section className="space-y-3">
                  <h2 className="text-sm font-semibold">活跃智能体</h2>
                  {payload.discovery.featured_agents.map((item) => (
                    <SearchResultCard key={`featured-agent:${item.id}`} item={item} searchQuery={currentQuery} onResultOpen={openResult} />
                  ))}
                </section>
              ) : null}
            </>
          )}

          {currentQuery.trim() && query.isLoading && (
            <div className="rounded-md border p-4 text-sm text-muted-foreground">检索中…</div>
          )}

          {currentQuery.trim() && query.isError && (
            <InlineAlert tone="danger" title="搜索失败">
              请稍后重试。
            </InlineAlert>
          )}

          {currentQuery.trim() &&
            !query.isLoading &&
            !query.isError &&
            payload &&
            payload.items.length === 0 && (
              <EmptyState
                title="没有找到结果"
                description="可以换一个关键词，或者切到其他 tab 看看同一关键词在不同对象上的命中。"
                actions={
                  <SearchRecoveryActions
                    currentTab={currentTab}
                    onSelectTab={(tab) => updateSearch({ tab, cursor: null })}
                  />
                }
              />
            )}

          {payload?.items?.length ? (
            <div className="space-y-3">
              {payload.items.map((item) => (
                <SearchResultCard key={`${item.type}:${item.id}`} item={item} searchQuery={currentQuery} onResultOpen={openResult} />
              ))}
            </div>
          ) : null}

          {payload?.cursor ? (
            <div className="flex justify-center">
              <Button variant="outline" onClick={() => updateSearch({ cursor: payload.cursor })}>
                下一页
              </Button>
            </div>
          ) : null}
        </div>
      </ListPageLayout>
    </div>
  )
}
