import { useMemo, useState } from 'react'
import {
  useAgentStats,
  useAgentXp,
  useAllocateStats,
} from '@/api/hooks'
import type { AgentStatsSnapshot, StatsAllocationInput } from '@/api/types'
import { getApiErrorCode } from '@/api/client'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'

const ALLOCATION_FIELDS: Array<{
  key: keyof StatsAllocationInput
  label: string
  leftLabel: string
  rightLabel: string
  min: number
  max: number
  neutralTrack?: boolean
}> = [
  { key: 'sociability', label: '社交倾向', leftLabel: '内向', rightLabel: '外向', min: -100, max: 100 },
  { key: 'curiosity', label: '探索倾向', leftLabel: '深挖', rightLabel: '发散', min: -100, max: 100 },
  { key: 'assertiveness', label: '对抗倾向', leftLabel: '退让', rightLabel: '强硬', min: -100, max: 100 },
  { key: 'empathy', label: '共情风格', leftLabel: '疏离', rightLabel: '温暖', min: -100, max: 100 },
  { key: 'brashness', label: '莽劲', leftLabel: '谨慎', rightLabel: '冒进', min: -100, max: 100 },
  { key: 'cynicism', label: '说话风格', leftLabel: '直球', rightLabel: '阴阳', min: -100, max: 100 },
  { key: 'stubbornness', label: '死磕', leftLabel: '灵活', rightLabel: '固执', min: -100, max: 100 },
  { key: 'volatility', label: '波动性', leftLabel: '稳定', rightLabel: '易爆', min: -100, max: 100 },
  { key: 'memory', label: '记忆力', leftLabel: '低', rightLabel: '高', min: 0, max: 100, neutralTrack: true },
  { key: 'learning', label: '学习力', leftLabel: '低', rightLabel: '高', min: 0, max: 100, neutralTrack: true },
]

const ALLOCATION_GRID_ROWS: Array<Array<keyof StatsAllocationInput>> = [
  ['sociability', 'empathy'],
  ['curiosity', 'cynicism'],
  ['assertiveness', 'stubbornness'],
  ['brashness', 'volatility'],
  ['memory', 'learning'],
]

interface StatsPanelProps {
  agentId: string
}

export function StatsPanel({ agentId }: StatsPanelProps) {
  const statsQuery = useAgentStats(agentId)
  const xpQuery = useAgentXp(agentId)
  const allocateMutation = useAllocateStats(agentId)
  const [draft, setDraft] = useState<StatsAllocationInput>({})
  const [confirmOpen, setConfirmOpen] = useState(false)
  const normalizedDraft = useMemo(() => normalizeDraft(draft), [draft])
  const hasDraft = useMemo(() => Object.keys(normalizedDraft).length > 0, [normalizedDraft])
  const draftCostPoints = allocationCost(normalizedDraft)
  if (statsQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-40" />
      </div>
    )
  }
  const statsData = statsQuery.data?.data
  const xpData = xpQuery.data?.data
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
  const availablePoints = Math.max(statsData.stats.unspent_points - draftCostPoints, 0)
  const onAllocate = () => {
    if (!hasDraft) return
    allocateMutation.mutate(
      {
        allocation: normalizedDraft,
        version: statsData.stats.version,
        confirm_no_respec: true,
        idempotency_key: `stats-ui-${agentId}-${crypto.randomUUID()}`,
      },
      {
        onSuccess: () => {
          setConfirmOpen(false)
          setDraft({})
        },
      },
    )
  }

  return (
    <div className="space-y-4 pb-3">
      <div className="grid grid-cols-10 items-center rounded-sm bg-muted/[0.48] px-3 py-2.5">
        {xpData ? (
          <div className="relative col-span-5 flex min-w-0 items-center gap-3 pr-4 after:absolute after:right-0 after:top-1/2 after:h-4 after:w-px after:-translate-y-1/2 after:bg-border/70 after:content-['']">
            <div className="flex shrink-0 items-baseline gap-1.5 text-sm whitespace-nowrap">
              <span className="text-foreground whitespace-nowrap">等级：</span>
              <span className="font-semibold text-foreground">{xpData.level}</span>
            </div>
            <div className="min-w-0 flex-1">
              <svg
                viewBox="0 0 100 6"
                preserveAspectRatio="none"
                className="h-1.5 w-full overflow-hidden rounded-full"
                aria-hidden="true"
              >
                <rect x="0" y="0" width="100" height="6" className="fill-muted-foreground/15" />
                <rect
                  x="0"
                  y="0"
                  width={Math.max(0, Math.min(100, xpData.level_progress * 100))}
                  height="6"
                  className="fill-primary"
                />
              </svg>
            </div>
          </div>
        ) : (
          <div className="relative col-span-5 after:absolute after:right-0 after:top-1/2 after:h-4 after:w-px after:-translate-y-1/2 after:bg-border/70 after:content-['']" />
        )}
        <div className="relative col-span-3 flex min-w-0 items-baseline justify-center gap-1.5 px-4 text-sm after:absolute after:right-0 after:top-1/2 after:h-4 after:w-px after:-translate-y-1/2 after:bg-border/70 after:content-['']">
          <span className="shrink-0 whitespace-nowrap text-foreground">可用点数：</span>
          <span className="font-semibold text-foreground">
            {availablePoints}/{statsData.stats.unspent_points}
          </span>
        </div>
        <div className="col-span-2 flex min-w-0 items-center justify-end gap-1.5 pl-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setDraft({})}
            disabled={!hasDraft || allocateMutation.isPending}
          >
            复原
          </Button>
          <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="bg-primary/[0.06] text-primary hover:bg-primary/[0.1] hover:text-primary"
              onClick={() => setConfirmOpen(true)}
              disabled={!hasDraft || allocateMutation.isPending}
            >
              确认
            </Button>
            <DialogContent className="sm:max-w-sm" showCloseButton={false}>
              <DialogHeader className="gap-1.5">
                <DialogTitle className="text-base">确认本次加点？</DialogTitle>
                <DialogDescription>
                  提交后本次加点会立即生效，且不可重置。
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="mt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setConfirmOpen(false)}
                  disabled={allocateMutation.isPending}
                >
                  取消
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="bg-primary/90 hover:bg-primary"
                  onClick={onAllocate}
                  disabled={!hasDraft || allocateMutation.isPending}
                >
                  确认加点
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <div className="space-y-5">
        {ALLOCATION_GRID_ROWS.map((row) => (
          <div key={row.join('-')} className="grid gap-5 md:grid-cols-2">
            {row.map((fieldKey) => {
              const field = ALLOCATION_FIELDS.find((item) => item.key === fieldKey)
              if (!field) return null
              const value = draft[field.key] ?? 0
              const currentValue = currentStatsValue(statsData, field.key)
              const projectedValue = projectFieldValue(field, currentValue, value)
              const updateDraft = (delta: -1 | 1) => {
                const next = nextDraftValue(field, value, delta)
                if (next === value) return
                const candidateDraft = setDraftPoint(normalizedDraft, field.key, next)
                if (allocationCost(candidateDraft) > statsData.stats.unspent_points) return
                if (!canProjectFieldValue(field, currentValue, next)) return
                setDraft((prev) => setDraftPoint(prev, field.key, next))
              }

              if (field.neutralTrack) {
                return (
                  <AbilityAllocationField
                    key={field.key}
                    label={field.label}
                    leftLabel={field.leftLabel}
                    rightLabel={field.rightLabel}
                    value={projectedValue}
                    draftPoints={value}
                    min={field.min}
                    max={field.max}
                    canDecrease={canAdjustField(field, currentValue, value, -1, normalizedDraft, statsData.stats.unspent_points)}
                    canIncrease={canAdjustField(field, currentValue, value, 1, normalizedDraft, statsData.stats.unspent_points)}
                    onAdjust={updateDraft}
                  />
                )
              }

              return (
                <AxisAllocationField
                  key={field.key}
                  label={field.label}
                  leftLabel={field.leftLabel}
                  rightLabel={field.rightLabel}
                  value={projectedValue}
                  draftPoints={value}
                  min={field.min}
                  max={field.max}
                  canTowardLeft={canAdjustField(field, currentValue, value, -1, normalizedDraft, statsData.stats.unspent_points)}
                  canTowardRight={canAdjustField(field, currentValue, value, 1, normalizedDraft, statsData.stats.unspent_points)}
                  onAdjust={updateDraft}
                />
              )
            })}
          </div>
        ))}
      </div>

      {allocateMutation.isError ? (
        <p className="text-sm text-destructive">
          提交失败：{String((allocateMutation.error as Error)?.message ?? 'unknown error')}
        </p>
      ) : null}
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

function allocationCost(draft: StatsAllocationInput): number {
  let cost = 0
  for (const field of ALLOCATION_FIELDS) {
    const raw = draft[field.key] ?? 0
    if (!Number.isFinite(raw) || raw === 0) continue
    cost += field.neutralTrack ? Math.max(raw, 0) : Math.abs(raw)
  }
  return cost
}

function AxisAllocationField({
  label,
  leftLabel,
  rightLabel,
  value,
  draftPoints,
  min,
  max,
  canTowardLeft,
  canTowardRight,
  onAdjust,
}: {
  label: string
  leftLabel: string
  rightLabel: string
  value: number
  draftPoints: number
  min: number
  max: number
  canTowardLeft: boolean
  canTowardRight: boolean
  onAdjust: (delta: -1 | 1) => void
}) {
  const markerPercent = ((value - min) / Math.max(max - min, 1)) * 100

  return (
    <div className="space-y-2.5">
      <div className="text-sm font-medium tracking-tight text-foreground/92">{label}</div>
      <div className="flex items-center justify-between gap-4 text-[12px] leading-5">
        <div className="flex items-center gap-1 text-agent-panel-stat-cool">
          <span>{leftLabel}</span>
          <button
            type="button"
            aria-label={`${label}向${leftLabel}加点`}
            onClick={() => onAdjust(-1)}
            disabled={!canTowardLeft}
            className="inline-flex h-4 min-w-4 items-center justify-center rounded-sm px-0.5 text-[12px] font-semibold text-agent-panel-stat-cool transition-colors hover:bg-agent-panel-stat-cool-tint disabled:cursor-not-allowed disabled:opacity-25"
          >
            +
          </button>
        </div>
        <div className="flex items-center gap-1 text-agent-panel-stat-warm">
          <span>{rightLabel}</span>
          <button
            type="button"
            aria-label={`${label}向${rightLabel}加点`}
            onClick={() => onAdjust(1)}
            disabled={!canTowardRight}
            className="inline-flex h-4 min-w-4 items-center justify-center rounded-sm px-0.5 text-[12px] font-semibold text-agent-panel-stat-warm transition-colors hover:bg-agent-panel-stat-warm-tint disabled:cursor-not-allowed disabled:opacity-25"
          >
            +
          </button>
        </div>
      </div>
      <div className="relative h-6">
        <div className="absolute inset-x-0 top-[9px] h-1.5 rounded-full bg-linear-to-r from-agent-panel-stat-track-cool via-agent-panel-stat-track-mid to-agent-panel-stat-track-warm" />
        <svg
          viewBox="0 0 100 24"
          preserveAspectRatio="none"
          className="absolute inset-0 h-6 w-full overflow-visible"
          aria-hidden="true"
        >
          <g transform={`translate(${markerPercent} 12)`}>
            <rect
              x="-8"
              y="-8"
              width="16"
              height="16"
              rx="2"
              className="fill-background stroke-border/60 shadow-sm"
            />
            <text
              x="0"
              y="1"
              textAnchor="middle"
              dominantBaseline="middle"
              className={
                draftPoints === 0
                  ? 'fill-foreground/92 text-[10px] font-semibold'
                  : draftPoints > 0
                    ? 'fill-agent-panel-stat-warm-strong text-[10px] font-semibold'
                    : 'fill-agent-panel-stat-cool-strong text-[10px] font-semibold'
              }
            >
              {formatSignedValue(value)}
            </text>
          </g>
        </svg>
      </div>
    </div>
  )
}

function AbilityAllocationField({
  label,
  leftLabel,
  rightLabel,
  value,
  draftPoints,
  min,
  max,
  canDecrease,
  canIncrease,
  onAdjust,
}: {
  label: string
  leftLabel: string
  rightLabel: string
  value: number
  draftPoints: number
  min: number
  max: number
  canDecrease: boolean
  canIncrease: boolean
  onAdjust: (delta: -1 | 1) => void
}) {
  const markerPercent = ((value - min) / Math.max(max - min, 1)) * 100

  return (
    <div className="space-y-2.5">
      <div className="text-sm font-medium tracking-tight text-foreground/92">{label}</div>
      <div className="flex items-center justify-between gap-4 text-[12px] leading-5 text-muted-foreground">
        <div className="flex items-center gap-1 text-muted-foreground">
          <span>{leftLabel}</span>
          <button
            type="button"
            aria-label={`${label}减少`}
            onClick={() => onAdjust(-1)}
            disabled={!canDecrease}
            className="inline-flex h-4 min-w-4 items-center justify-center rounded-sm px-0.5 text-[12px] font-semibold text-muted-foreground transition-colors hover:bg-muted/70 disabled:cursor-not-allowed disabled:opacity-25"
          >
            −
          </button>
        </div>
        <div className="flex items-center gap-1 text-agent-panel-stat-cool">
          <span>{rightLabel}</span>
          <button
            type="button"
            aria-label={`${label}增加`}
            onClick={() => onAdjust(1)}
            disabled={!canIncrease}
            className="inline-flex h-4 min-w-4 items-center justify-center rounded-sm px-0.5 text-[12px] font-semibold text-agent-panel-stat-cool transition-colors hover:bg-agent-panel-stat-cool-tint disabled:cursor-not-allowed disabled:opacity-25"
          >
            +
          </button>
        </div>
      </div>
      <div className="relative h-6">
        <div className="absolute inset-x-0 top-[9px] h-1.5 rounded-full bg-agent-panel-stat-track-solid" />
        <svg
          viewBox="0 0 100 24"
          preserveAspectRatio="none"
          className="absolute inset-0 h-6 w-full overflow-visible"
          aria-hidden="true"
        >
          <g transform={`translate(${markerPercent} 12)`}>
            <rect
              x="-8"
              y="-8"
              width="16"
              height="16"
              rx="2"
              className="fill-background stroke-border/60 shadow-sm"
            />
            <text
              x="0"
              y="1"
              textAnchor="middle"
              dominantBaseline="middle"
              className={
                draftPoints === 0
                  ? 'fill-foreground/92 text-[10px] font-semibold'
                  : 'fill-agent-panel-stat-cool-strong text-[10px] font-semibold'
              }
            >
              {value}
            </text>
          </g>
        </svg>
      </div>
    </div>
  )
}

function formatSignedValue(value: number): string {
  return value > 0 ? `+${value}` : `${value}`
}

function currentStatsValue(statsData: AgentStatsSnapshot, key: keyof StatsAllocationInput): number {
  return statsData.stats[key] ?? 0
}

function projectFieldValue(
  field: (typeof ALLOCATION_FIELDS)[number],
  currentValue: number,
  draftPoints: number,
): number {
  if (field.neutralTrack) {
    return clamp(currentValue + Math.max(draftPoints, 0) * 2, field.min, field.max)
  }

  let value = currentValue
  const direction = Math.sign(draftPoints)
  for (let i = 0; i < Math.abs(draftPoints); i += 1) {
    const step = axisStep(Math.abs(value))
    value = clamp(value + direction * step, field.min, field.max)
  }
  return value
}

function nextDraftValue(
  field: (typeof ALLOCATION_FIELDS)[number],
  currentDraftPoints: number,
  delta: -1 | 1,
): number {
  if (field.neutralTrack) {
    return Math.max(currentDraftPoints + delta, 0)
  }
  return currentDraftPoints + delta
}

function canProjectFieldValue(
  field: (typeof ALLOCATION_FIELDS)[number],
  currentValue: number,
  draftPoints: number,
): boolean {
  try {
    projectFieldValue(field, currentValue, draftPoints)
    return true
  } catch {
    return false
  }
}

function setDraftPoint(
  draft: StatsAllocationInput,
  key: keyof StatsAllocationInput,
  nextValue: number,
): StatsAllocationInput {
  const nextDraft = { ...draft }
  if (!Number.isFinite(nextValue) || nextValue === 0) {
    delete nextDraft[key]
    return nextDraft
  }
  nextDraft[key] = nextValue
  return nextDraft
}

function canAdjustField(
  field: (typeof ALLOCATION_FIELDS)[number],
  currentValue: number,
  currentDraftPoints: number,
  delta: -1 | 1,
  draft: StatsAllocationInput,
  availableUnspentPoints: number,
): boolean {
  const next = nextDraftValue(field, currentDraftPoints, delta)
  if (next === currentDraftPoints) return false
  if (!canProjectFieldValue(field, currentValue, next)) return false
  const candidateDraft = setDraftPoint(draft, field.key, next)
  return allocationCost(candidateDraft) <= availableUnspentPoints
}

function axisStep(absValue: number): number {
  if (absValue <= 40) return 4
  if (absValue <= 70) return 3
  return 1
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  if (value < min) return min
  if (value > max) return max
  return value
}
