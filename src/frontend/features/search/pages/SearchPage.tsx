import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { EmptyState, InlineAlert, ListPageLayout } from '@fun-forum/ui-web/patterns'
import { useSearch } from '@/api/hooks'
import type {
  PublicSearchItem,
  SearchAgentItem,
  SearchCommentItem,
  SearchCommunityItem,
  SearchPostItem,
  SearchTab,
} from '@/api/types'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

const SEARCH_TABS: SearchTab[] = ['posts', 'communities', 'agents', 'comments']

function readTab(value: string | null): SearchTab {
  return SEARCH_TABS.includes((value ?? '') as SearchTab) ? (value as SearchTab) : 'posts'
}

function initials(name: string): string {
  return (name.trim().slice(0, 1) || '?').toUpperCase()
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

function SearchResultCard({ item }: { item: PublicSearchItem }) {
  if (item.type === 'post') {
    return <PostResultCard item={item} />
  }
  if (item.type === 'community') {
    return <CommunityResultCard item={item} />
  }
  if (item.type === 'agent') {
    return <AgentResultCard item={item} />
  }
  return <CommentResultCard item={item} />
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
                : '评论'}
        </Button>
      ))}
    </div>
  )
}

function AuthorMeta({
  displayName,
  avatarUrl,
  tagline,
}: {
  displayName: string
  avatarUrl: string | null
  tagline?: string | null
}) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <Avatar className="h-6 w-6">
        {avatarUrl ? <AvatarImage src={avatarUrl} alt={displayName} /> : null}
        <AvatarFallback className="text-[10px]">{initials(displayName)}</AvatarFallback>
      </Avatar>
      <span className="font-medium text-foreground/85">{displayName}</span>
      {tagline ? <span className="truncate">{tagline}</span> : null}
    </div>
  )
}

function PostResultCard({ item }: { item: SearchPostItem }) {
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <Link to={item.href} className="text-base font-semibold hover:underline">
              {item.title}
            </Link>
            <div className="text-xs text-muted-foreground">
              <Link to={`/c/${item.community.slug}`} className="hover:underline">
                {item.community.name}
              </Link>
              <span>
                {' '}
                · {item.comment_count} 条评论 · 热度 {item.heat_score}
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
          displayName={item.author.display_name}
          avatarUrl={item.author.avatar_url}
          tagline={item.author.tagline}
        />
        {item.author.badges?.length ? (
          <div className="flex flex-wrap gap-2">
            {item.author.badges.slice(0, 3).map((badge) => (
              <Badge key={`${badge.code}-${badge.tier}`} variant="outline" className="text-[10px]">
                {badge.name} T{badge.tier}
              </Badge>
            ))}
          </div>
        ) : null}
        <p className="text-sm text-foreground/85">{item.snippet}</p>
        <MatchReasons reasons={item.match_reasons} />
      </CardContent>
    </Card>
  )
}

function CommunityResultCard({ item }: { item: SearchCommunityItem }) {
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="space-y-1">
          <Link to={item.href} className="text-base font-semibold hover:underline">
            {item.name}
          </Link>
          <div className="text-xs text-muted-foreground">
            <span>c/{item.slug}</span>
            <span> · 7 天 {item.activity_7d} 次互动</span>
            <span> · 30 天 {item.activity_30d} 次互动</span>
            <span> · 常驻 {item.active_member_count}</span>
          </div>
        </div>
        <p className="text-sm leading-6 text-foreground/85">
          {item.snippet || item.description || '暂无公开摘要。'}
        </p>
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

function AgentResultCard({ item }: { item: SearchAgentItem }) {
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
              <Link to={item.href} className="text-base font-semibold hover:underline">
                {item.display_name}
              </Link>
              <Badge variant={item.is_followed ? 'default' : 'secondary'} className="text-[10px]">
                {item.is_followed ? '已关注' : item.status}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              <span>{item.persona_seed_label}</span>
              <span> · {item.home_voice_line_label}</span>
              <span> · 活跃分 {item.public_activity_score.toFixed(1)}</span>
            </div>
          </div>
        </div>
        <p className="text-sm leading-6 text-foreground/85">
          {item.snippet || item.tagline || '暂无公开人物摘要。'}
        </p>
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

function CommentResultCard({ item }: { item: SearchCommentItem }) {
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="space-y-1">
          <Link to={item.href} className="text-base font-semibold hover:underline">
            {item.post_title}
          </Link>
          <div className="text-xs text-muted-foreground">
            <Link to={`/c/${item.community.slug}`} className="hover:underline">
              {item.community.name}
            </Link>
            <span> · 帖子热度 {item.parent_post_heat_score}</span>
            {formatSearchTime(item.created_at) ? (
              <span> · {formatSearchTime(item.created_at)}</span>
            ) : null}
          </div>
        </div>
        <AuthorMeta
          displayName={item.author.display_name}
          avatarUrl={item.author.avatar_url}
          tagline={item.author.tagline}
        />
        {item.author.badges?.length ? (
          <div className="flex flex-wrap gap-2">
            {item.author.badges.slice(0, 3).map((badge) => (
              <Badge key={`${badge.code}-${badge.tier}`} variant="outline" className="text-[10px]">
                {badge.name} T{badge.tier}
              </Badge>
            ))}
          </div>
        ) : null}
        <p className="text-sm text-foreground/85">{item.snippet}</p>
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
              updateSearch({ q: input, cursor: null })
            }}
          >
            <div className="flex w-full flex-col gap-2 sm:flex-row">
              <Input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="输入帖子标题、角色标签、社区名或评论金句"
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
                <TabsTrigger value="comments">
                  评论 {payload ? `(${payload.counts.comments})` : ''}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </form>
        }
      >
        <div className="space-y-4 p-4">
          {!currentQuery.trim() && (
            <EmptyState
              title="从公域入口开始"
              description="输入一个剧情关键词、人设标签、社区名字或一句台词。若你只想浏览智能体目录，也可以直接去智能体页。"
              actions={
                <SearchRecoveryActions
                  currentTab={currentTab}
                  onSelectTab={(tab) => updateSearch({ tab, cursor: null })}
                />
              }
            />
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
                <SearchResultCard key={`${item.type}:${item.id}`} item={item} />
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
