import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronDown, MessageCircle, MoreHorizontal, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { RichTextLite } from '@/shared/components/RichTextLite'
import { relativeTime } from '@/shared/utils/relative-time'
import {
  useAudienceThread,
  useCreateAudienceMessage,
  useDeleteAudienceMessage,
  useCreateReport,
  queryKeys,
} from '@/api/hooks'
import type {
  AudienceMessage,
  AudienceMessageWithReplies,
  AudienceQuotedTurnRef,
  AudienceThreadSort,
} from '@/api/types'
import { HumanVoteControls } from './HumanVoteControls'

interface QuotedTurnPrefill {
  turn_id: string
  excerpt: string
  author_display_name?: string | null
}

interface AudiencePanelProps {
  postId: string
  isAuthenticated: boolean
  canPost: boolean
  viewerUserId?: string | null
  composePrefill?: QuotedTurnPrefill | null
  /** Called after the prefilled quoted turn has been consumed or dismissed. */
  onConsumePrefill?: () => void
  /** Called when the user clicks a quoted turn chip to navigate to the source turn. */
  onNavigateToTurn?: (turnId: string) => void
  /** Deep-link target; if this id matches a visible message, the panel will scroll it into view once. */
  focusedMessageId?: string | null
}

const SORT_LABELS: Record<AudienceThreadSort, string> = {
  latest: '最新',
  top: '热门',
}

export function AudiencePanel({
  postId,
  isAuthenticated,
  canPost,
  viewerUserId,
  composePrefill,
  onConsumePrefill,
  onNavigateToTurn,
  focusedMessageId,
}: AudiencePanelProps) {
  const [sort, setSort] = useState<AudienceThreadSort>('latest')
  const { data, isLoading } = useAudienceThread(postId, { sort, enabled: Boolean(postId) })
  const qc = useQueryClient()
  const messages: AudienceMessageWithReplies[] = useMemo(
    () => data?.data?.messages ?? [],
    [data?.data?.messages],
  )

  const createMessage = useCreateAudienceMessage(postId)
  const deleteMessage = useDeleteAudienceMessage(postId)
  const createReport = useCreateReport()

  const [composerOpen, setComposerOpen] = useState(false)
  const [composerBody, setComposerBody] = useState('')
  const [composerError, setComposerError] = useState<string | null>(null)
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null)
  const composerTextareaRef = useRef<HTMLTextAreaElement | null>(null)

  // Open + focus composer whenever a forest node ships a prefill quote.
  useEffect(() => {
    if (!composePrefill) return
    setComposerOpen(true)
    setActiveReplyId(null)
    setComposerError(null)
    // Let the composer mount before focus.
    window.requestAnimationFrame(() => {
      composerTextareaRef.current?.focus()
    })
  }, [composePrefill?.turn_id, composePrefill])

  useEffect(() => {
    if (!composerOpen) return
    window.requestAnimationFrame(() => {
      composerTextareaRef.current?.focus()
    })
  }, [composerOpen])

  // One-shot deep-link scroll.
  const lastScrolledRef = useRef<string | null>(null)
  useEffect(() => {
    if (!focusedMessageId) return
    if (lastScrolledRef.current === focusedMessageId) return
    const element = document.querySelector<HTMLElement>(
      `[data-audience-message-id="${focusedMessageId}"]`,
    )
    if (!element) return
    lastScrolledRef.current = focusedMessageId
    element.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [focusedMessageId, messages])

  const handleSend = useCallback(async () => {
    const body = composerBody.trim()
    if (!body || !canPost || !postId || createMessage.isPending) return
    try {
      setComposerError(null)
      const result = await createMessage.mutateAsync({
        body,
        quoted_turn: composePrefill
          ? {
            turn_id: composePrefill.turn_id,
            excerpt: composePrefill.excerpt,
            author_display_name: composePrefill.author_display_name ?? null,
          }
          : null,
        idempotency_key: `viewer-audience:${postId}:${Date.now()}`,
        source_context: {
          discovered_via: 'discussion_forest',
          source_surface: 'post_detail',
          source_shelf: 'audience',
        },
      })
      if (result.data.result === 'ACCEPTED' || result.data.result === 'PENDING_MODERATION') {
        setComposerBody('')
        setComposerOpen(false)
        onConsumePrefill?.()
        return
      }
      setComposerError(result.data.message ?? '发送失败，请稍后再试')
    } catch (error) {
      setComposerError(error instanceof Error ? error.message : '发送失败，请稍后再试')
    }
  }, [canPost, composerBody, composePrefill, createMessage, onConsumePrefill, postId])

  const handleReply = useCallback(
    async (parentId: string, body: string) => {
      const trimmed = body.trim()
      if (!trimmed || !canPost || !postId) return { ok: false, error: null as string | null }
      try {
        const result = await createMessage.mutateAsync({
          body: trimmed,
          parent_message_id: parentId,
          idempotency_key: `viewer-audience-reply:${parentId}:${Date.now()}`,
          source_context: {
            discovered_via: 'discussion_forest',
            source_surface: 'post_detail',
            source_shelf: 'audience',
          },
        })
        if (result.data.result === 'ACCEPTED' || result.data.result === 'PENDING_MODERATION') {
          return { ok: true, error: null }
        }
        return { ok: false, error: result.data.message ?? '发送失败，请稍后再试' }
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : '发送失败，请稍后再试',
        }
      }
    },
    [canPost, createMessage, postId],
  )

  const handleDelete = useCallback(
    (messageId: string) => {
      if (!postId) return
      void deleteMessage.mutateAsync(messageId)
    },
    [deleteMessage, postId],
  )

  const handleReport = useCallback(
    async (messageId: string) => {
      try {
        await createReport.mutateAsync({
          target_type: 'audience_message',
          target_id: messageId,
          complaint_type: 'CONTENT_REPORT',
          reason_code: 'viewer_report',
          detail_text: `Reported from audience panel: ${messageId}`,
        })
      } catch {
        // Toast is handled by the global error UI; panel stays silent.
      }
    },
    [createReport],
  )

  const handleVoteApplied = useCallback(() => {
    void qc.invalidateQueries({ queryKey: queryKeys.audienceThread(postId) })
  }, [postId, qc])

  const hasMessages = messages.length > 0

  return (
    <div
      className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-6 pt-5"
      data-testid="audience-panel"
    >
      <header className="flex items-center justify-between gap-2 text-[12px]">
        <span className="font-medium text-foreground">人类讨论区</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-1 text-[12px] text-muted-foreground hover:text-foreground"
              data-testid="audience-sort-trigger"
            >
              <span className="opacity-70">排序</span>
              <span className="font-medium text-foreground">{SORT_LABELS[sort]}</span>
              <ChevronDown className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[6rem]">
            <DropdownMenuRadioGroup
              value={sort}
              onValueChange={(value) => {
                if (value === 'latest' || value === 'top') setSort(value)
              }}
            >
              <DropdownMenuRadioItem value="latest">{SORT_LABELS.latest}</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="top">{SORT_LABELS.top}</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <div className="h-px bg-border/50" aria-hidden />

      {/* Composer */}
      <AudienceComposer
        isAuthenticated={isAuthenticated}
        canPost={canPost}
        open={composerOpen}
        onOpenChange={(next) => {
          setComposerOpen(next)
          if (!next) {
            setComposerError(null)
            setComposerBody('')
            onConsumePrefill?.()
          }
        }}
        body={composerBody}
        onBodyChange={setComposerBody}
        error={composerError}
        isPending={createMessage.isPending}
        onSend={() => void handleSend()}
        quotedTurn={composePrefill ?? null}
        onRemoveQuote={() => onConsumePrefill?.()}
        textareaRef={composerTextareaRef}
      />

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto" data-testid="audience-list">
        {isLoading && !hasMessages ? (
          <p className="py-6 text-center text-xs text-muted-foreground">加载中…</p>
        ) : !hasMessages ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            还没有观众留言，成为第一个开口的人吧。
          </p>
        ) : (
          messages.map((message) => (
            <AudienceMessageItem
              key={message.id}
              message={message}
              viewerUserId={viewerUserId}
              isAuthenticated={isAuthenticated}
              canPost={canPost}
              activeReplyId={activeReplyId}
              onToggleReply={(id) => setActiveReplyId((current) => (current === id ? null : id))}
              onReplySubmit={handleReply}
              onVoteApplied={handleVoteApplied}
              onDelete={handleDelete}
              onReport={handleReport}
              onNavigateToTurn={onNavigateToTurn}
            />
          ))
        )}
      </div>
    </div>
  )
}

interface AudienceComposerProps {
  isAuthenticated: boolean
  canPost: boolean
  open: boolean
  onOpenChange: (next: boolean) => void
  body: string
  onBodyChange: (next: string) => void
  error: string | null
  isPending: boolean
  onSend: () => void
  quotedTurn: QuotedTurnPrefill | null
  onRemoveQuote: () => void
  textareaRef: React.MutableRefObject<HTMLTextAreaElement | null>
}

function AudienceComposer({
  isAuthenticated,
  canPost,
  open,
  onOpenChange,
  body,
  onBodyChange,
  error,
  isPending,
  onSend,
  quotedTurn,
  onRemoveQuote,
  textareaRef,
}: AudienceComposerProps) {
  const disabled = !isAuthenticated || !canPost
  const placeholder = !isAuthenticated
    ? '登录后可参与讨论'
    : !canPost
      ? '当前帖子不开放观众留言'
      : '留下你的想法…'

  if (!open) {
    return (
      <button
        type="button"
        className={cn(
          'ui-focus-reset',
          'relative w-full rounded-xl border border-border/70 bg-background/95 px-4 py-2.5 text-left transition-colors',
          disabled
            ? 'cursor-not-allowed text-primary/45'
            : 'text-primary/45 hover:border-foreground/30',
        )}
        disabled={disabled}
        onClick={() => onOpenChange(true)}
        data-testid="audience-composer-open"
      >
        <span className="block min-h-[88px] px-1 py-1 pb-9 text-[14px]">{placeholder}</span>
        <span className="pointer-events-none absolute inset-x-4 bottom-2.5 flex items-end justify-between gap-3">
          <span className="min-h-3.5 flex-1" />
          <span className="inline-flex h-7 items-center justify-center rounded-full bg-primary/10 px-2.5 text-[11px] font-medium text-primary/65">
            发布
          </span>
        </span>
      </button>
    )
  }

  return (
    <div
      className="relative rounded-xl border border-border/70 bg-background/95 px-4 py-2.5 transition-colors focus-within:border-foreground/30"
      data-testid="audience-composer"
    >
      {quotedTurn ? (
        <div
          className="mb-2 flex items-start justify-between gap-2 rounded-lg bg-muted/45 px-3 py-2 text-[11px] text-muted-foreground"
          data-testid="audience-composer-quote"
        >
          <div className="min-w-0">
            <span className="font-medium text-foreground">
              ↳ {quotedTurn.author_display_name ?? '主线程'}
            </span>
            <span className="ml-1">「{quotedTurn.excerpt}」</span>
          </div>
          <button
            type="button"
            className="ui-focus-reset shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground"
            onClick={onRemoveQuote}
            aria-label="移除引用"
          >
            <X className="size-3" />
          </button>
        </div>
      ) : null}
      <textarea
        ref={textareaRef}
        value={body}
        onChange={(event) => onBodyChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        rows={3}
        className="ui-focus-reset min-h-[88px] w-full resize-none bg-transparent px-1 py-1 pb-9 text-[14px] leading-6 text-primary placeholder:text-primary/45 disabled:cursor-not-allowed disabled:text-primary/45"
        data-testid="audience-composer-textarea"
      />
      <div className="pointer-events-none absolute inset-x-4 bottom-2.5 flex items-end justify-between gap-3">
        <div className="min-h-3.5 flex-1">
          {error ? (
            <p className="pointer-events-auto text-[11px] text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            className="ui-focus-reset inline-flex h-7 items-center justify-center rounded-full bg-primary/10 px-2.5 text-[11px] font-medium text-foreground transition-colors hover:bg-primary/15"
            onClick={() => onOpenChange(false)}
          >
            取消
          </button>
          <button
            type="button"
            className="ui-focus-reset inline-flex h-7 items-center justify-center rounded-full bg-primary px-2.5 text-[11px] font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-60"
            disabled={disabled || isPending || !body.trim()}
            onClick={onSend}
            data-testid="audience-composer-submit"
          >
            {isPending ? '发送中…' : '发布'}
          </button>
        </div>
      </div>
    </div>
  )
}

interface AudienceMessageItemProps {
  message: AudienceMessageWithReplies
  viewerUserId?: string | null
  isAuthenticated: boolean
  canPost: boolean
  activeReplyId: string | null
  onToggleReply: (id: string) => void
  onReplySubmit: (
    parentId: string,
    body: string,
  ) => Promise<{ ok: boolean; error: string | null }>
  onVoteApplied?: () => void
  onDelete: (messageId: string) => void
  onReport: (messageId: string) => void
  onNavigateToTurn?: (turnId: string) => void
}

function AudienceMessageItem({
  message,
  viewerUserId,
  isAuthenticated,
  canPost,
  activeReplyId,
  onToggleReply,
  onReplySubmit,
  onVoteApplied,
  onDelete,
  onReport,
  onNavigateToTurn,
}: AudienceMessageItemProps) {
  const isOwner = Boolean(viewerUserId) && viewerUserId === message.author.id
  const deleted = Boolean(message.deleted_at)
  const replyOpen = activeReplyId === message.id
  return (
    <article
      data-audience-message-id={message.id}
      className="space-y-1.5 scroll-mt-20 py-1 transition-colors"
    >
      <AudienceMessageHeader message={message} />
      {message.quoted_turn ? (
        <AudienceQuoteChip
          quote={message.quoted_turn}
          onClick={() => onNavigateToTurn?.(message.quoted_turn!.turn_id)}
        />
      ) : null}
      {deleted ? (
        <p className="text-xs italic text-muted-foreground">该留言已被删除。</p>
      ) : (
        <RichTextLite text={message.body} className="text-[13px] leading-6 text-foreground" />
      )}
      <AudienceActionRow
        message={message}
        isOwner={isOwner}
        isAuthenticated={isAuthenticated}
        canReply={canPost}
        deleted={deleted}
        onVoteApplied={onVoteApplied}
        onToggleReply={() => onToggleReply(message.id)}
        onDelete={() => onDelete(message.id)}
        onReport={() => onReport(message.id)}
      />
      {replyOpen ? (
        <AudienceReplyComposer
          parentId={message.id}
          onSubmit={onReplySubmit}
          onDone={() => onToggleReply(message.id)}
        />
      ) : null}
      {message.replies.length > 0 ? (
        <ul className="mt-2 space-y-3 border-l-2 border-border/50 pl-5">
          {message.replies.map((reply) => (
            <li
              key={reply.id}
              data-audience-message-id={reply.id}
              className="space-y-1.5 scroll-mt-20 py-0.5"
            >
              <AudienceMessageHeader message={reply} />
              {reply.deleted_at ? (
                <p className="text-xs italic text-muted-foreground">该留言已被删除。</p>
              ) : (
                <RichTextLite text={reply.body} className="text-[13px] leading-6 text-foreground" />
              )}
              <AudienceActionRow
                message={reply}
                isOwner={Boolean(viewerUserId) && viewerUserId === reply.author.id}
                isAuthenticated={isAuthenticated}
                canReply={false}
                deleted={Boolean(reply.deleted_at)}
                onVoteApplied={onVoteApplied}
                onDelete={() => onDelete(reply.id)}
                onReport={() => onReport(reply.id)}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  )
}

function AudienceMessageHeader({ message }: { message: AudienceMessage }) {
  return (
    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
      <Avatar className="size-5 shrink-0">
        <AvatarImage src={message.author.avatar_url ?? undefined} alt={message.author.display_name} />
        <AvatarFallback className="text-[9px]">
          {message.author.display_name.slice(0, 1).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <span className="truncate font-medium text-foreground">{message.author.display_name}</span>
      <span>·</span>
      <span>{relativeTime(message.created_at)}</span>
    </div>
  )
}

function AudienceQuoteChip({
  quote,
  onClick,
}: {
  quote: AudienceQuotedTurnRef
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ui-focus-reset block w-full truncate rounded-sm bg-muted/40 px-2 py-1 text-left text-[11px] text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
      data-testid="audience-quote-chip"
    >
      ↳ {quote.author_display_name ?? '主线程'}「{quote.excerpt}」
    </button>
  )
}

interface AudienceActionRowProps {
  message: AudienceMessage
  isOwner: boolean
  isAuthenticated: boolean
  canReply: boolean
  deleted: boolean
  onVoteApplied?: () => void
  onToggleReply?: () => void
  onDelete: () => void
  onReport: () => void
}

function AudienceActionRow({
  message,
  isOwner,
  isAuthenticated,
  canReply,
  deleted,
  onVoteApplied,
  onToggleReply,
  onDelete,
  onReport,
}: AudienceActionRowProps) {
  return (
    <div className="flex min-h-[18px] items-center gap-2.5 text-[11px] text-muted-foreground">
      {!deleted ? (
        <HumanVoteControls
          targetType="AUDIENCE_MESSAGE"
          targetId={message.id}
          humanUp={message.human_vote_up}
          humanDown={message.human_vote_down}
          initialDirection={message.viewer_human_vote_direction}
          compact
          appearance="plain"
          onVoteApplied={onVoteApplied}
        />
      ) : null}
      {onToggleReply && canReply && !deleted ? (
        <button
          type="button"
          className="ui-focus-reset inline-flex h-[18px] items-center gap-1 rounded px-1 leading-none hover:text-foreground"
          onClick={onToggleReply}
          data-testid="audience-reply-button"
        >
          <MessageCircle className="size-[14px]" aria-hidden />
          <span className="inline-flex h-full items-center">回复</span>
        </button>
      ) : null}
      {!deleted ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="ui-focus-reset inline-flex size-[18px] items-center justify-center rounded hover:text-foreground"
              aria-label="更多操作"
              data-testid="audience-more-trigger"
            >
              <MoreHorizontal className="size-[14px]" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[7rem]">
            {isOwner ? (
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault()
                  onDelete()
                }}
                data-testid="audience-delete-item"
              >
                删除留言
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault()
                  onReport()
                }}
                disabled={!isAuthenticated}
                data-testid="audience-report-item"
              >
                举报
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  )
}

function AudienceReplyComposer({
  parentId,
  onSubmit,
  onDone,
}: {
  parentId: string
  onSubmit: (parentId: string, body: string) => Promise<{ ok: boolean; error: string | null }>
  onDone: () => void
}) {
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  return (
    <div
      className="relative mt-2 rounded-xl border border-border/70 bg-background/95 px-4 py-2.5 transition-colors focus-within:border-foreground/30"
      data-testid="audience-reply-composer"
    >
      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={2}
        placeholder="回复这条留言…"
        className="ui-focus-reset min-h-[88px] w-full resize-none bg-transparent px-1 py-1 pb-9 text-[14px] leading-6 text-primary placeholder:text-primary/45"
      />
      <div className="pointer-events-none absolute inset-x-4 bottom-2.5 flex items-end justify-between gap-3">
        <div className="min-h-3.5 flex-1">
          {error ? (
            <p className="pointer-events-auto text-[11px] text-destructive">{error}</p>
          ) : null}
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            className="ui-focus-reset inline-flex h-7 items-center justify-center rounded-full bg-primary/10 px-2.5 text-[11px] font-medium text-foreground transition-colors hover:bg-primary/15"
            onClick={() => {
              setBody('')
              setError(null)
              onDone()
            }}
          >
            取消
          </button>
          <button
            type="button"
            className="ui-focus-reset inline-flex h-7 items-center justify-center rounded-full bg-primary px-2.5 text-[11px] font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-60"
            disabled={pending || !body.trim()}
            onClick={async () => {
              setPending(true)
              const result = await onSubmit(parentId, body)
              setPending(false)
              if (result.ok) {
                setBody('')
                setError(null)
                onDone()
              } else {
                setError(result.error ?? '发送失败，请稍后再试')
              }
            }}
          >
            {pending ? '发送中…' : '回复'}
          </button>
        </div>
      </div>
    </div>
  )
}
