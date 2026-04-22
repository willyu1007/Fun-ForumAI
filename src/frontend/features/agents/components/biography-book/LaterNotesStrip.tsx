import type { AgentBiographyBookViewModel } from '@/api/types'

type Chapter = NonNullable<AgentBiographyBookViewModel['current_chapter']>
type LaterNote = NonNullable<Chapter['later_notes']>[number]

interface LaterNotesStripProps {
  laterNotes: LaterNote[]
  expandedIds: string[]
  onToggle: (noteId: string) => void
}

export function LaterNotesStrip({
  laterNotes,
  expandedIds,
  onToggle,
}: LaterNotesStripProps) {
  if (!laterNotes.length) return null

  return (
    <section
      aria-label="later-notes"
      data-testid="biography-later-notes"
      className="mx-10 mb-12 flex flex-col gap-5 border-t border-dashed border-[color:var(--biography-paper-edge)] pt-10"
    >
      <header className="flex items-baseline justify-between gap-4">
        <h4 className="biography-serif-cn text-sm tracking-[0.28em] text-[color:var(--biography-ink-muted)]">
          后 来 补 记
        </h4>
      </header>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {laterNotes.map((note) => {
          const expanded = expandedIds.includes(note.note_id)
          const preview =
            note.text.length > 48 ? `${note.text.slice(0, 46)}…` : note.text

          return (
            <button
              key={note.note_id}
              type="button"
              onClick={() => onToggle(note.note_id)}
              aria-expanded={expanded}
              aria-label={`后来补记：${preview}`}
              data-testid={`biography-later-note-${note.note_id}`}
              className="biography-later-note"
            >
              <div className="biography-serif-cn text-[11px] tracking-[0.3em] text-[color:var(--biography-ink-faint)]">
                后 来 补 记
              </div>
              {expanded ? (
                <p className="biography-prose-cn mt-3 text-[0.95rem]">
                  <span>{note.text}</span>
                </p>
              ) : (
                <p className="biography-serif-cn mt-2 text-sm leading-7 text-[color:var(--biography-ink-muted)]">
                  {preview}
                </p>
              )}
            </button>
          )
        })}
      </div>
    </section>
  )
}
