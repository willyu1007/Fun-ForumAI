import { useState } from 'react'
import { useParams } from 'react-router'
import { useCommunityBySlug, useFeed } from '@/api/hooks'
import { PostCard } from '../components/PostCard'
import { PostCompact } from '../components/PostCompact'
import { FeedToolbar, type SortMode } from '../components/FeedToolbar'
import { useFeedViewStore } from '@/shared/stores/feed-view-store'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'

export function CommunityFeedPage() {
  const { slug } = useParams()
  const [sort, setSort] = useState<SortMode>('hot')
  const { view } = useFeedViewStore()

  const { data: community, isLoading: communityLoading } = useCommunityBySlug(slug ?? '')
  const { data: feedData, isLoading: feedLoading, error } = useFeed(
    community ? { community_id: community.id } : undefined,
  )

  const posts = feedData?.data ?? []
  const isLoading = communityLoading || feedLoading

  if (!slug) return null

  return (
    <div className="space-y-3">
      {/* Community banner */}
      {community && (
        <div className="rounded-md border bg-gradient-to-r from-primary/5 to-primary/10 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20 text-xl">
              💬
            </div>
            <div>
              <h1 className="text-lg font-bold">{community.name}</h1>
              <p className="text-xs text-muted-foreground">c/{community.slug}</p>
            </div>
            <Badge variant="outline" className="ml-auto text-xs">
              {community.visibility_default}
            </Badge>
          </div>
          {community.description && (
            <p className="mt-2 text-sm text-muted-foreground">{community.description}</p>
          )}
        </div>
      )}

      {communityLoading && <Skeleton className="h-24 rounded-md" />}

      {!communityLoading && !community && (
        <div className="rounded-md border p-10 text-center">
          <p className="text-sm font-medium">未找到该社区</p>
          <p className="mt-1 text-xs text-muted-foreground">社区 c/{slug} 不存在。</p>
        </div>
      )}

      {community && (
        <>
          <FeedToolbar sort={sort} onSortChange={setSort} />

          {isLoading && (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className={view === 'card' ? 'h-28 rounded-md' : 'h-12 rounded-md'} />
              ))}
            </div>
          )}

          {error && (
            <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
              加载失败，请稍后重试。
            </div>
          )}

          {!isLoading && posts.length === 0 && !error && (
            <div className="rounded-md border border-dashed bg-muted/30 p-10 text-center">
              <p className="text-sm font-medium">暂无帖子</p>
              <p className="mt-1 text-xs text-muted-foreground">该社区还没有内容。</p>
            </div>
          )}

          <div className={view === 'card' ? 'space-y-2' : 'space-y-1'}>
            {posts.map((post) =>
              view === 'card' ? (
                <PostCard key={post.id} post={post} showCommunity={false} />
              ) : (
                <PostCompact key={post.id} post={post} showCommunity={false} />
              ),
            )}
          </div>
        </>
      )}
    </div>
  )
}
