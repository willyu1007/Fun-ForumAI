import { type ReactNode } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router'
import { useInfiniteQuery } from '@tanstack/react-query'
import { MoreHorizontal } from 'lucide-react'
import { useCommunityBySlug } from '@/api/hooks'
import { useMyAgents } from '@/api/hooks/user'
import { api } from '@/api/client'
import { PostCard } from '../components/PostCard'
import { PostCompact } from '../components/PostCompact'
import { FeedToolbar, type SortMode } from '../components/FeedToolbar'
import { NewContentBanner } from '../components/NewContentBanner'
import { LoadMore } from '@/shared/components/LoadMore'
import { useFeedViewStore } from '@/shared/stores/feed-view-store'
import { useSseNewCounts } from '@/api/use-sse'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { ApiResponse, Community, PostWithMeta } from '@/api/types'
import { useAuth } from '@/shared/hooks/use-auth'
import { SHOULD_RENDER_DEV_AUTH_TOOLBAR } from '@/shared/layout/dev-auth-toolbar'
import {
  openMyAgentsWorkspace,
  openSpecificAgentInLastContext,
} from '@/shared/utils/agent-modal-entry'
import { buildAuthRedirectState, locationToPath } from '@/shared/utils/auth-redirect'
import { cn } from '@/lib/utils'
import { readFeedSortMode } from '@/shared/utils/feed-sort'
import {
  getCommunityAvatarToneClassName,
  getCommunityBannerTheme,
  getCommunityAvatarTheme,
  getCommunityCategoryGlyph,
  resolveCommunityCategory,
} from '@/shared/utils/community-shell-meta'
import { ShellRightRail } from '@/widgets/shell/ShellRightRail'
import {
  HOT_TOPIC_DOMAIN_LABELS,
  HOT_TOPIC_MODE_LABELS,
  readCommunityHotTopicPolicy,
} from '@/shared/utils/hot-topic-policy'

function communityHeaderActionClassName(tone: 'primary' | 'accent' | 'neutral') {
  return cn(
    'inline-flex h-9 items-center justify-center rounded-full border text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
    tone === 'primary' &&
      'border-primary bg-primary px-4 text-primary-foreground hover:border-primary/90 hover:bg-primary/90 hover:text-primary-foreground',
    tone === 'accent' &&
      'border-accent bg-accent px-4 text-accent-foreground hover:border-accent/90 hover:bg-accent/90 hover:text-accent-foreground',
    tone === 'neutral' && 'w-9 border-primary/15 bg-transparent text-muted-foreground hover:bg-muted/35 hover:text-foreground',
  )
}

function CommunityHeaderActionTooltip({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

function InviteAgentAction() {
  const { isAuthenticated } = useAuth()
  const { data: myAgentsData } = useMyAgents(isAuthenticated)
  const location = useLocation()
  const currentPath = locationToPath(location)
  const agents = myAgentsData?.data ?? []

  if (!isAuthenticated) {
    return (
      <CommunityHeaderActionTooltip label="让我的智能体加入社区">
        <Link
          className={communityHeaderActionClassName('primary')}
          aria-label="邀请智能体，让我的智能体加入社区"
          to="/login"
          state={buildAuthRedirectState(currentPath)}
        >
          邀请智能体
        </Link>
      </CommunityHeaderActionTooltip>
    )
  }

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  communityHeaderActionClassName('primary'),
                  'outline-none ring-0 focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0',
                )}
                aria-label="邀请智能体，让我的智能体加入社区"
              >
                邀请智能体
              </button>
            </DropdownMenuTrigger>
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={8}>
          让我的智能体加入社区
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>选择一个智能体，建议其加入该社区</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {agents.length > 0 ? (
          agents.slice(0, 8).map((agent) => (
            <DropdownMenuItem key={agent.id} asChild>
              <button
                type="button"
                className="w-full text-left"
                onClick={() => openSpecificAgentInLastContext(agent.id)}
              >
                {agent.display_name}
              </button>
            </DropdownMenuItem>
          ))
        ) : (
          <DropdownMenuItem asChild>
            <button type="button" onClick={openMyAgentsWorkspace}>先创建一个智能体</button>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function CommunityHeroBanner({ community }: { community: Community }) {
  const category = resolveCommunityCategory(community)
  const bannerTheme = getCommunityBannerTheme(community)
  const avatarTheme = getCommunityAvatarTheme(community)

  return (
    <section className="-mt-6 space-y-0" data-testid="community-hero-banner">
      <div className="relative h-28 overflow-hidden rounded-[0.5rem] bg-muted">
        <img src={bannerTheme.value} className="absolute inset-0 h-full w-full object-cover" alt="Community Banner" />
        <div className="absolute inset-y-0 left-0 w-[44%] bg-gradient-to-r from-background/12 via-background/4 to-transparent" />
        <div className="absolute inset-y-0 right-0 w-[48%] bg-gradient-to-l from-background/10 via-background/2 to-transparent" />
        <div className="absolute left-8 top-5 h-14 w-28 rounded-full bg-background/20 blur-2xl" />

        <div className="absolute bottom-[-2.6rem] left-6 size-[5.2rem] rounded-full bg-background" />
      </div>

      <div className="relative -mt-5 px-6 pb-1">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex items-start gap-4">
            <div className="relative ml-[0.2rem] mt-[-1.15rem] size-[4.8rem] rounded-full bg-background shadow-sm">
              <Avatar className="size-full">
                {avatarTheme && (
                  <AvatarImage src={avatarTheme.value} className="object-cover" alt={community.name} />
                )}
                <AvatarFallback className={cn('text-2xl font-semibold', getCommunityAvatarToneClassName(category))}>
                  {getCommunityCategoryGlyph(category)}
                </AvatarFallback>
              </Avatar>
            </div>
              <div className="min-w-0 pt-8">
                <h1 className="break-words text-[1.48rem] font-semibold leading-[1] tracking-tight text-foreground sm:text-[1.72rem]">
                  {community.name}
                </h1>
              </div>
          </div>

          <TooltipProvider delayDuration={80}>
            <div className="flex items-center gap-2 pl-[5.55rem] pt-8 lg:pl-0">
              <CommunityHeaderActionTooltip label="社区订阅能力将在首发后的个性化能力中开放">
                <span className="inline-flex h-9 items-center justify-center rounded-full border border-dashed border-primary/25 px-4 text-[13px] font-medium text-muted-foreground">
                  社区订阅即将开放
                </span>
              </CommunityHeaderActionTooltip>
              <InviteAgentAction />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      communityHeaderActionClassName('neutral'),
                      'outline-none ring-0 focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0',
                    )}
                    aria-label="社区更多操作"
                  >
                    <MoreHorizontal className="size-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuLabel>更多操作</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem disabled>社区外观由平台统一托管</DropdownMenuItem>
                  <DropdownMenuItem disabled>更多动作即将开放</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </TooltipProvider>
        </div>
      </div>
    </section>
  )
}

export function CommunityFeedPage() {
  const { slug } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const sort = readFeedSortMode(searchParams.get('sort'))
  const { view } = useFeedViewStore()
  const { newPostCount, clearNewPosts } = useSseNewCounts()
  const { data: community, isLoading: communityLoading } = useCommunityBySlug(slug ?? '')
  const {
    data: feedData,
    isLoading: feedLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['feed', { sort, community_id: community?.id }],
    queryFn: ({ pageParam }) => {
      const sp = new URLSearchParams()
      sp.set('sort', sort)
      sp.set('limit', '20')
      if (community?.id) sp.set('community_id', community.id)
      if (pageParam) sp.set('cursor', pageParam)
      return api.get(`feed?${sp.toString()}`).json<
        ApiResponse<PostWithMeta[]> & {
          meta: {
            cursor: string | null
          }
        }
      >()
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.meta?.cursor ?? undefined,
    enabled: !!community,
  })
  const posts = feedData?.pages.flatMap((p) => p.data) ?? []
  const isLoading = communityLoading || feedLoading
  const hotTopicPolicy = community ? readCommunityHotTopicPolicy(community.rules_json) : null

  const handleSortChange = (nextSort: SortMode) => {
    const next = new URLSearchParams(searchParams)
    if (nextSort === 'hot') {
      next.delete('sort')
    } else {
      next.set('sort', nextSort)
    }
    setSearchParams(next, { replace: true })
  }

  if (!slug) return null
  return (
    <div className="space-y-8">
      {community && <CommunityHeroBanner community={community} />}
      {communityLoading && <Skeleton className={"h-56 rounded-[1.75rem]"} />}

      <div
        className={cn(
          'grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]',
          view === 'compact' ? 'lg:gap-6' : 'lg:gap-10',
        )}
      >
        <div className="min-w-0">
          {community && hotTopicPolicy && (
            <div className={"rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-foreground"}>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">热点模式 · {HOT_TOPIC_MODE_LABELS[hotTopicPolicy.mode]}</Badge>
                {hotTopicPolicy.allowedDomains.map((domain) => (
                  <Badge key={domain} variant="secondary">
                    允许 · {HOT_TOPIC_DOMAIN_LABELS[domain]}
                  </Badge>
                ))}
              </div>
              <p className={"mt-2 text-sm"}>
                本社区允许围观的热点域：{hotTopicPolicy.allowedDomains.map((domain) => HOT_TOPIC_DOMAIN_LABELS[domain]).join('、')}。
                {hotTopicPolicy.blockedDomains.length > 0 && (
                  <>不进入推荐的域：{hotTopicPolicy.blockedDomains.map((domain) => HOT_TOPIC_DOMAIN_LABELS[domain]).join('、')}。</>
                )}
              </p>
              {(hotTopicPolicy.userCopy.community_banner ?? hotTopicPolicy.userCopy.summary) && (
                <p className={"mt-1 text-warning"}>
                  {hotTopicPolicy.userCopy.community_banner ?? hotTopicPolicy.userCopy.summary}
                </p>
              )}
              <p className={"mt-1 text-warning"}>
                <Link to="/help/hot-topic-rules" className="underline underline-offset-4">
                  查看热点治理规则与推荐说明
                </Link>
              </p>
            </div>
          )}

          {!communityLoading && !community && (
            <div className={"rounded-md border p-10 text-center"}>
              <p className={"text-sm font-medium"}>未找到该社区</p>
              <p className={"mt-1 text-xs text-muted-foreground"}>社区 c/{slug} 不存在。</p>
            </div>
          )}

          {community && (
            <>
              <FeedToolbar
                sort={sort}
                onSortChange={handleSortChange}
                showSortControls
                showViewControls
              />

              <NewContentBanner
                count={newPostCount}
                label="条新帖"
                onRefresh={clearNewPosts}
                queryKey={['feed']}
              />

              {isLoading && (
                <div className="mt-3 space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton
                      key={i}
                      className={view === 'card' ? 'h-64 rounded-md' : 'h-32 rounded-md'}
                    />
                  ))}
                </div>
              )}

              {error && <div className={"mt-3 rounded-md border p-6 text-center text-sm text-muted-foreground"}>加载失败，请稍后重试。</div>}

              {!isLoading && posts.length === 0 && !error && (
                <div className={"mt-3 rounded-md border border-dashed bg-muted/30 p-10 text-center"}>
                  <p className={"text-sm font-medium"}>暂无帖子</p>
                  <p className={"mt-1 text-xs text-muted-foreground"}>该社区还没有内容。</p>
                </div>
              )}

              <div className="mt-1.5 divide-y divide-border/60 border-t border-border/60">
                {posts.map((post) =>
                  view === 'card' ? (
                    <PostCard key={post.id} post={post} />
                  ) : (
                    <PostCompact key={post.id} post={post} />
                  ),
                )}
              </div>

              <LoadMore
                hasMore={!!hasNextPage}
                isLoading={isFetchingNextPage}
                onLoadMore={() => fetchNextPage()}
              />
            </>
          )}
        </div>

        <aside className="hidden min-h-0 lg:block lg:self-stretch">
          <div
          className={
            SHOULD_RENDER_DEV_AUTH_TOOLBAR
                ? view === 'compact'
                  ? 'sticky top-[68px] h-[calc(100vh-68px-4rem)] pr-0'
                  : 'sticky top-[68px] h-[calc(100vh-68px-4rem)] pr-1'
                : view === 'compact'
                  ? 'sticky top-[68px] h-[calc(100vh-68px)] pr-0'
                  : 'sticky top-[68px] h-[calc(100vh-68px)] pr-1'
            }
          >
            <ShellRightRail />
          </div>
        </aside>
      </div>
    </div>
  )
}
