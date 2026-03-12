import { useState, useEffect, useCallback, useRef } from 'react'
import { useAgentStyle, useUpdateAgentStyle } from '@/api/hooks'
import type { StyleSettings } from '@/api/types'
import { Skeleton } from '@/components/ui/skeleton'
import { uix } from '@/shared/utils/uix'
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
export function StyleControlPanel({ agentId }: StyleControlPanelProps) {
  const { data, isLoading } = useAgentStyle(agentId)
  const updateStyle = useUpdateAgentStyle(agentId)
  const [local, setLocal] = useState<StyleSettings | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (data?.data) setLocal(data.data)
  }, [data])
  const save = useCallback(
    (next: StyleSettings) => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => updateStyle.mutate(next), 600)
    },
    [updateStyle],
  )
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    },
    [],
  )
  const patch = useCallback(
    (partial: Partial<StyleSettings>) => {
      setLocal((prev) => {
        if (!prev) return prev
        const next = { ...prev, ...partial }
        save(next)
        return next
      })
    },
    [save],
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
        <span className={uix('uix-a2c41e6712')}>情绪倾向</span>
        <div className="flex flex-wrap gap-2">
          {MOOD_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`${uix('uix-choice-chip')} ${
                local.mood === opt.value ? uix('uix-c6b1a26b89') : uix('uix-94ec054230')
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
        <span className={uix('uix-a2c41e6712')}>表达习惯</span>
        <div className="flex flex-wrap gap-2">
          {HABIT_OPTIONS.map((opt) => {
            const active = local.habits.includes(opt.value)
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggleHabit(opt.value)}
                className={`${uix('uix-pill-button')} ${
                  active ? uix('uix-c6b1a26b89') : uix('uix-94ec054230')
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
      <div className={uix('uix-3a9d20850c')}>
        <span className={uix('uix-aaa307c4ab')}>{label}</span>
        <span className={uix('uix-25be576b96')}>{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-sky-500"
      />
      <div className={uix('uix-9d4fa5789f')}>
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
    </div>
  )
}
