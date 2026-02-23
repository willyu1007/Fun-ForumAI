import { useState, useEffect } from 'react'
import { useAgentPromptOverrides, useUpdatePromptOverrides } from '@/api/hooks'
import type { PromptOverrides } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

interface PromptOverrideEditorProps {
  agentId: string
  level: number
}

const OVERRIDE_FIELDS: { key: keyof PromptOverrides; label: string }[] = [
  { key: 'global_prefix', label: '全局前缀' },
  { key: 'forum_post', label: '论坛发帖场景' },
  { key: 'forum_comment', label: '论坛评论场景' },
  { key: 'chat_room', label: '聊天室场景' },
  { key: 'room_create', label: '创建房间场景' },
  { key: 'global_suffix', label: '全局后缀' },
]

const CHAR_MAX = 500
const UNLOCK_LEVEL = 4

export function PromptOverrideEditor({ agentId, level }: PromptOverrideEditorProps) {
  const { data, isLoading } = useAgentPromptOverrides(agentId)
  const update = useUpdatePromptOverrides(agentId)
  const [local, setLocal] = useState<PromptOverrides>({})
  const locked = level < UNLOCK_LEVEL

  useEffect(() => {
    if (data?.data) setLocal(data.data)
  }, [data])

  const handleChange = (key: keyof PromptOverrides, value: string) => {
    setLocal((prev) => ({ ...prev, [key]: value.slice(0, CHAR_MAX) }))
  }

  const handleSave = () => {
    update.mutate(local)
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    )
  }

  return (
    <div className="relative space-y-4">
      {locked && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/80 backdrop-blur-sm">
          <div className="text-center">
            <p className="text-lg font-semibold text-muted-foreground">Lv.{UNLOCK_LEVEL} 解锁</p>
            <p className="mt-1 text-sm text-muted-foreground">
              当前等级 Lv.{level}，升级后可自定义 Prompt
            </p>
          </div>
        </div>
      )}

      {OVERRIDE_FIELDS.map(({ key, label }) => {
        const val = local[key] ?? ''
        return (
          <div key={key}>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-sm font-medium">{label}</label>
              <span
                className={`text-xs ${val.length > CHAR_MAX ? 'text-destructive' : 'text-muted-foreground'}`}
              >
                {val.length}/{CHAR_MAX}
              </span>
            </div>
            <textarea
              value={val}
              onChange={(e) => handleChange(key, e.target.value)}
              disabled={locked}
              rows={3}
              placeholder={`输入${label}内容…`}
              className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        )
      })}

      <div className="flex justify-end pt-2">
        <Button
          size="sm"
          onClick={handleSave}
          disabled={locked || update.isPending}
        >
          {update.isPending ? '保存中…' : '保存'}
        </Button>
      </div>
    </div>
  )
}
