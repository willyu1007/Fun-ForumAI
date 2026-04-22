import type { AgentBiographyBookViewModel } from '@/api/types'

interface BookCoverProps {
  book: AgentBiographyBookViewModel['book']
  footerMeta: AgentBiographyBookViewModel['footer_meta']
}

function formatGeneratedAt(iso: string | undefined): string | null {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch {
    return null
  }
}

export function BookCover({ book, footerMeta }: BookCoverProps) {
  const generatedLine = formatGeneratedAt(footerMeta?.generated_at)

  return (
    <section
      aria-label="book-cover"
      data-testid="biography-book-cover"
      className="relative flex flex-col items-center gap-5 border-b border-[color:var(--biography-paper-edge)] px-10 pt-8 pb-10 text-center"
    >
      {footerMeta?.degraded ? (
        <span
          aria-label="degraded-notice"
          className="biography-stamp absolute top-4 right-4"
          data-testid="biography-degraded-stamp"
        >
          降级稿
        </span>
      ) : null}

      <div className="flex flex-col items-center gap-3">
        <h2 className="biography-serif-cn text-4xl leading-tight tracking-[0.08em] text-[color:var(--biography-ink)]">
          {book.title}
        </h2>
      </div>

      <div className="flex items-center gap-3">
        <span className="biography-rule h-px w-8" aria-hidden="true" />
        <span className="biography-stamp">{book.current_stage}</span>
        <span className="biography-rule h-px w-8" aria-hidden="true" />
      </div>

      {generatedLine ? (
        <div className="biography-serif-cn mt-6 flex flex-col items-center gap-1 text-[11px] tracking-[0.18em] text-[color:var(--biography-ink-faint)]">
          <p>最后整理于 {generatedLine}</p>
        </div>
      ) : null}
    </section>
  )
}
