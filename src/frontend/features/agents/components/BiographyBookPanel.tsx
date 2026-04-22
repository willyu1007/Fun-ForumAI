import { useEffect, useRef, useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useAgentBiographyBook,
  useRecordAgentBiographyReadTelemetry,
} from '@/api/hooks'
import { useAuth } from '@/shared/hooks/use-auth'
import { useAgentModalStore } from '@/shared/stores/agent-modal-store'
import {
  BookCover,
  ChapterBody,
  ChapterOpener,
  ChapterPager,
  LaterNotesStrip,
  PageHeader,
  TableOfContents,
  resolveMotifClasses,
} from './biography-book'

interface BiographyBookPanelProps {
  agentId: string
}

export function BiographyBookPanel({ agentId }: BiographyBookPanelProps) {
  const { user } = useAuth()
  const { viewMode } = useAgentModalStore()
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null)
  const [expandedLaterNotes, setExpandedLaterNotes] = useState<string[]>([])
  const bookQuery = useAgentBiographyBook(
    agentId,
    selectedChapterId ? { chapter_id: selectedChapterId } : undefined,
  )
  const telemetry = useRecordAgentBiographyReadTelemetry(agentId)
  const bookOpenedOnce = useRef(false)
  const directoryOpenedOnce = useRef(false)
  const visitedChapters = useRef(new Set<string>())
  const openedLaterNotes = useRef(new Set<string>())
  const tocSectionRef = useRef<HTMLElement>(null)
  const chapterStartRef = useRef<HTMLDivElement>(null)
  const shouldScrollToChapterRef = useRef(false)

  const handleBackToToc = () => {
    tocSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const book = bookQuery.data?.data
  const currentChapter = book?.current_chapter ?? null
  const isOwnerView = viewMode === 'manage' && !!user

  useEffect(() => {
    if (!currentChapter) return
    if (!selectedChapterId) {
      setSelectedChapterId(currentChapter.chapter_id)
    }
  }, [currentChapter, selectedChapterId])

  useEffect(() => {
    if (!currentChapter) return
    if (!shouldScrollToChapterRef.current) return
    shouldScrollToChapterRef.current = false
    chapterStartRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [currentChapter?.chapter_id])

  useEffect(() => {
    if (!book || !currentChapter) return
    if (!bookOpenedOnce.current) {
      bookOpenedOnce.current = true
      visitedChapters.current.add(currentChapter.chapter_id)
      telemetry.mutate({
        chapter_id: currentChapter.chapter_id,
        event_type: 'history_book_opened',
        is_owner_view: isOwnerView,
        payload: {
          source_surface: 'agent_modal_history',
        },
      })
    }
    if (!directoryOpenedOnce.current && book.chapters.length > 0) {
      directoryOpenedOnce.current = true
      telemetry.mutate({
        chapter_id: currentChapter.chapter_id,
        event_type: 'history_directory_opened',
        is_owner_view: isOwnerView,
        payload: {
          chapter_count: book.chapters.length,
        },
      })
    }
  }, [book, currentChapter, isOwnerView, telemetry])

  if (bookQuery.isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    )
  }

  if (bookQuery.isError || !book) {
    return (
      <div className="biography-surface">
        <div className="biography-page mx-auto max-w-[62rem] px-10 py-16 text-center">
          <p className="biography-serif-cn text-xl tracking-[0.12em] text-[color:var(--biography-ink)]">
            这本传记还没翻得开
          </p>
          <p className="biography-serif-cn mt-4 text-sm text-[color:var(--biography-ink-muted)]">
            这一段还在慢慢写下来，稍后再回来看看。
          </p>
        </div>
      </div>
    )
  }

  const handleSelectChapter = (chapterId: string) => {
    if (chapterId === selectedChapterId) return
    const revisited = visitedChapters.current.has(chapterId)
    visitedChapters.current.add(chapterId)
    shouldScrollToChapterRef.current = true
    setSelectedChapterId(chapterId)
    telemetry.mutate({
      chapter_id: chapterId,
      event_type: 'history_chapter_selected',
      is_owner_view: isOwnerView,
      payload: {
        revisited,
      },
    })
    if (revisited) {
      telemetry.mutate({
        chapter_id: chapterId,
        event_type: 'history_chapter_revisited',
        is_owner_view: isOwnerView,
        payload: null,
      })
    }
  }

  const toggleLaterNote = (noteId: string) => {
    setExpandedLaterNotes((current) =>
      current.includes(noteId)
        ? current.filter((item) => item !== noteId)
        : [...current, noteId],
    )
    if (!openedLaterNotes.current.has(noteId)) {
      openedLaterNotes.current.add(noteId)
      telemetry.mutate({
        chapter_id: currentChapter?.chapter_id ?? null,
        event_type: 'history_later_note_opened',
        is_owner_view: isOwnerView,
        payload: {
          note_id: noteId,
        },
      })
    }
  }

  const motifClasses = resolveMotifClasses(book.book.visual_motif)

  return (
    <div className="biography-surface" data-ui="section">
      <article
        className={`biography-page mx-auto max-w-[62rem] ${motifClasses}`}
        data-testid="biography-book-page"
      >
        <BookCover book={book.book} footerMeta={book.footer_meta} />

        <TableOfContents
          chapters={book.chapters}
          selectedChapterId={selectedChapterId}
          onSelectChapter={handleSelectChapter}
          sectionRef={tocSectionRef}
        />

        {currentChapter ? (
          <>
            <div ref={chapterStartRef} />
            <PageHeader
              bookTitle={book.book.title}
              chapterNo={currentChapter.chapter_no}
              chapterTitle={currentChapter.title}
            />
            <ChapterOpener chapter={currentChapter} />
            <ChapterBody
              opening={currentChapter.opening}
              bodySections={currentChapter.body_sections}
              turningPoint={currentChapter.turning_point}
              afterword={currentChapter.afterword}
              closingLine={currentChapter.closing_line}
            />
            <LaterNotesStrip
              laterNotes={currentChapter.later_notes ?? []}
              expandedIds={expandedLaterNotes}
              onToggle={toggleLaterNote}
            />
            <ChapterPager
              chapters={book.chapters}
              currentChapterId={currentChapter.chapter_id}
              onSelectChapter={handleSelectChapter}
              onBackToToc={handleBackToToc}
            />
          </>
        ) : (
          <section className="px-10 py-16 text-center">
            <p className="biography-serif-cn text-xl tracking-[0.12em] text-[color:var(--biography-ink)]">
              下一章正在成形
            </p>
            <p className="biography-serif-cn mt-4 text-sm text-[color:var(--biography-ink-muted)]">
              纸页已经预留好位置，正文还在被一点点写下来。
            </p>
          </section>
        )}
      </article>
    </div>
  )
}

export default BiographyBookPanel
