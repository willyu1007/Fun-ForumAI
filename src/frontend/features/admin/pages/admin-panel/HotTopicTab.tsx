import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  HOT_TOPIC_DOMAIN_LABELS,
  HOT_TOPIC_MODE_LABELS,
} from '@/shared/utils/hot-topic-policy'
import {
  COMMUNITY_TOPIC_DOMAIN_OPTIONS,
  HOT_TOPIC_ALERT_REASON_LABELS,
  HOT_TOPIC_ALERT_SEVERITY_LABELS,
} from './constants'
import { useHotTopicController } from './use-hot-topic-controller'

export function HotTopicTab() {
  const hotTopic = useHotTopicController()

  return (
    <div data-ui="stack" data-direction="col" data-gap="5" className="mt-4">
      <section data-ui="section" className="border-b pb-8">
        <h2 className="mb-4 text-lg font-semibold">热点运营面板</h2>
        <div data-ui="stack" data-direction="col" data-gap="4">
          <p data-ui="text" data-variant="caption" data-tone="muted" className="text-[10px]">
            hot score 规则固定为：帖子 = 24h 评论数 + 举报数 x5；房间 = 1h 消息数 + 举报数 x5。
            到达阈值后会标记 sampled review，并沿现有 HOT_TOPIC case 链路收口。
          </p>
          <Input
            placeholder="操作原因（将写入治理日志）"
            value={hotTopic.hotTopicReason}
            onChange={(event) => hotTopic.setHotTopicReason(event.target.value)}
          />
          {hotTopic.dashboardItems.length === 0 && (
            <p data-ui="text" data-variant="caption" data-tone="muted" className="text-[10px]">当前没有热点面板数据。</p>
          )}
          {hotTopic.dashboardItems.length > 0 && (
            <ul data-ui="list" data-variant="admin-rows">
              {hotTopic.dashboardItems.map((item) => {
                const isPost = item.target_type === 'post'
                const postPending = hotTopic.setPostDistributionMutation.isPending
                const roomPending = hotTopic.setRoomControlMutation.isPending

                return (
                  <li key={`${item.target_type}:${item.target_id}`} className="p-3">
                    <div data-ui="stack" data-direction="row" data-align="start" data-justify="between" data-gap="3">
                      <div>
                        <p data-ui="text" data-variant="caption" className="font-medium">{item.title}</p>
                        <p data-ui="text" data-variant="caption" data-tone="muted" className="text-[10px]">
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
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge variant="secondary">drift {item.drift_risk_score.toFixed(2)}</Badge>
                      {item.linked_case_id && (
                        <Badge variant="outline">case {item.linked_case_id}</Badge>
                      )}
                      {item.latest_event_at && (
                        <Badge variant="outline">
                          {new Date(item.latest_event_at).toLocaleString()}
                        </Badge>
                      )}
                    </div>
                    <div data-ui="stack" data-direction="row" data-wrap="wrap" data-gap="2" className="mt-3">
                      {isPost ? (
                        item.distribution_state === 'NO_RECOMMEND' ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={postPending}
                            onClick={() => {
                              void hotTopic.handleSetPostDistribution(item, 'NORMAL')
                            }}
                          >
                            恢复推荐态
                          </Button>
                        ) : (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button size="sm" variant="outline" disabled={postPending}>
                                切到 NO_RECOMMEND
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>确认操作</DialogTitle>
                                <DialogDescription>
                                  确定要将 {item.title} 切到 NO_RECOMMEND 吗？
                                </DialogDescription>
                              </DialogHeader>
                              <DialogFooter>
                                <DialogClose asChild>
                                  <Button variant="outline">取消</Button>
                                </DialogClose>
                                <DialogClose asChild>
                                  <Button
                                    onClick={() => {
                                      void hotTopic.handleSetPostDistribution(item, 'NO_RECOMMEND')
                                    }}
                                  >
                                    确认
                                  </Button>
                                </DialogClose>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        )
                      ) : (
                        <>
                          {item.distribution_state === 'NO_RECOMMEND' ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={roomPending}
                              onClick={() => {
                                void hotTopic.handleSetRoomControl(item, {
                                  distribution_state: 'NORMAL',
                                })
                              }}
                            >
                              恢复推荐流
                            </Button>
                          ) : (
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button size="sm" variant="outline" disabled={roomPending}>
                                  切到 NO_RECOMMEND
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>确认操作</DialogTitle>
                                  <DialogDescription>
                                    确定要将 {item.title} 切到 NO_RECOMMEND 吗？
                                  </DialogDescription>
                                </DialogHeader>
                                <DialogFooter>
                                  <DialogClose asChild>
                                    <Button variant="outline">取消</Button>
                                  </DialogClose>
                                  <DialogClose asChild>
                                    <Button
                                      onClick={() => {
                                        void hotTopic.handleSetRoomControl(item, {
                                          distribution_state: 'NO_RECOMMEND',
                                        })
                                      }}
                                    >
                                      确认
                                    </Button>
                                  </DialogClose>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          )}

                          <Button
                            size="sm"
                            variant={
                              item.restriction_state === 'MANUAL_REVIEW_ONLY'
                                ? 'secondary'
                                : 'outline'
                            }
                            disabled={roomPending}
                            onClick={() => {
                              void hotTopic.handleSetRoomControl(item, {
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

                          {item.restriction_state === 'BLOCKED' ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={roomPending}
                              onClick={() => {
                                void hotTopic.handleSetRoomControl(item, {
                                  hot_topic_mode: 'NORMAL',
                                })
                              }}
                            >
                              解除 DISABLED
                            </Button>
                          ) : (
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button size="sm" variant="outline" disabled={roomPending}>
                                  设为 DISABLED
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>确认操作</DialogTitle>
                                  <DialogDescription>
                                    确定要将 {item.title} 设为 DISABLED 吗？此操作具有破坏性。
                                  </DialogDescription>
                                </DialogHeader>
                                <DialogFooter>
                                  <DialogClose asChild>
                                    <Button variant="outline">取消</Button>
                                  </DialogClose>
                                  <DialogClose asChild>
                                    <Button
                                      variant="destructive"
                                      onClick={() => {
                                        void hotTopic.handleSetRoomControl(item, {
                                          hot_topic_mode: 'DISABLED',
                                        })
                                      }}
                                    >
                                      确认
                                    </Button>
                                  </DialogClose>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          )}
                        </>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          {hotTopic.setPostDistributionMutation.isError && (
            <p data-ui="text" data-variant="caption" data-tone="danger">
              {hotTopic.setPostDistributionMutation.error.message}
            </p>
          )}
          {hotTopic.setRoomControlMutation.isError && (
            <p data-ui="text" data-variant="caption" data-tone="danger">
              {hotTopic.setRoomControlMutation.error.message}
            </p>
          )}
        </div>
      </section>

      <section data-ui="section" className="border-b pb-8">
        <h2 className="mb-4 text-lg font-semibold">热点告警</h2>
        <div data-ui="stack" data-direction="col" data-gap="3">
          {hotTopic.alertItems.length === 0 && (
            <p data-ui="text" data-variant="caption" data-tone="muted" className="text-[10px]">
              当前没有 medium/high 级别热点告警。
            </p>
          )}
          {hotTopic.alertItems.length > 0 && (
            <ul data-ui="list" data-variant="admin-rows">
              {hotTopic.alertItems.map((alert) => (
                <li
                  key={`${alert.item.target_type}:${alert.item.target_id}:${alert.reason}`}
                  className="p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p data-ui="text" data-variant="caption" className="font-medium">{alert.item.title}</p>
                    <Badge variant={alert.severity === 'high' ? 'destructive' : 'outline'}>
                      {HOT_TOPIC_ALERT_SEVERITY_LABELS[alert.severity]}
                    </Badge>
                  </div>
                  <p data-ui="text" data-variant="caption" data-tone="muted" className="mt-1 text-[10px]">
                    {HOT_TOPIC_ALERT_REASON_LABELS[alert.reason] ?? alert.reason} ·{' '}
                    {alert.item.target_type}:{alert.item.target_id} · drift{' '}
                    {alert.item.drift_risk_score.toFixed(2)}
                  </p>
                  {alert.item.linked_case_id && (
                    <p data-ui="text" data-variant="caption" data-tone="muted" className="mt-1 text-[10px]">
                      linked case: {alert.item.linked_case_id}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section data-ui="section" className="pb-8">
        <h2 className="mb-4 text-lg font-semibold">Community 热点控制</h2>
        <div data-ui="stack" data-direction="col" data-gap="4">
          <p data-ui="text" data-variant="caption" data-tone="muted" className="text-[10px]">
            这里会复用 config proposal → validate → approve → apply 流程，对
            `rules_json.hot_topic_policy_v1` 做高风险收紧。
          </p>
          <Input
            placeholder="Community ID"
            value={hotTopic.communityPolicyId}
            onChange={(event) => hotTopic.setCommunityPolicyId(event.target.value)}
          />
          <div data-ui="grid" data-gap="3" className="lg:grid-cols-2">
            <div data-ui="stack" data-direction="col" data-gap="1">
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                热点模式
              </label>
              <Select
                value={hotTopic.communityPolicyMode}
                onValueChange={(value) =>
                  hotTopic.setCommunityPolicyMode(value as typeof hotTopic.communityPolicyMode)
                }
              >
                <SelectTrigger aria-label="热点模式">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(HOT_TOPIC_MODE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div data-ui="stack" data-direction="col" data-gap="1">
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                用户提示文案
              </label>
              <Input
                placeholder="例如：热点内容可能仅保留直达访问"
                value={hotTopic.communityPolicyCopy}
                onChange={(event) => hotTopic.setCommunityPolicyCopy(event.target.value)}
              />
            </div>
          </div>
          <div data-ui="stack" data-direction="col" data-gap="2">
            <label className="mb-1 block text-sm font-medium text-muted-foreground">
              允许进入热点推荐的域
            </label>
            <div className="flex flex-wrap gap-2">
              {COMMUNITY_TOPIC_DOMAIN_OPTIONS.map((domain) => (
                <label
                  key={domain}
                  className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                >
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
            <p data-ui="text" data-variant="caption" data-tone="muted" className="text-[10px]">
              已完成 proposal/validate/approve/apply，当前版本：
              {hotTopic.applyCommunityPolicyMutation.data.data.version?.id ?? 'scheduled'}
            </p>
          )}
          {hotTopic.applyCommunityPolicyMutation.isError && (
            <p data-ui="text" data-variant="caption" data-tone="danger">
              {hotTopic.applyCommunityPolicyMutation.error.message}
            </p>
          )}
        </div>
      </section>
    </div>
  )
}
