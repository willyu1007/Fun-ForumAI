import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Scissors, X } from 'lucide-react'
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

type DragHandle = 'select' | 'move' | 'nw' | 'ne' | 'sw' | 'se'
type ResizeHandle = Exclude<DragHandle, 'select' | 'move'>

interface DragState {
  mode: DragHandle
  startX: number
  startY: number
  origin: CropRect | null
}

interface ViewportSize {
  width: number
  height: number
}

const MIN_CROP_SIZE = 40
const HANDLE_HIT_RADIUS = 18
const HANDLE_VISUAL_LENGTH = 14
const ACTION_BAR_WIDTH = 84
const ACTION_BAR_HEIGHT = 30
const ACTION_BAR_OFFSET = 8

function clearDomSelection() {
  if (typeof window === 'undefined') return
  window.getSelection()?.removeAllRanges()
}

function createInitialViewportSize(): ViewportSize {
  if (typeof window === 'undefined') {
    return { width: 1280, height: 800 }
  }

  return {
    width: window.innerWidth,
    height: window.innerHeight,
  }
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('截图载入失败，请重试。'))
    image.src = src
  })
}

function clampValue(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function clampCropRect(rect: CropRect, width: number, height: number): CropRect {
  const w = clampValue(rect.w, MIN_CROP_SIZE, width)
  const h = clampValue(rect.h, MIN_CROP_SIZE, height)
  const x = clampValue(rect.x, 0, Math.max(0, width - w))
  const y = clampValue(rect.y, 0, Math.max(0, height - h))
  return { x, y, w, h }
}

function buildSelectionRect(
  startX: number,
  startY: number,
  currentX: number,
  currentY: number,
  width: number,
  height: number,
): CropRect {
  const clampedCurrentX = clampValue(currentX, 0, width)
  const clampedCurrentY = clampValue(currentY, 0, height)
  const x = Math.min(startX, clampedCurrentX)
  const y = Math.min(startY, clampedCurrentY)
  const w = Math.abs(clampedCurrentX - startX)
  const h = Math.abs(clampedCurrentY - startY)

  return {
    x,
    y,
    w,
    h,
  }
}

function resizeCrop(
  origin: CropRect,
  currentX: number,
  currentY: number,
  width: number,
  height: number,
  mode: ResizeHandle,
): CropRect {
  const left = origin.x
  const right = origin.x + origin.w
  const top = origin.y
  const bottom = origin.y + origin.h

  if (mode === 'nw') {
    const nextLeft = clampValue(currentX, 0, right - MIN_CROP_SIZE)
    const nextTop = clampValue(currentY, 0, bottom - MIN_CROP_SIZE)
    return { x: nextLeft, y: nextTop, w: right - nextLeft, h: bottom - nextTop }
  }

  if (mode === 'ne') {
    const nextRight = clampValue(currentX, left + MIN_CROP_SIZE, width)
    const nextTop = clampValue(currentY, 0, bottom - MIN_CROP_SIZE)
    return { x: left, y: nextTop, w: nextRight - left, h: bottom - nextTop }
  }

  if (mode === 'sw') {
    const nextLeft = clampValue(currentX, 0, right - MIN_CROP_SIZE)
    const nextBottom = clampValue(currentY, top + MIN_CROP_SIZE, height)
    return { x: nextLeft, y: top, w: right - nextLeft, h: nextBottom - top }
  }

  const nextRight = clampValue(currentX, left + MIN_CROP_SIZE, width)
  const nextBottom = clampValue(currentY, top + MIN_CROP_SIZE, height)
  return { x: left, y: top, w: nextRight - left, h: nextBottom - top }
}

function hasUsableCrop(crop: CropRect | null) {
  return Boolean(crop && crop.w >= MIN_CROP_SIZE && crop.h >= MIN_CROP_SIZE)
}

function getHandleSegments(mode: ResizeHandle, x: number, y: number) {
  const length = HANDLE_VISUAL_LENGTH

  switch (mode) {
    case 'nw':
      return [
        { x1: x, y1: y, x2: x + length, y2: y },
        { x1: x, y1: y, x2: x, y2: y + length },
      ]
    case 'ne':
      return [
        { x1: x, y1: y, x2: x - length, y2: y },
        { x1: x, y1: y, x2: x, y2: y + length },
      ]
    case 'sw':
      return [
        { x1: x, y1: y, x2: x + length, y2: y },
        { x1: x, y1: y, x2: x, y2: y - length },
      ]
    case 'se':
      return [
        { x1: x, y1: y, x2: x - length, y2: y },
        { x1: x, y1: y, x2: x, y2: y - length },
      ]
  }
}

function getActionBarPosition(crop: CropRect, viewportSize: ViewportSize) {
  const preferredX = crop.x + crop.w - ACTION_BAR_WIDTH
  const x = clampValue(preferredX, 16, Math.max(16, viewportSize.width - ACTION_BAR_WIDTH - 16))
  const preferredBelowY = crop.y + crop.h + ACTION_BAR_OFFSET
  const fitsBelow = preferredBelowY + ACTION_BAR_HEIGHT <= viewportSize.height - 16
  const y = fitsBelow
    ? preferredBelowY
    : Math.max(16, crop.y - ACTION_BAR_HEIGHT - ACTION_BAR_OFFSET)

  return { x, y }
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
  const stageRef = useRef<HTMLDivElement | null>(null)
  const dragStateRef = useRef<DragState | null>(null)
  const cropRef = useRef<CropRect | null>(null)
  const previousBodyUserSelectRef = useRef<string>('')
  const previousDocumentUserSelectRef = useRef<string>('')
  const [viewportSize, setViewportSize] = useState<ViewportSize>(() => createInitialViewportSize())
  const [crop, setCrop] = useState<CropRect | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [hasStartedSelection, setHasStartedSelection] = useState(false)

  useEffect(() => {
    if (!open || !draft) {
      cropRef.current = null
      setCrop(null)
      setConfirming(false)
      setErrorMessage(null)
      setIsDragging(false)
      setHasStartedSelection(false)
      return
    }

    cropRef.current = null
    setCrop(null)
    setConfirming(false)
    setErrorMessage(null)
    setIsDragging(false)
    setHasStartedSelection(false)
    setViewportSize(createInitialViewportSize())
  }, [draft, open])

  useEffect(() => {
    if (!open || typeof document === 'undefined') return

    previousBodyUserSelectRef.current = document.body.style.userSelect
    previousDocumentUserSelectRef.current = document.documentElement.style.userSelect
    document.body.style.userSelect = 'none'
    document.documentElement.style.userSelect = 'none'
    clearDomSelection()

    return () => {
      clearDomSelection()
      document.body.style.userSelect = previousBodyUserSelectRef.current
      document.documentElement.style.userSelect = previousDocumentUserSelectRef.current
    }
  }, [open])

  const updateCrop = (nextCrop: CropRect | null) => {
    cropRef.current = nextCrop
    setCrop(nextCrop)
  }

  useEffect(() => {
    if (!open || typeof window === 'undefined') return

    const handleResize = () => {
      setViewportSize(createInitialViewportSize())
      updateCrop(
        cropRef.current
          ? clampCropRect(cropRef.current, window.innerWidth, window.innerHeight)
          : null,
      )
    }

    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [open])

  useEffect(() => {
    if (!open) return

    const handlePointerMove = (event: PointerEvent) => {
      const activeDrag = dragStateRef.current
      const stage = stageRef.current
      if (!activeDrag || !stage) return

      const bounds = stage.getBoundingClientRect()
      const nextX = clampValue(event.clientX - bounds.left, 0, bounds.width)
      const nextY = clampValue(event.clientY - bounds.top, 0, bounds.height)

      if (activeDrag.mode === 'select') {
        updateCrop(
          buildSelectionRect(
            activeDrag.startX,
            activeDrag.startY,
            nextX,
            nextY,
            bounds.width,
            bounds.height,
          ),
        )
        return
      }

      if (!activeDrag.origin) return

      if (activeDrag.mode === 'move') {
        const dx = nextX - activeDrag.startX
        const dy = nextY - activeDrag.startY
        updateCrop(
          clampCropRect(
            {
              x: activeDrag.origin.x + dx,
              y: activeDrag.origin.y + dy,
              w: activeDrag.origin.w,
              h: activeDrag.origin.h,
            },
            bounds.width,
            bounds.height,
          ),
        )
        return
      }

      updateCrop(
        resizeCrop(
          activeDrag.origin,
          nextX,
          nextY,
          bounds.width,
          bounds.height,
          activeDrag.mode,
        ),
      )
    }

    const handlePointerUp = () => {
      if (dragStateRef.current?.mode === 'select' && !hasUsableCrop(cropRef.current)) {
        updateCrop(null)
      }

      dragStateRef.current = null
      setIsDragging(false)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    }
  }, [crop, open])

  const startDrag = (
    event: React.PointerEvent<SVGElement | HTMLDivElement>,
    mode: DragHandle,
    origin: CropRect | null,
  ) => {
    if (!stageRef.current) return

    event.preventDefault()
    event.stopPropagation()
    clearDomSelection()

    const bounds = stageRef.current.getBoundingClientRect()
    dragStateRef.current = {
      mode,
      startX: clampValue(event.clientX - bounds.left, 0, bounds.width),
      startY: clampValue(event.clientY - bounds.top, 0, bounds.height),
      origin,
    }

    if (mode === 'select') {
      setHasStartedSelection(true)
      const pointerX = clampValue(event.clientX - bounds.left, 0, bounds.width)
      const pointerY = clampValue(event.clientY - bounds.top, 0, bounds.height)
      updateCrop({
        x: pointerX,
        y: pointerY,
        w: 0,
        h: 0,
      })
    }

    setErrorMessage(null)
    setIsDragging(true)
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const handleConfirm = useCallback(async () => {
    if (!draft || !crop || !hasUsableCrop(crop)) return
    setConfirming(true)
    setErrorMessage(null)

    try {
      const image = await loadImage(draft.dataUrl)
      const scaleX = draft.width / viewportSize.width
      const scaleY = draft.height / viewportSize.height
      const sourceX = Math.round(crop.x * scaleX)
      const sourceY = Math.round(crop.y * scaleY)
      const sourceWidth = Math.max(1, Math.round(crop.w * scaleX))
      const sourceHeight = Math.max(1, Math.round(crop.h * scaleY))

      const canvas = document.createElement('canvas')
      canvas.width = sourceWidth
      canvas.height = sourceHeight
      const context = canvas.getContext('2d')

      if (!context) {
        throw new Error('截图裁剪不可用，请稍后再试。')
      }

      context.drawImage(
        image,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        sourceWidth,
        sourceHeight,
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
  }, [crop, draft, onConfirm, viewportSize.height, viewportSize.width])

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCancel()
        return
      }

      if (event.key === 'Enter' && hasUsableCrop(crop) && !confirming) {
        event.preventDefault()
        void handleConfirm()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [confirming, crop, handleConfirm, onCancel, open])

  const resizeHandles: Array<{ mode: ResizeHandle; x: number; y: number }> = crop
    ? [
        { mode: 'nw', x: crop.x, y: crop.y },
        { mode: 'ne', x: crop.x + crop.w, y: crop.y },
        { mode: 'sw', x: crop.x, y: crop.y + crop.h },
        { mode: 'se', x: crop.x + crop.w, y: crop.y + crop.h },
      ]
    : []

  if (!open || !draft) return null

  const actionBarPosition =
    crop && hasUsableCrop(crop) ? getActionBarPosition(crop, viewportSize) : null

  const overlay = (
    <div className="pointer-events-auto fixed inset-0 z-[80] cursor-crosshair select-none overflow-hidden bg-foreground/90 text-foreground">
      <div
        ref={stageRef}
        data-testid="screenshot-cropper-stage"
        className="pointer-events-auto relative h-full w-full touch-none select-none"
        onPointerDown={(event) => startDrag(event, 'select', null)}
      >
        <img
          src={draft.dataUrl}
          alt="截图预览"
          className="h-full w-full select-none object-fill brightness-[0.38] saturate-[0.82]"
          draggable={false}
        />

        <svg
          className="absolute inset-0 h-full w-full"
          viewBox={`0 0 ${viewportSize.width} ${viewportSize.height}`}
          preserveAspectRatio="none"
        >
          {crop && hasUsableCrop(crop) && (
            <defs>
              <clipPath id="screenshot-crop-window">
                <rect x={crop.x} y={crop.y} width={crop.w} height={crop.h} rx={4} />
              </clipPath>
            </defs>
          )}

          {crop && hasUsableCrop(crop) && (
            <image
              href={draft.dataUrl}
              x={0}
              y={0}
              width={viewportSize.width}
              height={viewportSize.height}
              preserveAspectRatio="none"
              clipPath="url(#screenshot-crop-window)"
            />
          )}

          {crop && hasUsableCrop(crop) && (
            <>
              <rect
                x={crop.x}
                y={crop.y}
                width={crop.w}
                height={crop.h}
                rx={4}
                fill="transparent"
                stroke="currentColor"
                strokeWidth={2}
                className="cursor-move text-background/95"
                onPointerDown={(event) => startDrag(event, 'move', crop)}
              />
              {resizeHandles.map((handle) => (
                <g
                  key={handle.mode}
                  onPointerDown={(event) => startDrag(event, handle.mode, crop)}
                >
                  <rect
                    x={handle.x - HANDLE_HIT_RADIUS}
                    y={handle.y - HANDLE_HIT_RADIUS}
                    width={HANDLE_HIT_RADIUS * 2}
                    height={HANDLE_HIT_RADIUS * 2}
                    fill="transparent"
                    className={cn(
                      'fill-transparent',
                      handle.mode === 'nw' || handle.mode === 'se'
                        ? 'cursor-nwse-resize'
                        : 'cursor-nesw-resize',
                    )}
                  />
                  {getHandleSegments(handle.mode, handle.x, handle.y).map((segment, index) => (
                    <line
                      key={`${handle.mode}-${index}`}
                      x1={segment.x1}
                      y1={segment.y1}
                      x2={segment.x2}
                      y2={segment.y2}
                      stroke="currentColor"
                      strokeWidth={3}
                      strokeLinecap="round"
                      className="text-background/95"
                    />
                  ))}
                </g>
              ))}
            </>
          )}

          {actionBarPosition && !isDragging && (
            <foreignObject
              x={actionBarPosition.x}
              y={actionBarPosition.y}
              width={ACTION_BAR_WIDTH}
              height={ACTION_BAR_HEIGHT}
            >
              <div
                className="flex h-full w-full items-center justify-center gap-2 rounded-[7px] border border-background/45 bg-background/12 px-2 shadow-lg backdrop-blur-sm"
                onPointerDown={(event) => event.stopPropagation()}
              >
                <button
                  type="button"
                  aria-label="取消截图"
                  title="取消截图"
                  onClick={onCancel}
                  className="flex h-6 w-6 items-center justify-center rounded-sm bg-transparent p-0 text-destructive hover:text-destructive/85"
                >
                  <X className="h-[18px] w-[18px] stroke-[2.8]" />
                </button>
                <button
                  type="button"
                  aria-label="附到聊天"
                  title="附到聊天"
                  onClick={() => void handleConfirm()}
                  disabled={confirming}
                  className="flex h-6 w-6 items-center justify-center rounded-sm bg-transparent p-0 text-success disabled:opacity-50"
                >
                  <Check className="h-[18px] w-[18px] stroke-[3.15]" />
                </button>
              </div>
            </foreignObject>
          )}
        </svg>

        {!hasStartedSelection && (
          <div
            data-testid="screenshot-cropper-hint"
            className="pointer-events-none absolute top-5 left-1/2 -translate-x-1/2 rounded-full bg-background/86 px-4 py-2 text-sm font-medium text-foreground shadow-lg backdrop-blur"
          >
            <div className="flex items-center gap-2">
              <Scissors className="size-4" />
              <span>拖拽选择截图区域</span>
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="pointer-events-none absolute top-16 left-1/2 -translate-x-1/2 rounded-full bg-destructive px-4 py-2 text-sm text-destructive-foreground shadow-lg">
            {errorMessage}
          </div>
        )}
      </div>
    </div>
  )

  if (typeof document === 'undefined') {
    return overlay
  }

  return createPortal(overlay, document.body)
}
