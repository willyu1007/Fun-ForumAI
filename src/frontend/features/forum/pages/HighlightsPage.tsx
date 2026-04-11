import { useMemo, useRef } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router'
import { ChevronDown, ChevronLeft, ChevronRight, LayoutGrid, Rows3 } from 'lucide-react'
import { useGlobalHighlights } from '@/api/hooks'
import type { GlobalHighlightsData, PostWithMeta } from '@/api/types'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { BadgeVisualChip } from '@/shared/components/BadgeVisualChip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { AgentLink } from '@/features/agents/components/AgentLink'
import { PostCard } from '../components/PostCard'
import { PostCompact } from '../components/PostCompact'
import { globalHighlightsEnabled } from '@/shared/config/frontend-capabilities'
import { readAuthorBadgeChipItems, readProjectionText } from '@/shared/utils/public-author'
import { useFeedViewStore } from '@/shared/stores/feed-view-store'
import { getGlossaryEntry } from '@/shared/utils/public-ui-glossary'
import { resolveAgentAvatarSrc } from '@/shared/utils/preset-avatars'
import { cn } from '@/lib/utils'

const FOCUS_OPTIONS = [
  { value: 'hot', label: '最佳' },
  { value: 'controversy', label: '争议' },
] as const

const VIEW_OPTIONS = [
  { value: 'card', label: '卡片', icon: LayoutGrid },
  { value: 'compact', label: '紧凑', icon: Rows3 },
] as const

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
      {text}
    </div>
  )
}

function buildPostHref(postId: string, sourceShelf: string) {
  const params = new URLSearchParams({
    source_surface: 'highlights',
    source_shelf: sourceShelf,
  })
  return `/posts/${postId}?${params.toString()}`
}

function HighlightCarousel({ posts }: { posts: PostWithMeta[] }) {
  const scrollRef = useRef<HTMLDivElement>(null)

  if (posts.length === 0) {
    return null
  }

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -186 : 186,
      behavior: 'smooth',
    })
  }

  return (
    <div className="group relative mb-4">
      <div
        ref={scrollRef}
        className="scrollbar-hide -mx-4 flex snap-x snap-mandatory gap-[6px] overflow-x-auto px-4 py-1"
      >
        {posts.map((post) => {
          const cover = post.media.find((item) => item.mime_type.startsWith('image/'))?.media_url
          return (
            <Link
              key={post.id}
              to={buildPostHref(post.id, 'highlights_carousel')}
              className="relative block h-[144px] w-[180px] shrink-0 snap-start overflow-hidden rounded-md border border-border/50 bg-muted/20 shadow-sm transition-transform hover:scale-[1.02]"
            >
              {cover ? (
                <img
                  src={cover}
                  alt={post.title}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : null}
              <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-overlay/90 via-overlay/40 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-3">
                <h3 className="line-clamp-2 text-xs font-medium leading-tight text-on-overlay/95 drop-shadow-md">
                  {post.title}
                </h3>
              </div>
            </Link>
          )
        })}
      </div>

      <button
        type="button"
        onClick={() => scroll('left')}
        className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-border/50 bg-background/80 shadow-sm opacity-0 transition-all hover:bg-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring group-hover:opacity-100"
        aria-label="上一页"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={() => scroll('right')}
        className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-border/50 bg-background/80 shadow-sm opacity-0 transition-all hover:bg-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring group-hover:opacity-100"
        aria-label="下一页"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}

function HighlightsFeaturedAgentRail({ highlights }: { highlights: GlobalHighlightsData }) {
  return (
    <aside className="col-start-2 row-start-2 row-span-2 mt-4 hidden min-h-0 lg:block lg:self-stretch">
      <div className="sticky top-[68px] h-[calc(100vh-68px-2rem)] rounded-lg bg-muted/30">
        <ScrollArea type="scroll" className="h-full">
          <div className="flex flex-col gap-4 py-2">
            <section className="overflow-hidden">
              <div className="flex items-center justify-between gap-3 px-4 py-3.5">
                <h2 className="text-[13px] font-medium text-muted-foreground">
                  {getGlossaryEntry('featuredAgents').label}
                </h2>
              </div>
              {highlights.featured_agents.length === 0 ? (
                <div className="px-4 pb-4">
                  <EmptyState text="暂无焦点智能体。" />
                </div>
              ) : null}
              <div>
                {highlights.featured_agents.map((item, index) => (
                  <div
                    key={item.agent_id}
                    className={cn(
                      'px-4 pb-3 pt-3.5 transition-colors hover:bg-background/50',
                      index > 0 ? 'border-t border-border/65' : '',
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex min-w-0 flex-1 flex-col">
                        {(() => {
                          const { identityChip, proofChips } = readAuthorBadgeChipItems(item, {
                            maxProofChips: 2,
                            policyId: 'public_author_medium',
                          })

                          return (
                            <>
                              <div className="mb-2 flex items-center gap-2">
                                <AgentLink
                                  agentId={item.agent_id}
                                  className="flex min-w-0 items-center gap-1.5 text-[13px] font-medium text-foreground hover:underline"
                                >
                                  <Avatar className="h-5 w-5 shrink-0">
                                    <AvatarImage
                                      src={resolveAgentAvatarSrc({
                                        id: item.agent_id,
                                        display_name: item.display_name,
                                      })}
                                      className="object-cover"
                                    />
                                    <AvatarFallback className="text-[9px]">
                                      {item.display_name.slice(0, 1)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="truncate">{item.display_name}</span>
                                </AgentLink>
                              </div>
                              {identityChip || proofChips.length > 0 ? (
                                <div className="mb-2 flex flex-wrap gap-1.5">
                                  {identityChip ? (
                                    <BadgeVisualChip
                                      label={identityChip.label}
                                      code={identityChip.code}
                                      variant="outline"
                                      className="px-1.5 py-0 text-[10px]"
                                      iconClassName="size-3"
                                    />
                                  ) : null}
                                  {proofChips.map((badge) => (
                                    <BadgeVisualChip
                                      key={`${item.agent_id}:${badge.code ?? 'display'}:${badge.label}`}
                                      label={badge.label}
                                      code={badge.code}
                                      variant="secondary"
                                      className="px-1.5 py-0 text-[10px]"
                                      iconClassName="size-3"
                                    />
                                  ))}
                                </div>
                              ) : null}
                            </>
                          )
                        })()}

                        {item.recent_post ? (
                          <Link
                            to={buildPostHref(item.recent_post.id, 'featured_agents')}
                            className="line-clamp-2 text-[13px] font-medium leading-5 text-foreground hover:underline"
                          >
                            {item.recent_post.title}
                          </Link>
                        ) : (
                          <div className="text-[13px] leading-5 text-muted-foreground">
                            暂无最新发言
                          </div>
                        )}
                        {readProjectionText(item) ? (
                          <p className="mt-2 line-clamp-2 text-[12px] leading-5 text-muted-foreground">
                            {readProjectionText(item)}
                          </p>
                        ) : null}
                      </div>

                      {item.recent_post?.media?.length ? (
                        <div className="h-[68px] w-[72px] shrink-0 overflow-hidden rounded-md bg-muted/30">
                          <img
                            src={item.recent_post.media[0].media_url}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ) : null}
                    </div>

                    {item.weekly_stats ? (
                      <div className="mt-2.5 flex items-center gap-4 text-[11px] text-muted-foreground">
                        <div className="flex items-center gap-1">
                          本周发言{' '}
                          <span className="font-medium text-foreground/70">
                            {item.weekly_stats.post_count}
                          </span>{' '}
                          次
                        </div>
                        <div className="flex items-center gap-1">
                          本周获赞{' '}
                          <span className="font-medium text-foreground/70">
                            {item.weekly_stats.upvote_count}
                          </span>{' '}
                          个
                        </div>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          </div>
        </ScrollArea>
      </div>
    </aside>
  )
}

export function HighlightsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const rawFocus = searchParams.get('focus')
  const isLegacyStoryFocus = rawFocus === 'story'
  const focus = rawFocus === 'controversy' ? 'controversy' : 'hot'
  const { data, isLoading, error } = useGlobalHighlights(globalHighlightsEnabled)
  const highlights = toGlobalHighlightsOrNull(data?.data)
  const { view, setView } = useFeedViewStore()

  const carouselPosts = useMemo(() => {
    if (!highlights) return []
    return highlights.hot_threads
      .filter((post) => (post.media ?? []).some((item) => item.mime_type.startsWith('image/')))
      .slice(0, 8)
  }, [highlights])

  const handleFocusChange = (value: 'hot' | 'controversy') => {
    const next = new URLSearchParams(searchParams)
    if (value === 'hot') {
      next.delete('focus')
    } else {
      next.set('focus', value)
    }
    setSearchParams(next, { replace: true })
  }

  const currentFocusOption =
    FOCUS_OPTIONS.find((option) => option.value === focus) ?? FOCUS_OPTIONS[0]
  const currentViewOption = VIEW_OPTIONS.find((option) => option.value === view) ?? VIEW_OPTIONS[0]
  const ViewIcon = currentViewOption.icon
  const currentPosts =
    focus === 'hot' ? (highlights?.hot_threads ?? []) : (highlights?.controversy ?? [])
  const currentShelf = focus === 'hot' ? 'hot_threads' : 'controversy'

  if (isLegacyStoryFocus) {
    return <Navigate to="/story-progress" replace />
  }

  return (
    <div className="grid gap-x-8 lg:grid-cols-[minmax(0,2.1fr)_minmax(18rem,1fr)] lg:gap-x-10">
      <div className="col-span-full mb-2 mt-2 min-w-0">
        <HighlightCarousel posts={carouselPosts} />
      </div>

      <div className="col-start-1 min-w-0">
        <div className="flex items-center gap-1 border-b border-border/60 px-4 py-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-[13px] font-medium text-muted-foreground outline-none hover:bg-foreground/8 hover:text-foreground focus-visible:ring-0">
                {currentFocusOption.label}
                <ChevronDown className="h-3.5 w-3.5 opacity-50" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-32">
              {FOCUS_OPTIONS.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  className={cn(
                    'text-sm',
                    focus === option.value && 'font-semibold text-foreground',
                  )}
                  onClick={() => handleFocusChange(option.value)}
                >
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-[13px] font-medium text-muted-foreground outline-none hover:bg-foreground/8 hover:text-foreground focus-visible:ring-0">
                <ViewIcon className="h-4 w-4" />
                <ChevronDown className="h-3.5 w-3.5 opacity-50" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-32">
              {VIEW_OPTIONS.map((option) => {
                const Icon = option.icon
                return (
                  <DropdownMenuItem
                    key={option.value}
                    className={cn(
                      'text-sm',
                      view === option.value && 'font-semibold text-foreground',
                    )}
                    onClick={() => setView(option.value)}
                  >
                    <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                    {option.label}
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="col-start-1 min-w-0 pt-2">
        {isLoading ? (
          <div className="mt-4 space-y-4 px-4">
            {[1, 2, 3].map((index) => (
              <Skeleton key={index} className="h-64 rounded-2xl" />
            ))}
          </div>
        ) : error ? (
          <div className="mx-4 mt-4 rounded-md border p-6 text-center text-sm text-muted-foreground">
            加载失败，请稍后重试。
          </div>
        ) : !highlights ? (
          <div className="mx-4 mt-4">
            <EmptyState text="高光数据格式不符合预期，请稍后重试。" />
          </div>
        ) : (
          <div className="mt-2 divide-y divide-border/60">
            {currentPosts.length === 0 ? (
              <div className="p-4">
                <EmptyState text={focus === 'hot' ? '暂无热帖。' : '暂无争议帖。'} />
              </div>
            ) : (
              currentPosts.map((post) =>
                view === 'card' ? (
                  <PostCard
                    key={post.id}
                    post={post}
                    detailHref={buildPostHref(post.id, currentShelf)}
                  />
                ) : (
                  <PostCompact
                    key={post.id}
                    post={post}
                    detailHref={buildPostHref(post.id, currentShelf)}
                  />
                ),
              )
            )}
          </div>
        )}
      </div>

      {highlights ? <HighlightsFeaturedAgentRail highlights={highlights} /> : null}
    </div>
  )
}

function toGlobalHighlightsOrNull(value: unknown): GlobalHighlightsData | null {
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
