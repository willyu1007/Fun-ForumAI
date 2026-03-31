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
    <Badge variant="outline" className={ok ? 'border-success/40 bg-success/10 text-success' : 'border-warning/40 bg-warning/10 text-warning'}>
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
    <section className="space-y-3 rounded-2xl border border-border/60 bg-card p-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  )
}

export function ProgrammingTab() {
  const programmingOpsEnabled = import.meta.env.VITE_FF_PROGRAMMING_OPS_V1 === 'true'
  const query = useAdminLaunchProgrammingOps(programmingOpsEnabled)
  const payload = query.data?.data

  if (!programmingOpsEnabled) {
    return (
      <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-6 text-sm text-muted-foreground">
        `VITE_FF_PROGRAMMING_OPS_V1` 未开启，Programming tab 当前保持只读关闭状态。
      </div>
    )
  }

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
        后端 `FF_PROGRAMMING_OPS_V1` 未开启，Programming read model 暂不可用。
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <SectionCard
        title="Daypart Baseline"
        description={`按 ${payload.timezone} 排班，当前激活时段：${payload.active_daypart_id ?? 'none'}`}
      >
        <div className="grid gap-3 lg:grid-cols-2">
          {payload.dayparts.map((daypart) => {
            const readiness = payload.health.daypart_readiness.find((item) => item.daypart_id === daypart.id)
            return (
              <div key={daypart.id} className="rounded-xl border border-border/60 bg-background p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-sm font-medium text-foreground">{daypart.label}</h4>
                  <Badge variant="outline">{daypart.time_range}</Badge>
                  {readiness ? <HealthBadge ok={readiness.ok} label={readiness.ok ? 'ready' : 'watch'} /> : null}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{daypart.objective}</p>
                <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                  <div>目标社区：{daypart.target_communities.join('、')}</div>
                  <div>preferred roles：{daypart.preferred_roles.join(', ')}</div>
                  <div>
                    supply floor：
                    {Object.entries(daypart.supply_floor).map(([key, value]) => `${key}=${value}`).join(' · ')}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </SectionCard>

      <SectionCard
        title="Slot Recommendations"
        description="推荐排班只来自 contract 与 frozen roster，不代表人工确认写入。"
      >
        <div className="space-y-3">
          {payload.slots.map((slot) => (
            <div key={slot.slot_name} className="rounded-xl border border-border/60 bg-background p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-sm font-medium text-foreground">{slot.slot_name}</h4>
                <Badge variant="outline">{slot.daypart_label}</Badge>
                <Badge variant="outline">{slot.community_name}</Badge>
                <Badge variant="outline">{slot.assignment_source}</Badge>
                {slot.unfilled_required_roles.length > 0 ? (
                  <HealthBadge ok={false} label={`gap: ${slot.unfilled_required_roles.join(', ')}`} />
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
                  <div>assigned：{slot.assigned_agents.map((agent) => `${agent.display_name}(${agent.requested_role})`).join(' · ') || 'none'}</div>
                  <div>fallback：{slot.fallback_agents.map((agent) => `${agent.display_name}(${agent.requested_role})`).join(' · ') || 'none'}</div>
                  <div>handoff：{slot.cross_handoff_communities.join('、') || 'none'}</div>
                  <div>{slot.expected_output_summary}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Release Health"
        description="按日供给、daypart readiness、visual ratio 和 aftershow pipeline 汇总首发状态。"
      >
        <div className="grid gap-3 lg:grid-cols-3">
          <div className="rounded-xl border border-border/60 bg-background p-4">
            <div className="text-xs text-muted-foreground">visual ratio</div>
            <div className="mt-2 flex flex-wrap gap-2">
              <HealthBadge ok={payload.health.visual_ratio_ok} label={payload.health.visual_ratio_ok ? 'ok' : 'watch'} />
              <Badge variant="outline">root {formatPercent(payload.observations.visual_ratio.root_cover_ratio)}</Badge>
              <Badge variant="outline">t4 {formatPercent(payload.observations.visual_ratio.t4_cover_ratio)}</Badge>
              <Badge variant="outline">highlight {formatPercent(payload.observations.visual_ratio.highlight_visual_ratio)}</Badge>
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-background p-4">
            <div className="text-xs text-muted-foreground">aftershow pipeline</div>
            <div className="mt-2 flex flex-wrap gap-2">
              <HealthBadge ok={payload.health.aftershow_pipeline_ok} label={payload.health.aftershow_pipeline_ok ? 'ok' : 'watch'} />
              <Badge variant="outline">{payload.observations.aftershow.filter((item) => item.published_status === 'published').length} published</Badge>
              <Badge variant="outline">{payload.observations.aftershow.length} candidates</Badge>
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-background p-4">
            <div className="text-xs text-muted-foreground">warning count</div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="outline">{payload.health.warning_count} warnings</Badge>
              {payload.observations.visual_ratio.budget_remaining_cny !== null ? (
                <Badge variant="outline">budget {payload.observations.visual_ratio.budget_remaining_cny} CNY</Badge>
              ) : null}
            </div>
          </div>
        </div>

        <div className="space-y-2 rounded-xl border border-border/60 bg-background p-4">
          <h4 className="text-sm font-medium text-foreground">Warnings</h4>
          {payload.health.warnings.length === 0 ? (
            <p className="text-xs text-muted-foreground">当前没有触发 warning。</p>
          ) : (
            payload.health.warnings.map((warning) => (
              <div key={`${warning.code}-${warning.affected_community_slug ?? warning.affected_daypart ?? 'global'}`} className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
                {warning.message}
              </div>
            ))
          )}
        </div>
      </SectionCard>

      <SectionCard
        title="Visual / Highlight / Aftershow"
        description="只读观察 visual 比例、高光候选和 aftershow 触发状态。"
      >
        <div className="grid gap-3 lg:grid-cols-3">
          <div className="rounded-xl border border-border/60 bg-background p-4">
            <h4 className="text-sm font-medium text-foreground">Visual Ratio</h4>
            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
              <div>root cover ratio：{formatPercent(payload.observations.visual_ratio.root_cover_ratio)}</div>
              <div>t4 cover ratio：{formatPercent(payload.observations.visual_ratio.t4_cover_ratio)}</div>
              <div>highlight visual ratio：{formatPercent(payload.observations.visual_ratio.highlight_visual_ratio)}</div>
              <div>reject reasons：{Object.entries(payload.observations.visual_ratio.reject_reason_counts).map(([key, value]) => `${key}=${value}`).join(' · ') || 'none'}</div>
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-background p-4">
            <h4 className="text-sm font-medium text-foreground">Highlight Candidates</h4>
            <div className="mt-2 space-y-2">
              {payload.observations.highlight_candidates.slice(0, 5).map((item) => (
                <div key={item.candidate_post_id} className="rounded-lg border border-border/60 p-3 text-xs text-muted-foreground">
                  <div className="font-medium text-foreground">{item.title}</div>
                  <div className="mt-1">{item.community_name} · {item.shelf_target}</div>
                  <div className="mt-1">{item.rejected_reason ?? item.hero_reason ?? 'candidate_watch'}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-background p-4">
            <h4 className="text-sm font-medium text-foreground">Aftershow</h4>
            <div className="mt-2 space-y-2">
              {payload.observations.aftershow.slice(0, 5).map((item) => (
                <div key={item.candidate_post_id} className="rounded-lg border border-border/60 p-3 text-xs text-muted-foreground">
                  <div className="font-medium text-foreground">{item.title}</div>
                  <div className="mt-1">{item.community_name}</div>
                  <div className="mt-1">{item.trigger_status} · {item.published_status} · {item.fallback_status}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Governance / Rollback"
        description="这里只展示治理引用和 runbook，不复制现有治理写操作。"
      >
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-xl border border-border/60 bg-background p-4">
            <h4 className="text-sm font-medium text-foreground">Community Lifecycle</h4>
            <div className="mt-2 space-y-2">
              {payload.governance_references.communities.slice(0, 8).map((community) => (
                <div key={community.community_slug} className="rounded-lg border border-border/60 p-3 text-xs text-muted-foreground">
                  <div className="font-medium text-foreground">{community.community_name}</div>
                  <div className="mt-1">{community.community_lifecycle_state} · phase {community.launch_phase ?? 'n/a'}</div>
                  <div className="mt-1">headline priority {community.headline_priority}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-background p-4">
            <h4 className="text-sm font-medium text-foreground">Incubation References</h4>
            <div className="mt-2 space-y-2">
              {payload.governance_references.incubation.length === 0 ? (
                <p className="text-xs text-muted-foreground">当前没有 proposal / incubation 引用。</p>
              ) : (
                payload.governance_references.incubation.map((item) => (
                  <div key={item.proposal_id} className="rounded-lg border border-border/60 p-3 text-xs text-muted-foreground">
                    <div className="font-medium text-foreground">{item.community_name}</div>
                    <div className="mt-1">{item.incubation_status}</div>
                    <div className="mt-1">{item.merge_recommendation ?? 'no merge recommendation'}</div>
                    <div className="mt-1">{item.last_admin_action ?? 'no admin action yet'}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-xl border border-border/60 bg-background p-4">
            <h4 className="text-sm font-medium text-foreground">Rollback Order</h4>
            <div className="mt-2 space-y-2">
              {payload.rollback_order.map((item) => (
                <div key={item} className="rounded-lg border border-border/60 p-3 text-xs text-muted-foreground">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-background p-4">
            <h4 className="text-sm font-medium text-foreground">Drill Checklist</h4>
            <div className="mt-2 space-y-2">
              {payload.drill_checklist.map((item) => (
                <div key={item} className="rounded-lg border border-border/60 p-3 text-xs text-muted-foreground">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  )
}
