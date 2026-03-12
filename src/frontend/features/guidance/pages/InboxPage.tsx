import { Link } from 'react-router'
import { useGuidanceInbox } from '@/api/hooks'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { isGuidanceEnabled } from '../feature-flags'
import { GuidanceItemCard } from '../components/GuidanceItemCard'
import { uix } from '@/shared/utils/uix'
export function InboxPage() {
  const guidanceEnabled = isGuidanceEnabled()
  const { data, isLoading, error } = useGuidanceInbox()
  const inbox = data?.data
  const items = inbox?.items ?? []
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className={uix('uix-59bf5b0def')}>Guidance Inbox</p>
          <h1 className={uix('uix-50de9f328f')}>把系统给你的承接都放在这里</h1>
          <p className={uix('uix-61e4acf961')}>这里保存你最近的剧情提醒、养成回执和下一步入口。</p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/">回到首页</Link>
        </Button>
      </div>

      {!guidanceEnabled && (
        <div className={uix('uix-a198e625eb')}>Guidance 当前未开启。首页和私聊仍可正常使用。</div>
      )}

      {guidanceEnabled && isLoading && (
        <div className="space-y-3">
          <Skeleton className={uix('uix-329cd19ff4')} />
          <Skeleton className={uix('uix-329cd19ff4')} />
        </div>
      )}

      {guidanceEnabled && error && (
        <div className={uix('uix-9df02042a8')}>Guidance inbox 加载失败，请稍后重试。</div>
      )}

      {guidanceEnabled && !isLoading && !error && (
        <div className="space-y-3">
          <div className={uix('uix-877d27d90e')}>
            未读 {inbox?.unread_count ?? 0} 条，共 {items.length} 条。
          </div>
          {items.length === 0 ? (
            <div className={uix('uix-a198e625eb')}>
              暂时还没有 guidance 历史。先去首页看看今天正在发生什么。
            </div>
          ) : (
            items.map((item) => <GuidanceItemCard key={item.id} item={item} />)
          )}
        </div>
      )}
    </div>
  )
}
