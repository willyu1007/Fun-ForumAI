import { useEffect, useState } from 'react'
import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { PresetAgentMomentsCoverOption } from '@/shared/utils/preset-agent-moments-covers'

interface PresetCoverDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  currentLabel: string
  previewSrc: string | null
  initialSelectionSrc: string | null
  presets: PresetAgentMomentsCoverOption[]
  saveLabel?: string
  savePending?: boolean
  onSave?: (selectedSrc: string | null) => void
}

export function PresetCoverDialog({
  open,
  onOpenChange,
  title,
  currentLabel,
  previewSrc,
  initialSelectionSrc,
  presets,
  saveLabel = '保存背景',
  savePending = false,
  onSave,
}: PresetCoverDialogProps) {
  const [selectedSrc, setSelectedSrc] = useState<string | null>(initialSelectionSrc)

  useEffect(() => {
    if (!open) return
    setSelectedSrc(initialSelectionSrc)
  }, [initialSelectionSrc, open])

  const activePreviewSrc = selectedSrc ?? previewSrc

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(88vh,48rem)] overflow-hidden p-0 sm:max-w-[42rem]">
        <div className="flex max-h-[min(88vh,48rem)] flex-col">
          <div className="space-y-2 px-6 pt-6 pb-4">
            <DialogTitle>{title}</DialogTitle>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
            <div className="space-y-5">
              <div className="overflow-hidden border bg-muted/10">
                <div className="relative aspect-[2.82/1] w-full overflow-hidden bg-muted">
                  {activePreviewSrc ? (
                    <img
                      src={activePreviewSrc}
                      alt={currentLabel}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-muted via-background to-muted" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-b from-background/8 via-background/14 to-background/40" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex">
                      <button
                        type="button"
                        aria-label="上传图片"
                        disabled
                        className="flex aspect-[2.82/1] items-center justify-center gap-2 rounded-md border border-dashed border-border/70 bg-muted/20 px-3 text-sm text-muted-foreground"
                      >
                        <Upload className="size-4" />
                        上传图片
                      </button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={8}>
                    自定义背景功能正在调试
                  </TooltipContent>
                </Tooltip>
                {presets.map((preset) => (
                  <button
                    key={preset.src}
                    type="button"
                    aria-label={preset.label}
                    onClick={() => setSelectedSrc(preset.src)}
                    className={cn(
                      'group relative overflow-hidden rounded-md border bg-background text-left transition-all',
                      selectedSrc === preset.src
                        ? 'border-primary ring-2 ring-primary/20 shadow-sm'
                        : 'border-border/60 hover:border-primary/40 hover:shadow-sm',
                    )}
                  >
                    <div className="aspect-[2.82/1] w-full overflow-hidden bg-muted">
                      <img 
                        src={preset.src} 
                        alt={preset.label} 
                        className={cn(
                          "h-full w-full object-cover transition-transform duration-500",
                          selectedSrc === preset.src ? "scale-105" : "group-hover:scale-105"
                        )} 
                      />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t px-6 py-4">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              关闭
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => onSave?.(selectedSrc)}
              disabled={savePending || !onSave}
            >
              {savePending ? '保存中…' : saveLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
