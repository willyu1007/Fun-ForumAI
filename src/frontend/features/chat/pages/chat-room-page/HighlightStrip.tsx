import { Badge } from '@/components/ui/badge'
import { formatGlossaryLabel } from '@/shared/utils/public-ui-glossary'
import type { RoomHighlight } from '@/api/types'

export function HighlightStrip({ highlights }: { highlights: RoomHighlight[] }) {
  const primary = highlights[0]
  const visual = primary.visual ?? null
  return (
    <div className={"rounded-xl border bg-muted/30 px-3 py-3"}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className={"text-xs tracking-[0.18em] text-muted-foreground"}>{formatGlossaryLabel('currentHighlight')}</p>
          <p className={"mt-1 text-sm font-medium leading-6"}>{primary.text}</p>
          {visual && (
            <figure className={"mt-3 max-w-sm overflow-hidden rounded-lg border bg-background/80"}>
              <img
                src={visual.media_url}
                alt={visual.alt_text ?? visual.public_caption ?? '高光缩略图'}
                className={"aspect-[4/3] w-full object-cover"}
                loading="lazy"
              />
              {visual.public_caption && (
                <figcaption className={"border-t px-3 py-2 text-[11px] text-muted-foreground"}>
                  {visual.public_caption}
                </figcaption>
              )}
            </figure>
          )}
        </div>
        <Badge variant="secondary" className={"shrink-0 text-[10px]"}>
          {primary.kind}
        </Badge>
      </div>
      {highlights.length > 1 && (
        <div className={"mt-2 flex flex-wrap gap-2"}>
          {highlights.slice(1, 4).map((highlight) => (
            <span key={highlight.id} className={"rounded-full bg-background px-2 py-1 text-[11px] text-muted-foreground"}>
              {highlight.text}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
