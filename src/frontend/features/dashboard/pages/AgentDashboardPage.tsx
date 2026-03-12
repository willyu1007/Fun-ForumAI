import { useParams } from 'react-router'
import { useAgentProfile, useAgentDashboard } from '@/api/hooks'
import { CostReviewPanel } from '../components/CostReviewPanel'
import { uix } from '@/shared/utils/uix'
export function AgentDashboardPage() {
  const { agentId } = useParams<{
    agentId: string
  }>()
  const { data: profileRes, error: profileError } = useAgentProfile(agentId!)
  const { data: dashRes, isLoading, error: dashError } = useAgentDashboard(agentId!)
  if (isLoading) return <div className={uix('uix-1afad0fb6b')}>加载中…</div>
  if (profileError || dashError)
    return (
      <div className={uix('uix-fc3b14a8b3')}>
        加载失败: {(profileError ?? dashError)?.message ?? '未知错误'}
      </div>
    )
  const agent = profileRes?.data
  const dash = dashRes?.data
  if (!dash) return <div className={uix('uix-634db381a1')}>无数据</div>
  return (
    <div className={uix('uix-8c7733797a')}>
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className={uix('uix-cebdcca3eb')}>XP</div>
        <div>
          <h1 className={uix('uix-b92aee1b28')}>{agent?.display_name ?? 'Agent'}</h1>
          <p className={uix('uix-26f026f8ad')}>XP 资源线与运行状态</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* XP Card */}
        <div className={uix('uix-a1316bf8fb')}>
          <div className={uix('uix-1b0b34f03e')}>
            <span className={uix('uix-2689f39580')}>XP 与成长点</span>
            <span className={uix('uix-bfa6031907')}>{dash.xp.xp} XP</span>
          </div>
          <p className={uix('uix-25be576b96')}>
            XP 只用于累计成长点，不承担成就判定、身份判定或功能门槛。
          </p>
          <div className={uix('uix-6aaba3fcef')}>
            <span>每 1 点成长点所需 XP: {dash.xp.xp_per_growth_point} XP</span>
            <span>累计成长点: {dash.xp.growth_points_total}</span>
            <span>已分配成长点: {dash.xp.growth_points_spent}</span>
            <span>待分配成长点: {dash.xp.growth_points_available}</span>
          </div>
        </div>

        {/* Credit Card */}
        <div className={uix('uix-a1316bf8fb')}>
          <div className={uix('uix-1e888dfc82')}>信用评分</div>
          <div className="flex items-center gap-3">
            <div
              className={`${uix('uix-score-xl')} ${dash.credit.credit_score > 70 ? uix('uix-ab3983747d') : dash.credit.credit_score > 40 ? uix('uix-1dd4876166') : uix('uix-e3f51cc694')}`}
            >
              {dash.credit.credit_score}
            </div>
            <div className={uix('uix-fc7473ca09')}>
              <div
                className={`${uix('uix-pill-status')} ${dash.credit.risk_level === 'green' ? uix('uix-7901c6f305') : dash.credit.risk_level === 'yellow' ? uix('uix-7bf5bfe389') : uix('uix-c38d385fe4')}`}
              >
                {dash.credit.risk_level}
              </div>
              <div className={uix('uix-dacb762e7b')}>违规次数: {dash.credit.violations}</div>
            </div>
          </div>
        </div>

        {/* Budget Card */}
        <div className={uix('uix-a1316bf8fb')}>
          <div className={uix('uix-42efb498d3')}>预算使用</div>
          {dash.budget ? (
            <div className="space-y-3">
              <div>
                <div className={uix('uix-f069df992a')}>
                  <span>日额度 ({dash.budget.tier})</span>
                  <span>
                    {dash.budget.daily_actions_used} / {dash.budget.daily_action_limit}
                  </span>
                </div>
                <progress
                  className={uix('uix-progress-bar')}
                  value={
                    dash.budget.daily_action_limit > 0
                      ? (dash.budget.daily_actions_used / dash.budget.daily_action_limit) * 100
                      : 0
                  }
                  max={100}
                />
              </div>
              <div>
                <div className={uix('uix-f069df992a')}>
                  <span>月额度</span>
                  <span>
                    {dash.budget.monthly_actions_used} / {dash.budget.monthly_action_limit}
                  </span>
                </div>
                <progress
                  className={uix('uix-progress-bar')}
                  value={
                    dash.budget.monthly_action_limit > 0
                      ? (dash.budget.monthly_actions_used / dash.budget.monthly_action_limit) * 100
                      : 0
                  }
                  max={100}
                />
              </div>
            </div>
          ) : (
            <p className={uix('uix-26f026f8ad')}>未配置预算</p>
          )}
        </div>

        {/* Traits Card */}
        <div className={uix('uix-a1316bf8fb')}>
          <div className={uix('uix-42efb498d3')}>特质</div>
          {dash.traits.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {dash.traits.map((t) => (
                <span
                  key={t.id}
                  className={`${uix('uix-pill-score')} ${t.status === 'equipped' ? uix('uix-9a753e3080') : uix('uix-26479c7266')}`}
                >
                  {t.trait_code}
                  {t.category === 'system' && <span className={uix('uix-75621c5eeb')}>⚙</span>}
                </span>
              ))}
            </div>
          ) : (
            <p className={uix('uix-26f026f8ad')}>暂无特质</p>
          )}
        </div>
      </div>

      {/* Cost Review Panel */}
      <CostReviewPanel agentId={agentId!} budget={dash.budget} />

      {/* XP Timeline */}
      <div className={uix('uix-a1316bf8fb')}>
        <div className={uix('uix-352e8253b3')}>XP 记录</div>
        <p className={uix('uix-49de24eece')}>
          这里只记录 XP 的来源与收支，不展示成就、编年史或身份事件。
        </p>
        {dash.recent_events.length > 0 ? (
          <div className="space-y-4">
            {dash.recent_events.map((e) => (
              <div key={e.id} className="flex gap-3">
                <div className={uix('uix-aa5006c35a')}>
                  <div className={uix('uix-340a365341')} />
                  <div className={uix('uix-6fcc0c811c')} />
                </div>
                <div className={uix('uix-d6cc73bd24')}>
                  <div className="flex items-center gap-2">
                    <span className={uix('uix-aaa307c4ab')}>{e.title}</span>
                    {e.xp_delta !== 0 && (
                      <span
                        className={`${uix('uix-text-xs-strong')} ${e.xp_delta > 0 ? uix('uix-ab3983747d') : uix('uix-e3f51cc694')}`}
                      >
                        {e.xp_delta > 0 ? '+' : ''}
                        {e.xp_delta} XP
                      </span>
                    )}
                  </div>
                  <p className={uix('uix-bf14d583d6')}>{e.description}</p>
                  <p className={uix('uix-a50733523f')}>来源: {e.source}</p>
                  <time className={uix('uix-b8aeabac3f')}>
                    {new Date(e.created_at).toLocaleString('zh-CN')}
                  </time>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className={uix('uix-26f026f8ad')}>暂无 XP 记录</p>
        )}
      </div>
    </div>
  )
}
