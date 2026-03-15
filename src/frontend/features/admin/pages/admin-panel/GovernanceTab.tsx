import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { uix } from '@/shared/utils/uix'
import type { AdminPanelController } from './use-admin-panel-controller'
import {
  ACTION_LABELS,
  ACTION_OPTIONS,
  TARGET_OPTIONS,
  STATE_LABELS,
  VISIBILITY_LABELS,
} from './constants'
import {
  AgentRiskProfileCard,
  DisclosureCapCard,
  IdentityReviewCard,
  ReviewQueueCard,
} from './GovernanceSections'

export function GovernanceTab({ controller }: { controller: AdminPanelController }) {
  return (
    <div className={uix('uix-c52b72f5ca')}>
      <Card>
        <CardHeader className={uix('uix-f4cc511ff0')}>
          <CardTitle className={uix('uix-fc7473ca09')}>执行治理操作</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className={uix('uix-b3691fbf2a')}>操作类型</label>
              <select
                value={controller.action}
                onChange={(event) =>
                  controller.setAction(event.target.value as typeof controller.action)
                }
                className={uix('uix-34e5554f24')}
              >
                {ACTION_OPTIONS.map((action) => (
                  <option key={action.value} value={action.value}>
                    {action.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={uix('uix-b3691fbf2a')}>目标类型</label>
              <select
                value={controller.targetType}
                onChange={(event) => controller.setTargetType(event.target.value)}
                className={uix('uix-34e5554f24')}
              >
                {TARGET_OPTIONS.map((target) => (
                  <option key={target.value} value={target.value}>
                    {target.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <Input
            placeholder="目标 ID（如 post_123…）"
            value={controller.targetId}
            onChange={(event) => controller.setTargetId(event.target.value)}
            className={uix('uix-fc76479a37')}
          />
          <Input
            placeholder="原因（选填）"
            value={controller.reason}
            onChange={(event) => controller.setReason(event.target.value)}
            className={uix('uix-fc76479a37')}
          />
          <Button
            size="sm"
            onClick={() => {
              void controller.handleSubmit()
            }}
            disabled={controller.governance.isPending || !controller.targetId.trim()}
          >
            {controller.governance.isPending ? '执行中…' : '执行操作'}
          </Button>
          {controller.governance.isError && (
            <p className={uix('uix-551c237449')}>
              {controller.governance.error.message}
            </p>
          )}
        </CardContent>
      </Card>

      {controller.history.length > 0 && (
        <section>
          <h2 className={uix('uix-673a51ffad')}>操作记录</h2>
          <div className="space-y-1">
            {controller.history.map((result, index) => (
              <div key={index} className={uix('uix-81af913189')}>
                <div>
                  <p className={uix('uix-da8bf29040')}>
                    {ACTION_LABELS[result.action] ?? result.action} → {result.target_id}
                  </p>
                  <p className={uix('uix-abda0153e3')}>
                    {result.new_visibility &&
                      `可见性：${VISIBILITY_LABELS[result.new_visibility] ?? result.new_visibility}`}
                    {result.new_state &&
                      ` · 状态：${STATE_LABELS[result.new_state] ?? result.new_state}`}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={
                    result.success ? uix('uix-6196a83432') : uix('uix-a47175a4cf')
                  }
                >
                  {result.success ? '成功' : '失败'}
                </Badge>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <AgentRiskProfileCard controller={controller} />
        <DisclosureCapCard controller={controller} />
      </div>

      <ReviewQueueCard controller={controller} />
      <IdentityReviewCard controller={controller} />
    </div>
  )
}
