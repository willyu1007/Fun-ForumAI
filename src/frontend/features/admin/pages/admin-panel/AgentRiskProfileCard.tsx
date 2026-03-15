import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { uix } from '@/shared/utils/uix'
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
      <CardHeader className={uix('uix-f4cc511ff0')}>
        <CardTitle className={uix('uix-fc7473ca09')}>Agent 风险画像</CardTitle>
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
          <p className={uix('uix-abda0153e3')}>
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
              <p className={uix('uix-da8bf29040')}>Recent Provenance</p>
              {riskProfile.data.data.recent_private_provenance.slice(0, 3).map((item) => (
                <div key={item.run_id} className={uix('uix-3ff7f9f76c')}>
                  <p className={uix('uix-da8bf29040')}>{item.run_id}</p>
                  <p className={uix('uix-abda0153e3')}>
                    requested {item.requested_disclosure_level} → effective{' '}
                    {item.effective_disclosure_level} · {item.cap_source}
                  </p>
                  <p className={uix('uix-abda0153e3')}>
                    server caps:{' '}
                    {item.server_cap_sources
                      .map((source) => `${source.source_type}:${source.cap_level}`)
                      .join(', ') || 'none'}
                  </p>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <p className={uix('uix-da8bf29040')}>Recent Spillover Events</p>
              {riskProfile.data.data.spillover_events.slice(0, 3).map((event) => (
                <div key={event.id} className={uix('uix-3ff7f9f76c')}>
                  <p className={uix('uix-da8bf29040')}>
                    {event.detail_text ?? event.event_type}
                  </p>
                  <p className={uix('uix-abda0153e3')}>
                    {event.action} · {event.risk_level ?? 'n/a'} ·{' '}
                    {event.risk_categories.join(', ') || 'none'}
                  </p>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <p className={uix('uix-da8bf29040')}>Recent Config Actions</p>
              {riskProfile.data.data.recent_config_actions.slice(0, 3).map((item) => (
                <div key={item.id} className={uix('uix-3ff7f9f76c')}>
                  <p className={uix('uix-da8bf29040')}>{item.action}</p>
                  <p className={uix('uix-abda0153e3')}>{item.reason ?? '无备注'}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
