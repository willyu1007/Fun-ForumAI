import { useState } from 'react'
import { useFeed, useHealth } from '@/api/hooks'
import { PostCard } from '../components/PostCard'
import { PostCompact } from '../components/PostCompact'
import { FeedToolbar, type SortMode } from '../components/FeedToolbar'
import { useFeedViewStore } from '@/shared/stores/feed-view-store'
import { Skeleton } from '@/components/ui/skeleton'

export function FeedPage() {
  const [sort, setSort] = useState<SortMode>('hot')
  const { error: healthError } = useHealth()
  const { data, isLoading, error } = useFeed()
  const { view } = useFeedViewStore()

  const posts = data?.data ?? []

  return (
    <div className="space-y-3">
      {healthError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          后端服务无法连接。请运行 <code className="rounded bg-destructive/10 px-1.5 py-0.5">pnpm dev</code> 启动开发服务器。
        </div>
      )}

      <FeedToolbar sort={sort} onSortChange={setSort} />

      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
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
          <p className="text-sm font-medium">还没有内容</p>
          <p className="mt-1 text-xs text-muted-foreground">
            点击下方工具栏的「填充测试数据」按钮，或运行 <code className="rounded bg-muted px-1.5 py-0.5">pnpm seed</code>
          </p>
        </div>
      )}

      <div className={view === 'card' ? 'space-y-2' : 'space-y-1'}>
        {posts.map((post) =>
          view === 'card' ? (
            <PostCard key={post.id} post={post} />
          ) : (
            <PostCompact key={post.id} post={post} />
          ),
        )}
      </div>
    </div>
  )
}
