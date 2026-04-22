import type { AgentBiographyBookViewModel } from '@/api/types'

type DirectoryItem = AgentBiographyBookViewModel['chapters'][number]

interface TableOfContentsProps {
  chapters: DirectoryItem[]
  selectedChapterId: string | null
  onSelectChapter: (chapterId: string) => void
  sectionRef?: React.Ref<HTMLElement>
}

function statusDotClass(label: DirectoryItem['status_label']): string {
  switch (label) {
    case '已发布':
      return 'bg-[color:var(--biography-ink)]'
    case '审核中':
      return 'bg-[color:var(--biography-ribbon)]'
    case '补记':
      return 'border border-[color:var(--biography-ink-faint)] bg-transparent'
    case '待完成':
    default:
      return 'bg-[color:var(--biography-ink-faint)]'
  }
}

export function TableOfContents({
  chapters,
  selectedChapterId,
  onSelectChapter,
  sectionRef,
}: TableOfContentsProps) {
  return (
    <section
      ref={sectionRef}
      aria-label="table-of-contents"
      data-testid="biography-toc"
      className="border-b border-[color:var(--biography-paper-edge)] px-10 py-10"
    >
      <header className="mb-6 flex items-baseline justify-between gap-4">
        <h3 className="biography-serif-cn text-xl tracking-[0.16em] text-[color:var(--biography-ink)]">
          目 录
        </h3>
      </header>

      <ol className="flex flex-col gap-1">
        {chapters.map((chapter) => {
          const isSelected = selectedChapterId === chapter.chapter_id
          return (
            <li key={chapter.chapter_id}>
              <button
                type="button"
                onClick={() => onSelectChapter(chapter.chapter_id)}
                data-active={isSelected ? 'true' : 'false'}
                data-current={chapter.is_current ? 'true' : 'false'}
                data-testid={`biography-toc-item-${chapter.chapter_no}`}
                className="biography-serif-cn group grid w-full grid-cols-[2.5rem_minmax(0,1fr)_auto] items-baseline gap-4 rounded-sm px-2 py-2 text-left transition-colors hover:bg-[color:color-mix(in_srgb,var(--biography-ink)_6%,transparent)] data-[active=true]:bg-[color:color-mix(in_srgb,var(--biography-ink)_8%,transparent)]"
              >
                <span className="tabular-nums text-sm tracking-[0.18em] text-[color:var(--biography-ink-faint)]">
                  {String(chapter.chapter_no).padStart(2, '0')}
                </span>

                <span className="flex min-w-0 items-baseline gap-3">
                  <span className="truncate text-base tracking-[0.02em] text-[color:var(--biography-ink)]">
                    {chapter.title}
                  </span>
                  <span className="hidden flex-1 items-center overflow-hidden md:flex">
                    <span
                      aria-hidden
                      className="flex-1 border-b border-dotted border-[color:color-mix(in_srgb,var(--biography-ink-faint)_60%,transparent)]"
                    />
                  </span>
                  <span className="hidden truncate text-xs text-[color:var(--biography-ink-muted)] md:inline">
                    {chapter.one_line_summary}
                  </span>
                </span>

                <span className="flex items-center gap-2">
                  <span
                    className={`h-[5px] w-[5px] rounded-full ${statusDotClass(chapter.status_label)}`}
                    aria-hidden
                  />
                  <span className="text-xs tracking-[0.18em] text-[color:var(--biography-ink-muted)]">
                    {chapter.status_label}
                  </span>
                  {chapter.is_current ? (
                    <span
                      aria-label="current"
                      className="ml-2 inline-block h-4 w-[2px] bg-[color:var(--biography-ribbon)]"
                    />
                  ) : null}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
