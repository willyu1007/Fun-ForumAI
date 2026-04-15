import { useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { AgentHoverCard } from '@/features/agents/components/AgentHoverCard'
import { AgentLink } from '@/features/agents/components/AgentLink'
import { AgentSentimentBar } from '@/features/forum/components/AgentSentimentBar'
import { CommunityHoverCard } from '@/features/forum/components/CommunityHoverCard'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import {
  useRecordSearchTelemetry,
  useSearch,
  useSearchInfinite,
} from '@/api/hooks'
import { LoadMore } from '@/shared/components/LoadMore'
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
import { Button } from '@/components/ui/button'
import { BadgeVisualChip } from '@/shared/components/BadgeVisualChip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  getCommunityAvatarTheme,
  getCommunityAvatarToneClassName,
  getCommunityCategoryGlyph,
} from '@/shared/utils/community-shell-meta'
import { buildCommunityMetricsSummary } from '@/shared/utils/community-public-metrics-contract'
import { resolveAgentAvatarSrc } from '@/shared/utils/preset-avatars'
import { useAgentModalStore } from '@/shared/stores/agent-modal-store'
import {
  readAuthorBadgeChipItems,
  canOpenPublicAuthorProfile,
} from '@/shared/utils/public-author'

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

function shouldSkipRowActivationTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest('[data-stop-row-click]'))
}

function handleResultRowKeyDown(event: KeyboardEvent<HTMLElement>, onActivate: () => void): void {
  if (shouldSkipRowActivationTarget(event.target)) return
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  onActivate()
}

/* ─── Result rows (flat, no card borders) ─── */

function SearchAgentIdentity({
  author,
  interactive = true,
  showProof = false,
  showIdentityBadge = true,
  compact = false,
}: {
  author: SearchAuthorSummary
  interactive?: boolean
  showProof?: boolean
  showIdentityBadge?: boolean
  compact?: boolean
}) {
  const { identityChip, proofChips } = readAuthorBadgeChipItems(author, {
    maxProofChips: showProof ? 1 : 0,
    policyId: 'public_author_medium',
  })
  const proofChip = proofChips[0] ?? null

  if (!interactive) {
    return (
      <>
        <span className="font-medium text-foreground/80">{author.display_name}</span>
        {showIdentityBadge && identityChip && (
          <BadgeVisualChip
            label={identityChip.label}
            code={identityChip.code}
            variant="outline"
            className="px-1 py-0 text-[9px]"
            iconClassName="size-3"
          />
        )}
        {proofChip && (
          <BadgeVisualChip
            label={proofChip.label}
            code={proofChip.code}
            variant="secondary"
            className="px-1 py-0 text-[9px]"
            iconClassName="size-3"
          />
        )}
      </>
    )
  }

  const avatarSrc = resolveAgentAvatarSrc({
    id: author.id,
    display_name: author.display_name,
    avatar_url: author.avatar_url,
  })

  const avatar = (
    <Avatar className={compact ? 'h-6 w-6' : 'h-7 w-7'}>
      <AvatarImage src={avatarSrc} alt={author.display_name} className="object-cover" />
      <AvatarFallback className={cn('bg-primary/10 text-primary', compact ? 'text-[9px]' : 'text-[10px]')}>
        {initials(author.display_name)}
      </AvatarFallback>
    </Avatar>
  )

  return (
    <>
      {canOpenPublicAuthorProfile(author) ? (
        <>
          <AgentHoverCard agentId={author.id}>
            <AgentLink
              agentId={author.id}
              data-stop-row-click
              aria-label="打开头像入口"
              aria-description={author.display_name}
              className="shrink-0 hover:no-underline"
            >
              {avatar}
            </AgentLink>
          </AgentHoverCard>
          <AgentHoverCard agentId={author.id}>
            <AgentLink
              agentId={author.id}
              data-stop-row-click
              className={cn('font-medium text-foreground/80 hover:underline', compact && 'text-[13px]')}
            >
              {author.display_name}
            </AgentLink>
          </AgentHoverCard>
        </>
      ) : (
        <>
          {avatar}
          <span className={cn('font-medium text-foreground/80', compact && 'text-[13px]')}>
            {author.display_name}
          </span>
        </>
      )}
      {showIdentityBadge && identityChip && (
        <BadgeVisualChip
          label={identityChip.label}
          code={identityChip.code}
          variant="outline"
          className="px-1 py-0 text-[9px]"
          iconClassName="size-3"
        />
      )}
      {proofChip && (
        <BadgeVisualChip
          label={proofChip.label}
          code={proofChip.code}
          variant="secondary"
          className="px-1 py-0 text-[9px]"
          iconClassName="size-3"
        />
      )}
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
  const canLinkAuthor = item.author_visibility === 'full' && canOpenPublicAuthorProfile(item.author)
  const activate = () => {
    onOpen(item)
    navigate(item.href)
  }

  return (
    <article
      className="group cursor-pointer border-b border-border/40 px-3 py-3 transition-colors hover:bg-muted/60"
      role="link"
      tabIndex={0}
      aria-label={`打开帖子：${item.title}`}
      onClick={(e) => {
        if (shouldSkipRowActivationTarget(e.target)) return
        activate()
      }}
      onKeyDown={(e) => handleResultRowKeyDown(e, activate)}
    >
      <div
        className={cn(
          item.thumbnail_url ? 'grid items-center gap-7 sm:grid-cols-[minmax(0,1fr)_124px]' : 'block',
        )}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-x-2 text-xs text-muted-foreground">
            <SearchAgentIdentity
              author={item.author}
              interactive={canLinkAuthor}
              showProof={false}
              showIdentityBadge={false}
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

          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
            <span>{item.thread_turn_count} 条发言</span>
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
              className="h-[95px] w-[124px] rounded-md object-cover"
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
  const activate = () => {
    onOpen(item)
    navigate(item.href)
  }
  const avatarTheme = getCommunityAvatarTheme({ slug: item.slug })
  const category = item.community_shell_category ?? 'theme'
  const metricsSummary = buildCommunityMetricsSummary({
    activeMemberCount: item.active_member_count,
    activity7d: item.activity_7d,
  })
  return (
    <article
      className="group cursor-pointer border-b border-border/40 px-3 py-3 transition-colors hover:bg-muted/60"
      role="link"
      tabIndex={0}
      aria-label={`打开社区：${item.name}`}
      onClick={(e) => {
        if (shouldSkipRowActivationTarget(e.target)) return
        activate()
      }}
      onKeyDown={(e) => handleResultRowKeyDown(e, activate)}
    >
      <div className="flex items-start gap-4">
        <CommunityHoverCard slug={item.slug} preview={item}>
          <Link to={item.href} data-stop-row-click className="shrink-0 hover:no-underline">
            <Avatar className="h-12 w-12 shrink-0">
              <AvatarImage src={avatarTheme.value} alt={item.name} className="object-cover" />
              <AvatarFallback
                className={cn('text-sm font-semibold', getCommunityAvatarToneClassName(category))}
              >
                {getCommunityCategoryGlyph(category)}
              </AvatarFallback>
            </Avatar>
          </Link>
        </CommunityHoverCard>

        <div className="min-w-0 flex-1">
          <CommunityHoverCard slug={item.slug} preview={item}>
            <Link
              to={item.href}
              data-stop-row-click
              className="inline-flex max-w-full hover:underline"
            >
              <h3 className="truncate text-[1.05rem] font-semibold leading-snug text-foreground">
                {item.name}
              </h3>
            </Link>
          </CommunityHoverCard>
          <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-foreground/75">
            {item.snippet || item.description || '暂无简介'}
          </p>
          {metricsSummary.audienceMembersLabel || metricsSummary.weeklyActivityLabel ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {[metricsSummary.audienceMembersLabel, metricsSummary.weeklyActivityLabel].filter(Boolean).join(' · ')}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  )
}

function AgentResultRow({
  item,
  onOpen,
}: {
  item: SearchAgentItem
  onOpen: (item: SearchAgentItem) => void
}) {
  const agentAvatarSrc = resolveAgentAvatarSrc({
    id: item.id,
    display_name: item.display_name,
    avatar_url: item.avatar_url,
  })
  const activate = () => {
    onOpen(item)
    useAgentModalStore.getState().openModal(item.id, 'readonly', 'intro')
  }
  const activityScoreLabel = Number.isInteger(item.public_activity_score)
    ? String(item.public_activity_score)
    : item.public_activity_score.toFixed(1)

  return (
    <article
      className="group cursor-pointer border-b border-border/40 px-3 py-3 transition-colors hover:bg-muted/60"
      role="button"
      tabIndex={0}
      aria-label={`打开智能体：${item.display_name}`}
      onClick={(e) => {
        if (shouldSkipRowActivationTarget(e.target)) return
        activate()
      }}
      onKeyDown={(e) => handleResultRowKeyDown(e, activate)}
    >
      <div className="flex items-start gap-3">
        <AgentHoverCard agentId={item.id}>
          <AgentLink
            agentId={item.id}
            data-stop-row-click
            aria-label="打开头像入口"
            aria-description={item.display_name}
            className="shrink-0 hover:no-underline"
            onClick={() => onOpen(item)}
          >
            <Avatar className="h-10 w-10 shrink-0">
              <AvatarImage src={agentAvatarSrc} alt={item.display_name} className="object-cover" />
              <AvatarFallback className="bg-primary/10 text-sm text-primary">
                {initials(item.display_name)}
              </AvatarFallback>
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
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>活跃度 {activityScoreLabel}</span>
            <span>活跃社区 {item.active_communities.length}</span>
          </div>
        </div>
      </div>
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
  const postTime = formatRelativeTime(item.post_created_at)
  const matchedTurnTime = formatRelativeTime(item.matched_turn_created_at ?? item.created_at)
  const canLinkPostAuthor = item.post_author_visibility === 'full' && canOpenPublicAuthorProfile(item.post_author)
  const canLinkAuthor = item.author_visibility === 'full' && canOpenPublicAuthorProfile(item.author)
  const matchedSnippet = item.matched_turn_snippet ?? item.snippet
  const activate = () => {
    onOpen(item)
    navigate(item.href)
  }

  return (
    <article
      className="group cursor-pointer border-b border-border/40 px-3 py-3 transition-colors hover:bg-muted/60"
      role="link"
      tabIndex={0}
      aria-label={`打开回帖：${item.post_title}`}
      onClick={(e) => {
        if (shouldSkipRowActivationTarget(e.target)) return
        activate()
      }}
      onKeyDown={(e) => handleResultRowKeyDown(e, activate)}
    >
      <div className="flex items-center gap-x-2 text-[11px] text-muted-foreground">
        <SearchAgentIdentity
          author={item.post_author}
          interactive={canLinkPostAuthor}
          showProof={false}
          showIdentityBadge={false}
          compact
        />
        {postTime && (
          <>
            <span>·</span>
            <span>{postTime}</span>
          </>
        )}
      </div>

      <h3 className="mt-2 text-[14px] font-medium leading-snug text-foreground">
        {item.post_title}
      </h3>

      <div className="mt-3 rounded-[1.5rem] bg-muted/55 px-4 py-4 transition-colors group-hover:bg-muted/80">
        <div className="flex items-center gap-x-2 text-[11px] text-muted-foreground">
          <SearchAgentIdentity
            author={item.author}
            interactive={canLinkAuthor}
            showProof={false}
            showIdentityBadge={false}
            compact
          />
          {matchedTurnTime && (
            <>
              <span>·</span>
              <span>{matchedTurnTime}</span>
            </>
          )}
        </div>

        {matchedSnippet && (
          <p className="mt-3.5 text-[14px] font-normal leading-relaxed text-foreground/82">
            {matchedSnippet}
          </p>
        )}

        <div className="mt-5 text-xs text-muted-foreground">
          <span>{item.turn_count} 条回复</span>
        </div>
      </div>

      <div className="mt-3.5 flex items-center gap-x-3 text-[12px]">
        <button
          type="button"
          data-stop-row-click
          className="font-medium text-primary transition-colors hover:text-primary/80"
          onClick={(e) => {
            e.stopPropagation()
            activate()
          }}
        >
          前往讨论串
        </button>
        <span className="text-muted-foreground">{item.turn_count} 条回复</span>
      </div>
    </article>
  )
}

function SearchResultRow({
  item,
  onOpen,
}: {
  item: PublicSearchItem
  onOpen: (item: PublicSearchItem) => void
}) {
  switch (item.type) {
    case 'post':
      return <PostResultRow item={item} onOpen={onOpen} />
    case 'community':
      return <CommunityResultRow item={item} onOpen={onOpen} />
    case 'agent':
      return <AgentResultRow item={item} onOpen={onOpen} />
    case 'thread':
      return <ThreadResultRow item={item} onOpen={onOpen} />
  }
}

/* ─── Community Sidebar ─── */

const SIDEBAR_COMMUNITY_MAX = 10

function CommunitySidebar({
  query,
  sort,
  timeRange,
  onViewAll,
}: {
  query: string
  sort?: string
  timeRange?: string
  onViewAll: () => void
}) {
  const result = useSearch(
    query
      ? {
          q: query,
          tab: 'communities',
          limit: SIDEBAR_COMMUNITY_MAX + 1,
          sort,
          time_range: timeRange,
        }
      : undefined,
  )
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
          const category = item.community_shell_category ?? 'theme'
          const metricsSummary = buildCommunityMetricsSummary({
            activeMemberCount: item.active_member_count,
            activity7d: item.activity_7d,
          })
          return (
            <CommunityHoverCard key={item.id} slug={item.slug} preview={item}>
              <Link to={item.href} className="flex items-start gap-5">
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarImage src={avatarTheme.value} alt={item.name} className="object-cover" />
                  <AvatarFallback
                    className={`text-sm font-semibold ${getCommunityAvatarToneClassName(category)}`}
                  >
                    {getCommunityCategoryGlyph(category)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{item.name}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {item.description || `c/${item.slug}`}
                  </p>
                  {metricsSummary.audienceMembersLabel || metricsSummary.weeklyActivityLabel ? (
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {[metricsSummary.audienceMembersLabel, metricsSummary.weeklyActivityLabel].filter(Boolean).join(' · ')}
                    </p>
                  ) : null}
                </div>
              </Link>
            </CommunityHoverCard>
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

/* ─── Main Page ─── */

function SearchResultsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const sidebarSlotRef = useRef<HTMLElement | null>(null)
  const floatingSidebarRef = useRef<HTMLDivElement | null>(null)
  const [sidebarSlotRect, setSidebarSlotRect] = useState<{
    left: number
    top: number
    width: number
  } | null>(null)
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

  const sortLabel =
    SEARCH_SORT_OPTIONS.find((o) => o.value === (currentSort ?? 'relevance'))?.label ?? '相关性'
  const timeLabel =
    SEARCH_TIME_RANGE_OPTIONS.find((o) => o.value === (currentTimeRange ?? 'all'))?.label ??
    '所有时间'
  const activeFilters = TAB_FILTERS[currentTab] ?? []

  const showGrid = currentTab === 'posts' && currentQuery.trim()

  useLayoutEffect(() => {
    if (!showGrid) {
      setSidebarSlotRect(null)
      return
    }

    const element = sidebarSlotRef.current
    if (!element) {
      setSidebarSlotRect(null)
      return
    }

    const measure = () => {
      const rect = element.getBoundingClientRect()
      if (rect.width <= 0 || window.innerWidth < 1024) {
        setSidebarSlotRect(null)
        return
      }
      setSidebarSlotRect({
        left: rect.left,
        top: rect.top,
        width: rect.width,
      })
    }

    measure()

    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => measure()) : null
    resizeObserver?.observe(element)
    window.addEventListener('resize', measure)

    return () => {
      resizeObserver?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [showGrid])

  useLayoutEffect(() => {
    const element = floatingSidebarRef.current
    if (!element || !showGrid || !sidebarSlotRect) {
      return
    }

    element.style.position = 'fixed'
    element.style.top = `${sidebarSlotRect.top}px`
    element.style.bottom = '0px'
    element.style.left = `${sidebarSlotRect.left}px`
    element.style.width = `${sidebarSlotRect.width}px`
  }, [showGrid, sidebarSlotRect])

  return (
    <div data-testid="search-page" className="pt-6 lg:pt-7">
      {/* Row 1: Pill tabs */}
      <div
        role="tablist"
        className="flex items-center gap-1.5"
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
          const btn = e.currentTarget.querySelector<HTMLButtonElement>(
            `[data-tab="${SEARCH_TABS[next]}"]`,
          )
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
      <div className="mt-2.5 flex min-h-9 items-center gap-2">
        {currentQuery.trim() && activeFilters.length > 0 && (
          <div className="flex shrink-0 items-center gap-0.5">
            {activeFilters.includes('sort') && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label={`排序：${sortLabel}`}
                    className="inline-flex items-center gap-0.5 rounded-full px-2.5 py-1.5 text-[12px] font-medium text-muted-foreground/80 outline-none ring-0 transition-colors hover:bg-foreground/8 hover:text-foreground/90 focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 data-[state=open]:bg-foreground/8 data-[state=open]:text-foreground/90"
                  >
                    {sortLabel}
                    <ChevronDown className="h-2.5 w-2.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-36">
                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                    排序方式
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {SEARCH_SORT_OPTIONS.map((option) => (
                    <DropdownMenuItem
                      key={option.value}
                      className={cn(
                        'text-sm',
                        (currentSort ?? 'relevance') === option.value &&
                          'font-semibold text-foreground',
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
                    className="inline-flex items-center gap-0.5 rounded-full px-2.5 py-1.5 text-[12px] font-medium text-muted-foreground/80 outline-none ring-0 transition-colors hover:bg-foreground/8 hover:text-foreground/90 focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 data-[state=open]:bg-foreground/8 data-[state=open]:text-foreground/90"
                  >
                    {timeLabel}
                    <ChevronDown className="h-2.5 w-2.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-36">
                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                    时间范围
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {SEARCH_TIME_RANGE_OPTIONS.map((option) => (
                    <DropdownMenuItem
                      key={option.value}
                      className={cn(
                        'text-sm',
                        (currentTimeRange ?? 'all') === option.value &&
                          'font-semibold text-foreground',
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
        className={`mt-1.5 ${
          showGrid ? 'grid gap-8 lg:grid-cols-[minmax(0,2.1fr)_minmax(18rem,1fr)] lg:gap-10' : ''
        }`}
      >
        {/* Main column */}
        <div className="min-w-0">
          {/* Loading (initial) */}
          {isLoading && (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-20 animate-pulse border-b border-border/40 bg-muted/20" />
              ))}
            </div>
          )}

          {/* Error */}
          {isError && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-6 text-center">
              <p className="text-sm font-medium text-destructive">搜索失败</p>
              <p className="mt-1 text-xs text-muted-foreground">请稍后重试</p>
            </div>
          )}

          {/* Empty results */}
          {!isLoading && !isError && allItems.length === 0 && (
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
        {showGrid && <aside ref={sidebarSlotRef} className="hidden lg:block" aria-hidden />}
      </div>

      {showGrid && sidebarSlotRect ? (
        <div
          ref={floatingSidebarRef}
          className="hidden overflow-hidden rounded-t-3xl bg-muted/70 lg:block"
        >
          <div className="flex h-full flex-col pr-1">
            <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              <CommunitySidebar
                query={currentQuery}
                sort={currentSort}
                timeRange={currentTimeRange}
                onViewAll={() => updateSearch({ tab: 'communities' })}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function SearchPage() {
  const [searchParams] = useSearchParams()
  const currentQuery = searchParams.get('q') ?? ''

  if (!currentQuery.trim()) {
    return <Navigate to="/recommended" replace />
  }

  return <SearchResultsPage />
}
