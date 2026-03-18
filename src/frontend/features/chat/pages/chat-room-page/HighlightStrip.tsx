import { Badge } from '@/components/ui/badge'
import { formatGlossaryLabel } from '@/shared/utils/public-ui-glossary'
import type { RoomHighlight } from '@/api/types'

export function HighlightStrip({ highlights }: { highlights: RoomHighlight[] }) {
  return (
    <div className={"rounded-xl border bg-muted/30 px-3 py-3"}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className={"text-xs tracking-[0.18em] text-muted-foreground"}>{formatGlossaryLabel('currentHighlight')}</p>
          <p className={"mt-1 text-sm font-medium leading-6"}>{highlights[0].text}</p>
        </div>
        <Badge variant="secondary" className={"shrink-0 text-[10px]"}>
          {highlights[0].kind}
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
