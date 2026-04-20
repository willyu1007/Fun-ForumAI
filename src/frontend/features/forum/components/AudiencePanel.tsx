import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Heart, MessageSquare, MoreHorizontal, X } from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'
import { RichTextLite } from '@/shared/components/RichTextLite'
import { relativeTime } from '@/shared/utils/relative-time'
import {
  useAudienceThread,
  useCreateAudienceMessage,
  useDeleteAudienceMessage,
  useToggleAudienceMessageLike,
  useCreateReport,
} from '@/api/hooks'
import type {
  AudienceMessage,
  AudienceMessageWithReplies,
  AudienceQuotedTurnRef,
  AudienceThreadSort,
} from '@/api/types'

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
  const messages: AudienceMessageWithReplies[] = useMemo(
    () => data?.data?.messages ?? [],
    [data?.data?.messages],
  )

  const createMessage = useCreateAudienceMessage(postId)
  const deleteMessage = useDeleteAudienceMessage(postId)
  const toggleLike = useToggleAudienceMessageLike(postId)
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

  const handleToggleLike = useCallback(
    (message: AudienceMessage) => {
      if (!isAuthenticated || !postId) return
      void toggleLike.mutateAsync({ messageId: message.id, liked: !message.viewer_has_liked })
    },
    [isAuthenticated, postId, toggleLike],
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

  const hasMessages = messages.length > 0

  return (
    <div
      className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-6 pt-5"
      data-testid="audience-panel"
    >
      <header className="flex items-center justify-between gap-2 text-[12px]">
        <span className="font-medium text-foreground">留言</span>
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
              onToggleLike={handleToggleLike}
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
          'flex w-full items-center gap-2 rounded-md border border-border/70 px-3 py-2 text-left text-xs',
          disabled
            ? 'cursor-not-allowed text-muted-foreground/70'
            : 'text-muted-foreground hover:border-border hover:text-foreground',
        )}
        disabled={disabled}
        onClick={() => onOpenChange(true)}
        data-testid="audience-composer-open"
      >
        {placeholder}
      </button>
    )
  }

  return (
    <div className="space-y-2 rounded-md border border-border/70 p-2" data-testid="audience-composer">
      {quotedTurn ? (
        <div
          className="flex items-start justify-between gap-2 rounded-sm bg-muted/40 px-2 py-1 text-[11px] text-muted-foreground"
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
            className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground"
            onClick={onRemoveQuote}
            aria-label="移除引用"
          >
            <X className="size-3" />
          </button>
        </div>
      ) : null}
      <Textarea
        ref={textareaRef}
        value={body}
        onChange={(event) => onBodyChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        rows={3}
        className="min-h-[4.5rem] text-[13px]"
        data-testid="audience-composer-textarea"
      />
      {error ? (
        <p className="text-[11px] text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-[11px] text-muted-foreground"
          onClick={() => onOpenChange(false)}
        >
          取消
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-7 text-[11px]"
          disabled={disabled || isPending || !body.trim()}
          onClick={onSend}
          data-testid="audience-composer-submit"
        >
          {isPending ? '发送中…' : '发布'}
        </Button>
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
  onToggleLike: (message: AudienceMessage) => void
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
  onToggleLike,
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
        onToggleLike={() => onToggleLike(message)}
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
        <ul className="mt-1 space-y-2 border-l-2 border-border/50 pl-3">
          {message.replies.map((reply) => (
            <li
              key={reply.id}
              data-audience-message-id={reply.id}
              className="space-y-1 scroll-mt-20"
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
                onToggleLike={() => onToggleLike(reply)}
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
      className="block w-full truncate rounded-sm bg-muted/40 px-2 py-1 text-left text-[11px] text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
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
  onToggleLike: () => void
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
  onToggleLike,
  onToggleReply,
  onDelete,
  onReport,
}: AudienceActionRowProps) {
  return (
    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
      <button
        type="button"
        className={cn(
          'inline-flex items-center gap-1 rounded px-1 py-0.5 transition-colors',
          message.viewer_has_liked
            ? 'text-primary hover:text-primary'
            : 'hover:text-foreground',
          (!isAuthenticated || deleted) && 'cursor-not-allowed opacity-60 hover:text-muted-foreground',
        )}
        onClick={onToggleLike}
        disabled={!isAuthenticated || deleted}
        data-testid="audience-like-button"
        aria-pressed={message.viewer_has_liked}
      >
        <Heart
          className={cn('size-3.5', message.viewer_has_liked && 'fill-current')}
          aria-hidden
        />
        <span className="tabular-nums">{message.like_count || ''}</span>
      </button>
      {onToggleReply && canReply && !deleted ? (
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded px-1 py-0.5 hover:text-foreground"
          onClick={onToggleReply}
          data-testid="audience-reply-button"
        >
          <MessageSquare className="size-3.5" aria-hidden />
          <span>回复</span>
        </button>
      ) : null}
      {!deleted ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="rounded p-0.5 hover:text-foreground"
              aria-label="更多操作"
              data-testid="audience-more-trigger"
            >
              <MoreHorizontal className="size-3.5" />
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
    <div className="mt-1 space-y-1 rounded-md border border-border/60 p-2" data-testid="audience-reply-composer">
      <Textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={2}
        placeholder="回复这条留言…"
        className="min-h-[3.5rem] text-[12px]"
      />
      {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 text-[11px] text-muted-foreground"
          onClick={() => {
            setBody('')
            setError(null)
            onDone()
          }}
        >
          取消
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-6 text-[11px]"
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
        </Button>
      </div>
    </div>
  )
}
