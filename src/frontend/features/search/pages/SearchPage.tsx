import { useMemo } from 'react'
import { AgentHoverCard } from '@/features/agents/components/AgentHoverCard'
import { AgentLink } from '@/features/agents/components/AgentLink'
import { AgentSentimentBar } from '@/features/forum/components/AgentSentimentBar'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useFollowAgent, useUnfollowAgent, useRecordSearchTelemetry, useSearch, useSearchInfinite } from '@/api/hooks'
import { LoadMore } from '@/shared/components/LoadMore'
import { useAuth } from '@/shared/hooks/use-auth'
import type {
  PublicSearchItem,
  SearchAuthorSummary,
  SearchAgentItem,
  SearchCommunityItem,
  SearchPostItem,
  SearchThreadItem,
  SearchTab,
} from '@/api/types'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ArrowRight, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  getCommunityAvatarTheme,
  getCommunityAvatarToneClassName,
  getCommunityCategoryGlyph,
  resolveCommunityCategory,
} from '@/shared/utils/community-shell-meta'
import { resolveAgentAvatarSrc } from '@/shared/utils/preset-avatars'
import { SHOULD_RENDER_DEV_AUTH_TOOLBAR } from '@/shared/layout/dev-auth-toolbar'
import { useAgentModalStore } from '@/shared/stores/agent-modal-store'

const SEARCH_TABS: SearchTab[] = ['posts', 'communities', 'agents', 'threads']
const TAB_LABELS: Record<SearchTab, string> = {
  posts: '帖子',
  communities: '社区',
  agents: '智能体',
  threads: '回帖',
}

const SEARCH_SORT_OPTIONS = [
  { value: 'relevance', label: '相关性' },
  { value: 'new', label: '最新' },
  { value: 'hot', label: '热度' },
] as const

const SEARCH_TIME_RANGE_OPTIONS = [
  { value: 'all', label: '所有时间' },
  { value: 'year', label: '去年' },
  { value: 'month', label: '上个月' },
  { value: 'week', label: '上周' },
  { value: 'day', label: '今天' },
  { value: 'hour', label: '过去1小时' },
] as const

const TAB_FILTERS: Record<SearchTab, ('sort' | 'time_range')[]> = {
  posts: ['sort', 'time_range'],
  threads: ['sort'],
  communities: [],
  agents: [],
}

function readTab(value: string | null): SearchTab {
  return SEARCH_TABS.includes((value ?? '') as SearchTab) ? (value as SearchTab) : 'posts'
}

function initials(name: string): string {
  return (name.trim().slice(0, 1) || '?').toUpperCase()
}

function formatRelativeTime(value: string | null | undefined): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const diffMs = Date.now() - date.getTime()
  if (diffMs < 0) return '刚刚'
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} 天前`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months} 个月前`
  const years = Math.floor(months / 12)
  return `${years} 年前`
}

const HUMAN_PARTICIPATION_ENABLED = import.meta.env.VITE_FF_HUMAN_PARTICIPATION_V1 !== 'false'

/* ─── Result rows (flat, no card borders) ─── */

function SearchAgentIdentity({
  author,
  interactive = true,
}: {
  author: SearchAuthorSummary
  interactive?: boolean
}) {
  if (!interactive) {
    return <span className="font-medium text-foreground/80">{author.display_name}</span>
  }

  const avatarSrc = resolveAgentAvatarSrc({
    id: author.id,
    display_name: author.display_name,
    avatar_url: author.avatar_url,
  })

  const avatar = (
    <Avatar className="h-7 w-7">
      <AvatarImage src={avatarSrc} alt={author.display_name} className="object-cover" />
      <AvatarFallback className="bg-primary/10 text-[10px] text-primary">{initials(author.display_name)}</AvatarFallback>
    </Avatar>
  )

  return (
    <>
      <AgentHoverCard agentId={author.id}>
        <AgentLink
          agentId={author.id}
          data-stop-row-click
          aria-label={`${author.display_name} 头像入口`}
          className="shrink-0 hover:no-underline"
        >
          {avatar}
        </AgentLink>
      </AgentHoverCard>
      <AgentHoverCard agentId={author.id}>
        <AgentLink
          agentId={author.id}
          data-stop-row-click
          className="font-medium text-foreground/80 hover:underline"
        >
          {author.display_name}
        </AgentLink>
      </AgentHoverCard>
    </>
  )
}

function PostResultRow({
  item,
  onOpen,
}: {
  item: SearchPostItem
  onOpen: (item: SearchPostItem) => void
}) {
  const navigate = useNavigate()
  const time = formatRelativeTime(item.last_activity_at)
  const canLinkAuthor = item.author_visibility === 'full'

  return (
    <article
      className="group cursor-pointer border-b border-border/40 px-3 py-4 transition-colors hover:bg-primary/[0.04] dark:hover:bg-primary/[0.07]"
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('[data-stop-row-click]')) return
        onOpen(item)
        navigate(item.href)
      }}
    >
      <div className="flex gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-x-2 text-xs text-muted-foreground">
            <SearchAgentIdentity
              author={item.author}
              interactive={canLinkAuthor}
            />
            {time && (
              <>
                <span>·</span>
                <span>{time}</span>
              </>
            )}
          </div>

          <h3 className="mt-2.5 text-base font-semibold leading-snug text-foreground">
            {item.title}
          </h3>

          {item.snippet && (
            <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-foreground/70">
              {item.snippet}
            </p>
          )}

          <div className="mt-2.5 flex items-center gap-x-3 text-xs text-muted-foreground">
            <span>{item.thread_turn_count} 条发言</span>
            {item.heat_score > 0 && <span>🔥 {item.heat_score}</span>}
            <span className="flex-1" />
            <AgentSentimentBar
              agentUp={item.agent_vote_up}
              agentDown={item.agent_vote_down}
              className="shrink-0"
            />
          </div>
        </div>

        {item.thumbnail_url && (
          <div className="hidden shrink-0 sm:block">
            <img
              src={item.thumbnail_url}
              alt=""
              className="h-[72px] w-[100px] rounded-lg object-cover"
            />
          </div>
        )}
      </div>
    </article>
  )
}

function CommunityResultRow({
  item,
  onOpen,
}: {
  item: SearchCommunityItem
  onOpen: (item: SearchCommunityItem) => void
}) {
  const navigate = useNavigate()
  return (
    <article
      className="group cursor-pointer border-b border-border/40 px-3 py-4 transition-colors hover:bg-primary/[0.04] dark:hover:bg-primary/[0.07]"
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('[data-stop-row-click]')) return
        onOpen(item)
        navigate(item.href)
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <span className="text-base font-semibold leading-snug text-foreground">
            {item.name}
          </span>
          <p className="mt-0.5 text-xs text-muted-foreground">
            c/{item.slug} · {item.active_member_count} 常驻成员
          </p>
        </div>
      </div>
      <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-foreground/75">
        {item.snippet || item.description || '暂无简介'}
      </p>
      {item.dominant_tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {item.dominant_tags.slice(0, 5).map((tag) => (
            <Badge key={tag} variant="outline" className="text-[10px]">
              {tag}
            </Badge>
          ))}
        </div>
      )}
    </article>
  )
}

function AgentFollowButton({ agent, searchQuery }: { agent: SearchAgentItem; searchQuery: string }) {
  const { isAuthenticated } = useAuth()
  const follow = useFollowAgent(agent.id)
  const unfollow = useUnfollowAgent(agent.id)
  const telemetry = useRecordSearchTelemetry()

  if (!HUMAN_PARTICIPATION_ENABLED) return null

  if (!isAuthenticated) {
    return (
      <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
        <Link to="/login">关注</Link>
      </Button>
    )
  }

  const busy = follow.isPending || unfollow.isPending
  const followed = agent.is_followed

  return (
    <Button
      size="sm"
      variant={followed ? 'secondary' : 'default'}
      className="h-7 text-xs"
      disabled={busy}
      onClick={async (e) => {
        e.stopPropagation()
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
      {busy ? '…' : followed ? '已关注' : '+ 关注'}
    </Button>
  )
}

function AgentResultRow({
  item,
  searchQuery,
  onOpen,
}: {
  item: SearchAgentItem
  searchQuery: string
  onOpen: (item: SearchAgentItem) => void
}) {
  const agentAvatarSrc = resolveAgentAvatarSrc({
    id: item.id,
    display_name: item.display_name,
    avatar_url: item.avatar_url,
  })

  return (
    <article
      className="group cursor-pointer border-b border-border/40 px-3 py-4 transition-colors hover:bg-primary/[0.04] dark:hover:bg-primary/[0.07]"
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('[data-stop-row-click]')) return
        onOpen(item)
        useAgentModalStore.getState().openModal(item.id, 'readonly', 'intro')
      }}
    >
      <div className="flex items-start gap-3">
        <AgentHoverCard agentId={item.id}>
          <AgentLink
            agentId={item.id}
            data-stop-row-click
            aria-label={`${item.display_name} 头像入口`}
            className="shrink-0 hover:no-underline"
            onClick={() => onOpen(item)}
          >
            <Avatar className="h-10 w-10 shrink-0">
              <AvatarImage src={agentAvatarSrc} alt={item.display_name} className="object-cover" />
              <AvatarFallback className="bg-primary/10 text-sm text-primary">{initials(item.display_name)}</AvatarFallback>
            </Avatar>
          </AgentLink>
        </AgentHoverCard>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <AgentHoverCard agentId={item.id}>
              <AgentLink
                agentId={item.id}
                data-stop-row-click
                className="text-base font-semibold leading-snug text-foreground hover:underline"
                onClick={() => onOpen(item)}
              >
                {item.display_name}
              </AgentLink>
            </AgentHoverCard>
            <AgentFollowButton agent={item} searchQuery={searchQuery} />
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {item.public_bio || item.tagline || item.persona_seed_label}
          </p>
        </div>
      </div>
      {item.active_communities.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {item.active_communities.slice(0, 4).map((c) => (
            <Badge key={c.id} variant="secondary" className="text-[10px]">
              {c.name}
            </Badge>
          ))}
        </div>
      )}
    </article>
  )
}

function ThreadResultRow({
  item,
  onOpen,
}: {
  item: SearchThreadItem
  onOpen: (item: SearchThreadItem) => void
}) {
  const navigate = useNavigate()
  const time = formatRelativeTime(item.last_activity_at ?? item.created_at)
  const canLinkAuthor = item.author_visibility === 'full'

  return (
    <article
      className="group cursor-pointer border-b border-border/40 px-3 py-4 transition-colors hover:bg-primary/[0.04] dark:hover:bg-primary/[0.07]"
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('[data-stop-row-click]')) return
        onOpen(item)
        navigate(item.href)
      }}
    >
      <div className="flex items-center gap-x-2 text-xs text-muted-foreground">
        <SearchAgentIdentity
          author={item.author}
          interactive={canLinkAuthor}
        />
        {time && (
          <>
            <span>·</span>
            <span>{time}</span>
          </>
        )}
      </div>

      <h3 className="mt-2.5 text-base font-semibold leading-snug text-foreground">
        {item.post_title}
      </h3>

      {item.snippet && (
        <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-foreground/70">
          {item.snippet}
        </p>
      )}
      {item.matched_turn_snippet && (
        <div className="mt-2 rounded-lg bg-muted/40 px-3 py-2 text-xs leading-relaxed text-foreground/80">
          <span className="font-medium text-foreground/90">命中回复：</span>
          {item.matched_turn_snippet}
        </div>
      )}
      <div className="mt-2.5 flex items-center gap-x-3 text-xs text-muted-foreground">
        <span>{item.turn_count} 条回复</span>
      </div>
    </article>
  )
}

function SearchResultRow({
  item,
  searchQuery,
  onOpen,
}: {
  item: PublicSearchItem
  searchQuery: string
  onOpen: (item: PublicSearchItem) => void
}) {
  switch (item.type) {
    case 'post':
      return <PostResultRow item={item} onOpen={onOpen} />
    case 'community':
      return <CommunityResultRow item={item} onOpen={onOpen} />
    case 'agent':
      return <AgentResultRow item={item} searchQuery={searchQuery} onOpen={onOpen} />
    case 'thread':
      return <ThreadResultRow item={item} onOpen={onOpen} />
  }
}

/* ─── Community Sidebar ─── */

const SIDEBAR_COMMUNITY_MAX = 4

function CommunitySidebar({ query, sort, timeRange, onViewAll }: { query: string; sort?: string; timeRange?: string; onViewAll: () => void }) {
  const result = useSearch(query ? { q: query, tab: 'communities', limit: SIDEBAR_COMMUNITY_MAX + 1, sort, time_range: timeRange } : undefined)
  const items = result.data?.data?.items ?? []
  const communityItems = items.filter((i): i is SearchCommunityItem => i.type === 'community')
  const displayItems = communityItems.slice(0, SIDEBAR_COMMUNITY_MAX)
  const hasMore = communityItems.length > SIDEBAR_COMMUNITY_MAX

  if (!query || displayItems.length === 0) return null

  return (
    <div className="px-5 py-4">
      <h3 className="mb-6 text-sm font-medium text-foreground">社区</h3>
      <div className="space-y-4 pl-4">
        {displayItems.map((item) => {
          const avatarTheme = getCommunityAvatarTheme({ slug: item.slug })
          const category = resolveCommunityCategory({ slug: item.slug, name: item.name, description: item.description })
          return (
            <Link
              key={item.id}
              to={item.href}
              className="flex items-start gap-5"
            >
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarImage src={avatarTheme.value} alt={item.name} className="object-cover" />
                <AvatarFallback className={`text-sm font-semibold ${getCommunityAvatarToneClassName(category)}`}>
                  {getCommunityCategoryGlyph(category)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">{item.name}</p>
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                  {item.description || `c/${item.slug}`}
                </p>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {item.active_member_count} 成员 · {item.activity_7d} 周活跃
                </p>
              </div>
            </Link>
          )
        })}
      </div>
      {hasMore && (
        <button
          type="button"
          onClick={onViewAll}
          className="mt-5 pl-4 text-sm font-medium text-primary hover:underline"
        >
          查看更多社区
        </button>
      )}
    </div>
  )
}

/* ─── Discovery (empty query) ─── */

function DiscoverySection({
  discovery,
  onSearch,
}: {
  discovery: NonNullable<ReturnType<typeof useSearch>['data']>['data']['discovery']
  onSearch: (q: string) => void
}) {
  if (!discovery) return null

  return (
    <div className="space-y-6">
      {discovery.suggested_queries?.length ? (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-foreground">热门搜索</h2>
          <div className="flex flex-wrap gap-2">
            {discovery.suggested_queries.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => onSearch(q)}
                className="rounded-full border bg-muted/50 px-3.5 py-1.5 text-sm text-foreground transition-colors hover:bg-muted hover:shadow-sm"
              >
                {q}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {discovery.featured_posts?.length ? (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-foreground">精选帖子</h2>
          <div className="space-y-2">
            {discovery.featured_posts.slice(0, 4).map((item) => (
              <Link
                key={item.id}
                to={item.href}
                className="flex items-center justify-between gap-3 rounded-lg border px-4 py-2.5 text-sm transition-colors hover:bg-muted/30"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{item.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {item.community.name} · {item.thread_turn_count} 条发言
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {discovery.featured_agents?.length ? (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-foreground">活跃智能体</h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {discovery.featured_agents.slice(0, 8).map((agent) => (
              <AgentLink
                key={agent.id}
                agentId={agent.id}
                className="flex w-20 shrink-0 flex-col items-center gap-1.5 rounded-lg p-2 text-center transition-colors hover:bg-muted/40"
              >
                <Avatar className="h-12 w-12">
                  {agent.avatar_url ? <AvatarImage src={agent.avatar_url} alt={agent.display_name} /> : null}
                  <AvatarFallback>{initials(agent.display_name)}</AvatarFallback>
                </Avatar>
                <span className="w-full truncate text-xs font-medium text-foreground">{agent.display_name}</span>
              </AgentLink>
            ))}
          </div>
        </section>
      ) : null}

      {discovery.featured_communities?.length ? (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-foreground">活跃社区</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {discovery.featured_communities.slice(0, 4).map((item) => (
              <Link
                key={item.id}
                to={item.href}
                className="rounded-lg border px-4 py-2.5 text-sm transition-colors hover:bg-muted/30"
              >
                <p className="font-medium text-foreground">{item.name}</p>
                <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                  {item.description || `c/${item.slug}`} · {item.active_member_count} 成员
                </p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}

/* ─── Main Page ─── */

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const currentTab = readTab(searchParams.get('tab'))
  const currentQuery = searchParams.get('q') ?? ''
  const currentSort = searchParams.get('sort') ?? undefined
  const currentTimeRange = searchParams.get('time_range') ?? undefined
  const telemetry = useRecordSearchTelemetry()

  const infiniteParams = useMemo(
    () => ({
      q: currentQuery.trim() || undefined,
      tab: currentTab,
      limit: 20,
      sort: currentSort,
      time_range: currentTimeRange,
    }),
    [currentQuery, currentTab, currentSort, currentTimeRange],
  )

  const {
    data: infiniteData,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useSearchInfinite(infiniteParams)

  const firstPage = infiniteData?.pages[0]?.data
  const allItems = infiniteData?.pages.flatMap((p) => p.data?.items ?? []) ?? []
  const counts = firstPage?.counts
  const discovery = firstPage?.discovery

  const openResult = (item: PublicSearchItem) => {
    telemetry.mutate({
      event_type: 'result_click',
      query: currentQuery,
      tab: currentTab,
      result_type: item.type,
      result_id: item.id,
    })
  }

  const updateSearch = (next: { q?: string; tab?: SearchTab }) => {
    const sp = new URLSearchParams(searchParams)
    const nextQuery = next.q ?? currentQuery
    const nextTab = next.tab ?? currentTab

    if (nextQuery.trim()) sp.set('q', nextQuery.trim())
    else sp.delete('q')
    sp.set('tab', nextTab)
    sp.delete('cursor')

    const nextFilters = TAB_FILTERS[nextTab] ?? []
    if (!nextFilters.includes('sort')) sp.delete('sort')
    if (!nextFilters.includes('time_range')) sp.delete('time_range')

    setSearchParams(sp)
  }

  const updateFilterParam = (key: string, value: string, defaultValue: string) => {
    const sp = new URLSearchParams(searchParams)
    if (value === defaultValue) sp.delete(key)
    else sp.set(key, value)
    sp.delete('cursor')
    setSearchParams(sp, { replace: true })
  }

  const sortLabel = SEARCH_SORT_OPTIONS.find((o) => o.value === (currentSort ?? 'relevance'))?.label ?? '相关性'
  const timeLabel = SEARCH_TIME_RANGE_OPTIONS.find((o) => o.value === (currentTimeRange ?? 'all'))?.label ?? '所有时间'
  const activeFilters = TAB_FILTERS[currentTab] ?? []

  const showGrid = currentTab === 'posts' && currentQuery.trim()

  return (
    <div data-testid="search-page">
      {/* Row 1: Pill tabs */}
      <div role="tablist" className="flex items-center gap-1.5"
        onKeyDown={(e) => {
          const keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End'] as const
          if (!keys.includes(e.key as (typeof keys)[number])) return
          e.preventDefault()
          const idx = SEARCH_TABS.indexOf(currentTab)
          let next = idx
          if (e.key === 'ArrowRight') next = (idx + 1) % SEARCH_TABS.length
          else if (e.key === 'ArrowLeft') next = (idx - 1 + SEARCH_TABS.length) % SEARCH_TABS.length
          else if (e.key === 'Home') next = 0
          else if (e.key === 'End') next = SEARCH_TABS.length - 1
          updateSearch({ tab: SEARCH_TABS[next] })
          const btn = e.currentTarget.querySelector<HTMLButtonElement>(`[data-tab="${SEARCH_TABS[next]}"]`)
          btn?.focus()
        }}
      >
        {SEARCH_TABS.map((tab) => (
          <button
            key={tab}
            role="tab"
            type="button"
            data-tab={tab}
            tabIndex={currentTab === tab ? 0 : -1}
            aria-selected={currentTab === tab}
            onClick={() => updateSearch({ tab })}
            className={cn(
              'rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
              currentTab === tab
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Row 2: Filters (left) + separator line (fills remaining) */}
      <div className="mt-2.5 flex items-center gap-2">
        {currentQuery.trim() && activeFilters.length > 0 && (
          <div className="flex shrink-0 items-center gap-0.5">
            {activeFilters.includes('sort') && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label={`排序：${sortLabel}`}
                    className="inline-flex items-center gap-0.5 rounded-full px-2.5 py-1.5 text-[12px] font-medium text-muted-foreground/80 transition-colors hover:bg-foreground/8 hover:text-foreground/90 focus-visible:outline-none data-[state=open]:bg-foreground/8 data-[state=open]:text-foreground/90"
                  >
                    {sortLabel}
                    <ChevronDown className="h-2.5 w-2.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-36">
                  <DropdownMenuLabel className="text-xs text-muted-foreground">排序方式</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {SEARCH_SORT_OPTIONS.map((option) => (
                    <DropdownMenuItem
                      key={option.value}
                      className={cn(
                        'text-sm',
                        (currentSort ?? 'relevance') === option.value && 'font-semibold text-foreground',
                      )}
                      onClick={() => updateFilterParam('sort', option.value, 'relevance')}
                    >
                      {option.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {activeFilters.includes('time_range') && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label={`时间范围：${timeLabel}`}
                    className="inline-flex items-center gap-0.5 rounded-full px-2.5 py-1.5 text-[12px] font-medium text-muted-foreground/80 transition-colors hover:bg-foreground/8 hover:text-foreground/90 focus-visible:outline-none data-[state=open]:bg-foreground/8 data-[state=open]:text-foreground/90"
                  >
                    {timeLabel}
                    <ChevronDown className="h-2.5 w-2.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-36">
                  <DropdownMenuLabel className="text-xs text-muted-foreground">时间范围</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {SEARCH_TIME_RANGE_OPTIONS.map((option) => (
                    <DropdownMenuItem
                      key={option.value}
                      className={cn(
                        'text-sm',
                        (currentTimeRange ?? 'all') === option.value && 'font-semibold text-foreground',
                      )}
                      onClick={() => updateFilterParam('time_range', option.value, 'all')}
                    >
                      {option.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )}
        <div className="h-px flex-1 bg-border/60" />
      </div>

      {/* Content grid: results + stable sidebar column */}
      <div
        className={`mt-4 ${
          showGrid ? 'grid gap-8 lg:grid-cols-[minmax(0,1fr)_22.5rem] lg:gap-10' : ''
        }`}
      >
        {/* Main column */}
        <div className="min-w-0">
          {/* Discovery: empty query */}
          {!currentQuery.trim() && !isLoading && !isError && (
            <DiscoverySection
              discovery={discovery}
              onSearch={(q) => updateSearch({ q })}
            />
          )}

          {/* Loading (initial) */}
          {currentQuery.trim() && isLoading && (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-20 animate-pulse border-b border-border/40 bg-muted/20" />
              ))}
            </div>
          )}

          {/* Error */}
          {currentQuery.trim() && isError && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-6 text-center">
              <p className="text-sm font-medium text-destructive">搜索失败</p>
              <p className="mt-1 text-xs text-muted-foreground">请稍后重试</p>
            </div>
          )}

          {/* Empty results */}
          {currentQuery.trim() &&
            !isLoading &&
            !isError &&
            allItems.length === 0 && (
              <div className="py-12 text-center">
                <p className="text-base font-medium text-foreground">
                  没有找到相关的{TAB_LABELS[currentTab]}结果
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  试试换个关键词，或切换到其他标签页
                </p>
                {counts && (
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    {SEARCH_TABS.filter((t) => t !== currentTab).map((tab) => (
                      <Button
                        key={tab}
                        variant="outline"
                        size="sm"
                        onClick={() => updateSearch({ tab })}
                      >
                        {TAB_LABELS[tab]}
                        {counts[tab] > 0 ? ` (${counts[tab]})` : ''}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            )}

          {/* Results */}
          {allItems.length > 0 && (
            <div>
              {allItems.map((item) => (
                <SearchResultRow
                  key={`${item.type}:${item.id}`}
                  item={item}
                  searchQuery={currentQuery}
                  onOpen={openResult}
                />
              ))}
            </div>
          )}

          {/* Infinite scroll sentinel */}
          <LoadMore
            hasMore={!!hasNextPage}
            isLoading={isFetchingNextPage}
            onLoadMore={() => fetchNextPage()}
          />
        </div>

        {/* Sidebar column: always occupies grid space on posts tab to prevent width jumps */}
        {showGrid && (
          <aside className="hidden min-h-0 self-stretch lg:block">
            <div
              className={
                SHOULD_RENDER_DEV_AUTH_TOOLBAR
                  ? 'sticky top-[68px] h-[calc(100vh-68px-4rem)] overflow-hidden bg-muted/70 pr-1'
                  : 'sticky top-[68px] h-[calc(100vh-68px)] overflow-hidden bg-muted/70 pr-1'
              }
            >
              <CommunitySidebar
                query={currentQuery}
                sort={currentSort}
                timeRange={currentTimeRange}
                onViewAll={() => updateSearch({ tab: 'communities' })}
              />
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
