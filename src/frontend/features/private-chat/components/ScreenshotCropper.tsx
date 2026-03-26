import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Scissors, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface ScreenshotDraft {
  dataUrl: string
  width: number
  height: number
  mimeType: string
  fileName: string
}

interface CropRect {
  x: number
  y: number
  w: number
  h: number
}

type DragHandle = 'move' | 'nw' | 'ne' | 'sw' | 'se'
type ResizeHandle = Exclude<DragHandle, 'move'>

interface DragState {
  mode: DragHandle
  startX: number
  startY: number
  origin: CropRect
}

const MIN_CROP_SIZE = 96

function createDefaultCrop(width: number, height: number): CropRect {
  const w = Math.max(MIN_CROP_SIZE, Math.round(width * 0.72))
  const h = Math.max(MIN_CROP_SIZE, Math.round(height * 0.58))
  return {
    x: Math.max(0, Math.round((width - w) / 2)),
    y: Math.max(0, Math.round((height - h) / 2)),
    w: Math.min(width, w),
    h: Math.min(height, h),
  }
}

function clampCropRect(rect: CropRect, width: number, height: number): CropRect {
  const w = Math.max(MIN_CROP_SIZE, Math.min(rect.w, width))
  const h = Math.max(MIN_CROP_SIZE, Math.min(rect.h, height))
  const x = Math.max(0, Math.min(rect.x, width - w))
  const y = Math.max(0, Math.min(rect.y, height - h))
  return { x, y, w, h }
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('截图载入失败，请重试。'))
    image.src = src
  })
}

export function ScreenshotCropper({
  draft,
  open,
  onConfirm,
  onCancel,
}: {
  draft: ScreenshotDraft | null
  open: boolean
  onConfirm: (file: File) => void
  onCancel: () => void
}) {
  const frameRef = useRef<HTMLDivElement | null>(null)
  const dragStateRef = useRef<DragState | null>(null)
  const [crop, setCrop] = useState<CropRect | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const resizeHandles: Array<{ mode: ResizeHandle; x: number; y: number }> = crop
    ? [
        { mode: 'nw', x: crop.x, y: crop.y },
        { mode: 'ne', x: crop.x + crop.w, y: crop.y },
        { mode: 'sw', x: crop.x, y: crop.y + crop.h },
        { mode: 'se', x: crop.x + crop.w, y: crop.y + crop.h },
      ]
    : []

  useEffect(() => {
    if (!draft || !open) {
      setCrop(null)
      setConfirming(false)
      setErrorMessage(null)
      return
    }

    setCrop(createDefaultCrop(draft.width, draft.height))
    setConfirming(false)
    setErrorMessage(null)
  }, [draft, open])

  useEffect(() => {
    if (!open || !draft) return

    const handlePointerMove = (event: PointerEvent) => {
      const activeDrag = dragStateRef.current
      const frame = frameRef.current
      if (!activeDrag || !frame) return

      const bounds = frame.getBoundingClientRect()
      const offsetX = Math.max(0, Math.min(event.clientX - bounds.left, bounds.width))
      const offsetY = Math.max(0, Math.min(event.clientY - bounds.top, bounds.height))
      const nextX = (offsetX / bounds.width) * draft.width
      const nextY = (offsetY / bounds.height) * draft.height
      const dx = nextX - activeDrag.startX
      const dy = nextY - activeDrag.startY

      const origin = activeDrag.origin
      let nextCrop = origin

      if (activeDrag.mode === 'move') {
        nextCrop = {
          x: origin.x + dx,
          y: origin.y + dy,
          w: origin.w,
          h: origin.h,
        }
      }

      if (activeDrag.mode === 'nw') {
        nextCrop = {
          x: origin.x + dx,
          y: origin.y + dy,
          w: origin.w - dx,
          h: origin.h - dy,
        }
      }

      if (activeDrag.mode === 'ne') {
        nextCrop = {
          x: origin.x,
          y: origin.y + dy,
          w: origin.w + dx,
          h: origin.h - dy,
        }
      }

      if (activeDrag.mode === 'sw') {
        nextCrop = {
          x: origin.x + dx,
          y: origin.y,
          w: origin.w - dx,
          h: origin.h + dy,
        }
      }

      if (activeDrag.mode === 'se') {
        nextCrop = {
          x: origin.x,
          y: origin.y,
          w: origin.w + dx,
          h: origin.h + dy,
        }
      }

      setCrop(clampCropRect(nextCrop, draft.width, draft.height))
    }

    const handlePointerUp = () => {
      dragStateRef.current = null
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    }
  }, [draft, open])

  const handlePointerDown = (event: React.PointerEvent<SVGElement>, mode: DragHandle) => {
    if (!draft || !crop || !frameRef.current) return
    const bounds = frameRef.current.getBoundingClientRect()
    const offsetX = Math.max(0, Math.min(event.clientX - bounds.left, bounds.width))
    const offsetY = Math.max(0, Math.min(event.clientY - bounds.top, bounds.height))
    dragStateRef.current = {
      mode,
      startX: (offsetX / bounds.width) * draft.width,
      startY: (offsetY / bounds.height) * draft.height,
      origin: crop,
    }
  }

  const handleConfirm = async () => {
    if (!draft || !crop) return
    setConfirming(true)
    setErrorMessage(null)

    try {
      const image = await loadImage(draft.dataUrl)
      const canvas = document.createElement('canvas')
      const cropWidth = Math.max(1, Math.round(crop.w))
      const cropHeight = Math.max(1, Math.round(crop.h))
      canvas.width = cropWidth
      canvas.height = cropHeight
      const context = canvas.getContext('2d')

      if (!context) {
        throw new Error('截图裁剪不可用，请稍后再试。')
      }

      context.drawImage(
        image,
        Math.round(crop.x),
        Math.round(crop.y),
        cropWidth,
        cropHeight,
        0,
        0,
        cropWidth,
        cropHeight,
      )

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, draft.mimeType)
      })

      if (!blob) {
        throw new Error('截图导出失败，请重试。')
      }

      onConfirm(new File([blob], draft.fileName, { type: draft.mimeType }))
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '截图裁剪失败，请重试。')
    } finally {
      setConfirming(false)
    }
  }

  const dimensionsLabel = useMemo(() => {
    if (!crop) return ''
    return `${Math.round(crop.w)} × ${Math.round(crop.h)}`
  }, [crop])

  if (!open || !draft || !crop) return null

  const right = crop.x + crop.w
  const bottom = crop.y + crop.h

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-foreground/65 px-4 py-6 backdrop-blur-sm">
      <div className="flex max-h-full w-full max-w-6xl flex-col overflow-hidden rounded-2xl border bg-background shadow-lg">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Scissors className="size-4" />
            裁剪截图
          </div>
          <div className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
            {dimensionsLabel}
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center overflow-auto px-4 py-4">
          <div ref={frameRef} className="relative inline-block max-h-[72vh] max-w-full overflow-hidden rounded-xl border bg-background">
            <img
              src={draft.dataUrl}
              alt="截图预览"
              className="block max-h-[72vh] max-w-full select-none object-contain"
              draggable={false}
            />
            <svg
              className="absolute inset-0 h-full w-full touch-none"
              viewBox={`0 0 ${draft.width} ${draft.height}`}
              preserveAspectRatio="none"
            >
              <rect x={0} y={0} width={draft.width} height={crop.y} fill="currentColor" className="text-foreground/55" />
              <rect x={0} y={crop.y} width={crop.x} height={crop.h} fill="currentColor" className="text-foreground/55" />
              <rect x={right} y={crop.y} width={draft.width - right} height={crop.h} fill="currentColor" className="text-foreground/55" />
              <rect x={0} y={bottom} width={draft.width} height={draft.height - bottom} fill="currentColor" className="text-foreground/55" />

              <rect
                x={crop.x}
                y={crop.y}
                width={crop.w}
                height={crop.h}
                rx={10}
                fill="transparent"
                stroke="currentColor"
                strokeWidth={3}
                className="cursor-move text-background"
                onPointerDown={(event) => handlePointerDown(event, 'move')}
              />

              {resizeHandles.map((handle) => (
                <g key={handle.mode}>
                  <circle
                    cx={handle.x}
                    cy={handle.y}
                    r={11}
                    fill="currentColor"
                    className={cn(
                      "text-background",
                      handle.mode === 'nw' || handle.mode === 'se' ? 'cursor-nwse-resize' : 'cursor-nesw-resize',
                    )}
                    onPointerDown={(event) => handlePointerDown(event, handle.mode)}
                  />
                  <circle cx={handle.x} cy={handle.y} r={6} fill="currentColor" className="text-primary" />
                </g>
              ))}
            </svg>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
          {errorMessage && (
            <div className="mr-auto text-sm text-destructive">
              {errorMessage}
            </div>
          )}
          <Button type="button" variant="ghost" onClick={onCancel}>
            <X className="size-4" />
            取消
          </Button>
          <Button type="button" onClick={() => void handleConfirm()} disabled={confirming}>
            <Check className="size-4" />
            {confirming ? '处理中…' : '附到聊天'}
          </Button>
        </div>
      </div>
    </div>
  )
}
