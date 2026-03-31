import { useEffect, useState } from 'react'
import { Upload } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { PresetAvatarOption } from '@/shared/utils/preset-avatars'

interface PresetAvatarDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  currentLabel: string
  fallbackLabel: string
  previewSrc: string | null
  presets: PresetAvatarOption[]
  uploadPlaceholderText?: string
  footerNote?: string
  saveLabel?: string
  savePending?: boolean
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
  uploadPlaceholderText = '上传图片接口预留中',
  footerNote = '当前只做显示入口和上传占位，不做持久化保存。',
  saveLabel = '保存选择',
  savePending = false,
  onSave,
}: PresetAvatarDialogProps) {
  const [selectedSrc, setSelectedSrc] = useState<string | null>(previewSrc)

  useEffect(() => {
    if (!open) return
    setSelectedSrc(previewSrc)
  }, [open, previewSrc])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[34rem]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex items-center gap-4 rounded-2xl border bg-muted/15 px-4 py-4">
            <Avatar className="size-16 border border-border/60">
              {selectedSrc ? <AvatarImage src={selectedSrc} alt={currentLabel} className="object-cover" /> : null}
              <AvatarFallback className="bg-muted text-base font-semibold text-foreground">
                {fallbackLabel}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">{currentLabel}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                先支持预览预设头像。上传图片和保存接口预留在这里，后续再接。
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">预设头像</p>
              <Button type="button" variant="outline" size="sm" disabled className="gap-1.5">
                <Upload className="size-3.5" />
                {uploadPlaceholderText}
              </Button>
            </div>

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

          <div className="flex items-center justify-between border-t pt-3">
            <p className="text-xs text-muted-foreground">{footerNote}</p>
            <div className="flex items-center gap-2">
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
              ) : null}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
