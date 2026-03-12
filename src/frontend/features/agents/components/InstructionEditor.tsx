import { useState } from 'react'
import { useCreateInstruction, useInstructionTemplates } from '@/api/hooks'
import { Button } from '@/components/ui/button'
import { uix } from '@/shared/utils/uix'
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
  { value: 'forum_comment', label: '论坛评论' },
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
        <h3 className={uix('uix-9f9576a7da')}>新建指令</h3>
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
            <div className={uix('uix-8be92b3570')}>
              {templates.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => applyTemplate(tpl)}
                  className={uix('uix-df6cd0d4c0')}
                >
                  {tpl.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div>
        <label className={uix('uix-04e0ee4b3b')}>名称</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="指令名称"
          className={uix('uix-bb26c57321')}
        />
      </div>

      <div>
        <label className={uix('uix-04e0ee4b3b')}>触发类型</label>
        <select
          value={triggerType}
          onChange={(e) => setTriggerType(e.target.value)}
          className={uix('uix-bb26c57321')}
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
          <label className={uix('uix-04e0ee4b3b')}>关键词（逗号分隔）</label>
          <input
            type="text"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="AI, 人工智能, 机器学习"
            className={uix('uix-bb26c57321')}
          />
        </div>
      )}

      {triggerType === 'scene' && (
        <div>
          <label className={uix('uix-04e0ee4b3b')}>场景选择</label>
          <div className="flex flex-wrap gap-2">
            {SCENE_OPTIONS.map((opt) => {
              const active = scenes.includes(opt.value)
              return (
                <label
                  key={opt.value}
                  className={`${uix('uix-choice-chip')} ${
                    active ? uix('uix-c6b1a26b89') : uix('uix-94ec054230')
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
          <div className={uix('uix-3a9d20850c')}>
            <label className={uix('uix-aaa307c4ab')}>争议阈值</label>
            <span className={uix('uix-25be576b96')}>{threshold.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={0.5}
            max={1.0}
            step={0.05}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="w-full accent-sky-500"
          />
          <div className={uix('uix-9d4fa5789f')}>
            <span>0.50</span>
            <span>1.00</span>
          </div>
        </div>
      )}

      <div>
        <div className={uix('uix-3a9d20850c')}>
          <label className={uix('uix-aaa307c4ab')}>指令内容</label>
          <span
            className={`${uix('uix-text-xs')} ${body.length > BODY_MAX ? uix('uix-811148b13d') : uix('uix-bfa6031907')}`}
          >
            {body.length}/{BODY_MAX}
          </span>
        </div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, BODY_MAX))}
          rows={4}
          placeholder="描述 Agent 在触发时应如何行为…"
          className={uix('uix-6761e68629')}
        />
      </div>

      <div>
        <div className={uix('uix-3a9d20850c')}>
          <label className={uix('uix-aaa307c4ab')}>优先级</label>
          <span className={uix('uix-25be576b96')}>{priority}</span>
        </div>
        <input
          type="range"
          min={0}
          max={10}
          step={1}
          value={priority}
          onChange={(e) => setPriority(Number(e.target.value))}
          className="w-full accent-sky-500"
        />
        <div className={uix('uix-9d4fa5789f')}>
          <span>0</span>
          <span>10</span>
        </div>
      </div>

      <div className={uix('uix-19d19ceda7')}>
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
