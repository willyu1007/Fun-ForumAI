import { Badge } from '@/components/ui/badge'
import { formatGlossaryLabel } from '@/shared/utils/public-ui-glossary'
import type { RoomHighlight } from '@/api/types'
import { uix } from '@/shared/utils/uix'

export function HighlightStrip({ highlights }: { highlights: RoomHighlight[] }) {
  return (
    <div className={uix('uix-2777618df0')}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className={uix('uix-129eb1143b')}>{formatGlossaryLabel('currentHighlight')}</p>
          <p className={uix('uix-71859d03b8')}>{highlights[0].text}</p>
        </div>
        <Badge variant="secondary" className={uix('uix-ed6a322ef2')}>
          {highlights[0].kind}
        </Badge>
      </div>
      {highlights.length > 1 && (
        <div className={uix('uix-2017a99066')}>
          {highlights.slice(1, 4).map((highlight) => (
            <span key={highlight.id} className={uix('uix-436252ebed')}>
              {highlight.text}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
