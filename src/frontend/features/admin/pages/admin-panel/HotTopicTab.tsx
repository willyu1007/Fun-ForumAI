import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  HOT_TOPIC_DOMAIN_LABELS,
  HOT_TOPIC_MODE_LABELS,
} from '@/shared/utils/hot-topic-policy'
import type { AdminPanelController } from './use-admin-panel-controller'
import {
  COMMUNITY_TOPIC_DOMAIN_OPTIONS,
  HOT_TOPIC_ALERT_REASON_LABELS,
  HOT_TOPIC_ALERT_SEVERITY_LABELS,
} from './constants'
import { HotTopicDashboardCard } from './shared'

type HotTopicTabProps = Pick<AdminPanelController, 'hotTopic'>

export function HotTopicTab({ hotTopic }: HotTopicTabProps) {
  return (
    <div className={"mt-4 space-y-4"}>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className={"pb-2"}>
            <CardTitle className={"text-sm"}>热点运营面板</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className={"text-[10px] text-muted-foreground"}>
              hot score 规则固定为：帖子 = 24h 评论数 + 举报数 x5；房间 = 1h 消息数 + 举报数 x5。
              到达阈值后会标记 sampled review，并沿现有 HOT_TOPIC case 链路收口。
            </p>
            <Input
              placeholder="操作原因（将写入治理日志）"
              value={hotTopic.hotTopicReason}
              onChange={(event) => hotTopic.setHotTopicReason(event.target.value)}
            />
            {hotTopic.dashboardItems.length === 0 && (
              <p className={"text-[10px] text-muted-foreground"}>当前没有热点面板数据。</p>
            )}
            <div className="space-y-3">
              {hotTopic.dashboardItems.map((item) => (
                <HotTopicDashboardCard
                  key={`${item.target_type}:${item.target_id}`}
                  item={item}
                  onSetPostDistribution={hotTopic.handleSetPostDistribution}
                  onSetRoomControl={hotTopic.handleSetRoomControl}
                  postPending={hotTopic.setPostDistributionMutation.isPending}
                  roomPending={hotTopic.setRoomControlMutation.isPending}
                />
              ))}
            </div>
            {hotTopic.setPostDistributionMutation.isError && (
              <p className={"text-xs text-destructive"}>
                {hotTopic.setPostDistributionMutation.error.message}
              </p>
            )}
            {hotTopic.setRoomControlMutation.isError && (
              <p className={"text-xs text-destructive"}>
                {hotTopic.setRoomControlMutation.error.message}
              </p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className={"pb-2"}>
              <CardTitle className={"text-sm"}>热点告警</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {hotTopic.alertItems.length === 0 && (
                <p className={"text-[10px] text-muted-foreground"}>
                  当前没有 medium/high 级别热点告警。
                </p>
              )}
              {hotTopic.alertItems.map((alert) => (
                <div
                  key={`${alert.item.target_type}:${alert.item.target_id}:${alert.reason}`}
                  className={"rounded-md border p-3"}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className={"text-xs font-medium"}>{alert.item.title}</p>
                    <Badge variant={alert.severity === 'high' ? 'destructive' : 'outline'}>
                      {HOT_TOPIC_ALERT_SEVERITY_LABELS[alert.severity]}
                    </Badge>
                  </div>
                  <p className={"text-[10px] text-muted-foreground"}>
                    {HOT_TOPIC_ALERT_REASON_LABELS[alert.reason] ?? alert.reason} ·{' '}
                    {alert.item.target_type}:{alert.item.target_id} · drift{' '}
                    {alert.item.drift_risk_score.toFixed(2)}
                  </p>
                  {alert.item.linked_case_id && (
                    <p className={"text-[10px] text-muted-foreground"}>
                      linked case: {alert.item.linked_case_id}
                    </p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className={"pb-2"}>
              <CardTitle className={"text-sm"}>Community 热点控制</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className={"text-[10px] text-muted-foreground"}>
                这里会复用 config proposal → validate → approve → apply 流程，对
                `rules_json.hot_topic_policy_v1` 做高风险收紧。
              </p>
              <Input
                placeholder="Community ID"
                value={hotTopic.communityPolicyId}
                onChange={(event) => hotTopic.setCommunityPolicyId(event.target.value)}
              />
              <div className="grid gap-3 lg:grid-cols-2">
                <div className="space-y-1">
                  <label className={"mb-1 block text-[10px] font-medium text-muted-foreground"}>热点模式</label>
                  <select
                    value={hotTopic.communityPolicyMode}
                    onChange={(event) =>
                      hotTopic.setCommunityPolicyMode(
                        event.target.value as typeof hotTopic.communityPolicyMode,
                      )
                    }
                    className={"h-8 w-full rounded-md border bg-background px-2 text-xs"}
                  >
                    {Object.entries(HOT_TOPIC_MODE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className={"mb-1 block text-[10px] font-medium text-muted-foreground"}>用户提示文案</label>
                  <Input
                    placeholder="例如：热点内容可能仅保留直达访问"
                    value={hotTopic.communityPolicyCopy}
                    onChange={(event) => hotTopic.setCommunityPolicyCopy(event.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className={"mb-1 block text-[10px] font-medium text-muted-foreground"}>允许进入热点推荐的域</label>
                <div className="flex flex-wrap gap-2">
                  {COMMUNITY_TOPIC_DOMAIN_OPTIONS.map((domain) => (
                    <label key={domain} className={"inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm"}>
                      <input
                        type="checkbox"
                        checked={hotTopic.communityAllowedDomains.includes(domain)}
                        onChange={() => hotTopic.toggleCommunityAllowedDomain(domain)}
                      />
                      <span>{HOT_TOPIC_DOMAIN_LABELS[domain]}</span>
                    </label>
                  ))}
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  void hotTopic.handleApplyCommunityPolicy()
                }}
                disabled={
                  hotTopic.applyCommunityPolicyMutation.isPending ||
                  !hotTopic.communityPolicyId.trim()
                }
              >
                {hotTopic.applyCommunityPolicyMutation.isPending
                  ? '应用中…'
                  : '提交并应用热点策略'}
              </Button>
              {hotTopic.applyCommunityPolicyMutation.isSuccess && (
                <p className={"text-[10px] text-muted-foreground"}>
                  已完成 proposal/validate/approve/apply，当前版本：
                  {hotTopic.applyCommunityPolicyMutation.data.data.version?.id ?? 'scheduled'}
                </p>
              )}
              {hotTopic.applyCommunityPolicyMutation.isError && (
                <p className={"text-xs text-destructive"}>
                  {hotTopic.applyCommunityPolicyMutation.error.message}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
