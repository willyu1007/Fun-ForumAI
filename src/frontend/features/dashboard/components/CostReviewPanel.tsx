import { useState } from 'react'
import { useAgentCostReview, useBudgetTiers, useInitBudget, useChangeBudgetTier } from '@/api/hooks'
import type { AgentBudgetInfo } from '@/api/types'
import { uix } from '@/shared/utils/uix'
interface Props {
  agentId: string
  budget: AgentBudgetInfo | null
}
export function CostReviewPanel({ agentId, budget }: Props) {
  const [days, setDays] = useState(30)
  const { data: costRes, isLoading: costLoading } = useAgentCostReview(agentId, days)
  const { data: tiersRes } = useBudgetTiers()
  const initBudget = useInitBudget(agentId)
  const changeTier = useChangeBudgetTier(agentId)
  const cost = costRes?.data
  const tiers = tiersRes?.data
  return (
    <div className="space-y-6">
      {/* Budget Tier Management */}
      <div className={uix('uix-a1316bf8fb')}>
        <div className={uix('uix-42efb498d3')}>预算档位</div>
        {budget ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className={uix('uix-061645c9ff')}>当前: {budget.tier}</span>
            {tiers &&
              Object.keys(tiers).map((t) => (
                <button
                  key={t}
                  disabled={t === budget.tier || changeTier.isPending}
                  onClick={() => changeTier.mutate(t)}
                  className={uix('uix-914dffbb91')}
                >
                  {t}
                </button>
              ))}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <span className={uix('uix-26f026f8ad')}>未配置预算</span>
            {tiers &&
              Object.entries(tiers).map(([t, cfg]) => (
                <button
                  key={t}
                  disabled={initBudget.isPending}
                  onClick={() => initBudget.mutate(t)}
                  className={uix('uix-914dffbb91')}
                >
                  {t} ({cfg.daily_action_limit}/日)
                </button>
              ))}
          </div>
        )}
      </div>

      {/* Cost Review */}
      <div className={uix('uix-a1316bf8fb')}>
        <div className={uix('uix-869291ae0a')}>
          <span className={uix('uix-aaa307c4ab')}>成本回顾</span>
          <div className="flex gap-1">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`${uix('uix-round-button-compact')} ${
                  days === d ? uix('uix-c5cfd5db2c') : uix('uix-9e02d96b5c')
                }`}
              >
                {d}天
              </button>
            ))}
          </div>
        </div>

        {costLoading ? (
          <p className={uix('uix-26f026f8ad')}>加载中…</p>
        ) : cost ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className={uix('uix-ca6bf63030')}>
                <div className={uix('uix-b92aee1b28')}>{cost.action_count}</div>
                <div className={uix('uix-25be576b96')}>总操作数</div>
              </div>
              <div className={uix('uix-ca6bf63030')}>
                <div className={uix('uix-b92aee1b28')}>
                  {((cost.total_tokens_in + cost.total_tokens_out) / 1000).toFixed(1)}k
                </div>
                <div className={uix('uix-25be576b96')}>总 Token</div>
              </div>
              <div className={uix('uix-ca6bf63030')}>
                <div className={uix('uix-b92aee1b28')}>
                  {cost.action_count > 0
                    ? Math.round((cost.total_tokens_in + cost.total_tokens_out) / cost.action_count)
                    : 0}
                </div>
                <div className={uix('uix-25be576b96')}>平均 Token/次</div>
              </div>
            </div>

            {Object.keys(cost.by_action_type).length > 0 && (
              <div>
                <div className={uix('uix-c814f31939')}>按操作类型</div>
                <div className="space-y-1.5">
                  {Object.entries(cost.by_action_type).map(([type, data]) => (
                    <div key={type} className={uix('uix-7c3cd25611')}>
                      <span className={uix('uix-0e65706bcc')}>{type}</span>
                      <span className={uix('uix-bfa6031907')}>
                        {data.count}次 · {((data.tokens_in + data.tokens_out) / 1000).toFixed(1)}k
                        tokens
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className={uix('uix-26f026f8ad')}>暂无成本数据</p>
        )}
      </div>
    </div>
  )
}
