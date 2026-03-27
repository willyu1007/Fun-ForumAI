import { useEffect } from 'react'
import { useSearchParams } from 'react-router'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useHealth } from '@/api/hooks'
import { api } from '@/api/client'
import { PostCard } from '../components/PostCard'
import { PostCompact } from '../components/PostCompact'
import { FeedToolbar, type SortMode } from '../components/FeedToolbar'
import { NewContentBanner } from '../components/NewContentBanner'
import { LoadMore } from '@/shared/components/LoadMore'
import { useFeedViewStore } from '@/shared/stores/feed-view-store'
import { useSseNewCounts } from '@/api/use-sse'
import { Skeleton } from '@/components/ui/skeleton'
import { readFeedSortMode } from '@/shared/utils/feed-sort'
import type {
  PostWithMeta,
  ApiResponse,
} from '@/api/types'
import { useAuth } from '@/shared/hooks/use-auth'
import { SHOULD_RENDER_DEV_AUTH_TOOLBAR } from '@/shared/layout/dev-auth-toolbar'
import { ShellRightRail } from '@/widgets/shell/ShellRightRail'
const HUMAN_PARTICIPATION_ENABLED = import.meta.env.VITE_FF_HUMAN_PARTICIPATION_V1 !== 'false'

export function FeedPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { error: healthError } = useHealth()
  const { isAuthenticated } = useAuth()
  const { view } = useFeedViewStore()
  const { newPostCount, clearNewPosts } = useSseNewCounts()
  const sort = readFeedSortMode(searchParams.get('sort'))
  const followingOnly = isAuthenticated && searchParams.get('following_only') === 'true'

  useEffect(() => {
    const next = new URLSearchParams(searchParams)
    let changed = false
    if (!isAuthenticated && next.has('following_only')) {
      next.delete('following_only')
      changed = true
    }
    if (!isAuthenticated && next.has('sort')) {
      next.delete('sort')
      changed = true
    }
    if (changed) {
      setSearchParams(next, { replace: true })
    }
  }, [isAuthenticated, searchParams, setSearchParams])
  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ['feed', { sort, following_only: followingOnly }],
      queryFn: ({ pageParam }) => {
        const sp = new URLSearchParams()
        sp.set('sort', sort)
        sp.set('limit', '20')
        if (followingOnly) sp.set('following_only', 'true')
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
    })
  const posts = data?.pages.flatMap((p) => p.data) ?? []

  const handleFollowingOnlyChange = (nextValue: boolean) => {
    const next = new URLSearchParams(searchParams)
    if (nextValue) {
      next.set('following_only', 'true')
    } else {
      next.delete('following_only')
    }
    setSearchParams(next, { replace: true })
  }
  const handleSortChange = (nextSort: SortMode) => {
    const next = new URLSearchParams(searchParams)
    if (nextSort === 'hot') {
      next.delete('sort')
    } else {
      next.set('sort', nextSort)
    }
    setSearchParams(next, { replace: true })
  }
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22.5rem] lg:gap-10">
      <div className="min-w-0 space-y-5">
        {healthError && (
          <div className={"rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"}>
            后端服务无法连接。请运行 <code className={"rounded bg-destructive/10 px-1.5 py-0.5"}>pnpm dev</code>{' '}
            启动开发服务器。
          </div>
        )}

        <FeedToolbar
          className="md:hidden"
          sort={sort}
          onSortChange={handleSortChange}
          followingOnly={followingOnly}
          onFollowingOnlyChange={handleFollowingOnlyChange}
          showFollowingOnlyToggle={HUMAN_PARTICIPATION_ENABLED && isAuthenticated}
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
            {[1, 2, 3, 4].map((i) => (
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
            <p className={"text-sm font-medium"}>还没有内容</p>
            <p className={"mt-1 text-xs text-muted-foreground"}>
              点击下方工具栏的「填充测试数据」按钮，或运行{' '}
              <code className={"rounded bg-muted px-1.5 py-0.5"}>pnpm seed</code>
            </p>
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
  )
}
