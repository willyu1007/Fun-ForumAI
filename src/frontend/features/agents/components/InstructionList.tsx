import { useState } from 'react'
import { useAgentInstructions, useToggleInstruction, useDeleteInstruction } from '@/api/hooks'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { uix } from '@/shared/utils/uix'
interface InstructionListProps {
  agentId: string
}
const TRIGGER_LABELS: Record<string, string> = {
  keyword: '关键词',
  scene: '场景',
  high_controversy: '高争议',
  always: '始终',
  random: '随机',
  schedule: '定时',
}
const TRIGGER_COLORS: Record<string, string> = {
  keyword: 'bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  scene: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  high_controversy: 'bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
  always: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  random: 'bg-pink-50 text-pink-700 dark:bg-pink-950 dark:text-pink-300',
  schedule: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
}
export function InstructionList({ agentId }: InstructionListProps) {
  const { data, isLoading } = useAgentInstructions(agentId)
  const toggle = useToggleInstruction(agentId)
  const remove = useDeleteInstruction(agentId)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const instructions = data?.data ?? []
  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-40" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    )
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className={uix('uix-896582a1bc')}>已配置指令: {instructions.length}</span>
        <span className={uix('uix-25be576b96')}>可自由配置</span>
      </div>

      {instructions.length === 0 && <p className={uix('uix-05e9bff609')}>暂无指令。</p>}

      {instructions.map((inst) => (
        <div
          key={inst.id}
          className={`${uix('uix-card-choice')} ${inst.enabled ? uix('uix-18049387f0') : uix('uix-da17576907')}`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className={uix('uix-aaa307c4ab')}>{inst.name}</span>
              <Badge variant="outline" className={TRIGGER_COLORS[inst.trigger_type] ?? ''}>
                {TRIGGER_LABELS[inst.trigger_type] ?? inst.trigger_type}
              </Badge>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={inst.enabled}
              onClick={() => toggle.mutate(inst.id)}
              className={`${uix('uix-switch-track-base')} ${inst.enabled ? uix('uix-fcdeb3110f') : uix('uix-2ef11f1cb2')}`}
            >
              <span
                className={`${uix('uix-switch-thumb-base')} ${inst.enabled ? 'translate-x-4' : 'translate-x-0'}`}
              />
            </button>
          </div>

          <p className={uix('uix-3425537525')}>{inst.body}</p>

          <div className={uix('uix-37fc81c53e')}>
            <div className={uix('uix-f0d2bb1b7d')}>
              <span>触发 {inst.times_triggered} 次</span>
              {inst.last_triggered_at && (
                <span>
                  上次:{' '}
                  {new Date(inst.last_triggered_at).toLocaleString('zh-CN', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              )}
            </div>

            {confirmId === inst.id ? (
              <div className="flex gap-1">
                <Button
                  variant="destructive"
                  size="xs"
                  onClick={() => {
                    remove.mutate(inst.id)
                    setConfirmId(null)
                  }}
                >
                  确认删除
                </Button>
                <Button variant="ghost" size="xs" onClick={() => setConfirmId(null)}>
                  取消
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="xs"
                className={uix('uix-538c1f81cf')}
                onClick={() => setConfirmId(inst.id)}
              >
                删除
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
