import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type { AdminPanelController } from './use-admin-panel-controller'
import { AgentRiskProfileCard } from './AgentRiskProfileCard'
import {
  ACTION_LABELS,
  ACTION_OPTIONS,
  TARGET_OPTIONS,
  STATE_LABELS,
  VISIBILITY_LABELS,
} from './constants'
import { DisclosureCapCard } from './DisclosureCapCard'
import { IdentityReviewCard } from './IdentityReviewCard'
import { ReviewQueueCard } from './ReviewQueueCard'

type GovernanceTabProps = Pick<
  AdminPanelController,
  'auth' | 'governance' | 'riskProfile' | 'disclosureCaps' | 'review'
>

export function GovernanceTab({
  auth,
  governance,
  riskProfile,
  disclosureCaps,
  review,
}: GovernanceTabProps) {
  return (
    <div className={"mt-4 space-y-4"}>
      <Card>
        <CardHeader className={"pb-2"}>
          <CardTitle className={"text-sm"}>执行治理操作</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className={"mb-1 block text-[10px] font-medium text-muted-foreground"}>操作类型</label>
              <select
                value={governance.action}
                onChange={(event) =>
                  governance.setAction(event.target.value as typeof governance.action)
                }
                className={"h-8 w-full rounded-md border bg-background px-2 text-xs"}
              >
                {ACTION_OPTIONS.map((action) => (
                  <option key={action.value} value={action.value}>
                    {action.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={"mb-1 block text-[10px] font-medium text-muted-foreground"}>目标类型</label>
              <select
                value={governance.targetType}
                onChange={(event) => governance.setTargetType(event.target.value)}
                className={"h-8 w-full rounded-md border bg-background px-2 text-xs"}
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
            value={governance.targetId}
            onChange={(event) => governance.setTargetId(event.target.value)}
            className={"h-8 text-xs"}
          />
          <Input
            placeholder="原因（选填）"
            value={governance.reason}
            onChange={(event) => governance.setReason(event.target.value)}
            className={"h-8 text-xs"}
          />
          <Button
            size="sm"
            onClick={() => {
              void governance.handleSubmit()
            }}
            disabled={governance.mutation.isPending || !governance.targetId.trim()}
          >
            {governance.mutation.isPending ? '执行中…' : '执行操作'}
          </Button>
          {governance.mutation.isError && (
            <p className={"text-xs text-destructive"}>
              {governance.mutation.error.message}
            </p>
          )}
        </CardContent>
      </Card>

      {governance.history.length > 0 && (
        <section>
          <h2 className={"mb-2 text-sm font-semibold"}>操作记录</h2>
          <div className="space-y-1">
            {governance.history.map((result, index) => (
              <div key={index} className={"flex items-center justify-between rounded-md border bg-card px-3 py-2"}>
                <div>
                  <p className={"text-xs font-medium"}>
                    {ACTION_LABELS[result.action] ?? result.action} → {result.target_id}
                  </p>
                  <p className={"text-[10px] text-muted-foreground"}>
                    {result.new_visibility &&
                      `可见性：${VISIBILITY_LABELS[result.new_visibility] ?? result.new_visibility}`}
                    {result.new_state &&
                      ` · 状态：${STATE_LABELS[result.new_state] ?? result.new_state}`}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={
                    result.success ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
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
        <AgentRiskProfileCard governance={governance} riskProfile={riskProfile} />
        <DisclosureCapCard disclosureCaps={disclosureCaps} />
      </div>

      <ReviewQueueCard auth={auth} review={review} />
      <IdentityReviewCard review={review} />
    </div>
  )
}
