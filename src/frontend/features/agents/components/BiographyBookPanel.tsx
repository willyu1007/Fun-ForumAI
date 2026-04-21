import { useEffect, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useAgentBiographyBook,
  useRecordAgentBiographyReadTelemetry,
} from '@/api/hooks'
import { useAuth } from '@/shared/hooks/use-auth'
import { useAgentModalStore } from '@/shared/stores/agent-modal-store'

interface BiographyBookPanelProps {
  agentId: string
}

function buildStatusTone(label: string): 'secondary' | 'outline' {
  return label === '已经定稿' ? 'secondary' : 'outline'
}

export function BiographyBookPanel({ agentId }: BiographyBookPanelProps) {
  const { user } = useAuth()
  const { viewMode } = useAgentModalStore()
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null)
  const [directoryOpen, setDirectoryOpen] = useState(false)
  const [expandedLaterNotes, setExpandedLaterNotes] = useState<string[]>([])
  const bookQuery = useAgentBiographyBook(
    agentId,
    selectedChapterId ? { chapter_id: selectedChapterId } : undefined,
  )
  const telemetry = useRecordAgentBiographyReadTelemetry(agentId)
  const openedOnce = useRef(false)
  const visitedChapters = useRef(new Set<string>())
  const openedLaterNotes = useRef(new Set<string>())

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
    if (!currentChapter || openedOnce.current) return
    openedOnce.current = true
    visitedChapters.current.add(currentChapter.chapter_id)
    telemetry.mutate({
      chapter_id: currentChapter.chapter_id,
      event_type: 'history_book_opened',
      is_owner_view: isOwnerView,
      payload: {
        source_surface: 'agent_modal_history',
      },
    })
  }, [currentChapter, isOwnerView, telemetry])

  if (bookQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    )
  }

  if (bookQuery.isError || !book) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>传记暂时不可读</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          当前编年史还没有整理成可阅读的章节，请稍后再试。
        </CardContent>
      </Card>
    )
  }

  const handleDirectoryToggle = () => {
    setDirectoryOpen((current) => {
      const next = !current
      if (next) {
        telemetry.mutate({
          chapter_id: currentChapter?.chapter_id ?? null,
          event_type: 'history_directory_opened',
          is_owner_view: isOwnerView,
          payload: {
            chapter_count: book.chapters.length,
          },
        })
      }
      return next
    })
  }

  const handleSelectChapter = (chapterId: string) => {
    const revisited = visitedChapters.current.has(chapterId)
    visitedChapters.current.add(chapterId)
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

  return (
    <div className="space-y-4" data-ui="section" data-surface="biography-book">
      <Card className="overflow-hidden">
        <CardHeader className="space-y-3 border-b bg-muted/20">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-[0.24em]">
              Biography Book
            </Badge>
            <Badge variant={book.footer_meta?.degraded ? 'outline' : 'secondary'}>
              {book.footer_meta?.degraded ? '降级稿' : '已成册'}
            </Badge>
          </div>
          <div className="space-y-1">
            <p className="font-serif text-2xl tracking-tight">{book.book.title}</p>
            {book.book.subtitle ? (
              <p className="font-serif text-sm text-muted-foreground">{book.book.subtitle}</p>
            ) : null}
          </div>
          <div className="grid gap-3 md:grid-cols-[1.2fr,0.8fr]">
            <div className="rounded-xl border bg-background/70 p-4">
              <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">当前阶段</p>
              <p className="mt-2 font-serif text-lg">{book.book.current_stage}</p>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{book.book.cover_line}</p>
            </div>
            <div className="rounded-xl border bg-background/70 p-4">
              <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">编纂说明</p>
              <p className="mt-2 text-sm text-muted-foreground">{book.footer_meta?.source_line}</p>
              {book.footer_meta?.generated_at ? (
                <p className="mt-4 text-xs text-muted-foreground">
                  最后整理于 {new Date(book.footer_meta.generated_at).toLocaleString()}
                </p>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">目录</p>
              <p className="text-sm text-muted-foreground">章节按人物变化切分，而不是按时间清单切分。</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleDirectoryToggle}>
              {directoryOpen ? '收起目录' : '展开目录'}
            </Button>
          </div>
          {directoryOpen ? (
            <div className="grid gap-2">
              {book.chapters.map((chapter) => (
                <button
                  key={chapter.chapter_id}
                  type="button"
                  onClick={() => handleSelectChapter(chapter.chapter_id)}
                  className={`rounded-xl border px-4 py-3 text-left transition ${
                    chapter.is_current ? 'bg-muted/40' : 'bg-background'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-serif text-base">
                        {chapter.chapter_no}. {chapter.title}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">{chapter.one_line_summary}</p>
                    </div>
                    <Badge variant={buildStatusTone(chapter.status_label)}>{chapter.status_label}</Badge>
                  </div>
                </button>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {currentChapter ? (
        <Card>
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">第 {currentChapter.chapter_no} 章</Badge>
              <Badge variant={buildStatusTone(currentChapter.status_label)}>
                {currentChapter.status_label}
              </Badge>
            </div>
            <div className="space-y-1">
              <CardTitle className="font-serif text-2xl">{currentChapter.title}</CardTitle>
              {currentChapter.subtitle ? (
                <p className="font-serif text-sm text-muted-foreground">{currentChapter.subtitle}</p>
              ) : null}
            </div>
            {currentChapter.epigraph ? (
              <div className="rounded-xl border-l-2 border-border bg-muted/20 px-4 py-3 text-sm italic text-muted-foreground">
                {currentChapter.epigraph}
              </div>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-6 pb-6">
            <section className="space-y-3">
              <p className="font-serif text-lg">{currentChapter.opening}</p>
            </section>

            {currentChapter.body_sections.map((section, index) => (
              <section key={`${section.title ?? 'section'}-${index}`} className="space-y-2">
                {section.title ? (
                  <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                    {section.title}
                  </p>
                ) : null}
                <p className="leading-7 text-foreground/90">{section.text}</p>
                {section.visual_anchor ? (
                  <p className="text-xs text-muted-foreground">痕迹：{section.visual_anchor}</p>
                ) : null}
              </section>
            ))}

            {currentChapter.turning_point ? (
              <section className="rounded-xl border bg-muted/20 p-4">
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">转折点</p>
                <p className="mt-2 font-serif text-lg">{currentChapter.turning_point.title}</p>
                <p className="mt-2 leading-7">{currentChapter.turning_point.text}</p>
              </section>
            ) : null}

            <section className="space-y-3 border-t pt-4">
              <p className="leading-7 text-foreground/90">{currentChapter.afterword}</p>
              <p className="font-serif text-lg">{currentChapter.closing_line}</p>
              <p className="text-sm text-muted-foreground">{currentChapter.trace_text}</p>
            </section>

            {currentChapter.margin_notes?.length ? (
              <section className="space-y-2 rounded-xl border bg-background/80 p-4">
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">页边批注</p>
                {currentChapter.margin_notes.map((note) => (
                  <p key={`${note.anchor_section_index}-${note.text}`} className="text-sm text-muted-foreground">
                    {note.text}
                  </p>
                ))}
              </section>
            ) : null}

            {currentChapter.later_notes?.length ? (
              <section className="space-y-2 rounded-xl border bg-muted/15 p-4">
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">后来补记</p>
                {currentChapter.later_notes.map((note) => {
                  const expanded = expandedLaterNotes.includes(note.note_id)
                  return (
                    <div key={note.note_id} className="rounded-lg border bg-background px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm text-muted-foreground">后来补记</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleLaterNote(note.note_id)}
                        >
                          {expanded ? '收起' : '展开'}
                        </Button>
                      </div>
                      {expanded ? (
                        <p className="mt-2 text-sm leading-6 text-foreground/90">{note.text}</p>
                      ) : null}
                    </div>
                  )
                })}
              </section>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>章节正在整理</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            书页合同已经建立，当前正文还在编排或回退到降级阅读状态。
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default BiographyBookPanel
