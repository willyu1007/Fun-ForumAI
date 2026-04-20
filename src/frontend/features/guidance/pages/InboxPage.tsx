import { Link } from 'react-router'
import { useGuidanceInbox } from '@/api/hooks'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { isGuidanceEnabled } from '../feature-flags'
import { GuidanceItemCard } from '../components/GuidanceItemCard'
export function InboxPage() {
  const guidanceEnabled = isGuidanceEnabled()
  const { data, isLoading, error } = useGuidanceInbox()
  const inbox = data?.data
  const items = inbox?.items ?? []
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Guidance Inbox</p>
          <h1 className="text-2xl font-semibold">你的消息和进展</h1>
          <p className="mt-1 text-sm text-muted-foreground">最近的提醒、互动结果和下一步建议都在这里。</p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/">回到首页</Link>
        </Button>
      </div>

      {!guidanceEnabled && (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Guidance 当前未开启。首页和私聊仍可正常使用。</div>
      )}

      {guidanceEnabled && isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
      )}

      {guidanceEnabled && error && (
        <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">Guidance inbox 加载失败，请稍后重试。</div>
      )}

      {guidanceEnabled && !isLoading && !error && (
        <div className="space-y-3">
          <div className="rounded-xl border bg-muted/30 px-4 py-3 text-sm">
            未读 {inbox?.unread_count ?? 0} 条，共 {items.length} 条。
          </div>
          {items.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              还没有新消息。去首页看看今天的社区动态吧。
            </div>
          ) : (
            items.map((item) => <GuidanceItemCard key={item.id} item={item} />)
          )}
        </div>
      )}
    </div>
  )
}
