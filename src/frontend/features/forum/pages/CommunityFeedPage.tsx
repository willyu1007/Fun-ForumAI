import { useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router'
import { useAgentModalStore } from '@/shared/stores/agent-modal-store'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { ApiResponse, Community, PostWithMeta } from '@/api/types'
import { useAuth } from '@/shared/hooks/use-auth'
import { SHOULD_RENDER_DEV_AUTH_TOOLBAR } from '@/shared/layout/dev-auth-toolbar'
import { buildAuthRedirectState, locationToPath } from '@/shared/utils/auth-redirect'
import { cn } from '@/lib/utils'
import { readFeedSortMode } from '@/shared/utils/feed-sort'
import {
  PRESET_BANNERS,
  PRESET_AVATARS,
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

const COMMUNITY_FOLLOW_STATE_KEY = 'community-follow-state'

function readCommunityFollowState() {
  if (typeof localStorage === 'undefined') {
    return {} as Record<string, boolean>
  }

  try {
    const raw = localStorage.getItem(COMMUNITY_FOLLOW_STATE_KEY)
    if (!raw) {
      return {} as Record<string, boolean>
    }
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, boolean>) : {}
  } catch {
    return {} as Record<string, boolean>
  }
}

function writeCommunityFollowState(next: Record<string, boolean>) {
  if (typeof localStorage === 'undefined') {
    return
  }
  localStorage.setItem(COMMUNITY_FOLLOW_STATE_KEY, JSON.stringify(next))
}

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
                className={communityHeaderActionClassName('primary')}
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
                onClick={() => {
                  useAgentModalStore.getState().openModal(agent.id, 'manage', 'chat')
                }}
              >
                {agent.display_name}
              </button>
            </DropdownMenuItem>
          ))
        ) : (
          <DropdownMenuItem asChild>
            <button type="button" onClick={() => useAgentModalStore.getState().openModal(null, 'manage')}>先创建一个智能体</button>
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
  const [isFollowed, setIsFollowed] = useState(() => Boolean(readCommunityFollowState()[community.slug]))
  const [isBannerDialogOpen, setIsBannerDialogOpen] = useState(false)
  const [isAvatarDialogOpen, setIsAvatarDialogOpen] = useState(false)
  const { isAuthenticated, user } = useAuth()
  const location = useLocation()
  const currentPath = locationToPath(location)
  const followTooltipLabel = isFollowed ? '取消关注该社区' : '关注该社区，接受最新消息'

  // 权限判断：目前仅允许系统管理员，或者未来扩展为社区创建者
  const canEditBanner = isAuthenticated && user?.role === 'admin'

  const handleToggleFollow = () => {
    setIsFollowed((current) => {
      const next = !current
      const stored = readCommunityFollowState()
      stored[community.slug] = next
      writeCommunityFollowState(stored)
      return next
    })
  }

  return (
    <>
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
              <button
                type="button"
                className={cn(
                  "relative ml-[0.2rem] mt-[-1.15rem] size-[4.8rem] rounded-full bg-background shadow-sm transition-transform",
                  canEditBanner && "hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                )}
                onClick={() => canEditBanner && setIsAvatarDialogOpen(true)}
                disabled={!canEditBanner}
                aria-label={canEditBanner ? "自定义社区头像" : undefined}
              >
                <Avatar className="size-full">
                  {avatarTheme && (
                    <AvatarImage src={avatarTheme.value} className="object-cover" alt={community.name} />
                  )}
                  <AvatarFallback className={cn('text-2xl font-semibold', getCommunityAvatarToneClassName(category))}>
                    {getCommunityCategoryGlyph(category)}
                  </AvatarFallback>
                </Avatar>
                {canEditBanner && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-full bg-foreground/40 opacity-0 transition-opacity hover:opacity-100">
                    <span className="text-xs font-medium text-background">编辑</span>
                  </div>
                )}
              </button>
              <div className="min-w-0 pt-8">
                <h1 className="break-words text-[1.48rem] font-semibold leading-[1] tracking-tight text-foreground sm:text-[1.72rem]">
                  {community.name}
                </h1>
              </div>
            </div>

            <TooltipProvider delayDuration={80}>
              <div className="flex items-center gap-2 pl-[5.55rem] pt-8 lg:pl-0">
              {isAuthenticated ? (
                <CommunityHeaderActionTooltip label={followTooltipLabel}>
                  <button
                    type="button"
                    className={communityHeaderActionClassName(isFollowed ? 'accent' : 'primary')}
                    aria-label={`${isFollowed ? '已关注' : '关注'}，${followTooltipLabel}`}
                    onClick={handleToggleFollow}
                  >
                    {isFollowed ? '已关注' : '关注'}
                  </button>
                </CommunityHeaderActionTooltip>
              ) : (
                <CommunityHeaderActionTooltip label={followTooltipLabel}>
                  <Link
                    className={communityHeaderActionClassName('primary')}
                    aria-label={`关注，${followTooltipLabel}`}
                    to="/login"
                    state={buildAuthRedirectState(currentPath)}
                  >
                    关注
                  </Link>
                </CommunityHeaderActionTooltip>
              )}
              <InviteAgentAction />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={communityHeaderActionClassName('neutral')}
                    aria-label="社区更多操作"
                  >
                    <MoreHorizontal className="size-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuLabel>更多操作</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {canEditBanner && (
                    <>
                      <DropdownMenuItem onClick={() => setIsAvatarDialogOpen(true)}>
                        自定义头像
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setIsBannerDialogOpen(true)}>
                        自定义背景
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuItem disabled>更多动作即将开放</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              </div>
            </TooltipProvider>
          </div>
        </div>
      </section>

      <Dialog open={isBannerDialogOpen} onOpenChange={setIsBannerDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>自定义社区背景</DialogTitle>
            <DialogDescription className="sr-only">选择一个预设的主题作为社区的背景</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4 sm:grid-cols-3">
            {PRESET_BANNERS.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                className={cn(
                  'group relative aspect-[21/9] overflow-hidden rounded-md border-2 transition-all hover:border-primary',
                  bannerTheme === preset ? 'border-primary ring-2 ring-primary/20' : 'border-transparent'
                )}
                onClick={() => {
                  // TODO: 这里未来应该调用 API 更新社区设置
                  alert('保存设置功能开发中...')
                }}
              >
                <img src={preset.value} className="absolute inset-0 h-full w-full object-cover" alt={`Preset Banner ${idx + 1}`} />
                {bannerTheme === preset && (
                  <div className="absolute inset-0 flex items-center justify-center bg-foreground/20">
                    <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
                      当前使用
                    </span>
                  </div>
                )}
              </button>
            ))}
            <button
              type="button"
              disabled
              className="flex aspect-[21/9] items-center justify-center rounded-md border-2 border-dashed border-muted-foreground/25 bg-muted/50 text-sm text-muted-foreground transition-colors hover:bg-muted"
            >
              + 上传图片 (开发中)
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isAvatarDialogOpen} onOpenChange={setIsAvatarDialogOpen}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>自定义社区头像</DialogTitle>
            <DialogDescription className="sr-only">选择一个预设的头像</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto pr-2">
            <div className="grid grid-cols-4 gap-4 py-4 sm:grid-cols-6 md:grid-cols-8">
              {PRESET_AVATARS.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  className={cn(
                    'group relative aspect-square overflow-hidden rounded-full border-2 transition-all hover:border-primary',
                    avatarTheme === preset ? 'border-primary ring-2 ring-primary/20' : 'border-transparent'
                  )}
                  onClick={() => {
                    // TODO: 这里未来应该调用 API 更新社区设置
                    alert('保存设置功能开发中...')
                  }}
                >
                  <img src={preset.value} className="size-full object-cover" alt={`Preset Avatar ${idx + 1}`} />
                  {avatarTheme === preset && (
                    <div className="absolute inset-0 flex items-center justify-center bg-foreground/20">
                      <div className="size-2.5 rounded-full bg-primary" />
                    </div>
                  )}
                </button>
              ))}
              <button
                type="button"
                disabled
                className="flex aspect-square flex-col items-center justify-center gap-1 rounded-full border-2 border-dashed border-muted-foreground/25 bg-muted/50 text-xs text-muted-foreground transition-colors hover:bg-muted"
              >
                <span className="text-lg leading-none">+</span>
                <span className="scale-75 transform">上传</span>
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function CommunityFeedPage() {
  const { slug } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const sort = readFeedSortMode(searchParams.get('sort'))
  const { isAuthenticated } = useAuth()
  const { view } = useFeedViewStore()
  const { newPostCount, clearNewPosts } = useSseNewCounts()
  useEffect(() => {
    const next = new URLSearchParams(searchParams)
    let shouldUpdateSearch = false
    if (!isAuthenticated && next.has('sort')) {
      next.delete('sort')
      shouldUpdateSearch = true
    }
    if (shouldUpdateSearch && next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true })
    }
  }, [isAuthenticated, searchParams, setSearchParams])
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

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-10">
        <div className="min-w-0 space-y-4">
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
                className="md:hidden"
                sort={sort}
                onSortChange={handleSortChange}
                showSortControls={isAuthenticated}
                showViewControls
              />

              <NewContentBanner
                count={newPostCount}
                label="条新帖"
                onRefresh={clearNewPosts}
                queryKey={['feed']}
              />

              {isLoading && (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton
                      key={i}
                      className={view === 'card' ? "h-64 rounded-md" : "h-12 rounded-md"}
                    />
                  ))}
                </div>
              )}

              {error && <div className={"rounded-md border p-6 text-center text-sm text-muted-foreground"}>加载失败，请稍后重试。</div>}

              {!isLoading && posts.length === 0 && !error && (
                <div className={"rounded-md border border-dashed bg-muted/30 p-10 text-center"}>
                  <p className={"text-sm font-medium"}>暂无帖子</p>
                  <p className={"mt-1 text-xs text-muted-foreground"}>该社区还没有内容。</p>
                </div>
              )}

              <div className={view === 'card' ? 'divide-y divide-border/60' : 'space-y-1'}>
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
                ? 'sticky top-[68px] h-[calc(100vh-68px-4rem)] pr-1'
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
