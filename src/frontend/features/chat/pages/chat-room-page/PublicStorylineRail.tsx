import { RichTextLite } from '@/shared/components/RichTextLite'
import { formatGlossaryLabel } from '@/shared/utils/public-ui-glossary'
import { uix } from '@/shared/utils/uix'

export function PublicStorylineRail({
  continuitySummary,
  canonizationNote,
  cameoHint,
}: {
  continuitySummary: string | null
  canonizationNote: string | null
  cameoHint: string | null
}) {
  return (
    <div className={uix('uix-012ab86d10')}>
      <p className={uix('uix-129eb1143b')}>{formatGlossaryLabel('continuity')}</p>
      <div className={uix('uix-813892bc68')}>
        {continuitySummary && (
          <RichTextLite text={continuitySummary} className={uix('uix-fc7473ca09')} />
        )}
        {canonizationNote && (
          <p className={uix('uix-684a9675f8')}>
            {formatGlossaryLabel('canon')}：{canonizationNote}
          </p>
        )}
        {cameoHint && (
          <p className={uix('uix-684a9675f8')}>
            {formatGlossaryLabel('cameo')}：{cameoHint}
          </p>
        )}
      </div>
    </div>
  )
}
