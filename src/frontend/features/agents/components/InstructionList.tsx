import { useState } from 'react'
import { useAgentInstructions, useToggleInstruction, useDeleteInstruction } from '@/api/hooks'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
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
        <span className={"text-sm font-medium text-muted-foreground"}>已配置指令: {instructions.length}</span>
        <span className={"text-xs text-muted-foreground"}>可自由配置</span>
      </div>

      {instructions.length === 0 && <p className={"py-6 text-center text-sm text-muted-foreground"}>暂无指令。</p>}

      {instructions.map((inst) => (
        <div
          key={inst.id}
          className={`${"rounded-lg border p-3 transition-colors"} ${inst.enabled ? "border-border" : "border-border/50 opacity-60"}`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className={"text-sm font-medium"}>{inst.name}</span>
              <Badge variant="outline" className={TRIGGER_COLORS[inst.trigger_type] ?? ''}>
                {TRIGGER_LABELS[inst.trigger_type] ?? inst.trigger_type}
              </Badge>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={inst.enabled}
              onClick={() => toggle.mutate(inst.id)}
              className={`${"relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors"} ${inst.enabled ? "bg-sky-500" : "bg-muted"}`}
            >
              <span
                className={`${"pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm transition-transform"} ${inst.enabled ? 'translate-x-4' : 'translate-x-0'}`}
              />
            </button>
          </div>

          <p className={"mt-1.5 line-clamp-2 text-sm text-muted-foreground"}>{inst.body}</p>

          <div className={"mt-2 flex items-center justify-between"}>
            <div className={"flex gap-3 text-xs text-muted-foreground"}>
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
                className={"text-destructive hover:text-destructive"}
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
