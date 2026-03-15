import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  HOT_TOPIC_DOMAIN_LABELS,
  HOT_TOPIC_MODE_LABELS,
} from '@/shared/utils/hot-topic-policy'
import { uix } from '@/shared/utils/uix'
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
    <div className={uix('uix-c52b72f5ca')}>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className={uix('uix-f4cc511ff0')}>
            <CardTitle className={uix('uix-fc7473ca09')}>热点运营面板</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className={uix('uix-abda0153e3')}>
              hot score 规则固定为：帖子 = 24h 评论数 + 举报数 x5；房间 = 1h 消息数 + 举报数 x5。
              到达阈值后会标记 sampled review，并沿现有 HOT_TOPIC case 链路收口。
            </p>
            <Input
              placeholder="操作原因（将写入治理日志）"
              value={hotTopic.hotTopicReason}
              onChange={(event) => hotTopic.setHotTopicReason(event.target.value)}
            />
            {hotTopic.dashboardItems.length === 0 && (
              <p className={uix('uix-abda0153e3')}>当前没有热点面板数据。</p>
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
              <p className={uix('uix-551c237449')}>
                {hotTopic.setPostDistributionMutation.error.message}
              </p>
            )}
            {hotTopic.setRoomControlMutation.isError && (
              <p className={uix('uix-551c237449')}>
                {hotTopic.setRoomControlMutation.error.message}
              </p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className={uix('uix-f4cc511ff0')}>
              <CardTitle className={uix('uix-fc7473ca09')}>热点告警</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {hotTopic.alertItems.length === 0 && (
                <p className={uix('uix-abda0153e3')}>
                  当前没有 medium/high 级别热点告警。
                </p>
              )}
              {hotTopic.alertItems.map((alert) => (
                <div
                  key={`${alert.item.target_type}:${alert.item.target_id}:${alert.reason}`}
                  className={uix('uix-3ff7f9f76c')}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className={uix('uix-da8bf29040')}>{alert.item.title}</p>
                    <Badge variant={alert.severity === 'high' ? 'destructive' : 'outline'}>
                      {HOT_TOPIC_ALERT_SEVERITY_LABELS[alert.severity]}
                    </Badge>
                  </div>
                  <p className={uix('uix-abda0153e3')}>
                    {HOT_TOPIC_ALERT_REASON_LABELS[alert.reason] ?? alert.reason} ·{' '}
                    {alert.item.target_type}:{alert.item.target_id} · drift{' '}
                    {alert.item.drift_risk_score.toFixed(2)}
                  </p>
                  {alert.item.linked_case_id && (
                    <p className={uix('uix-abda0153e3')}>
                      linked case: {alert.item.linked_case_id}
                    </p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className={uix('uix-f4cc511ff0')}>
              <CardTitle className={uix('uix-fc7473ca09')}>Community 热点控制</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className={uix('uix-abda0153e3')}>
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
                  <label className={uix('uix-b3691fbf2a')}>热点模式</label>
                  <select
                    value={hotTopic.communityPolicyMode}
                    onChange={(event) =>
                      hotTopic.setCommunityPolicyMode(
                        event.target.value as typeof hotTopic.communityPolicyMode,
                      )
                    }
                    className={uix('uix-34e5554f24')}
                  >
                    {Object.entries(HOT_TOPIC_MODE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className={uix('uix-b3691fbf2a')}>用户提示文案</label>
                  <Input
                    placeholder="例如：热点内容可能仅保留直达访问"
                    value={hotTopic.communityPolicyCopy}
                    onChange={(event) => hotTopic.setCommunityPolicyCopy(event.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className={uix('uix-b3691fbf2a')}>允许进入热点推荐的域</label>
                <div className="flex flex-wrap gap-2">
                  {COMMUNITY_TOPIC_DOMAIN_OPTIONS.map((domain) => (
                    <label key={domain} className={uix('uix-cc8c57f280')}>
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
                <p className={uix('uix-abda0153e3')}>
                  已完成 proposal/validate/approve/apply，当前版本：
                  {hotTopic.applyCommunityPolicyMutation.data.data.version?.id ?? 'scheduled'}
                </p>
              )}
              {hotTopic.applyCommunityPolicyMutation.isError && (
                <p className={uix('uix-551c237449')}>
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
