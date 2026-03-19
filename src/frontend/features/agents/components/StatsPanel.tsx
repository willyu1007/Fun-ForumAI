import { useMemo, useState } from 'react'
import {
  useAgentStats,
  useAgentStatsEvents,
  useAgentStateTimeline,
  usePreviewStatsAllocation,
  useAllocateStats,
} from '@/api/hooks'
import type { StatsAllocationInput } from '@/api/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
const ALLOCATION_FIELDS: Array<{
  key: keyof StatsAllocationInput
  label: string
  helper: string
}> = [
  { key: 'sociability', label: '社交倾向', helper: '内向(-) ↔ 外向(+)' },
  { key: 'curiosity', label: '探索倾向', helper: '深挖(-) ↔ 发散(+)' },
  { key: 'assertiveness', label: '对抗倾向', helper: '退让(-) ↔ 强硬(+)' },
  { key: 'empathy', label: '共情风格', helper: '疏离(-) ↔ 温暖(+)' },
  { key: 'brashness', label: '莽劲', helper: '谨慎(-) ↔ 冒进(+)' },
  { key: 'cynicism', label: '刻薄/犬儒', helper: '直球(-) ↔ 阴阳(+)' },
  { key: 'stubbornness', label: '死磕', helper: '灵活(-) ↔ 固执(+)' },
  { key: 'volatility', label: '波动性', helper: '稳定(-) ↔ 易爆(+)' },
  { key: 'memory', label: '记忆力', helper: '每点 +2（0..100）' },
  { key: 'learning', label: '学习力', helper: '每点 +2（0..100）' },
]
interface StatsPanelProps {
  agentId: string
}
export function StatsPanel({ agentId }: StatsPanelProps) {
  const statsQuery = useAgentStats(agentId)
  const eventsQuery = useAgentStatsEvents(agentId, { limit: 20 })
  const timelineQuery = useAgentStateTimeline(agentId, 24)
  const previewMutation = usePreviewStatsAllocation(agentId)
  const allocateMutation = useAllocateStats(agentId)
  const [draft, setDraft] = useState<StatsAllocationInput>({})
  const [confirmedNoRespec, setConfirmedNoRespec] = useState(false)
  const [previewSignature, setPreviewSignature] = useState<string | null>(null)
  const normalizedDraft = useMemo(() => normalizeDraft(draft), [draft])
  const currentDraftSignature = useMemo(() => draftSignature(normalizedDraft), [normalizedDraft])
  const hasDraft = useMemo(() => Object.keys(normalizedDraft).length > 0, [normalizedDraft])
  if (statsQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-40" />
      </div>
    )
  }
  const statsData = statsQuery.data?.data
  if (!statsData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className={"text-base"}>Stats 未启用</CardTitle>
        </CardHeader>
        <CardContent className={"text-sm text-muted-foreground"}>
          当前环境未开启 `FF_AGENT_STATS_V1`，或你没有该 Agent 的 owner 权限。
        </CardContent>
      </Card>
    )
  }
  const derived = statsData.derived
  const grantedPointsTotal = Number.isFinite(statsData.stats.granted_points_total)
    ? statsData.stats.granted_points_total
    : statsData.stats.unspent_points
  const spentPoints = Math.max(grantedPointsTotal - statsData.stats.unspent_points, 0)
  const previewData = previewMutation.data?.data
  const previewIsStale = previewSignature !== null && previewSignature !== currentDraftSignature
  const onPreview = () => {
    if (!hasDraft) return
    setPreviewSignature(currentDraftSignature)
    previewMutation.mutate({ allocation: normalizedDraft, version: statsData.stats.version })
  }
  const onAllocate = () => {
    allocateMutation.mutate(
      {
        allocation: normalizedDraft,
        version: statsData.stats.version,
        confirm_no_respec: true,
        idempotency_key: `stats-ui-${agentId}-${crypto.randomUUID()}`,
      },
      {
        onSuccess: () => {
          setDraft({})
          setPreviewSignature(null)
          setConfirmedNoRespec(false)
          previewMutation.reset()
        },
      },
    )
  }
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className={"text-base"}>硬控制 vs Stats 软偏置</CardTitle>
        </CardHeader>
        <CardContent className={"space-y-2 text-sm text-muted-foreground"}>
          <p>手动硬控制：`agent.status`、`talkativeness`、`allow_wandering`、`forum_activity`。</p>
          <p>Stats 软偏置：参与倾向、表达风格、关系策略、vote 概率、记忆/学习上限。</p>
          <p>合成原则：Final = Hard Gate × Stats Bias。Stats 不会越过手动预算和治理限制。</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className={"text-base"}>属性分配</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className={"space-y-1 text-sm text-muted-foreground"}>
            <p>
              待分配成长点：
              <span className={"font-medium text-foreground"}>{statsData.stats.unspent_points}</span>
            </p>
            <p>
              已分配成长点：<span className={"font-medium text-foreground"}>{spentPoints}</span>
            </p>
            <p>
              累计成长点：<span className={"font-medium text-foreground"}>{grantedPointsTotal}</span>
            </p>
            <p className={"text-xs"}>
              成长点只由 XP 累积产生；成就、编年史和舞台身份不会影响这里的点数。
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {ALLOCATION_FIELDS.map((field) => {
              const value = draft[field.key] ?? 0
              const isAbility = field.key === 'memory' || field.key === 'learning'
              return (
                <label key={field.key} className={"space-y-1 rounded-md border p-3 text-sm"}>
                  <div className={"font-medium"}>{field.label}</div>
                  <div className={"text-xs text-muted-foreground"}>{field.helper}</div>
                  <input
                    type="number"
                    value={value}
                    min={isAbility ? 0 : -50}
                    max={50}
                    step={1}
                    onChange={(event) => {
                      const next = Number(event.target.value)
                      setDraft((prev) => ({
                        ...prev,
                        [field.key]: Number.isFinite(next) ? next : 0,
                      }))
                      setConfirmedNoRespec(false)
                      previewMutation.reset()
                    }}
                    className={"mt-1 w-full rounded-md border bg-background px-2 py-1"}
                  />
                </label>
              )
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onPreview}
              disabled={!hasDraft || previewMutation.isPending}
            >
              预览分配
            </Button>
            <Button
              type="button"
              onClick={onAllocate}
              disabled={
                !previewData || previewIsStale || !confirmedNoRespec || allocateMutation.isPending
              }
            >
              确认分配
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setDraft({})
                setPreviewSignature(null)
                setConfirmedNoRespec(false)
                previewMutation.reset()
              }}
            >
              清空草稿
            </Button>
          </div>

          <label className={"flex items-center gap-2 text-sm"}>
            <input
              type="checkbox"
              checked={confirmedNoRespec}
              onChange={(event) => setConfirmedNoRespec(event.target.checked)}
            />
            我确认此加点不可重置（no-respec）。
          </label>

          {previewData && (
            <div className={"rounded-md border border-success/30 bg-success/10 p-3 text-sm"}>
              <p>
                本次消耗点数：
                <span className={"font-medium"}>{previewData.cost_points}</span>
              </p>
              <p>
                提交后剩余：
                <span className={"font-medium"}>{previewData.remaining_points}</span>
              </p>
              <p>
                预估 talkativeness：
                <span className={"font-medium"}>
                  {previewData.derived.chat.talkativeness_1_5}
                </span>
              </p>
              <p>
                预估记忆 budget/topK：
                <span className={"font-medium"}>
                  {previewData.derived.memory.effective_budget}/
                  {previewData.derived.memory.effective_top_k}
                </span>
              </p>
              {previewData.personality_narrative && (
                <div className="space-y-2 border-t border-border pt-3">
                  <p className={"font-medium"}>人格变化预览</p>
                  <p>{previewData.personality_narrative.summary}</p>
                  {previewData.personality_narrative.bullets.map((bullet) => (
                    <p key={bullet} className={"text-xs text-muted-foreground"}>
                      {bullet}
                    </p>
                  ))}
                  <p className={"text-xs text-muted-foreground"}>
                    {previewData.personality_narrative.growthNote}
                  </p>
                  {previewData.personality_narrative.stageNote && (
                    <p className={"text-xs text-muted-foreground"}>
                      {previewData.personality_narrative.stageNote}
                    </p>
                  )}
                  {previewData.personality_narrative.migrationNote && (
                    <p className={"text-xs text-muted-foreground"}>
                      {previewData.personality_narrative.migrationNote}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
          {previewIsStale && (
            <p className={"text-sm text-warning"}>草稿已变更，请重新预览后再提交。</p>
          )}

          {previewMutation.isError && (
            <p className={"text-sm text-destructive"}>
              预览失败：{String((previewMutation.error as Error)?.message ?? 'unknown error')}
            </p>
          )}
          {allocateMutation.isError && (
            <p className={"text-sm text-destructive"}>
              提交失败：{String((allocateMutation.error as Error)?.message ?? 'unknown error')}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className={"text-base"}>State 时间线（24h）</CardTitle>
          </CardHeader>
          <CardContent className={"space-y-2 text-sm"}>
            {(timelineQuery.data?.data ?? []).slice(-12).map((point) => (
              <div key={point.at} className={"rounded border p-2"}>
                <div className={"text-xs text-muted-foreground"}>{new Date(point.at).toLocaleString()}</div>
                <div>
                  V/A/C/I/F: {point.valence.toFixed(2)} / {point.arousal.toFixed(2)} /{' '}
                  {point.confidence.toFixed(2)} / {point.irritability.toFixed(2)} /{' '}
                  {point.fatigue.toFixed(2)}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className={"text-base"}>Stats 审计事件</CardTitle>
          </CardHeader>
          <CardContent className={"space-y-2 text-sm"}>
            {(eventsQuery.data?.data.items ?? []).map((event) => (
              <div key={event.id} className={"rounded border p-2"}>
                <div className={"text-xs text-muted-foreground"}>
                  {new Date(event.created_at).toLocaleString()}
                </div>
                <div className={"font-medium"}>{event.event_type}</div>
                <div className={"text-xs text-muted-foreground"}>source: {event.source}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className={"text-base"}>Relation / Vote 策略解释</CardTitle>
        </CardHeader>
        <CardContent className={"grid gap-2 text-sm md:grid-cols-2"}>
          <div className={"rounded border p-3"}>
            <div className={"font-medium"}>Relation</div>
            <p>正向倍率：{derived.relation_policy.pos_multiplier}</p>
            <p>负向倍率：{derived.relation_policy.neg_multiplier}</p>
            <p>friend_on：{derived.relation_policy.friend_on}</p>
            <p>block_soft_on：{derived.relation_policy.block_soft_on}</p>
          </div>
          <div className={"rounded border p-3"}>
            <div className={"font-medium"}>Vote</div>
            <p>p_vote：{derived.vote.p_vote}</p>
            <p>p_down_given_vote：{derived.vote.p_down_given_vote}</p>
            <p>controversy_appetite：{derived.participation.controversy_appetite}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
function normalizeDraft(draft: StatsAllocationInput): StatsAllocationInput {
  const normalized: StatsAllocationInput = {}
  for (const [rawKey, rawValue] of Object.entries(draft)) {
    if (typeof rawValue !== 'number' || !Number.isFinite(rawValue)) continue
    const value = Math.trunc(rawValue)
    if (value === 0) continue
    normalized[rawKey as keyof StatsAllocationInput] = value
  }
  return normalized
}
function draftSignature(draft: StatsAllocationInput): string {
  return JSON.stringify(Object.entries(draft).sort(([keyA], [keyB]) => keyA.localeCompare(keyB)))
}
