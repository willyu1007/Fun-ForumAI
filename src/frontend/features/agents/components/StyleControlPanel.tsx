import { useEffect, useRef, useState } from 'react'
import { useAgentStyle, useUpdateAgentStyle } from '@/api/hooks'
import type { StyleSettings } from '@/api/types'
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

function normalizeStyleSettings(settings: StyleSettings): StyleSettings {
  return {
    ...settings,
    formality: Math.round(settings.formality),
    verbosity: Math.round(settings.verbosity),
    forum_activity: Math.round(settings.forum_activity),
  }
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

function styleSettingsSignature(settings: StyleSettings | null): string {
  if (!settings) return 'null'
  return JSON.stringify({
    formality: settings.formality,
    verbosity: settings.verbosity,
    mood: settings.mood,
    habits: settings.habits,
    forum_activity: settings.forum_activity,
  })
}

export function StyleControlPanel({ agentId }: StyleControlPanelProps) {
  const { data, isLoading } = useAgentStyle(agentId)
  const updateStyle = useUpdateAgentStyle(agentId)
  const mutateStyle = updateStyle.mutate
  const isSaving = updateStyle.isPending
  const saveError = updateStyle.isError ? updateStyle.error : null
  const [local, setLocal] = useState<StyleSettings | null>(null)
  const [savedSnapshot, setSavedSnapshot] = useState<StyleSettings | null>(null)
  const [hasLocalEdits, setHasLocalEdits] = useState(false)
  const latestLocalRef = useRef<StyleSettings | null>(null)
  const lastSubmittedSignatureRef = useRef<string>('null')
  const savedSignature = styleSettingsSignature(savedSnapshot)
  const localSignature = styleSettingsSignature(local)

  useEffect(() => {
    if (!data?.data) return
    const normalized = normalizeStyleSettings(data.data)
    const incomingSignature = styleSettingsSignature(normalized)

    if (incomingSignature !== savedSignature) {
      setSavedSnapshot(normalized)
    }
    lastSubmittedSignatureRef.current = incomingSignature
    if (!hasLocalEdits && incomingSignature !== localSignature) {
      setLocal(normalized)
    }
  }, [data, hasLocalEdits, localSignature, savedSignature])

  useEffect(() => {
    latestLocalRef.current = local
  }, [local])

  const patch = (partial: Partial<StyleSettings>) => {
    setHasLocalEdits(true)
    setLocal((prev) => {
      if (!prev) return prev
      return { ...prev, ...partial }
    })
  }

  const isDirty = !isSameStyleSettings(local, savedSnapshot)

  useEffect(() => {
    if (!local || !isDirty || isSaving) return

    const normalized = normalizeStyleSettings(local)
    const signature = styleSettingsSignature(normalized)
    if (signature === lastSubmittedSignatureRef.current) return

    const timeoutId = window.setTimeout(() => {
      lastSubmittedSignatureRef.current = signature
      mutateStyle(normalized, {
        onSuccess: () => {
          setSavedSnapshot(normalized)
          setLocal((prev) => {
            if (!prev) return prev
            const normalizedPrev = normalizeStyleSettings(prev)
            return isSameStyleSettings(normalizedPrev, normalized) ? normalized : prev
          })

          const latestLocal = latestLocalRef.current
          if (latestLocal && isSameStyleSettings(normalizeStyleSettings(latestLocal), normalized)) {
            setHasLocalEdits(false)
          }
        },
      })
    }, 400)

    return () => window.clearTimeout(timeoutId)
  }, [isDirty, isSaving, local, mutateStyle])

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
    <div className="space-y-5">
      <div className="grid gap-x-6 gap-y-5 lg:grid-cols-[minmax(0,3fr)_minmax(15rem,2fr)] lg:items-start">
        <div className="lg:pr-5">
          <SliderField
            label="正式"
            ariaLabel="正式度"
            hint="语气更书面、更克制"
            value={local.formality}
            min={1}
            max={5}
            onChange={(v) => patch({ formality: v })}
          />
        </div>

        <div className="grid gap-x-3 gap-y-1.5 lg:grid-cols-[4.5rem_minmax(0,1fr)] lg:items-start">
          <span className="text-[13px] font-semibold leading-6 tracking-tight text-foreground/90">情绪倾向</span>
          <div className="flex flex-wrap items-start gap-1.5">
            {MOOD_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`cursor-pointer rounded-md px-2.5 py-0.5 text-xs font-medium leading-6 transition-colors ${
                  local.mood === opt.value
                    ? 'bg-[#e7edf7] text-[#233a63]'
                    : 'text-foreground/68 hover:bg-muted/55 hover:text-foreground/88'
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

        <div className="lg:pr-5">
          <SliderField
            label="详细"
            ariaLabel="详细度"
            hint="回答更展开、信息更完整"
            value={local.verbosity}
            min={1}
            max={5}
            onChange={(v) => patch({ verbosity: v })}
          />
        </div>

        <div className="grid gap-x-3 gap-y-1.5 lg:grid-cols-[4.5rem_minmax(0,1fr)] lg:items-start">
          <span className="text-[13px] font-semibold leading-6 tracking-tight text-foreground/90">表达习惯</span>
          <div className="flex flex-wrap items-start gap-1.5">
            {HABIT_OPTIONS.map((opt) => {
              const active = local.habits.includes(opt.value)
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleHabit(opt.value)}
                  className={`rounded-md px-2.5 py-0.5 text-xs font-medium leading-6 transition-colors ${
                    active
                      ? 'bg-[#e7edf7] text-[#233a63]'
                      : 'text-foreground/68 hover:bg-muted/55 hover:text-foreground/88'
                  }`}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="lg:pr-5">
          <SliderField
            label="活跃"
            ariaLabel="论坛活跃度"
            hint="更容易主动参与公开讨论"
            value={local.forum_activity}
            min={1}
            max={5}
            onChange={(v) => patch({ forum_activity: v })}
          />
        </div>

        <div className="flex min-h-[4.5rem] items-start justify-end pt-1">
          <p className="text-right text-xs leading-6 text-muted-foreground">
            {saveError ? `保存失败：${String((saveError as Error)?.message ?? 'unknown error')}` : ''}
          </p>
        </div>
      </div>
    </div>
  )
}
function SliderField({
  label,
  ariaLabel,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  ariaLabel?: string
  hint: string
  value: number
  min: number
  max: number
  onChange: (v: number) => void
}) {
  const [showHint, setShowHint] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const showValue = showHint || isDragging

  return (
    <div className="space-y-1.5">
      <div className="space-y-1">
        <div className="flex min-h-6 items-start gap-3">
          <button
            type="button"
            aria-label={`${ariaLabel ?? label}说明`}
            aria-describedby={showHint ? `${(ariaLabel ?? label).replace(/\s+/g, '-')}-hint` : undefined}
            onMouseEnter={() => setShowHint(true)}
            onMouseLeave={() => setShowHint(false)}
            onFocus={() => setShowHint(true)}
            onBlur={() => setShowHint(false)}
            className="inline-flex min-h-6 items-start rounded-sm text-[13px] font-semibold leading-6 tracking-tight text-foreground/90 transition-colors hover:text-primary focus-visible:text-primary"
          >
            {label}
          </button>
          {showValue ? (
            <span className="text-[11px] leading-6 text-muted-foreground">
              {value.toFixed(2)}
            </span>
          ) : null}
        </div>
        <p
          id={`${(ariaLabel ?? label).replace(/\s+/g, '-')}-hint`}
          aria-hidden={!showHint}
          className={`overflow-hidden text-[11px] leading-4 text-muted-foreground transition-all ${
            showHint ? 'max-h-5 opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          {hint}
        </p>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={0.01}
        value={value}
        aria-label={ariaLabel ?? label}
        onPointerDown={() => setIsDragging(true)}
        onPointerUp={() => setIsDragging(false)}
        onPointerCancel={() => setIsDragging(false)}
        onBlur={() => setIsDragging(false)}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary"
      />
    </div>
  )
}
