import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useCreateAgent } from '@/api/hooks'
import type { StyleSettings } from '@/api/types'

interface AgentCreateWizardProps {
  open: boolean
  onClose: () => void
  onCreated: (agentId: string) => void
}

interface PersonaTemplate {
  emoji: string
  name: string
  style: StyleSettings
}

const PERSONA_TEMPLATES: PersonaTemplate[] = [
  {
    emoji: '🎓',
    name: '学者型',
    style: { formality: 4, verbosity: 4, mood: 'neutral', habits: ['summarizes'], forum_activity: 3 },
  },
  {
    emoji: '🔥',
    name: '毒舌型',
    style: { formality: 2, verbosity: 2, mood: 'critical', habits: ['asks_questions'], forum_activity: 3 },
  },
  {
    emoji: '🌸',
    name: '暖心型',
    style: { formality: 3, verbosity: 3, mood: 'optimistic', habits: ['tells_stories'], forum_activity: 3 },
  },
  {
    emoji: '🤔',
    name: '哲学家型',
    style: { formality: 4, verbosity: 5, mood: 'neutral', habits: ['asks_questions'], forum_activity: 3 },
  },
  {
    emoji: '🎭',
    name: '段子手型',
    style: { formality: 1, verbosity: 2, mood: 'random', habits: ['uses_analogies'], forum_activity: 3 },
  },
  {
    emoji: '🌊',
    name: '和事佬型',
    style: { formality: 3, verbosity: 3, mood: 'neutral', habits: ['summarizes'], forum_activity: 3 },
  },
]

const INTEREST_TAGS = ['科技', '哲学', '艺术', '生活', '编程', '社会', '游戏', '音乐', '电影', '美食']

const DEFAULT_STYLE: StyleSettings = {
  formality: 3,
  verbosity: 3,
  mood: 'neutral',
  habits: [],
  forum_activity: 3,
}

export function AgentCreateWizard({ open, onClose, onCreated }: AgentCreateWizardProps) {
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [selectedPersona, setSelectedPersona] = useState<number | null>(null)
  const [interests, setInterests] = useState<string[]>([])
  const [style, setStyle] = useState<StyleSettings>(DEFAULT_STYLE)
  const [creating, setCreating] = useState(false)

  const createAgent = useCreateAgent()

  const reset = () => {
    setStep(0)
    setName('')
    setAvatarUrl('')
    setSelectedPersona(null)
    setInterests([])
    setStyle(DEFAULT_STYLE)
    setCreating(false)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const doCreate = async (finalStyle: StyleSettings) => {
    if (!name.trim()) return
    setCreating(true)
    try {
      const avatar = avatarUrl.trim()
      const res = await createAgent.mutateAsync({
        display_name: name.trim(),
        model: 'default',
        avatar_url: avatar ? avatar : undefined,
      })
      const agentId = res.data.id
      await updateAgentStyleDirect(agentId, finalStyle)
      onCreated(agentId)
      handleClose()
    } catch {
      setCreating(false)
    }
  }

  const updateAgentStyleDirect = async (agentId: string, s: StyleSettings) => {
    const { api } = await import('@/api/client')
    await api.patch(`agents/${agentId}/style`, { json: s })
  }

  const skipAll = () => doCreate(DEFAULT_STYLE)

  const handleNext = () => {
    if (step === 1 && selectedPersona !== null) {
      setStyle(PERSONA_TEMPLATES[selectedPersona].style)
    }
    if (step < 3) {
      setStep(step + 1)
    } else {
      doCreate(style)
    }
  }

  const toggleInterest = (tag: string) => {
    setInterests((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>创建新 Agent</DialogTitle>
        </DialogHeader>

        <div className="flex justify-center gap-1.5 py-2">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-2 w-2 rounded-full transition-colors ${
                i === step ? 'bg-sky-500' : i < step ? 'bg-sky-300' : 'bg-muted'
              }`}
            />
          ))}
        </div>

        <div className="min-h-[260px]">
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">名称 *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="给你的 Agent 起个名字"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">头像 URL（可选）</label>
                <input
                  type="text"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                />
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <p className="mb-3 text-sm text-muted-foreground">选择一个人设模板：</p>
              <div className="grid grid-cols-2 gap-2">
                {PERSONA_TEMPLATES.map((t, i) => (
                  <button
                    key={t.name}
                    type="button"
                    onClick={() => setSelectedPersona(i)}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      selectedPersona === i
                        ? 'border-sky-500 bg-sky-50 dark:bg-sky-950'
                        : 'border-border hover:bg-muted'
                    }`}
                  >
                    <span className="text-xl">{t.emoji}</span>
                    <span className="ml-2 text-sm font-medium">{t.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <p className="mb-3 text-sm text-muted-foreground">选择兴趣标签：</p>
              <div className="flex flex-wrap gap-2">
                {INTEREST_TAGS.map((tag) => {
                  const active = interests.includes(tag)
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleInterest(tag)}
                      className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                        active
                          ? 'border-sky-500 bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300'
                          : 'border-border hover:bg-muted'
                      }`}
                    >
                      {tag}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <p className="text-sm text-muted-foreground">微调风格参数：</p>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-medium">正式度</span>
                  <span className="text-xs text-muted-foreground">{style.formality}</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={style.formality}
                  onChange={(e) => setStyle((s) => ({ ...s, formality: Number(e.target.value) }))}
                  className="w-full accent-sky-500"
                />
                <div className="mt-0.5 flex justify-between text-xs text-muted-foreground">
                  <span>随意</span>
                  <span>正式</span>
                </div>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-medium">详细度</span>
                  <span className="text-xs text-muted-foreground">{style.verbosity}</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={style.verbosity}
                  onChange={(e) => setStyle((s) => ({ ...s, verbosity: Number(e.target.value) }))}
                  className="w-full accent-sky-500"
                />
                <div className="mt-0.5 flex justify-between text-xs text-muted-foreground">
                  <span>简洁</span>
                  <span>详细</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-2">
          <Button variant="ghost" size="sm" onClick={skipAll} disabled={!name.trim() || creating}>
            跳过全部
          </Button>
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="outline" size="sm" onClick={() => setStep(step - 1)}>
                上一步
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleNext}
              disabled={(step === 0 && !name.trim()) || creating}
            >
              {creating ? '创建中…' : step === 3 ? '创建' : '下一步'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
