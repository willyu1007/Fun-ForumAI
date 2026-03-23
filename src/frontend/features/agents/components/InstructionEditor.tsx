import { useState } from 'react'
import { useCreateInstruction, useInstructionTemplates } from '@/api/hooks'
import { Button } from '@/components/ui/button'
interface InstructionEditorProps {
  agentId: string
  onClose: () => void
}
const TRIGGER_TYPES = [
  { value: 'always', label: '始终触发' },
  { value: 'keyword', label: '关键词触发' },
  { value: 'scene', label: '场景触发' },
  { value: 'high_controversy', label: '高争议触发' },
  { value: 'random', label: '随机触发' },
  { value: 'schedule', label: '定时触发' },
] as const
const SCENE_OPTIONS = [
  { value: 'chat_room', label: '聊天室' },
  { value: 'forum_post', label: '论坛发帖' },
  { value: 'forum_turn', label: '线程回合' },
] as const
const BODY_MAX = 200
export function InstructionEditor({ agentId, onClose }: InstructionEditorProps) {
  const create = useCreateInstruction(agentId)
  const { data: templatesData } = useInstructionTemplates()
  const templates = templatesData?.data ?? []
  const [name, setName] = useState('')
  const [triggerType, setTriggerType] = useState('always')
  const [keywords, setKeywords] = useState('')
  const [scenes, setScenes] = useState<string[]>([])
  const [threshold, setThreshold] = useState(0.7)
  const [body, setBody] = useState('')
  const [priority, setPriority] = useState(5)
  const [showTemplates, setShowTemplates] = useState(false)
  const buildTriggerParams = () => {
    switch (triggerType) {
      case 'keyword':
        return {
          keywords: keywords
            .split(',')
            .map((k) => k.trim())
            .filter(Boolean),
        }
      case 'scene':
        return { scenes }
      case 'high_controversy':
        return { threshold }
      default:
        return undefined
    }
  }
  const handleSubmit = async () => {
    if (!name.trim() || !body.trim()) return
    await create.mutateAsync({
      name: name.trim(),
      trigger_type: triggerType,
      trigger_params: buildTriggerParams(),
      body: body.trim(),
      priority,
    })
    onClose()
  }
  const applyTemplate = (tpl: {
    name: string
    trigger_type: string
    trigger_params: unknown
    body: string
  }) => {
    setName(tpl.name)
    setTriggerType(tpl.trigger_type)
    setBody(tpl.body)
    if (tpl.trigger_type === 'keyword' && tpl.trigger_params) {
      const params = tpl.trigger_params as {
        keywords?: string[]
      }
      setKeywords(params.keywords?.join(', ') ?? '')
    }
    if (tpl.trigger_type === 'scene' && tpl.trigger_params) {
      const params = tpl.trigger_params as {
        scenes?: string[]
      }
      setScenes(params.scenes ?? [])
    }
    if (tpl.trigger_type === 'high_controversy' && tpl.trigger_params) {
      const params = tpl.trigger_params as {
        threshold?: number
      }
      setThreshold(params.threshold ?? 0.7)
    }
    setShowTemplates(false)
  }
  const toggleScene = (scene: string) => {
    setScenes((prev) => (prev.includes(scene) ? prev.filter((s) => s !== scene) : [...prev, scene]))
  }
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className={"text-sm font-semibold"}>新建指令</h3>
        <div className="relative">
          <Button
            variant="outline"
            size="xs"
            onClick={() => setShowTemplates(!showTemplates)}
            disabled={templates.length === 0}
          >
            模板
          </Button>
          {showTemplates && templates.length > 0 && (
            <div className={"absolute right-0 z-10 mt-1 w-56 rounded-md border bg-background p-1 shadow-lg"}>
              {templates.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => applyTemplate(tpl)}
                  className={"w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted"}
                >
                  {tpl.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div>
        <label className={"mb-1 block text-sm font-medium"}>名称</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="指令名称"
          className={"w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"}
        />
      </div>

      <div>
        <label className={"mb-1 block text-sm font-medium"}>触发类型</label>
        <select
          value={triggerType}
          onChange={(e) => setTriggerType(e.target.value)}
          className={"w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"}
        >
          {TRIGGER_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {triggerType === 'keyword' && (
        <div>
          <label className={"mb-1 block text-sm font-medium"}>关键词（逗号分隔）</label>
          <input
            type="text"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="AI, 人工智能, 机器学习"
            className={"w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"}
          />
        </div>
      )}

      {triggerType === 'scene' && (
        <div>
          <label className={"mb-1 block text-sm font-medium"}>场景选择</label>
          <div className="flex flex-wrap gap-2">
            {SCENE_OPTIONS.map((opt) => {
              const active = scenes.includes(opt.value)
              return (
                <label
                  key={opt.value}
                  className={`${"cursor-pointer rounded-lg border px-3 py-1.5 text-sm transition-colors"} ${
                    active ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border hover:bg-muted'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => toggleScene(opt.value)}
                    className="sr-only"
                  />
                  {opt.label}
                </label>
              )
            })}
          </div>
        </div>
      )}

      {triggerType === 'high_controversy' && (
        <div>
          <div className={"mb-1 flex items-center justify-between"}>
            <label className={"text-sm font-medium"}>争议阈值</label>
            <span className={"text-xs text-muted-foreground"}>{threshold.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={0.5}
            max={1.0}
            step={0.05}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="w-full accent-primary"
          />
          <div className={"mt-0.5 flex justify-between text-xs text-muted-foreground"}>
            <span>0.50</span>
            <span>1.00</span>
          </div>
        </div>
      )}

      <div>
        <div className={"mb-1 flex items-center justify-between"}>
          <label className={"text-sm font-medium"}>指令内容</label>
          <span
            className={`${"text-xs"} ${body.length > BODY_MAX ? "text-destructive" : "text-muted-foreground"}`}
          >
            {body.length}/{BODY_MAX}
          </span>
        </div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, BODY_MAX))}
          rows={4}
          placeholder="描述 Agent 在触发时应如何行为…"
          className={"w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"}
        />
      </div>

      <div>
        <div className={"mb-1 flex items-center justify-between"}>
          <label className={"text-sm font-medium"}>优先级</label>
          <span className={"text-xs text-muted-foreground"}>{priority}</span>
        </div>
        <input
          type="range"
          min={0}
          max={10}
          step={1}
          value={priority}
          onChange={(e) => setPriority(Number(e.target.value))}
          className="w-full accent-primary"
        />
        <div className={"mt-0.5 flex justify-between text-xs text-muted-foreground"}>
          <span>0</span>
          <span>10</span>
        </div>
      </div>

      <div className={"flex justify-end gap-2 pt-2"}>
        <Button variant="outline" size="sm" onClick={onClose}>
          取消
        </Button>
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!name.trim() || !body.trim() || body.length > BODY_MAX || create.isPending}
        >
          {create.isPending ? '创建中…' : '创建指令'}
        </Button>
      </div>
    </div>
  )
}
