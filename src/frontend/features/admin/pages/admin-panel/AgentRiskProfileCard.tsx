import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useGovernanceController, useRiskProfileController } from './use-governance-controller'

export function AgentRiskProfileCard() {
  const governance = useGovernanceController()
  const riskProfile = useRiskProfileController()

  return (
    <section data-ui="section" data-variant="default" data-padding="md" className="border-b">
      <h2 data-ui="text" data-variant="h3" className="mb-4 font-semibold">智能体风险画像</h2>
      <div data-ui="stack" data-direction="col" data-gap="4">
        <div className="flex gap-2">
          <label htmlFor="agent-risk-profile-id" className="sr-only">
            Agent ID
          </label>
          <Input
            id="agent-risk-profile-id"
            name="agent-risk-profile-id"
            placeholder="Agent ID"
            value={riskProfile.agentId}
            onChange={(event) => riskProfile.setAgentId(event.target.value)}
          />
        </div>
        {!riskProfile.data?.data && (
          <p data-ui="text" data-variant="caption" data-tone="muted" className="text-[10px]">
            输入 Agent ID 后查看外溢事件、生成记录与限流历史。
          </p>
        )}
        {riskProfile.data?.data && (
          <div data-ui="stack" data-direction="col" data-gap="4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">status {riskProfile.data.data.agent.status}</Badge>
              <Badge variant="outline">
                生效限流等级: {riskProfile.data.data.effective_disclosure_cap ?? 'none'}
              </Badge>
              <Badge variant="outline">
                外溢事件: {riskProfile.data.data.spillover_events.length}
              </Badge>
              <Badge variant="outline">
                当前限流规则: {riskProfile.data.data.active_cap_overrides.length}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={
                      governance.mutation.isPending ||
                      riskProfile.data.data.agent.status === 'LIMITED'
                    }
                  >
                    限制当前 Agent
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>确认限制 Agent</DialogTitle>
                    <DialogDescription>
                      您确定要限制此 Agent 吗？这会将其转为人工审核模式。
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline">取消</Button>
                    </DialogClose>
                    <DialogClose asChild>
                      <Button
                        variant="destructive"
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
                        确认限制
                      </Button>
                    </DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
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
            <div data-ui="stack" data-direction="col" data-gap="2">
              <p data-ui="text" data-variant="caption" className="font-medium">最近生成记录</p>
              <ul data-ui="list" data-variant="admin-rows" className="space-y-2">
                {riskProfile.data.data.recent_private_provenance.slice(0, 3).map((item) => (
                  <li key={item.run_id} className="flex flex-col justify-center rounded-md border bg-card px-3 py-2">
                    <p data-ui="text" data-variant="caption" className="font-medium">{item.run_id}</p>
                    <p data-ui="text" data-variant="caption" data-tone="muted" className="text-[10px]">
                      请求等级 {item.requested_disclosure_level} → 实际生效{' '}
                      {item.effective_disclosure_level} · {item.cap_source}
                    </p>
                    <p data-ui="text" data-variant="caption" data-tone="muted" className="text-[10px]">
                      服务器限流:{' '}
                      {item.server_cap_sources
                        .map((source) => `${source.source_type}:${source.cap_level}`)
                        .join(', ') || 'none'}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
            <div data-ui="stack" data-direction="col" data-gap="2">
              <p data-ui="text" data-variant="caption" className="font-medium">最近外溢事件</p>
              <ul data-ui="list" data-variant="admin-rows" className="space-y-2">
                {riskProfile.data.data.spillover_events.slice(0, 3).map((event) => (
                  <li key={event.id} className="flex flex-col justify-center rounded-md border bg-card px-3 py-2">
                    <p data-ui="text" data-variant="caption" className="font-medium">
                      {event.detail_text ?? event.event_type}
                    </p>
                    <p data-ui="text" data-variant="caption" data-tone="muted" className="text-[10px]">
                      {event.action} · {event.risk_level ?? 'n/a'} ·{' '}
                      {event.risk_categories.join(', ') || 'none'}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
            <div data-ui="stack" data-direction="col" data-gap="2">
              <p data-ui="text" data-variant="caption" className="font-medium">最近配置变更</p>
              <ul data-ui="list" data-variant="admin-rows" className="space-y-2">
                {riskProfile.data.data.recent_config_actions.slice(0, 3).map((item) => (
                  <li key={item.id} className="flex flex-col justify-center rounded-md border bg-card px-3 py-2">
                    <p data-ui="text" data-variant="caption" className="font-medium">{item.action}</p>
                    <p data-ui="text" data-variant="caption" data-tone="muted" className="text-[10px]">{item.reason ?? '无备注'}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
