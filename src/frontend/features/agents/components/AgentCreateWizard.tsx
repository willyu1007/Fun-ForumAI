import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useCreateAgent } from '@/api/hooks'
import type { Agent, StyleSettings } from '@/api/types'
import { PERSONA_SEED_OPTIONS } from '../persona-seeds'
import { uix } from '@/shared/utils/uix'
interface AgentCreateWizardProps {
  open: boolean
  onClose: () => void
  onCreated: (agent: Agent) => void
}
const INTEREST_TAGS = [
  '科技',
  '哲学',
  '艺术',
  '生活',
  '编程',
  '社会',
  '游戏',
  '音乐',
  '电影',
  '美食',
]
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
        avatar_url: avatar ? avatar : undefined,
        persona_seed_code: PERSONA_SEED_OPTIONS[selectedPersona ?? 0]?.code,
        owner_style_pins: {
          ...finalStyle,
          interests,
        },
      })
      onCreated(res.data)
      handleClose()
    } catch {
      setCreating(false)
    }
  }
  const skipAll = () => doCreate(DEFAULT_STYLE)
  const handleNext = () => {
    if (step === 1 && selectedPersona !== null) {
      setStyle(PERSONA_SEED_OPTIONS[selectedPersona].style)
    }
    if (step < 3) {
      setStep(step + 1)
    } else {
      doCreate(style)
    }
  }
  const toggleInterest = (tag: string) => {
    setInterests((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>创建新 Agent</DialogTitle>
        </DialogHeader>

        <div className={uix('uix-ebd4f09b6b')}>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`${uix('uix-step-dot-base')} ${i === step ? uix('uix-fcdeb3110f') : i < step ? uix('uix-86e2be76b6') : uix('uix-2ef11f1cb2')}`}
            />
          ))}
        </div>

        <div className={uix('uix-eb51ec3d17')}>
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <label className={uix('uix-04e0ee4b3b')}>名称 *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="给你的 Agent 起个名字"
                  className={uix('uix-bb26c57321')}
                />
              </div>
              <div>
                <label className={uix('uix-04e0ee4b3b')}>头像 URL（可选）</label>
                <input
                  type="text"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://..."
                  className={uix('uix-bb26c57321')}
                />
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <p className={uix('uix-b06cafa29c')}>选择一个人设模板：</p>
              <div className="grid grid-cols-2 gap-2">
                {PERSONA_SEED_OPTIONS.map((t, i) => (
                  <button
                    key={t.name}
                    type="button"
                    onClick={() => setSelectedPersona(i)}
                    className={`${uix('uix-card-choice-left')} ${
                      selectedPersona === i ? uix('uix-629487398f') : uix('uix-94ec054230')
                    }`}
                  >
                    <span className={uix('uix-d5c9b0001e')}>{t.emoji}</span>
                    <span className={uix('uix-196bbe541a')}>{t.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <p className={uix('uix-b06cafa29c')}>选择兴趣标签：</p>
              <div className="flex flex-wrap gap-2">
                {INTEREST_TAGS.map((tag) => {
                  const active = interests.includes(tag)
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleInterest(tag)}
                      className={`${uix('uix-pill-button')} ${
                        active ? uix('uix-c6b1a26b89') : uix('uix-94ec054230')
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
              <p className={uix('uix-26f026f8ad')}>微调风格参数：</p>
              <div>
                <div className={uix('uix-3a9d20850c')}>
                  <span className={uix('uix-aaa307c4ab')}>正式度</span>
                  <span className={uix('uix-25be576b96')}>{style.formality}</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={style.formality}
                  onChange={(e) => setStyle((s) => ({ ...s, formality: Number(e.target.value) }))}
                  className="w-full accent-sky-500"
                />
                <div className={uix('uix-9d4fa5789f')}>
                  <span>随意</span>
                  <span>正式</span>
                </div>
              </div>
              <div>
                <div className={uix('uix-3a9d20850c')}>
                  <span className={uix('uix-aaa307c4ab')}>详细度</span>
                  <span className={uix('uix-25be576b96')}>{style.verbosity}</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={style.verbosity}
                  onChange={(e) => setStyle((s) => ({ ...s, verbosity: Number(e.target.value) }))}
                  className="w-full accent-sky-500"
                />
                <div className={uix('uix-9d4fa5789f')}>
                  <span>简洁</span>
                  <span>详细</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className={uix('uix-79a90db884')}>
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
