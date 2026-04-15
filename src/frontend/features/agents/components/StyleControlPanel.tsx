import { useState, useEffect, useCallback } from 'react'
import { useAgentStyle, useUpdateAgentStyle } from '@/api/hooks'
import type { StyleSettings } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
const MOOD_OPTIONS = [
  { value: 'optimistic', label: '乐观' },
  { value: 'neutral', label: '中立' },
  { value: 'critical', label: '批判' },
  { value: 'random', label: '随机' },
] as const
const HABIT_OPTIONS = [
  { value: 'asks_questions', label: '善于提问' },
  { value: 'uses_analogies', label: '喜欢类比' },
  { value: 'tells_stories', label: '爱讲故事' },
  { value: 'summarizes', label: '善于总结' },
] as const
interface StyleControlPanelProps {
  agentId: string
}

function isSameStyleSettings(left: StyleSettings | null, right: StyleSettings | null): boolean {
  if (!left || !right) return left === right

  return (
    left.formality === right.formality
    && left.verbosity === right.verbosity
    && left.mood === right.mood
    && left.forum_activity === right.forum_activity
    && left.habits.length === right.habits.length
    && left.habits.every((habit, index) => habit === right.habits[index])
  )
}

export function StyleControlPanel({ agentId }: StyleControlPanelProps) {
  const { data, isLoading } = useAgentStyle(agentId)
  const updateStyle = useUpdateAgentStyle(agentId)
  const [local, setLocal] = useState<StyleSettings | null>(null)
  const [savedSnapshot, setSavedSnapshot] = useState<StyleSettings | null>(null)
  const [hasLocalEdits, setHasLocalEdits] = useState(false)

  useEffect(() => {
    if (!data?.data) return
    setSavedSnapshot(data.data)
    if (!hasLocalEdits) {
      setLocal(data.data)
    }
  }, [data, hasLocalEdits])

  const patch = useCallback(
    (partial: Partial<StyleSettings>) => {
      setHasLocalEdits(true)
      setLocal((prev) => {
        if (!prev) return prev
        return { ...prev, ...partial }
      })
    },
    [],
  )
  if (isLoading || !local) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-10" />
        ))}
      </div>
    )
  }
  const toggleHabit = (habit: string) => {
    const habits = local.habits.includes(habit)
      ? local.habits.filter((h) => h !== habit)
      : [...local.habits, habit]
    patch({ habits })
  }

  const isDirty = !isSameStyleSettings(local, savedSnapshot)

  const handleSave = () => {
    if (!local || !isDirty || updateStyle.isPending) return

    updateStyle.mutate(local, {
      onSuccess: () => {
        setSavedSnapshot(local)
        setHasLocalEdits(false)
      },
    })
  }

  return (
    <div className="space-y-6">
      <SliderField
        label="正式度"
        value={local.formality}
        min={1}
        max={5}
        leftLabel="随意"
        rightLabel="正式"
        onChange={(v) => patch({ formality: v })}
      />

      <SliderField
        label="详细度"
        value={local.verbosity}
        min={1}
        max={5}
        leftLabel="简洁"
        rightLabel="详细"
        onChange={(v) => patch({ verbosity: v })}
      />

      <div>
        <span className={"mb-2 block text-sm font-medium"}>情绪倾向</span>
        <div className="flex flex-wrap gap-2">
          {MOOD_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`${"cursor-pointer rounded-lg border px-3 py-1.5 text-sm transition-colors"} ${
                local.mood === opt.value
                  ? 'border-primary/30 bg-primary/10 text-primary'
                  : 'border-border hover:bg-muted'
              }`}
            >
              <input
                type="radio"
                name="mood"
                value={opt.value}
                checked={local.mood === opt.value}
                onChange={() => patch({ mood: opt.value })}
                className="sr-only"
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>

      <div>
        <span className={"mb-2 block text-sm font-medium"}>表达习惯</span>
        <div className="flex flex-wrap gap-2">
          {HABIT_OPTIONS.map((opt) => {
            const active = local.habits.includes(opt.value)
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggleHabit(opt.value)}
                className={`${"rounded-full border px-3 py-1 text-sm transition-colors"} ${
                  active ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border hover:bg-muted'
                }`}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      <SliderField
        label="论坛活跃度"
        value={local.forum_activity}
        min={1}
        max={5}
        leftLabel="低调"
        rightLabel="活跃"
        onChange={(v) => patch({ forum_activity: v })}
      />

      <div className="flex items-center justify-between gap-3 border-t border-border/50 pt-4">
        <p className="text-xs text-muted-foreground">
          {updateStyle.isPending
            ? '正在保存设定...'
            : updateStyle.isError
              ? `保存失败：${String((updateStyle.error as Error)?.message ?? 'unknown error')}`
            : isDirty
              ? '设定已修改，点击保存后生效。'
              : '当前设定已保存。'}
        </p>
        <Button type="button" size="sm" onClick={handleSave} disabled={!isDirty || updateStyle.isPending}>
          保存设定
        </Button>
      </div>
    </div>
  )
}
function SliderField({
  label,
  value,
  min,
  max,
  leftLabel,
  rightLabel,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  leftLabel: string
  rightLabel: string
  onChange: (v: number) => void
}) {
  return (
    <div>
      <div className={"mb-1 flex items-center justify-between"}>
        <span className={"text-sm font-medium"}>{label}</span>
        <span className={"text-xs text-muted-foreground"}>{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary"
      />
      <div className={"mt-0.5 flex justify-between text-xs text-muted-foreground"}>
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
    </div>
  )
}
