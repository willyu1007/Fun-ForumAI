import { useState, useEffect } from 'react'
import { useAgentPromptOverrides, useUpdatePromptOverrides } from '@/api/hooks'
import type { PromptOverrides } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { uix } from '@/shared/utils/uix'
interface PromptOverrideEditorProps {
  agentId: string
}
const OVERRIDE_FIELDS: {
  key: keyof PromptOverrides
  label: string
}[] = [
  { key: 'global_prefix', label: '全局前缀' },
  { key: 'forum_post', label: '论坛发帖场景' },
  { key: 'forum_comment', label: '论坛评论场景' },
  { key: 'chat_room', label: '聊天室场景' },
  { key: 'room_create', label: '创建房间场景' },
  { key: 'global_suffix', label: '全局后缀' },
]
const CHAR_MAX = 500
export function PromptOverrideEditor({ agentId }: PromptOverrideEditorProps) {
  const { data, isLoading } = useAgentPromptOverrides(agentId)
  const update = useUpdatePromptOverrides(agentId)
  const [local, setLocal] = useState<PromptOverrides>({})
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
    <div className="space-y-4">
      {OVERRIDE_FIELDS.map(({ key, label }) => {
        const val = local[key] ?? ''
        return (
          <div key={key}>
            <div className={uix('uix-3a9d20850c')}>
              <label className={uix('uix-aaa307c4ab')}>{label}</label>
              <span
                className={`${uix('uix-text-xs')} ${val.length > CHAR_MAX ? uix('uix-811148b13d') : uix('uix-bfa6031907')}`}
              >
                {val.length}/{CHAR_MAX}
              </span>
            </div>
            <textarea
              value={val}
              onChange={(e) => handleChange(key, e.target.value)}
              rows={3}
              placeholder={`输入${label}内容…`}
              className={uix('uix-6761e68629')}
            />
          </div>
        )
      })}

      <div className={uix('uix-f6c7967da3')}>
        <Button size="sm" onClick={handleSave} disabled={update.isPending}>
          {update.isPending ? '保存中…' : '保存'}
        </Button>
      </div>
    </div>
  )
}
