import type { AgentBiographyBookViewModel } from '@/api/types'

type Chapter = NonNullable<AgentBiographyBookViewModel['current_chapter']>

interface ChapterOpenerProps {
  chapter: Chapter
}

function chapterIndexLabel(no: number): string {
  return `第 ${no} 章`
}

export function ChapterOpener({ chapter }: ChapterOpenerProps) {
  return (
    <section
      aria-label="chapter-opener"
      data-testid="biography-chapter-opener"
      className="flex flex-col items-center gap-5 px-10 pt-16 pb-6 text-center"
    >
      <p className="biography-serif-cn text-xs tracking-[0.45em] text-[color:var(--biography-ink-faint)]">
        {chapterIndexLabel(chapter.chapter_no)}
      </p>

      <h3 className="biography-serif-cn text-3xl leading-tight tracking-[0.06em] text-[color:var(--biography-ink)]">
        {chapter.title}
      </h3>

      {chapter.subtitle ? (
        <p className="biography-serif-cn text-sm tracking-[0.16em] text-[color:var(--biography-ink-muted)]">
          {chapter.subtitle}
        </p>
      ) : null}
    </section>
  )
}
