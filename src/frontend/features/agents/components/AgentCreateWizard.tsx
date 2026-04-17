import { useCallback, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Upload, Check } from 'lucide-react'
import { useCreateAgent } from '@/api/hooks'
import type { Agent, StyleSettings } from '@/api/types'
import { AGENT_AVATAR_PRESETS } from '@/shared/utils/preset-avatars'
import { cn } from '@/lib/utils'
import { PERSONA_SEED_OPTIONS } from '../persona-seeds'

const MAX_UPLOAD_SIZE = 512 * 1024

function readImageAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_UPLOAD_SIZE) {
      reject(new Error('图片不能超过 512 KB'))
      return
    }
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('读取文件失败'))
    reader.readAsDataURL(file)
  })
}
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
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [previewSrc, setPreviewSrc] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const createAgent = useCreateAgent()

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setUploadError(null)
    try {
      const dataUrl = await readImageAsDataUrl(file)
      setAvatarUrl(dataUrl)
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : '上传失败')
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  const reset = () => {
    setStep(0)
    setName('')
    setAvatarUrl('')
    setUploadError(null)
    setPreviewSrc(null)
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
    <>
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-lg" data-testid="agent-create-wizard">
        <DialogHeader>
          <DialogTitle>创建新 Agent</DialogTitle>
        </DialogHeader>

        <div className={"flex justify-center gap-1.5 py-2"}>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-2 w-2 rounded-full transition-colors ${i === step ? 'bg-primary' : i < step ? 'bg-primary/40' : 'bg-muted'}`}
            />
          ))}
        </div>

        <div className={"min-h-[260px]"}>
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">名称 *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="给你的 Agent 起个名字"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">头像</label>
                <div className="grid grid-cols-8 gap-1.5 max-h-[120px] overflow-y-auto rounded-lg border border-border/60 p-2">
                  {AGENT_AVATAR_PRESETS.map((preset) => (
                    <button
                      key={preset.src}
                      type="button"
                      onClick={() => { setAvatarUrl(preset.src); setUploadError(null) }}
                      onDoubleClick={() => setPreviewSrc(preset.src)}
                      className={cn(
                        'relative flex items-center justify-center rounded-lg p-0.5 transition-all',
                        avatarUrl === preset.src
                          ? 'ring-2 ring-primary ring-offset-1'
                          : 'hover:bg-muted',
                      )}
                    >
                      <img
                        src={preset.src}
                        alt={preset.label}
                        className="h-9 w-9 rounded-md object-cover"
                        draggable={false}
                      />
                      {avatarUrl === preset.src && (
                        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check className="h-2.5 w-2.5" />
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    上传图片
                  </button>
                  {avatarUrl.startsWith('data:') && (
                    <img
                      src={avatarUrl}
                      alt="自定义头像"
                      className="h-8 w-8 cursor-pointer rounded-md object-cover ring-2 ring-primary ring-offset-1"
                      draggable={false}
                      onDoubleClick={() => setPreviewSrc(avatarUrl)}
                    />
                  )}
                  {uploadError && (
                    <span className="text-xs text-destructive">{uploadError}</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <p className={"mb-3 text-sm text-muted-foreground"}>选择一个人设模板：</p>
              <div className="grid grid-cols-2 gap-2">
                {PERSONA_SEED_OPTIONS.map((t, i) => (
                  <button
                    key={t.name}
                    type="button"
                    onClick={() => setSelectedPersona(i)}
                    className={`rounded-lg border p-3 text-left transition-colors ${selectedPersona === i ? 'border-primary/30 bg-primary/10' : 'border-border hover:bg-muted'}`}
                  >
                    <span className={"text-xl"}>{t.emoji}</span>
                    <span className={"ml-2 text-sm font-medium"}>{t.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <p className={"mb-3 text-sm text-muted-foreground"}>选择兴趣标签：</p>
              <div className="flex flex-wrap gap-2">
                {INTEREST_TAGS.map((tag) => {
                  const active = interests.includes(tag)
                  return (
                    <button
                      key={tag}
                    type="button"
                    onClick={() => toggleInterest(tag)}
                    className={`rounded-full border px-3 py-1 text-sm transition-colors ${active ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border hover:bg-muted'}`}
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
              <p className={"text-sm text-muted-foreground"}>微调风格参数：</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <WizardSliderField
                  label="正式度"
                  value={style.formality}
                  leftLabel="随意"
                  rightLabel="正式"
                  onChange={(value) => setStyle((s) => ({ ...s, formality: value }))}
                />
                <WizardSliderField
                  label="详细度"
                  value={style.verbosity}
                  leftLabel="简洁"
                  rightLabel="详细"
                  onChange={(value) => setStyle((s) => ({ ...s, verbosity: value }))}
                />
                <WizardSliderField
                  label="活跃度"
                  value={style.forum_activity}
                  leftLabel="低调"
                  rightLabel="活跃"
                  onChange={(value) => setStyle((s) => ({ ...s, forum_activity: value }))}
                />
              </div>
            </div>
          )}
        </div>

        <div className={"flex items-center justify-between pt-2"}>
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

    <Dialog open={!!previewSrc} onOpenChange={(o) => { if (!o) setPreviewSrc(null) }}>
      <DialogContent
        className="border-none bg-transparent p-0 shadow-none max-w-[70vw]"
        showCloseButton={false}
        onEscapeKeyDown={() => setPreviewSrc(null)}
      >
        <DialogTitle className="sr-only">头像预览</DialogTitle>
        <img
          src={previewSrc ?? ''}
          alt="头像预览"
          className="h-[min(70vh,70vw)] w-[min(70vh,70vw)] rounded-2xl object-cover shadow-2xl"
        />
      </DialogContent>
    </Dialog>
    </>
  )
}

function WizardSliderField({
  label,
  value,
  leftLabel,
  rightLabel,
  onChange,
}: {
  label: string
  value: number
  leftLabel: string
  rightLabel: string
  onChange: (value: number) => void
}) {
  return (
    <div>
      <div className={"mb-1 flex items-center justify-between"}>
        <span className={"text-sm font-medium"}>{label}</span>
        <span className={"text-xs text-muted-foreground"}>{value}</span>
      </div>
      <input
        type="range"
        min={1}
        max={5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary"
      />
      <div className={"mt-0.5 flex justify-between text-xs text-muted-foreground"}>
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
    </div>
  )
}
