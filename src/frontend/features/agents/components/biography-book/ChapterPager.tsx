import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { AgentBiographyBookViewModel } from '@/api/types'

type DirectoryItem = AgentBiographyBookViewModel['chapters'][number]

interface ChapterPagerProps {
  chapters: DirectoryItem[]
  currentChapterId: string | null
  onSelectChapter: (chapterId: string) => void
  onBackToToc?: () => void
}

export function ChapterPager({
  chapters,
  currentChapterId,
  onSelectChapter,
  onBackToToc,
}: ChapterPagerProps) {
  if (!chapters.length || !currentChapterId) return null

  const currentIndex = chapters.findIndex((c) => c.chapter_id === currentChapterId)
  if (currentIndex < 0) return null

  const previous = chapters[currentIndex - 1] ?? null
  const next = chapters[currentIndex + 1] ?? null
  const total = chapters.length

  return (
    <nav
      aria-label="chapter-pager"
      data-testid="biography-chapter-pager"
      className="flex flex-col gap-0 border-t border-[color:var(--biography-paper-edge)] px-10 py-6"
    >
      <div className="grid grid-cols-3 items-center gap-4">
        <button
          type="button"
          disabled={!previous}
          onClick={() => previous && onSelectChapter(previous.chapter_id)}
          data-testid="biography-pager-prev"
          className="biography-serif-cn flex items-center gap-2 justify-self-start rounded-sm px-3 py-2 text-sm text-[color:var(--biography-ink-muted)] transition-colors hover:text-[color:var(--biography-ink)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4 flex-shrink-0" />
          <span className="max-w-[14rem] truncate tracking-[0.02em]">
            {previous ? previous.title : '已是首章'}
          </span>
        </button>

        <p
          className="biography-serif-cn justify-self-center text-xs tracking-[0.24em] text-[color:var(--biography-ink-faint)]"
          data-testid="biography-pager-progress"
        >
          第 {currentIndex + 1} / {total} 章
        </p>

        <button
          type="button"
          disabled={!next}
          onClick={() => next && onSelectChapter(next.chapter_id)}
          data-testid="biography-pager-next"
          className="biography-serif-cn flex items-center gap-2 justify-self-end rounded-sm px-3 py-2 text-sm text-[color:var(--biography-ink-muted)] transition-colors hover:text-[color:var(--biography-ink)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span className="max-w-[14rem] truncate tracking-[0.02em]">
            {next ? next.title : '已是终章'}
          </span>
          <ChevronRight className="h-4 w-4 flex-shrink-0" />
        </button>
      </div>

      {onBackToToc ? (
        <div className="-mt-2 flex justify-center">
          <button
            type="button"
            onClick={onBackToToc}
            data-testid="biography-pager-back-to-toc"
            className="biography-serif-cn rounded-sm px-2 py-0 text-[10px] tracking-[0.2em] text-[color:color-mix(in_srgb,var(--biography-ink-faint)_70%,transparent)] transition-colors hover:text-[color:var(--biography-ink-faint)]"
          >
            返回目录
          </button>
        </div>
      ) : null}
    </nav>
  )
}
