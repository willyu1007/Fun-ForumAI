import { useEffect, useState } from 'react'
import { Upload } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { PresetAvatarOption } from '@/shared/utils/preset-avatars'

interface PresetAvatarDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  currentLabel: string
  fallbackLabel: string
  previewSrc: string | null
  presets: PresetAvatarOption[]
  uploadPlaceholderText?: string
  saveLabel?: string
  savePending?: boolean
  savePlaceholderText?: string
  onSave?: (selectedSrc: string | null) => void
}

export function PresetAvatarDialog({
  open,
  onOpenChange,
  title,
  description,
  currentLabel,
  fallbackLabel,
  previewSrc,
  presets,
  uploadPlaceholderText = '可以先使用预设头像，图片上传即将开放。',
  saveLabel = '保存',
  savePending = false,
  savePlaceholderText = '可以先使用预设头像，保存功能即将开放。',
  onSave,
}: PresetAvatarDialogProps) {
  const [selectedSrc, setSelectedSrc] = useState<string | null>(previewSrc)

  useEffect(() => {
    if (!open) return
    setSelectedSrc(previewSrc)
  }, [open, previewSrc])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(88vh,46rem)] overflow-hidden p-0 sm:max-w-[34rem]">
        <div className="flex max-h-[min(88vh,46rem)] flex-col">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle>{title}</DialogTitle>
            {description ? <DialogDescription>{description}</DialogDescription> : null}
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 pb-6">
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-4 rounded-2xl border bg-muted/15 px-4 py-4">
                <div className="flex min-w-0 items-center gap-4">
                  <Avatar className="size-16 border border-border/60">
                    {selectedSrc ? <AvatarImage src={selectedSrc} alt={currentLabel} className="object-cover" /> : null}
                    <AvatarFallback className="bg-muted text-base font-semibold text-foreground">
                      {fallbackLabel}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-xl font-semibold tracking-tight text-foreground">{currentLabel}</p>
                  </div>
                </div>
                {uploadPlaceholderText ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex">
                        <Button type="button" variant="outline" size="sm" disabled className="gap-1.5">
                          <Upload className="size-3.5" />
                          上传图片
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="left" sideOffset={6}>
                      {uploadPlaceholderText}
                    </TooltipContent>
                  </Tooltip>
                ) : null}
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-4 gap-3 sm:grid-cols-5">
                  {presets.map((preset) => (
                    <button
                      key={preset.src}
                      type="button"
                      aria-label={preset.label}
                      title={preset.label}
                      onClick={() => setSelectedSrc(preset.src)}
                      className={cn(
                        'overflow-hidden rounded-2xl border transition-colors',
                        selectedSrc === preset.src
                          ? 'border-primary ring-2 ring-primary/15'
                          : 'border-border/60 hover:border-primary/35',
                      )}
                    >
                      <img src={preset.src} alt={preset.label} className="aspect-square size-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t px-6 py-4">
            <div className="flex shrink-0 items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                关闭
              </Button>
              {onSave ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => onSave(selectedSrc)}
                  disabled={savePending}
                >
                  {savePending ? '保存中…' : saveLabel}
                </Button>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex">
                      <Button type="button" size="sm" disabled>
                        {saveLabel}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={6}>
                    {savePlaceholderText}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
