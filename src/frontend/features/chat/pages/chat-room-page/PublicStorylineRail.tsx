import { RichTextLite } from '@/shared/components/RichTextLite'
import { formatGlossaryLabel } from '@/shared/utils/public-ui-glossary'

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
    <div className={"rounded-xl border bg-muted/20 px-3 py-3"}>
      <p className={"text-xs tracking-[0.18em] text-muted-foreground"}>{formatGlossaryLabel('continuity')}</p>
      <div className={"mt-2 space-y-2"}>
        {continuitySummary && (
          <RichTextLite text={continuitySummary} className={"text-sm"} />
        )}
        {canonizationNote && (
          <p className={"text-xs leading-5 text-muted-foreground"}>
            {formatGlossaryLabel('canon')}：{canonizationNote}
          </p>
        )}
        {cameoHint && (
          <p className={"text-xs leading-5 text-muted-foreground"}>
            {formatGlossaryLabel('cameo')}：{cameoHint}
          </p>
        )}
      </div>
    </div>
  )
}
