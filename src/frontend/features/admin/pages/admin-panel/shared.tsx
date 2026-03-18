import { Button } from '@/components/ui/button'
import type { HotTopicDashboardItem } from '@/api/types'
import { Badge } from '@/components/ui/badge'

export function HotTopicDashboardCard({
  item,
  onSetPostDistribution,
  onSetRoomControl,
  postPending,
  roomPending,
}: {
  item: HotTopicDashboardItem
  onSetPostDistribution: (
    item: HotTopicDashboardItem,
    distributionState: 'NORMAL' | 'NO_RECOMMEND',
  ) => Promise<void>
  onSetRoomControl: (
    item: HotTopicDashboardItem,
    input: {
      hot_topic_mode?: 'NORMAL' | 'MANUAL_REVIEW_ONLY' | 'DISABLED'
      distribution_state?: 'NORMAL' | 'NO_RECOMMEND'
    },
  ) => Promise<void>
  postPending: boolean
  roomPending: boolean
}) {
  const isPost = item.target_type === 'post'
  return (
    <div className={"rounded-md border p-3"}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={"text-xs font-medium"}>{item.title}</p>
          <p className={"text-[10px] text-muted-foreground"}>
            {item.target_type}:{item.target_id} · {item.topic_domain} · hot score{' '}
            {item.hot_score} · reports {item.report_count_24h}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">分发 {item.distribution_state}</Badge>
          <Badge variant="outline">限制 {item.restriction_state}</Badge>
          {item.sampled_review_required && <Badge>抽样复核</Badge>}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">drift {item.drift_risk_score.toFixed(2)}</Badge>
        {item.linked_case_id && <Badge variant="outline">case {item.linked_case_id}</Badge>}
        {item.latest_event_at && (
          <Badge variant="outline">{new Date(item.latest_event_at).toLocaleString()}</Badge>
        )}
      </div>
      {isPost ? (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={item.distribution_state === 'NO_RECOMMEND' ? 'secondary' : 'outline'}
            disabled={postPending}
            onClick={() => {
              void onSetPostDistribution(
                item,
                item.distribution_state === 'NO_RECOMMEND' ? 'NORMAL' : 'NO_RECOMMEND',
              )
            }}
          >
            {item.distribution_state === 'NO_RECOMMEND' ? '恢复推荐态' : '切到 NO_RECOMMEND'}
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={item.distribution_state === 'NO_RECOMMEND' ? 'secondary' : 'outline'}
            disabled={roomPending}
            onClick={() => {
              void onSetRoomControl(item, {
                distribution_state:
                  item.distribution_state === 'NO_RECOMMEND' ? 'NORMAL' : 'NO_RECOMMEND',
              })
            }}
          >
            {item.distribution_state === 'NO_RECOMMEND' ? '恢复推荐流' : '切到 NO_RECOMMEND'}
          </Button>
          <Button
            size="sm"
            variant={
              item.restriction_state === 'MANUAL_REVIEW_ONLY' ? 'secondary' : 'outline'
            }
            disabled={roomPending}
            onClick={() => {
              void onSetRoomControl(item, {
                hot_topic_mode:
                  item.restriction_state === 'MANUAL_REVIEW_ONLY'
                    ? 'NORMAL'
                    : 'MANUAL_REVIEW_ONLY',
              })
            }}
          >
            {item.restriction_state === 'MANUAL_REVIEW_ONLY'
              ? '恢复 NORMAL'
              : '设为 MANUAL_REVIEW_ONLY'}
          </Button>
          <Button
            size="sm"
            variant={item.restriction_state === 'BLOCKED' ? 'secondary' : 'outline'}
            disabled={roomPending}
            onClick={() => {
              void onSetRoomControl(item, {
                hot_topic_mode: item.restriction_state === 'BLOCKED' ? 'NORMAL' : 'DISABLED',
              })
            }}
          >
            {item.restriction_state === 'BLOCKED' ? '解除 DISABLED' : '设为 DISABLED'}
          </Button>
        </div>
      )}
    </div>
  )
}
