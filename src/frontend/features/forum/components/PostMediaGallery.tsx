import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Lightbox } from '@/shared/components/Lightbox'
import type { PostMediaItem } from '@/api/types'

interface PostMediaGalleryProps {
  media: PostMediaItem[]
  className?: string
}

export function PostMediaGallery({ media, className }: PostMediaGalleryProps) {
  const [slide, setSlide] = useState(0)
  const [lightboxIndex, setLightboxIndex] = useState(-1)

  if (media.length === 0) return null

  const count = media.length
  const current = media[slide]
  if (!current) return null

  const goPrev = () => setSlide((i) => (i - 1 + count) % count)
  const goNext = () => setSlide((i) => (i + 1) % count)

  const lightboxImages = media.map((m) => ({
    src: m.media_url,
    alt: m.alt_text ?? undefined,
  }))

  return (
    <div className={className}>
      <div className="group/carousel relative overflow-hidden rounded-lg border border-border/30 bg-overlay/95">
        <button
          type="button"
          onClick={() => setLightboxIndex(slide)}
          className="block w-full cursor-zoom-in"
        >
          <img
            key={current.asset_id}
            src={current.media_url}
            alt={current.alt_text ?? 'post media'}
            className="max-h-[32rem] w-full object-contain"
            loading="lazy"
          />
        </button>

        {count > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); goPrev() }}
              className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-overlay/40 p-1.5 text-on-overlay/80 opacity-0 transition-opacity hover:bg-overlay/60 group-hover/carousel:opacity-100"
              aria-label="上一张"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); goNext() }}
              className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-overlay/40 p-1.5 text-on-overlay/80 opacity-0 transition-opacity hover:bg-overlay/60 group-hover/carousel:opacity-100"
              aria-label="下一张"
            >
              <ChevronRight className="size-5" />
            </button>
          </>
        )}

        {count > 1 && (
          <div className="absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
            {media.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={(e) => { e.stopPropagation(); setSlide(idx) }}
                className={cn(
                  'size-1.5 rounded-full transition-all',
                  idx === slide
                    ? 'scale-125 bg-on-overlay'
                    : 'bg-on-overlay/50 hover:bg-on-overlay/80',
                )}
                aria-label={`第 ${idx + 1} 张`}
              />
            ))}
          </div>
        )}

        {count > 1 && (
          <div className="absolute right-2 top-2 z-10 rounded-full bg-overlay/50 px-2 py-0.5 text-[11px] text-on-overlay/90">
            {slide + 1}/{count}
          </div>
        )}
      </div>

      <Lightbox
        images={lightboxImages}
        initialIndex={lightboxIndex}
        open={lightboxIndex >= 0}
        onClose={() => setLightboxIndex(-1)}
      />
    </div>
  )
}
