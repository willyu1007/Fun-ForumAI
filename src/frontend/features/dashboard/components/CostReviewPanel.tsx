import { useState } from 'react'
import { useAgentCostReview, useBudgetTiers, useInitBudget, useChangeBudgetTier } from '../../../api/hooks'
import type { AgentBudgetInfo } from '../../../api/types'

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
      <div className="rounded-xl border bg-card p-5">
        <div className="mb-3 text-sm font-medium">预算档位</div>
        {budget ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-700 dark:bg-sky-900/30 dark:text-sky-400">
              当前: {budget.tier}
            </span>
            {tiers &&
              Object.keys(tiers).map((t) => (
                <button
                  key={t}
                  disabled={t === budget.tier || changeTier.isPending}
                  onClick={() => changeTier.mutate(t)}
                  className="rounded-md border px-2.5 py-1 text-xs transition-colors hover:bg-accent disabled:opacity-40"
                >
                  {t}
                </button>
              ))}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">未配置预算</span>
            {tiers &&
              Object.entries(tiers).map(([t, cfg]) => (
                <button
                  key={t}
                  disabled={initBudget.isPending}
                  onClick={() => initBudget.mutate(t)}
                  className="rounded-md border px-2.5 py-1 text-xs transition-colors hover:bg-accent disabled:opacity-40"
                >
                  {t} ({cfg.daily_action_limit}/日)
                </button>
              ))}
          </div>
        )}
      </div>

      {/* Cost Review */}
      <div className="rounded-xl border bg-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-medium">成本回顾</span>
          <div className="flex gap-1">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`rounded-md px-2 py-0.5 text-xs transition-colors ${
                  days === d
                    ? 'bg-foreground text-background'
                    : 'bg-muted text-muted-foreground hover:bg-accent'
                }`}
              >
                {d}天
              </button>
            ))}
          </div>
        </div>

        {costLoading ? (
          <p className="text-sm text-muted-foreground">加载中…</p>
        ) : cost ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{cost.action_count}</div>
                <div className="text-xs text-muted-foreground">总操作数</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {((cost.total_tokens_in + cost.total_tokens_out) / 1000).toFixed(1)}k
                </div>
                <div className="text-xs text-muted-foreground">总 Token</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {cost.action_count > 0
                    ? Math.round((cost.total_tokens_in + cost.total_tokens_out) / cost.action_count)
                    : 0}
                </div>
                <div className="text-xs text-muted-foreground">平均 Token/次</div>
              </div>
            </div>

            {Object.keys(cost.by_action_type).length > 0 && (
              <div>
                <div className="mb-2 text-xs font-medium text-muted-foreground">按操作类型</div>
                <div className="space-y-1.5">
                  {Object.entries(cost.by_action_type).map(([type, data]) => (
                    <div key={type} className="flex items-center justify-between text-xs">
                      <span className="font-mono">{type}</span>
                      <span className="text-muted-foreground">
                        {data.count}次 · {((data.tokens_in + data.tokens_out) / 1000).toFixed(1)}k tokens
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">暂无成本数据</p>
        )}
      </div>
    </div>
  )
}
