import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

export interface LightboxImage {
  src: string
  alt?: string
}

interface LightboxProps {
  images: LightboxImage[]
  initialIndex?: number
  open: boolean
  onClose: () => void
}

export function Lightbox({ images, initialIndex = 0, open, onClose }: LightboxProps) {
  const count = images.length
  const safeInitial = Math.max(0, Math.min(initialIndex, count - 1))
  const [index, setIndex] = useState(safeInitial)

  useEffect(() => {
    if (open) setIndex(Math.max(0, Math.min(initialIndex, count - 1)))
  }, [open, initialIndex, count])

  const goPrev = useCallback(() => setIndex((i) => (i - 1 + count) % count), [count])
  const goNext = useCallback(() => setIndex((i) => (i + 1) % count), [count])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') goPrev()
      else if (e.key === 'ArrowRight') goNext()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose, goPrev, goNext])

  if (!open || count === 0) return null

  const current = images[index]
  if (!current) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-overlay/85 backdrop-blur-sm" onClick={onClose} />

      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-10 rounded-full bg-overlay/40 p-2 text-on-overlay/80 transition-colors hover:bg-overlay/60 hover:text-on-overlay"
        aria-label="关闭"
      >
        <X className="size-5" />
      </button>

      {count > 1 && (
        <div className="absolute top-4 left-1/2 z-10 -translate-x-1/2 rounded-full bg-overlay/40 px-3 py-1 text-xs text-on-overlay/80">
          {index + 1} / {count}
        </div>
      )}

      {count > 1 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); goPrev() }}
          className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-overlay/40 p-2 text-on-overlay/70 transition-colors hover:bg-overlay/60 hover:text-on-overlay"
          aria-label="上一张"
        >
          <ChevronLeft className="size-6" />
        </button>
      )}

      <img
        key={current.src}
        src={current.src}
        alt={current.alt ?? ''}
        className="relative z-[1] max-h-[90vh] max-w-[90vw] object-contain"
        draggable={false}
      />

      {count > 1 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); goNext() }}
          className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-overlay/40 p-2 text-on-overlay/70 transition-colors hover:bg-overlay/60 hover:text-on-overlay"
          aria-label="下一张"
        >
          <ChevronRight className="size-6" />
        </button>
      )}
    </div>,
    document.body,
  )
}
