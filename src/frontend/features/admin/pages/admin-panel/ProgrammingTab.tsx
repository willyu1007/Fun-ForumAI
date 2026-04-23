import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { useAdminLaunchProgrammingOps } from '@/api/hooks'

function formatPercent(value: number | null) {
  if (value === null) return 'n/a'
  return `${Math.round(value * 100)}%`
}

function formatRoleMix(roleMix: Record<string, number>) {
  const entries = Object.entries(roleMix)
  if (entries.length === 0) return '暂无'
  return entries.map(([role, count]) => `${role}×${count}`).join(' · ')
}

function HealthBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <Badge
      variant="outline"
      className={
        ok
          ? 'border-success/40 bg-success/10 text-success'
          : 'border-warning/40 bg-warning/10 text-warning'
      }
    >
      {label}
    </Badge>
  )
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section data-ui="section" className="border-b border-border pb-6 mb-6 last:border-0 last:pb-0 last:mb-0">
      <div className="mb-4 space-y-1">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p data-ui="text" data-variant="caption" data-tone="muted">{description}</p>
      </div>
      {children}
    </section>
  )
}

export function ProgrammingTab() {
  const query = useAdminLaunchProgrammingOps(true)
  const payload = query.data?.data

  if (query.isLoading) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card p-6 text-sm text-muted-foreground">
        正在读取 launch programming ops…
      </div>
    )
  }

  if (query.error || !payload) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card p-6 text-sm text-destructive">
        Programming ops 读面加载失败。
      </div>
    )
  }

  if (!payload.enabled) {
    return (
      <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-6 text-sm text-muted-foreground">
        Programming read model 暂不可用。
      </div>
    )
  }

  return (
    <div data-ui="stack" data-direction="col" data-gap="0">
      <SectionCard
        title="Daypart Baseline"
        description={`按 ${payload.timezone} 排班，当前激活时段：${payload.active_daypart_id ?? 'none'}`}
      >
        <ul data-ui="list" data-variant="admin-rows">
          {payload.dayparts.map((daypart) => {
            const readiness = payload.health.daypart_readiness.find(
              (item) => item.daypart_id === daypart.id,
            )
            return (
              <li
                key={daypart.id}
                className="py-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-sm font-medium text-foreground">{daypart.label}</h4>
                  <Badge variant="outline">{daypart.time_range}</Badge>
                  {readiness ? (
                    <HealthBadge ok={readiness.ok} label={readiness.ok ? 'ready' : 'watch'} />
                  ) : null}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{daypart.objective}</p>
                <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                  <div>目标社区：{daypart.target_communities.join('、')}</div>
                  <div>preferred roles：{daypart.preferred_roles.join(', ')}</div>
                  <div>
                    supply floor：
                    {Object.entries(daypart.supply_floor)
                      .map(([key, value]) => `${key}=${value}`)
                      .join(' · ')}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </SectionCard>

      <SectionCard
        title="Slot Recommendations"
        description="推荐排班只来自 contract 与 frozen roster，不代表人工确认写入。"
      >
        <ul data-ui="list" data-variant="admin-rows">
          {payload.slots.map((slot) => (
            <li
              key={slot.slot_name}
              className="py-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-sm font-medium text-foreground">{slot.slot_name}</h4>
                <Badge variant="outline">{slot.daypart_label}</Badge>
                <Badge variant="outline">{slot.community_name}</Badge>
                <Badge variant="outline">{slot.assignment_source}</Badge>
                {slot.unfilled_required_roles.length > 0 ? (
                  <HealthBadge
                    ok={false}
                    label={`gap: ${slot.unfilled_required_roles.join(', ')}`}
                  />
                ) : (
                  <HealthBadge ok={true} label="contract-ready" />
                )}
              </div>

              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <div className="space-y-1 text-xs text-muted-foreground">
                  <div>required：{slot.required_roles.join(', ')}</div>
                  <div>optional：{slot.optional_roles.join(', ') || 'none'}</div>
                  <div>fallback：{slot.fallback_roles.join(', ') || 'none'}</div>
                  <div>role mix：{formatRoleMix(slot.role_mix)}</div>
                  <div>blocked pairings：{slot.blocked_pairings.join(' · ') || 'none'}</div>
                </div>

                <div className="space-y-1 text-xs text-muted-foreground">
                  <div>
                    assigned：
                    {slot.assigned_agents
                      .map((agent) => `${agent.display_name}(${agent.requested_role})`)
                      .join(' · ') || 'none'}
                  </div>
                  <div>
                    fallback：
                    {slot.fallback_agents
                      .map((agent) => `${agent.display_name}(${agent.requested_role})`)
                      .join(' · ') || 'none'}
                  </div>
                  <div>handoff：{slot.cross_handoff_communities.join('、') || 'none'}</div>
                  <div>{slot.expected_output_summary}</div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard
        title="Release Health"
        description="按日供给、daypart readiness、visual ratio 和 aftershow pipeline 汇总首发状态。"
      >
        <ul data-ui="list" data-variant="admin-rows">
          <li className="py-3">
            <div className="text-xs text-muted-foreground">visual ratio</div>
            <div className="mt-2 flex flex-wrap gap-2">
              <HealthBadge
                ok={payload.health.visual_ratio_ok}
                label={payload.health.visual_ratio_ok ? 'ok' : 'watch'}
              />
              <Badge variant="outline">
                root {formatPercent(payload.observations.visual_ratio.root_cover_ratio)}
              </Badge>
              <Badge variant="outline">
                note {formatPercent(payload.observations.visual_ratio.note_cover_ratio)}
              </Badge>
              <Badge variant="outline">
                highlight {formatPercent(payload.observations.visual_ratio.highlight_visual_ratio)}
              </Badge>
            </div>
          </li>

          <li className="py-3">
            <div className="text-xs text-muted-foreground">aftershow pipeline</div>
            <div className="mt-2 flex flex-wrap gap-2">
              <HealthBadge
                ok={payload.health.aftershow_pipeline_ok}
                label={payload.health.aftershow_pipeline_ok ? 'ok' : 'watch'}
              />
              <Badge variant="outline">
                {
                  payload.observations.aftershow.filter(
                    (item) => item.published_status === 'published',
                  ).length
                }{' '}
                published
              </Badge>
              <Badge variant="outline">{payload.observations.aftershow.length} candidates</Badge>
            </div>
          </li>

          <li className="py-3">
            <div className="text-xs text-muted-foreground">warning count</div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="outline">{payload.health.warning_count} warnings</Badge>
              {payload.observations.visual_ratio.budget_remaining_cny !== null ? (
                <Badge variant="outline">
                  budget {payload.observations.visual_ratio.budget_remaining_cny} CNY
                </Badge>
              ) : null}
            </div>
          </li>
        </ul>

        <div className="mt-4 space-y-2">
          <h4 className="text-sm font-medium text-foreground">Warnings</h4>
          {payload.health.warnings.length === 0 ? (
            <p data-ui="text" data-variant="caption" data-tone="muted">当前没有触发 warning。</p>
          ) : (
            <ul data-ui="list" data-variant="admin-rows">
              {payload.health.warnings.map((warning) => (
                <li
                  key={`${warning.code}-${warning.affected_community_slug ?? warning.affected_daypart ?? 'global'}`}
                  className="py-2 text-xs text-warning"
                >
                  {warning.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      </SectionCard>

      <SectionCard
        title="Visual / Highlight / Aftershow"
        description="只读观察 visual 比例、高光候选和 aftershow 触发状态。"
      >
        <div data-ui="grid" data-gap="5" className="lg:grid-cols-3">
          <div>
            <h4 className="text-sm font-medium text-foreground">视觉内容占比</h4>
            <ul data-ui="list" data-variant="admin-rows" className="mt-2 text-xs text-muted-foreground">
              <li className="py-2">
                root cover ratio：
                {formatPercent(payload.observations.visual_ratio.root_cover_ratio)}
              </li>
              <li className="py-2">
                note cover ratio：
                {formatPercent(payload.observations.visual_ratio.note_cover_ratio)}
              </li>
              <li className="py-2">
                highlight visual ratio：
                {formatPercent(payload.observations.visual_ratio.highlight_visual_ratio)}
              </li>
              <li className="py-2">
                reject reasons：
                {Object.entries(payload.observations.visual_ratio.reject_reason_counts)
                  .map(([key, value]) => `${key}=${value}`)
                  .join(' · ') || 'none'}
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-medium text-foreground">高光候选内容</h4>
            <ul data-ui="list" data-variant="admin-rows" className="mt-2">
              {payload.observations.highlight_candidates.slice(0, 5).map((item) => (
                <li
                  key={item.candidate_post_id}
                  className="py-2 text-xs text-muted-foreground"
                >
                  <div className="font-medium text-foreground">{item.title}</div>
                  <div className="mt-1">
                    {item.community_name} · {item.shelf_target}
                  </div>
                  <div className="mt-1">
                    {item.rejected_reason ?? item.hero_reason ?? 'candidate_watch'}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-medium text-foreground">盘点与后日谈</h4>
            <ul data-ui="list" data-variant="admin-rows" className="mt-2">
              {payload.observations.aftershow.slice(0, 5).map((item) => (
                <li
                  key={item.candidate_post_id}
                  className="py-2 text-xs text-muted-foreground"
                >
                  <div className="font-medium text-foreground">{item.title}</div>
                  <div className="mt-1">{item.community_name}</div>
                  <div className="mt-1">
                    {item.trigger_status} · {item.published_status} · {item.fallback_status}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Governance / Rollback"
        description="这里只展示治理引用和 runbook，不复制现有治理写操作。"
      >
        <div data-ui="grid" data-gap="5" className="lg:grid-cols-2">
          <div>
            <h4 className="text-sm font-medium text-foreground">社区生命周期</h4>
            <ul data-ui="list" data-variant="admin-rows" className="mt-2">
              {payload.governance_references.communities.slice(0, 8).map((community) => (
                <li
                  key={community.community_slug}
                  className="py-2 text-xs text-muted-foreground"
                >
                  <div className="font-medium text-foreground">{community.community_name}</div>
                  <div className="mt-1">
                    {community.community_lifecycle_state} · wave {community.launch_wave ?? 'n/a'}
                  </div>
                  <div className="mt-1">headline priority {community.headline_priority}</div>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-medium text-foreground">孵化参考数据</h4>
            <ul data-ui="list" data-variant="admin-rows" className="mt-2">
              {payload.governance_references.incubation.length === 0 ? (
                <li className="py-2 text-xs text-muted-foreground">
                  当前没有 proposal / incubation 引用。
                </li>
              ) : (
                payload.governance_references.incubation.map((item) => (
                  <li
                    key={item.proposal_id}
                    className="py-2 text-xs text-muted-foreground"
                  >
                    <div className="font-medium text-foreground">{item.community_name}</div>
                    <div className="mt-1">{item.incubation_status}</div>
                    <div className="mt-1">
                      {item.merge_recommendation ?? 'no merge recommendation'}
                    </div>
                    <div className="mt-1">{item.last_admin_action ?? 'no admin action yet'}</div>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div>
            <h4 className="text-sm font-medium text-foreground">回滚指令</h4>
            <ul data-ui="list" data-variant="admin-rows" className="mt-2">
              {payload.rollback_order.map((item) => (
                <li
                  key={item}
                  className="py-2 text-xs text-muted-foreground"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-medium text-foreground">演练检查清单</h4>
            <ul data-ui="list" data-variant="admin-rows" className="mt-2">
              {payload.drill_checklist.map((item) => (
                <li
                  key={item}
                  className="py-2 text-xs text-muted-foreground"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </SectionCard>
    </div>
  )
}
