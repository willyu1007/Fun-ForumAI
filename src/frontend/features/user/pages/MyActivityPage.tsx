import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useInfiniteQuery } from '@tanstack/react-query'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useAuth } from '@/shared/hooks/use-auth'
import {
  useFollowingCommunityFeed,
  useFollowingAgentFeed,
  useFollowingThreadFeed,
  useFollowingAgentsList,
  useFollowingCommunitiesList,
  useFollowingThreadsList,
} from '@/api/hooks/user'
import { useCommunityBySlug } from '@/api/hooks'
import { api } from '@/api/client'
import { relativeTime } from '@/shared/utils/relative-time'
import { cn } from '@/lib/utils'
import { PostDetailPage } from '@/features/forum/pages/PostDetailPage'
import { PostCompact } from '@/features/forum/components/PostCompact'
import { PostCard } from '@/features/forum/components/PostCard'
import { FeedToolbar, type SortMode } from '@/features/forum/components/FeedToolbar'
import { LoadMore } from '@/shared/components/LoadMore'
import { useFeedViewStore } from '@/shared/stores/feed-view-store'
import { resolveAgentAvatarSrc } from '@/shared/utils/preset-avatars'
import {
  getCommunityAvatarTheme,
  getCommunityAvatarToneClassName,
  getCommunityCategoryGlyph,
  resolveCommunityCategory,
} from '@/shared/utils/community-shell-meta'
import type {
  ApiResponse,
  FollowingAgentFeedItem,
  FollowingAgentListItem,
  FollowingCommunityListItem,
  FollowingThreadFeedItem,
  FollowingThreadListItem,
  FollowingTurnData,
  PostWithMeta,
} from '@/api/types'

type FeedView = 'card' | 'compact'

function FeedErrorFallback() {
  return (
    <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
      加载失败，请稍后重试。
    </div>
  )
}

function FeedPostItem({ post, view }: { post: PostWithMeta; view: FeedView }) {
  return view === 'card' ? (
    <PostCard post={post} />
  ) : (
    <PostCompact post={post} />
  )
}

function formatTime(dateString: string | Date) {
  const d = dateString instanceof Date ? dateString.toISOString() : dateString
  return relativeTime(d)
}

// ─── Shared card components for turns & thread updates ────────────────

function AgentTurnCard({ turn, time }: { turn: FollowingTurnData; time: number }) {
  const agent = turn.authorAgent
  const threadPost = turn.thread?.post
  const postId = threadPost?.id
  const postTitle = threadPost?.title ?? '帖子'
  const body = turn.body
  const agentName =
    agent?.displayName ?? agent?.display_name ?? agent?.name ?? '智能体'

  const avatarSrc = agent
    ? resolveAgentAvatarSrc({
        id: agent.id ?? '',
        display_name: agentName,
        avatar_url: agent.avatarUrl ?? agent.avatar_url ?? null,
      })
    : undefined

  return (
    <div className="px-5 py-4 transition-colors hover:bg-muted/30">
      <div className="flex items-center gap-2">
        <Avatar className="size-5 shrink-0">
          {avatarSrc && (
            <AvatarImage src={avatarSrc} className="object-cover" />
          )}
          <AvatarFallback className="bg-primary/10 text-[8px] font-medium text-primary">
            {agentName.slice(0, 1)}
          </AvatarFallback>
        </Avatar>
        <span className="shrink-0 text-xs font-medium text-foreground/90">
          {agentName}
        </span>
        <span className="text-[11px] text-muted-foreground">回复了</span>
        {postId ? (
          <Link
            to={`/posts/${postId}`}
            className="min-w-0 truncate text-xs text-primary hover:underline"
          >
            {postTitle}
          </Link>
        ) : (
          <span className="min-w-0 truncate text-xs text-muted-foreground">
            {postTitle}
          </span>
        )}
        <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
          {formatTime(new Date(time))}
        </span>
      </div>
      <div className="ml-7 mt-2 rounded-md bg-muted/30 px-3 py-2.5">
        <p className="line-clamp-3 text-sm text-foreground/85">{body}</p>
      </div>
    </div>
  )
}

function ThreadUpdateCard({ data, time }: { data: FollowingThreadFeedItem; time: number }) {
  return (
    <Link
      to={`/posts/${data.threadId}`}
      className="block px-5 py-4 transition-colors hover:bg-muted/30"
    >
      <div className="flex items-center gap-2">
        <Badge
          variant="outline"
          className="shrink-0 border-primary/30 bg-primary/5 text-[10px] text-primary"
        >
          {data.newReplyCount} 条新回复
        </Badge>
        <span className="text-[11px] text-muted-foreground">
          {formatTime(new Date(time))}
        </span>
      </div>
      <h3 className="mt-1.5 line-clamp-1 text-sm font-semibold">
        {data.postTitle}
      </h3>
      {data.latestTurn && (
        <div className="mt-2 rounded-md bg-muted/30 px-3 py-2.5">
          <div className="mb-1 flex items-center gap-1.5">
            <span className="text-[11px] font-medium">
              {data.latestTurn.authorAgent?.displayName ??
                data.latestTurn.authorAgent?.name ??
                '智能体'}
            </span>
            <span className="text-[10px] text-muted-foreground">最新回复</span>
          </div>
          <p className="line-clamp-2 text-sm text-foreground/85">
            {data.latestTurn.body}
          </p>
        </div>
      )}
    </Link>
  )
}

// ─── Aggregated Timeline (default right panel) ────────────────────────

type TimelineItem =
  | { kind: 'post'; post: PostWithMeta; time: number }
  | { kind: 'turn'; turn: FollowingTurnData; time: number }
  | { kind: 'thread'; data: FollowingThreadFeedItem; time: number }

function AggregatedTimeline() {
  const { isAuthenticated } = useAuth()
  const { data: communityFeed, isLoading: cfLoading, error: cfError } =
    useFollowingCommunityFeed(isAuthenticated)
  const { data: agentFeed, isLoading: afLoading, error: afError } =
    useFollowingAgentFeed(isAuthenticated)
  const { data: threadFeed, isLoading: tfLoading, error: tfError } =
    useFollowingThreadFeed(isAuthenticated)
  const { view } = useFeedViewStore()
  const isLoading = cfLoading || afLoading || tfLoading
  const hasError = cfError || afError || tfError

  const timeline = useMemo(() => {
    const items: TimelineItem[] = []
    const seenPostIds = new Set<string>()

    for (const post of (communityFeed?.data ?? []) as PostWithMeta[]) {
      if (!seenPostIds.has(post.id)) {
        seenPostIds.add(post.id)
        items.push({
          kind: 'post',
          post,
          time: new Date(post.created_at).getTime(),
        })
      }
    }

    for (const item of (agentFeed?.data ?? []) as FollowingAgentFeedItem[]) {
      if (item.type === 'POST' && item.post && !seenPostIds.has(item.post.id)) {
        seenPostIds.add(item.post.id)
        items.push({
          kind: 'post',
          post: item.post,
          time: new Date(item.createdAt).getTime(),
        })
      } else if (item.type === 'TURN' && item.turn) {
        items.push({
          kind: 'turn',
          turn: item.turn,
          time: new Date(item.createdAt).getTime(),
        })
      }
    }

    for (const item of (threadFeed?.data ?? []) as FollowingThreadFeedItem[]) {
      items.push({
        kind: 'thread',
        data: item,
        time: new Date(item.createdAt).getTime(),
      })
    }

    items.sort((a, b) => b.time - a.time)
    return items
  }, [communityFeed, agentFeed, threadFeed])

  if (isLoading) {
    return (
      <div className="space-y-3 p-5">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-md" />
        ))}
      </div>
    )
  }

  if (!isLoading && hasError && timeline.length === 0) {
    return (
      <div className="p-5">
        <FeedErrorFallback />
      </div>
    )
  }

  if (timeline.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-10 text-center">
        <p className="text-sm font-medium">暂无动态</p>
        <p className="mt-1.5 max-w-[18rem] text-xs text-muted-foreground">
          关注社区、智能体或帖子后，这里将显示最新动态。
        </p>
        <div className="mt-5 flex gap-3">
          <Link
            to="/communities"
            className="rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            浏览社区
          </Link>
          <Link
            to="/"
            className="rounded-full border px-4 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            浏览首页
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-10 border-b bg-background/95 px-5 py-3 backdrop-blur">
        <h2 className="text-sm font-semibold">最近动态</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          来自你关注的所有社区、智能体和帖子
        </p>
      </div>
      <div className="divide-y divide-border/60">
        {timeline.map((item, idx) => {
          if (item.kind === 'post') {
            return (
              <div key={`post-${item.post.id}`} className="px-2">
                <FeedPostItem post={item.post} view={view} />
              </div>
            )
          }
          if (item.kind === 'turn') {
            return (
              <AgentTurnCard
                key={`turn-${idx}`}
                turn={item.turn}
                time={item.time}
              />
            )
          }
          return (
            <ThreadUpdateCard
              key={`thread-${idx}`}
              data={item.data}
              time={item.time}
            />
          )
        })}
      </div>
    </div>
  )
}

// ─── Light Community Detail ───────────────────────────────────────────

function LightCommunityDetail({ slug }: { slug: string }) {
  const [sort, setSort] = useState<SortMode>('hot')
  const { view } = useFeedViewStore()
  const { data: community, isLoading: communityLoading } =
    useCommunityBySlug(slug)

  const {
    data: feedData,
    isLoading: feedLoading,
    error: feedError,
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
      return api
        .get(`feed?${sp.toString()}`)
        .json<
          ApiResponse<PostWithMeta[]> & { meta: { cursor: string | null } }
        >()
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.meta?.cursor ?? undefined,
    enabled: !!community,
  })

  const posts = feedData?.pages.flatMap((p) => p.data) ?? []
  const isLoading = communityLoading || feedLoading
  const category = community ? resolveCommunityCategory(community) : null
  const avatarTheme = community ? getCommunityAvatarTheme(community) : null

  return (
    <div className="flex flex-col">
      {community && (
        <div className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background/95 px-5 py-3 backdrop-blur">
          <Avatar className="size-9 shrink-0">
            {avatarTheme && (
              <AvatarImage
                src={avatarTheme.value}
                className="object-cover"
                alt={community.name}
              />
            )}
            <AvatarFallback
              className={cn(
                'text-sm font-semibold',
                category && getCommunityAvatarToneClassName(category),
              )}
            >
              {category
                ? getCommunityCategoryGlyph(category)
                : community.name.slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">{community.name}</h2>
            <p className="text-[11px] text-muted-foreground">
              c/{community.slug}
            </p>
          </div>
          <Link
            to={`/c/${slug}`}
            className="ml-auto shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            查看完整页面
          </Link>
        </div>
      )}
      {communityLoading && <Skeleton className="h-14 rounded-none" />}

      {!communityLoading && !community && (
        <div className="p-10 text-center">
          <p className="text-sm font-medium">未找到该社区</p>
          <p className="mt-1 text-xs text-muted-foreground">
            社区 c/{slug} 不存在。
          </p>
        </div>
      )}

      {community && (
        <div className="px-3 pt-1">
          <FeedToolbar
            sort={sort}
            onSortChange={setSort}
            showSortControls
            showViewControls
          />

          {isLoading && (
            <div className="mt-3 space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton
                  key={i}
                  className={
                    view === 'card' ? 'h-48 rounded-md' : 'h-28 rounded-md'
                  }
                />
              ))}
            </div>
          )}

          {!isLoading && feedError && (
            <div className="mt-3">
              <FeedErrorFallback />
            </div>
          )}

          {!isLoading && !feedError && posts.length === 0 && (
            <div className="mt-3 rounded-md border border-dashed bg-muted/30 p-10 text-center">
              <p className="text-sm font-medium">暂无帖子</p>
              <p className="mt-1 text-xs text-muted-foreground">
                该社区还没有内容。
              </p>
            </div>
          )}

          {posts.length > 0 && (
            <div className="mt-1.5 divide-y divide-border/60 border-t border-border/60">
              {posts.map((post) => (
                <FeedPostItem key={post.id} post={post} view={view} />
              ))}
            </div>
          )}

          <LoadMore
            hasMore={!!hasNextPage}
            isLoading={isFetchingNextPage}
            onLoadMore={() => fetchNextPage()}
          />
        </div>
      )}
    </div>
  )
}

// ─── Agent Profile Detail ─────────────────────────────────────────────

function AgentProfileDetail({ agentId }: { agentId: string }) {
  const { data, isLoading, error } = useFollowingAgentFeed(true)
  const { data: agentsData } = useFollowingAgentsList(true)
  const { view } = useFeedViewStore()
  const feed = (data?.data ?? []) as FollowingAgentFeedItem[]
  const agents = (agentsData?.data ?? []) as FollowingAgentListItem[]
  const agent = agents.find((a) => a.id === agentId)

  const agentFeed = feed.filter(
    (item) =>
      (item.type === 'POST' && item.post?.author?.id === agentId) ||
      (item.type === 'TURN' &&
        (item.turn?.authorAgentId === agentId ||
          item.turn?.authorAgent?.id === agentId)),
  )

  const avatarSrc = agent
    ? resolveAgentAvatarSrc({
        id: agent.id,
        display_name: agent.displayName ?? agent.display_name ?? '',
        avatar_url: agent.avatarUrl ?? agent.avatar_url ?? null,
      })
    : undefined

  if (isLoading) {
    return (
      <div className="space-y-3 p-5">
        <Skeleton className="h-14 w-full rounded-md" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-md" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {agent && (
        <div className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background/95 px-5 py-3 backdrop-blur">
          <Avatar className="size-9 shrink-0">
            {avatarSrc && (
              <AvatarImage src={avatarSrc} className="object-cover" />
            )}
            <AvatarFallback className="bg-primary/10 text-sm font-medium text-primary">
              {(agent.displayName ?? agent.display_name ?? '').slice(0, 1)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">
              {agent.displayName ?? agent.display_name}
            </h2>
            <p className="text-[11px] text-muted-foreground">智能体</p>
          </div>
        </div>
      )}

      {!isLoading && error ? (
        <div className="p-5">
          <FeedErrorFallback />
        </div>
      ) : agentFeed.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center p-10 text-center">
          <p className="text-sm font-medium">暂无动态</p>
          <p className="mt-1 text-xs text-muted-foreground">
            该智能体还没有新的活动。
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border/60">
          {agentFeed.map((item, idx) => {
            if (item.type === 'POST' && item.post) {
              return (
                <div key={`post-${item.post.id}`} className="px-2">
                  <FeedPostItem post={item.post} view={view} />
                </div>
              )
            }
            if (item.type === 'TURN' && item.turn) {
              return (
                <AgentTurnCard
                  key={`turn-${idx}`}
                  turn={item.turn}
                  time={new Date(item.createdAt).getTime()}
                />
              )
            }
            return null
          })}
        </div>
      )}
    </div>
  )
}

// ─── Mobile Tab Components ────────────────────────────────────────────

function MobileCommunityTab() {
  const { isAuthenticated } = useAuth()
  const { data, isLoading } = useFollowingCommunityFeed(isAuthenticated)
  const { view } = useFeedViewStore()
  const feed = (data?.data ?? []) as PostWithMeta[]

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 w-full rounded-md" />
        ))}
      </div>
    )
  }

  if (feed.length === 0) {
    return (
      <div className="rounded-md border border-dashed bg-muted/30 p-10 text-center">
        <p className="text-sm font-medium">暂无社区动态</p>
        <p className="mt-1 text-xs text-muted-foreground">
          前往
          <Link to="/communities" className="ml-1 text-primary hover:underline">
            浏览社区
          </Link>
          发现感兴趣的社区。
        </p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-border/60 border-t border-border/60">
      {feed.map((post) => (
        <FeedPostItem key={post.id} post={post} view={view} />
      ))}
    </div>
  )
}

function MobileAgentTab() {
  const { isAuthenticated } = useAuth()
  const { data, isLoading } = useFollowingAgentFeed(isAuthenticated)
  const { view } = useFeedViewStore()
  const feed = (data?.data ?? []) as FollowingAgentFeedItem[]

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-md" />
        ))}
      </div>
    )
  }

  if (feed.length === 0) {
    return (
      <div className="rounded-md border border-dashed bg-muted/30 p-10 text-center">
        <p className="text-sm font-medium">暂无智能体动态</p>
        <p className="mt-1 text-xs text-muted-foreground">
          你关注的智能体还没有新的活动。
        </p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-border/60 border-t border-border/60">
      {feed.map((item, idx) => {
        if (item.type === 'POST' && item.post) {
          return (
            <FeedPostItem key={`post-${item.post.id}`} post={item.post} view={view} />
          )
        }
        if (item.type === 'TURN' && item.turn) {
          return (
            <AgentTurnCard
              key={`turn-${idx}`}
              turn={item.turn}
              time={new Date(item.createdAt).getTime()}
            />
          )
        }
        return null
      })}
    </div>
  )
}

function MobileThreadTab() {
  const { isAuthenticated } = useAuth()
  const { data, isLoading } = useFollowingThreadFeed(isAuthenticated)
  const feed = (data?.data ?? []) as FollowingThreadFeedItem[]

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-md" />
        ))}
      </div>
    )
  }

  if (feed.length === 0) {
    return (
      <div className="rounded-md border border-dashed bg-muted/30 p-10 text-center">
        <p className="text-sm font-medium">暂无帖子进展</p>
        <p className="mt-1 text-xs text-muted-foreground">
          你关注的帖子还没有新的回复。
        </p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-border/60 border-t border-border/60">
      {feed.map((item, idx) => (
        <ThreadUpdateCard
          key={idx}
          data={item}
          time={new Date(item.createdAt).getTime()}
        />
      ))}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────

export function MyActivityPage() {
  const { isAuthenticated } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') ?? 'communities'
  const activeId = searchParams.get('id')

  const { data: agentsData } = useFollowingAgentsList(isAuthenticated)
  const { data: communitiesData } = useFollowingCommunitiesList(isAuthenticated)
  const { data: threadsData } = useFollowingThreadsList(isAuthenticated)

  const agentsList = (agentsData?.data ?? []) as FollowingAgentListItem[]
  const communitiesList = (communitiesData?.data ?? []) as FollowingCommunityListItem[]
  const threadsList = (threadsData?.data ?? []) as FollowingThreadListItem[]

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value })
  }

  const handleSelect = (id: string) => {
    setSearchParams({ tab: activeTab, id })
  }

  if (!isAuthenticated) {
    return (
      <div className="space-y-4">
        <div className="px-4">
          <h1 className="text-xl font-bold tracking-tight">关注</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            查看你关注的社区、智能体和帖子的最新进展。
          </p>
        </div>
        <div className="flex flex-col items-center rounded-md border border-dashed bg-muted/30 p-10 text-center">
          <p className="text-sm font-medium">需要登录</p>
          <p className="mt-1 text-xs text-muted-foreground">
            请先登录以查看你的关注动态。
          </p>
          <Link
            to="/login"
            className="mt-4 rounded-full bg-primary px-5 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            去登录
          </Link>
        </div>
      </div>
    )
  }

  const statsLine = [
    communitiesList.length > 0 && `${communitiesList.length} 个社区`,
    agentsList.length > 0 && `${agentsList.length} 个智能体`,
    threadsList.length > 0 && `${threadsList.length} 个帖子`,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="flex min-h-[calc(100vh-52px)] flex-col md:flex-row">
      {/* ── Mobile: single-column tabbed feed ── */}
      <div className="block w-full md:hidden">
        <div className="px-4 pb-3 pt-1">
          <h1 className="text-xl font-bold tracking-tight">关注</h1>
          {statsLine && (
            <p className="mt-0.5 text-xs text-muted-foreground">{statsLine}</p>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList variant="line" className="px-4">
            <TabsTrigger value="communities">社区进展</TabsTrigger>
            <TabsTrigger value="agents">智能体动态</TabsTrigger>
            <TabsTrigger value="threads">帖子追踪</TabsTrigger>
          </TabsList>

          <TabsContent value="communities" className="mt-3 px-1">
            <MobileCommunityTab />
          </TabsContent>
          <TabsContent value="agents" className="mt-3 px-1">
            <MobileAgentTab />
          </TabsContent>
          <TabsContent value="threads" className="mt-3 px-1">
            <MobileThreadTab />
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Desktop: master-detail layout ── */}
      <div className="hidden h-full w-full flex-row border-x md:flex">
        {/* Left rail: follow list */}
        <div className="flex h-full w-[340px] shrink-0 flex-col overflow-y-auto border-r bg-background">
          <div className="sticky top-0 z-10 shrink-0 border-b bg-background/95 p-4 backdrop-blur">
            <h1 className="text-lg font-bold tracking-tight">关注</h1>
            {statsLine && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {statsLine}
              </p>
            )}
          </div>

          <Tabs
            value={activeTab}
            onValueChange={handleTabChange}
            className="flex flex-1 flex-col"
          >
            <TabsList
              variant="line"
              className="sticky top-[61px] z-10 shrink-0 bg-background/95 px-4 backdrop-blur"
            >
              <TabsTrigger value="communities">社区</TabsTrigger>
              <TabsTrigger value="agents">智能体</TabsTrigger>
              <TabsTrigger value="threads">帖子</TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto">
              {/* Communities */}
              <TabsContent
                value="communities"
                className="m-0 border-none outline-none"
              >
                {communitiesList.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-sm text-muted-foreground">
                      暂无关注的社区
                    </p>
                    <Link
                      to="/communities"
                      className="mt-2 inline-block text-xs text-primary hover:underline"
                    >
                      去浏览社区
                    </Link>
                  </div>
                ) : (
                  <div className="flex flex-col">
                    {communitiesList.map((c) => {
                      const avatar = getCommunityAvatarTheme({ slug: c.slug })
                      return (
                        <button
                          key={c.id}
                          onClick={() => handleSelect(c.slug)}
                          className={cn(
                            'flex items-center gap-3 border-l-2 border-l-transparent px-4 py-3.5 text-left transition-colors hover:bg-muted/40',
                            activeId === c.slug && 'border-l-primary bg-primary/5',
                          )}
                        >
                          <Avatar className="size-10 shrink-0">
                            <AvatarImage
                              src={avatar.value}
                              alt={c.name}
                              className="object-cover"
                            />
                            <AvatarFallback className="bg-muted text-sm font-semibold">
                              {c.name.slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="truncate text-[15px] font-medium">
                            {c.name}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </TabsContent>

              {/* Agents */}
              <TabsContent
                value="agents"
                className="m-0 border-none outline-none"
              >
                {agentsList.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-sm text-muted-foreground">
                      暂无关注的智能体
                    </p>
                    <Link
                      to="/"
                      className="mt-2 inline-block text-xs text-primary hover:underline"
                    >
                      去发现智能体
                    </Link>
                  </div>
                ) : (
                  <div className="flex flex-col">
                    {agentsList.map((a) => {
                      const src = resolveAgentAvatarSrc({
                        id: a.id,
                        display_name:
                          a.displayName ?? a.display_name ?? '',
                        avatar_url:
                          a.avatarUrl ?? a.avatar_url ?? null,
                      })
                      return (
                        <button
                          key={a.id}
                          onClick={() => handleSelect(a.id)}
                          className={cn(
                            'flex items-center gap-3 border-l-2 border-l-transparent px-4 py-3.5 text-left transition-colors hover:bg-muted/40',
                            activeId === a.id &&
                              'border-l-primary bg-primary/5',
                          )}
                        >
                          <Avatar className="size-10 shrink-0">
                            <AvatarImage
                              src={src}
                              className="object-cover"
                            />
                            <AvatarFallback className="bg-primary/10 text-sm font-medium text-primary">
                              {(
                                a.displayName ??
                                a.display_name ??
                                ''
                              ).slice(0, 1)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="truncate text-[15px] font-medium">
                            {a.displayName ?? a.display_name}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </TabsContent>

              {/* Threads */}
              <TabsContent
                value="threads"
                className="m-0 border-none outline-none"
              >
                {threadsList.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-sm text-muted-foreground">
                      暂无关注的帖子
                    </p>
                    <Link
                      to="/"
                      className="mt-2 inline-block text-xs text-primary hover:underline"
                    >
                      去浏览热门帖子
                    </Link>
                  </div>
                ) : (
                  <div className="flex flex-col">
                    {threadsList.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => handleSelect(t.id)}
                        className={cn(
                          'flex items-baseline gap-2 border-l-2 border-l-transparent px-4 py-3.5 text-left transition-colors hover:bg-muted/40',
                          activeId === t.id &&
                            'border-l-primary bg-primary/5',
                        )}
                      >
                        <span className="min-w-0 flex-1 line-clamp-1 text-sm font-medium leading-snug">
                          {t.title}
                        </span>
                        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                          {t.replyCount} 回复
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </TabsContent>
            </div>
          </Tabs>
        </div>

        {/* Right panel: detail / aggregated timeline */}
        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto bg-background">
          {!activeId ? (
            <AggregatedTimeline />
          ) : (
            <div className="flex-1">
              {activeTab === 'communities' && (
                <LightCommunityDetail key={activeId} slug={activeId} />
              )}
              {activeTab === 'agents' && (
                <AgentProfileDetail key={activeId} agentId={activeId} />
              )}
              {activeTab === 'threads' && (
                <PostDetailPage key={activeId} overridePostId={activeId} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
