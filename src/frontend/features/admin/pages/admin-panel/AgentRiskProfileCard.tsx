import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type { AdminPanelController } from './use-admin-panel-controller'

type GovernanceSlice = AdminPanelController['governance']
type RiskProfileSlice = AdminPanelController['riskProfile']

export function AgentRiskProfileCard({
  governance,
  riskProfile,
}: {
  governance: GovernanceSlice
  riskProfile: RiskProfileSlice
}) {
  return (
    <Card>
      <CardHeader className={"pb-2"}>
        <CardTitle className={"text-sm"}>Agent 风险画像</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            placeholder="Agent ID"
            value={riskProfile.agentId}
            onChange={(event) => riskProfile.setAgentId(event.target.value)}
          />
        </div>
        {!riskProfile.data?.data && (
          <p className={"text-[10px] text-muted-foreground"}>
            输入 Agent ID 后查看 spillover、provenance 与 cap 历史。
          </p>
        )}
        {riskProfile.data?.data && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">status {riskProfile.data.data.agent.status}</Badge>
              <Badge variant="outline">
                effective cap {riskProfile.data.data.effective_disclosure_cap ?? 'none'}
              </Badge>
              <Badge variant="outline">
                spillover events {riskProfile.data.data.spillover_events.length}
              </Badge>
              <Badge variant="outline">
                active caps {riskProfile.data.data.active_cap_overrides.length}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={
                  governance.mutation.isPending ||
                  riskProfile.data.data.agent.status === 'LIMITED'
                }
                onClick={async () => {
                  const result = await governance.mutation.mutateAsync({
                    action: 'limit_agent',
                    target_type: 'agent',
                    target_id: riskProfile.data!.data.agent.id,
                    reason: 'hot_topic_manual_review_only',
                  })
                  governance.pushGovernanceResult(result.data)
                }}
              >
                限制当前 Agent
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={
                  governance.mutation.isPending ||
                  riskProfile.data.data.agent.status === 'ACTIVE'
                }
                onClick={async () => {
                  const result = await governance.mutation.mutateAsync({
                    action: 'restore_agent',
                    target_type: 'agent',
                    target_id: riskProfile.data!.data.agent.id,
                    reason: 'restore_hot_topic_policy',
                  })
                  governance.pushGovernanceResult(result.data)
                }}
              >
                恢复当前 Agent
              </Button>
            </div>
            <div className="space-y-2">
              <p className={"text-xs font-medium"}>Recent Provenance</p>
              {riskProfile.data.data.recent_private_provenance.slice(0, 3).map((item) => (
                <div key={item.run_id} className={"rounded-md border p-3"}>
                  <p className={"text-xs font-medium"}>{item.run_id}</p>
                  <p className={"text-[10px] text-muted-foreground"}>
                    requested {item.requested_disclosure_level} → effective{' '}
                    {item.effective_disclosure_level} · {item.cap_source}
                  </p>
                  <p className={"text-[10px] text-muted-foreground"}>
                    server caps:{' '}
                    {item.server_cap_sources
                      .map((source) => `${source.source_type}:${source.cap_level}`)
                      .join(', ') || 'none'}
                  </p>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <p className={"text-xs font-medium"}>Recent Spillover Events</p>
              {riskProfile.data.data.spillover_events.slice(0, 3).map((event) => (
                <div key={event.id} className={"rounded-md border p-3"}>
                  <p className={"text-xs font-medium"}>
                    {event.detail_text ?? event.event_type}
                  </p>
                  <p className={"text-[10px] text-muted-foreground"}>
                    {event.action} · {event.risk_level ?? 'n/a'} ·{' '}
                    {event.risk_categories.join(', ') || 'none'}
                  </p>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <p className={"text-xs font-medium"}>Recent Config Actions</p>
              {riskProfile.data.data.recent_config_actions.slice(0, 3).map((item) => (
                <div key={item.id} className={"rounded-md border p-3"}>
                  <p className={"text-xs font-medium"}>{item.action}</p>
                  <p className={"text-[10px] text-muted-foreground"}>{item.reason ?? '无备注'}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
