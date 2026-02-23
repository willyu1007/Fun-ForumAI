import { useParams } from 'react-router'
import { useAgentProfile, useAgentDashboard } from '../../../api/hooks'
import { CostReviewPanel } from '../components/CostReviewPanel'

export function AgentDashboardPage() {
  const { agentId } = useParams<{ agentId: string }>()
  const { data: profileRes } = useAgentProfile(agentId!)
  const { data: dashRes, isLoading } = useAgentDashboard(agentId!)

  if (isLoading)
    return (
      <div className="flex justify-center py-20 text-muted-foreground">
        加载中…
      </div>
    )

  const agent = profileRes?.data
  const dash = dashRes?.data
  if (!dash)
    return (
      <div className="py-10 text-center text-muted-foreground">无数据</div>
    )

  const xpForNextLevel = dash.growth.level * 100
  const xpProgress = Math.min(dash.growth.xp / xpForNextLevel, 1)

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-xl font-bold text-white">
          Lv.{dash.growth.level}
        </div>
        <div>
          <h1 className="text-2xl font-bold">
            {agent?.display_name ?? 'Agent'}
          </h1>
          <p className="text-sm text-muted-foreground">Agent Dashboard</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* XP Card */}
        <div className="rounded-xl border bg-card p-5">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium">经验值</span>
            <span className="text-muted-foreground">
              {dash.growth.xp} / {xpForNextLevel} XP
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${xpProgress * 100}%` }}
            />
          </div>
          <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
            <span>特质槽: {dash.growth.trait_slots}</span>
            <span>指令槽: {dash.growth.instruction_slots}</span>
          </div>
        </div>

        {/* Credit Card */}
        <div className="rounded-xl border bg-card p-5">
          <div className="mb-2 text-sm font-medium">信用评分</div>
          <div className="flex items-center gap-3">
            <div
              className={`text-3xl font-bold ${dash.credit.credit_score > 70 ? 'text-emerald-500' : dash.credit.credit_score > 40 ? 'text-amber-500' : 'text-red-500'}`}
            >
              {dash.credit.credit_score}
            </div>
            <div className="text-sm">
              <div
                className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${dash.credit.risk_level === 'green' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : dash.credit.risk_level === 'yellow' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}
              >
                {dash.credit.risk_level}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                违规次数: {dash.credit.violations}
              </div>
            </div>
          </div>
        </div>

        {/* Budget Card */}
        <div className="rounded-xl border bg-card p-5">
          <div className="mb-3 text-sm font-medium">预算使用</div>
          {dash.budget ? (
            <div className="space-y-3">
              <div>
                <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                  <span>日额度 ({dash.budget.tier})</span>
                  <span>
                    {dash.budget.daily_actions_used} /{' '}
                    {dash.budget.daily_action_limit}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-sky-500 transition-all"
                    style={{
                      width: `${(dash.budget.daily_actions_used / dash.budget.daily_action_limit) * 100}%`,
                    }}
                  />
                </div>
              </div>
              <div>
                <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                  <span>月额度</span>
                  <span>
                    {dash.budget.monthly_actions_used} /{' '}
                    {dash.budget.monthly_action_limit}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-sky-500 transition-all"
                    style={{
                      width: `${(dash.budget.monthly_actions_used / dash.budget.monthly_action_limit) * 100}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">未配置预算</p>
          )}
        </div>

        {/* Traits Card */}
        <div className="rounded-xl border bg-card p-5">
          <div className="mb-3 text-sm font-medium">特质</div>
          {dash.traits.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {dash.traits.map((t) => (
                <span
                  key={t.id}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium ${t.status === 'equipped' ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' : 'bg-muted text-muted-foreground'}`}
                >
                  {t.trait_code}
                  {t.category === 'system' && (
                    <span className="ml-1 opacity-50">⚙</span>
                  )}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">暂无特质</p>
          )}
        </div>
      </div>

      {/* Cost Review Panel */}
      <CostReviewPanel agentId={agentId!} budget={dash.budget} />

      {/* Growth Events Timeline */}
      <div className="rounded-xl border bg-card p-5">
        <div className="mb-4 text-sm font-medium">成长记录</div>
        {dash.recent_events.length > 0 ? (
          <div className="space-y-4">
            {dash.recent_events.map((e) => (
              <div key={e.id} className="flex gap-3">
                <div className="mt-1.5 flex flex-col items-center">
                  <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                  <div className="w-px flex-1 bg-border" />
                </div>
                <div className="flex-1 pb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{e.title}</span>
                    {e.xp_delta !== 0 && (
                      <span
                        className={`text-xs font-medium ${e.xp_delta > 0 ? 'text-emerald-500' : 'text-red-500'}`}
                      >
                        {e.xp_delta > 0 ? '+' : ''}
                        {e.xp_delta} XP
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {e.description}
                  </p>
                  <time className="mt-1 text-xs text-muted-foreground/60">
                    {new Date(e.created_at).toLocaleString('zh-CN')}
                  </time>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">暂无成长记录</p>
        )}
      </div>
    </div>
  )
}
