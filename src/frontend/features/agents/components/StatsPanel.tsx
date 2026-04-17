import { useMemo, useState } from 'react'
import {
  useAgentStats,
  usePreviewStatsAllocation,
  useAllocateStats,
} from '@/api/hooks'
import type { StatsAllocationInput } from '@/api/types'
import { getApiErrorCode } from '@/api/client'
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
    const errorCode = getApiErrorCode(statsQuery.error)
    const unavailableMessage =
      errorCode === 'FEATURE_DISABLED'
        ? '后端 Stats 功能当前没有开启。'
        : errorCode === 'FORBIDDEN'
          ? '你当前没有这个 Agent 的 Stats 管理权限。'
          : errorCode === 'SERVICE_UNAVAILABLE'
            ? 'Stats 服务当前不可用。'
            : '当前还拿不到这个 Agent 的 Stats 数据。'

    return (
      <div className="py-2 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Stats 当前不可用</p>
        <p className="mt-1">{unavailableMessage}</p>
      </div>
    )
  }
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
      <div className="grid gap-x-6 gap-y-1 text-sm text-muted-foreground md:grid-cols-3">
        <p>
          待分配成长点：
          <span className="ml-1 font-medium text-foreground">{statsData.stats.unspent_points}</span>
        </p>
        <p>
          已分配成长点：
          <span className="ml-1 font-medium text-foreground">{spentPoints}</span>
        </p>
        <p>
          累计成长点：
          <span className="ml-1 font-medium text-foreground">{grantedPointsTotal}</span>
        </p>
      </div>
      <p className="text-xs text-muted-foreground">
        成长点只由 XP 累积产生；成就、编年史和舞台身份不会影响这里的点数。
      </p>

      <div className="grid gap-x-5 gap-y-4 md:grid-cols-2">
        {ALLOCATION_FIELDS.map((field) => {
          const value = draft[field.key] ?? 0
          const isAbility = field.key === 'memory' || field.key === 'learning'
          return (
            <label key={field.key} className="space-y-1.5 border-b border-border/50 pb-3 text-sm">
              <div className="font-medium">{field.label}</div>
              <div className="text-xs text-muted-foreground">{field.helper}</div>
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
                className="mt-1 w-full border-0 border-b border-border bg-transparent px-0 py-1 outline-none focus:border-primary focus:ring-0"
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

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={confirmedNoRespec}
          onChange={(event) => setConfirmedNoRespec(event.target.checked)}
        />
        我确认此加点不可重置（no-respec）。
      </label>

      {previewData ? (
        <div className="border-l-2 border-success/40 pl-4 text-sm">
          <p>
            本次消耗点数：
            <span className="ml-1 font-medium">{previewData.cost_points}</span>
          </p>
          <p className="mt-1">
            提交后剩余：
            <span className="ml-1 font-medium">{previewData.remaining_points}</span>
          </p>
          <p className="mt-1">
            预估 talkativeness：
            <span className="ml-1 font-medium">{previewData.derived.chat.talkativeness_1_5}</span>
          </p>
          <p className="mt-1">
            预估记忆 budget/topK：
            <span className="ml-1 font-medium">
              {previewData.derived.memory.effective_budget}/{previewData.derived.memory.effective_top_k}
            </span>
          </p>
          {previewData.personality_narrative ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {previewData.personality_narrative.summary}
            </p>
          ) : null}
        </div>
      ) : null}

      {previewIsStale ? (
        <p className="text-sm text-warning">草稿已变更，请重新预览后再提交。</p>
      ) : null}

      {previewMutation.isError ? (
        <p className="text-sm text-destructive">
          预览失败：{String((previewMutation.error as Error)?.message ?? 'unknown error')}
        </p>
      ) : null}

      {allocateMutation.isError ? (
        <p className="text-sm text-destructive">
          提交失败：{String((allocateMutation.error as Error)?.message ?? 'unknown error')}
        </p>
      ) : null}

      <div className="border-l-2 border-border/60 pl-4 text-sm text-muted-foreground">
        <p>手动硬控制：`agent.status`、`talkativeness`、`allow_wandering`、`forum_activity`。</p>
        <p className="mt-1">Stats 软偏置：参与倾向、表达风格、关系策略、vote 概率、记忆/学习上限。</p>
        <p className="mt-1">合成原则：Final = Hard Gate × Stats Bias。Stats 不会越过手动预算和治理限制。</p>
      </div>
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
