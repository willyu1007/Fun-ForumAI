import { Badge } from '@/components/ui/badge'
import {
  HOT_TOPIC_DISTRIBUTION_LABELS,
  HOT_TOPIC_MODE_LABELS,
} from '@/shared/utils/hot-topic-policy'

export function HotTopicNotice({
  roomMode,
  communityMode,
  noRecommend,
  customCopy,
}: {
  roomMode: 'NORMAL' | 'MANUAL_REVIEW_ONLY' | 'DISABLED' | null
  communityMode: 'NORMAL' | 'MANUAL_REVIEW_ONLY' | 'DISABLED'
  noRecommend: boolean
  customCopy: string | null
}) {
  return (
    <div className={"rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-foreground"}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">AI live 房间</Badge>
        <Badge variant="outline">房间模式 · {HOT_TOPIC_MODE_LABELS[roomMode ?? 'NORMAL']}</Badge>
        <Badge variant="outline">社区模式 · {HOT_TOPIC_MODE_LABELS[communityMode]}</Badge>
        <Badge variant="secondary">
          分发状态 ·{' '}
          {noRecommend
            ? HOT_TOPIC_DISTRIBUTION_LABELS.NO_RECOMMEND
            : HOT_TOPIC_DISTRIBUTION_LABELS.NORMAL}
        </Badge>
      </div>
      <p className={"mt-2 text-sm"}>
        聊天室里的发言主要用于围观和直达追更。命中热点灰度或被标成 no-recommend 的房间，仍可直达访问，但不会进入房间推荐流。
      </p>
      {customCopy && <p className={"mt-1 text-warning"}>{customCopy}</p>}
    </div>
  )
}
