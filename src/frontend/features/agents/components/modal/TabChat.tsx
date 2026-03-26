import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, ImageIcon, MoreHorizontalIcon, Plus, Scissors, Search, Smile, X } from 'lucide-react'
import { Link } from 'react-router'
import {
  useAgentProfile,
  useCreateReport,
  useGuidanceInbox,
  usePrivateMessageTimeline,
  usePrivateSessions,
  useCreatePrivateSession,
  useSendPrivateMessage,
  useUploadPrivateMessageAttachment,
  useEndPrivateSession,
} from '@/api/hooks'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { useAuth } from '@/shared/hooks/use-auth'
import { useAgentModalStore } from '@/shared/stores/agent-modal-store'
import type {
  PrivateMessage,
  PrivateMessageAttachment,
  PrivateSession,
  SendPrivateMessageInput,
} from '@/api/types'
import { MessageInput } from '@/features/private-chat/components/MessageInput'
import { ScreenshotCropper, type ScreenshotDraft } from '@/features/private-chat/components/ScreenshotCropper'
import { usePrivateSessionSse } from '@/features/private-chat/hooks/use-private-session-sse'
import { GuidanceItemCard } from '@/features/guidance/components/GuidanceItemCard'
import { isGuidanceEnabled } from '@/features/guidance/feature-flags'
import { getPrivateDigestFallbackNotice } from '@/features/private-chat/digest-guidance'
import { resolveAgentAvatarSrc, resolveUserAvatarSrc } from '@/shared/utils/preset-avatars'

const DELIVERY_BADGE: Partial<Record<NonNullable<PrivateMessage['delivery_status']>, string>> = {
  REWRITTEN: '已降温',
  REFUSED: '已拒送',
  BLOCKED: '已拦截',
  PENDING_REVIEW: '待复核',
}

const SESSION_DIVIDER_FORMATTER = new Intl.DateTimeFormat('zh-CN', {
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

const TIME_ONLY_FORMATTER = new Intl.DateTimeFormat('zh-CN', {
  hour: '2-digit',
  minute: '2-digit',
})

function sortSessionsByStartTime(sessions: PrivateSession[]) {
  return [...sessions].sort(
    (left, right) =>
      new Date(left.started_at).getTime() - new Date(right.started_at).getTime(),
  )
}

function getLastItem<T>(items: T[]) {
  return items.length > 0 ? items[items.length - 1] ?? null : null
}

function resolveFocusedSessionId(
  sessions: PrivateSession[],
  focusedSessionId: string | null,
): string | null {
  if (sessions.length === 0) return null
  if (focusedSessionId && sessions.some((session) => session.id === focusedSessionId)) {
    return focusedSessionId
  }

  return sessions.find((session) => session.status === 'ACTIVE')?.id ?? getLastItem(sessions)?.id ?? null
}

function getCurrentSession(sessions: PrivateSession[]) {
  return sessions.find((session) => session.status === 'ACTIVE') ?? getLastItem(sessions)
}

function waitForPaint(frames = 2) {
  return new Promise<void>((resolve) => {
    const step = (remaining: number) => {
      if (remaining <= 0) {
        resolve()
        return
      }

      window.requestAnimationFrame(() => step(remaining - 1))
    }

    step(frames)
  })
}

async function captureDisplayFrame(): Promise<ScreenshotDraft | null> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('当前环境不支持页面截图。')
  }

  const html2canvas = (await import('html2canvas')).default
  const canvas = await html2canvas(document.body, {
    backgroundColor: null,
    logging: false,
    useCORS: true,
    scale: Math.min(window.devicePixelRatio || 1, 2),
    x: window.scrollX,
    y: window.scrollY,
    width: window.innerWidth,
    height: window.innerHeight,
    scrollX: -window.scrollX,
    scrollY: -window.scrollY,
    windowWidth: document.documentElement.scrollWidth,
    windowHeight: document.documentElement.scrollHeight,
  })

  return {
    dataUrl: canvas.toDataURL('image/png'),
    width: canvas.width,
    height: canvas.height,
    mimeType: 'image/png',
    fileName: `forum-screenshot-${Date.now()}.png`,
  }
}

export function TabChat({ agentId }: { agentId: string }) {
  const [focusedSessionId, setFocusedSessionId] = useState<string | null>(null)
  const [sessionGovernanceMessage, setSessionGovernanceMessage] = useState<string | null>(null)
  const sessionAnchorRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const { data: agentData, isLoading: agentLoading } = useAgentProfile(agentId)
  const resolvedAgentAvatarSrc = agentData?.data ? resolveAgentAvatarSrc(agentData.data) : null
  const { data: sessionsData, isLoading: sessionsLoading } = usePrivateSessions(agentId)
  const createSession = useCreatePrivateSession(agentId)
  const createReport = useCreateReport()
  const agent = agentData?.data
  const sessionItems = sessionsData?.data?.items
  const sessions = useMemo(() => sortSessionsByStartTime(sessionItems ?? []), [sessionItems])
  const currentSession = useMemo(() => getCurrentSession(sessions), [sessions])
  const timeline = usePrivateMessageTimeline(agentId, sessions)
  const currentTimelineChunk =
    timeline.items.find((item) => item.session.id === currentSession?.id) ?? null
  const visibleTimelineItems = useMemo(
    () => timeline.items.filter((item) => item.messages.length > 0),
    [timeline.items],
  )
  const visibleSessions = useMemo(
    () => visibleTimelineItems.map((item) => item.session),
    [visibleTimelineItems],
  )
  const resolvedVisibleFocusSessionId = resolveFocusedSessionId(visibleSessions, focusedSessionId)

  useEffect(() => {
    if (resolvedVisibleFocusSessionId !== focusedSessionId) {
      setFocusedSessionId(resolvedVisibleFocusSessionId)
    }
  }, [focusedSessionId, resolvedVisibleFocusSessionId])

  useEffect(() => {
    setSessionGovernanceMessage(null)
  }, [agentId, currentSession?.id])

  useEffect(() => {
    if (!resolvedVisibleFocusSessionId) return
    const anchor = sessionAnchorRefs.current[resolvedVisibleFocusSessionId]
    anchor?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [resolvedVisibleFocusSessionId, visibleTimelineItems.length])

  const handleNewSession = async () => {
    try {
      const result = await createSession.mutateAsync()
      setFocusedSessionId(result.data.id)
    } catch {
      // Mutation error is rendered in-page.
    }
  }

  const handleReportSession = async () => {
    if (!currentSession) return
    setSessionGovernanceMessage(null)

    try {
      await createReport.mutateAsync({
        target_type: 'private_session',
        target_id: currentSession.id,
        complaint_type: 'HARASSMENT_REPORT',
        reason_code:
          currentSession.initiator === 'AGENT'
            ? 'proactive_private_session_report'
            : 'private_session_report',
        detail_text: `Reported from private chat with ${agent?.display_name ?? agentId}: ${currentSession.id}`,
      })
      setSessionGovernanceMessage('这段聊天已提交给治理队列，后续可以在 Safety Center 查看处理进度。')
    } catch (error) {
      setSessionGovernanceMessage(
        error instanceof Error ? error.message : '治理请求提交失败，请稍后重试。',
      )
    }
  }

  if (agentLoading || sessionsLoading) {
    return (
      <div className={"mx-auto flex h-full w-full max-w-4xl flex-col space-y-4 p-6"}>
        <Skeleton className="h-[70vh] rounded-[2rem]" />
        <Skeleton className="h-32 w-full rounded-[2rem]" />
      </div>
    )
  }

  if (!agent) {
    return <div className={"p-4 text-destructive"}>Agent 不存在</div>
  }

  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden" data-testid="private-chat-root">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden" data-testid="private-chat-main-area">
        {currentSession ? (
          <ChatTimeline
            agentId={agentId}
            agentName={agent.display_name}
            timelineItems={visibleTimelineItems}
            timelineLoading={timeline.isLoading}
            timelineError={timeline.error?.message ?? null}
            currentSession={currentSession}
            currentMessageCount={
              visibleTimelineItems.find((item) => item.session.id === currentSession?.id)?.messages.length ??
              currentTimelineChunk?.messages.length ??
              0
            }
            focusedSessionId={resolvedVisibleFocusSessionId}
            onNewSession={handleNewSession}
            isCreatingSession={createSession.isPending}
            onReportSession={handleReportSession}
            isReporting={createReport.isPending}
            sessionGovernanceMessage={sessionGovernanceMessage}
            sessionAnchorRefs={sessionAnchorRefs}
            agentAvatarSrc={resolvedAgentAvatarSrc}
          />
        ) : (
          <ChatEmptyState
            agentName={agent.display_name}
            onNewSession={handleNewSession}
            isCreating={createSession.isPending}
            errorMessage={createSession.isError ? createSession.error.message : null}
          />
        )}
      </div>
    </div>
  )
}

function ChatTimeline({
  agentId,
  agentName,
  timelineItems,
  timelineLoading,
  timelineError,
  currentSession,
  currentMessageCount,
  focusedSessionId,
  onNewSession,
  isCreatingSession,
  onReportSession,
  isReporting,
  sessionGovernanceMessage,
  sessionAnchorRefs,
  agentAvatarSrc,
}: {
  agentId: string
  agentName: string
  timelineItems: Array<{ session: PrivateSession; messages: PrivateMessage[] }>
  timelineLoading: boolean
  timelineError: string | null
  currentSession: PrivateSession | null
  currentMessageCount: number
  focusedSessionId: string | null
  onNewSession: () => void
  isCreatingSession: boolean
  onReportSession: () => void
  isReporting: boolean
  sessionGovernanceMessage: string | null
  sessionAnchorRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>
  agentAvatarSrc: string | null
}) {
  const hideForCapture = useAgentModalStore((state) => state.hideForCapture)
  const showAfterCapture = useAgentModalStore((state) => state.showAfterCapture)
  const { user } = useAuth()
  const guidanceEnabled = isGuidanceEnabled()
  const currentSessionId = currentSession?.id ?? ''
  const activeLiveSessionId = currentSession?.status === 'ACTIVE' ? currentSession.id : ''
  const sendMessage = useSendPrivateMessage(agentId, currentSessionId)
  const uploadAttachment = useUploadPrivateMessageAttachment(agentId, currentSessionId)
  const endSession = useEndPrivateSession(agentId, currentSessionId)
  const guidanceInbox = useGuidanceInbox()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const searchInputRef = useRef<HTMLInputElement>(null)
  const screenshotResolverRef = useRef<((file: File | null) => void) | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeSearchResultIndex, setActiveSearchResultIndex] = useState(0)
  const [screenshotDraft, setScreenshotDraft] = useState<ScreenshotDraft | null>(null)
  const [screenshotError, setScreenshotError] = useState<string | null>(null)
  const currentUserAvatarSrc = user ? resolveUserAvatarSrc(user) : null
  const totalMessageCount = timelineItems.reduce(
    (sum, item) => sum + item.messages.length,
    0,
  )
  const searchMatches = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase('zh-CN')
    if (!normalizedQuery) return []

    return timelineItems.flatMap((item) =>
      item.messages
        .filter((message) => message.content.toLocaleLowerCase('zh-CN').includes(normalizedQuery))
        .map((message) => message.id),
    )
  }, [searchQuery, timelineItems])
  const activeSearchMessageId =
    searchMatches.length > 0
      ? searchMatches[Math.min(activeSearchResultIndex, searchMatches.length - 1)]
      : null
  const matchedMessageIds = useMemo(() => new Set(searchMatches), [searchMatches])

  usePrivateSessionSse(activeLiveSessionId, agentId)

  const receiptItem =
    guidanceEnabled && currentSessionId
      ? (guidanceInbox.data?.data?.items.find(
          (item) => item.related_session_id === currentSessionId,
        ) ?? null)
      : null
  const fallbackNotice =
    currentSession && currentSession.status !== 'ACTIVE'
      ? getPrivateDigestFallbackNotice({
          messageCount: currentMessageCount,
          digestStatus: currentSession.digest_status,
        })
      : null

  useEffect(() => {
    if (focusedSessionId && focusedSessionId !== currentSessionId) return
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [currentSessionId, focusedSessionId, totalMessageCount])

  useEffect(() => {
    if (!searchOpen) return
    searchInputRef.current?.focus()
  }, [searchOpen])

  useEffect(() => {
    setActiveSearchResultIndex(0)
  }, [searchQuery])

  useEffect(() => {
    if (!activeSearchMessageId) return
    messageRefs.current[activeSearchMessageId]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [activeSearchMessageId])

  useEffect(() => {
    return () => {
      screenshotResolverRef.current?.(null)
      screenshotResolverRef.current = null
      showAfterCapture()
    }
  }, [showAfterCapture])

  const handleSend = async (input: SendPrivateMessageInput) => {
    await sendMessage.mutateAsync(input)
  }

  const handleUploadAttachment = async (file: File) => {
    const result = await uploadAttachment.mutateAsync(file)
    return result.data
  }

  const handleEnd = async () => {
    await endSession.mutateAsync()
  }

  const handleCaptureScreenshot = async () => {
    setScreenshotError(null)
    hideForCapture()

    try {
      await waitForPaint(2)
      const draft = await captureDisplayFrame()
      if (!draft) return null

      showAfterCapture()
      await waitForPaint(1)

      return await new Promise<File | null>((resolve) => {
        screenshotResolverRef.current = resolve
        setScreenshotDraft(draft)
      })
    } catch (error) {
      setScreenshotError(error instanceof Error ? error.message : '截图失败，请稍后再试。')
      return null
    } finally {
      showAfterCapture()
    }
  }

  const handleCloseSearch = () => {
    setSearchOpen(false)
    setSearchQuery('')
  }

  const moveSearchCursor = (direction: 1 | -1) => {
    if (searchMatches.length === 0) return
    setActiveSearchResultIndex((currentIndex) => {
      const nextIndex = currentIndex + direction
      if (nextIndex < 0) return searchMatches.length - 1
      if (nextIndex >= searchMatches.length) return 0
      return nextIndex
    })
  }

  const resolveScreenshotDraft = (file: File | null) => {
    screenshotResolverRef.current?.(file)
    screenshotResolverRef.current = null
    setScreenshotDraft(null)
  }

  if (timelineLoading) {
    return (
      <div className={"flex-1 space-y-4 p-6"}>
        <Skeleton className="mx-auto h-5 w-32 rounded-full" />
        <Skeleton className="h-16 w-2/3 rounded-3xl" />
        <Skeleton className={"ml-auto h-16 w-1/2 rounded-3xl"} />
        <Skeleton className="h-16 w-3/5 rounded-3xl" />
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <ScrollArea className="min-h-0 flex-1 px-4 py-3" data-testid="private-chat-thread-scroll-area">
        <div className="mx-auto flex max-w-3xl flex-col gap-3">
          {timelineItems.map((item, index) => (
            <div
              key={item.session.id}
              ref={(node) => {
                sessionAnchorRefs.current[item.session.id] = node
              }}
              data-testid={`session-timeline-${item.session.id}`}
              data-active={item.session.id === focusedSessionId ? 'true' : 'false'}
              className="space-y-3"
            >
              <SessionDivider label={formatSessionDividerLabel(item.session, index)} />
              {item.messages.length === 0 ? (
                <ChatSystemNote>
                  {item.session.status === 'ACTIVE'
                    ? '这一轮刚刚开始，先发一句问候吧。'
                    : '这一轮没有留下可见消息。'}
                </ChatSystemNote>
              ) : (
                item.messages.map((message) => (
                  <div
                    key={message.id}
                    ref={(node) => {
                      messageRefs.current[message.id] = node
                    }}
                  >
                    <MessageBubble
                      message={message}
                      agentName={agentName}
                      agentAvatarSrc={agentAvatarSrc}
                      userAvatarSrc={currentUserAvatarSrc}
                      searchMatched={matchedMessageIds.has(message.id)}
                      searchActive={message.id === activeSearchMessageId}
                    />
                  </div>
                ))
              )}
            </div>
          ))}

          {sendMessage.isPending && currentSession?.status === 'ACTIVE' && (
            <div className={"flex items-start gap-2"}>
              <Avatar className={"h-7 w-7 shrink-0"}>
                {agentAvatarSrc ? <AvatarImage src={agentAvatarSrc} alt={agentName} className="object-cover" /> : null}
                <AvatarFallback className={"text-xs bg-primary/10"}>{agentName[0]}</AvatarFallback>
              </Avatar>
              <div className={"rounded-md bg-muted/55 px-3 py-2"}>
                <div className={"flex gap-1"}>
                  <span className="animate-bounce">·</span>
                  <span className={"animate-bounce [animation-delay:0.1s]"}>·</span>
                  <span className={"animate-bounce [animation-delay:0.2s]"}>·</span>
                </div>
              </div>
            </div>
          )}

          {sessionGovernanceMessage && (
            <ChatSystemNote tone={sessionGovernanceMessage.includes('失败') ? 'danger' : 'muted'}>
              {sessionGovernanceMessage}
            </ChatSystemNote>
          )}

          {timelineError && <ChatSystemNote tone="danger">{timelineError}</ChatSystemNote>}

          {(receiptItem || fallbackNotice) && (
            <div className="pt-2">
              {receiptItem ? (
                <div className={"mx-auto max-w-2xl"}>
                  <GuidanceItemCard item={receiptItem} />
                </div>
              ) : fallbackNotice ? (
                <ChatArchiveCard notice={fallbackNotice} />
              ) : null}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {currentSession?.status === 'ACTIVE' ? (
        <MessageInput
          onSend={handleSend}
          onUploadAttachment={handleUploadAttachment}
          onCaptureScreenshot={handleCaptureScreenshot}
          onEndSession={handleEnd}
          disabled={sendMessage.isPending || uploadAttachment.isPending}
          sessionEnded={false}
          toolbar={({
            openFilePicker,
            captureScreenshot,
            insertText,
            disabled,
            hasAttachment,
            onEndSession,
            ending,
          }) => (
            <TooltipProvider delayDuration={0}>
              <div className="flex w-full items-center justify-between">
                <div className="flex items-center gap-1">
                  <EmojiMenu onSelectEmoji={insertText} disabled={disabled} />
                  <ToolbarIconButton
                    label="上传图片"
                    dataTestId="composer-attachment-trigger"
                    onClick={openFilePicker}
                    disabled={hasAttachment || disabled}
                  >
                    <ImageIcon className="size-3.5" />
                  </ToolbarIconButton>
                  <ToolbarIconButton
                    label="截图"
                    dataTestId="composer-screenshot-trigger"
                    onClick={captureScreenshot}
                    disabled={hasAttachment || disabled}
                  >
                    <Scissors className="size-3.5" />
                  </ToolbarIconButton>
                  <ComposerSearchControl
                    open={searchOpen}
                    value={searchQuery}
                    inputRef={searchInputRef}
                    matchCount={searchMatches.length}
                    activeMatchIndex={searchMatches.length > 0 ? activeSearchResultIndex + 1 : 0}
                    onToggle={() => setSearchOpen((open) => !open)}
                    onChange={setSearchQuery}
                    onPrev={() => moveSearchCursor(-1)}
                    onNext={() => moveSearchCursor(1)}
                    onClose={handleCloseSearch}
                  />
                </div>
                <div className="flex items-center gap-1">
                  <ToolbarIconButton
                    label="新一轮聊天"
                    dataTestId="composer-new-session-trigger"
                    onClick={onNewSession}
                    disabled={isCreatingSession}
                  >
                    <Plus className="size-3.5" />
                  </ToolbarIconButton>
                  <ComposerMoreMenu
                    canReport={Boolean(currentSessionId)}
                    isReporting={isReporting}
                    onReportSession={onReportSession}
                    onEndSession={onEndSession}
                    ending={ending}
                  />
                </div>
              </div>
            </TooltipProvider>
          )}
        />
      ) : (
        <EndedSessionFooter onNewSession={onNewSession} isCreating={isCreatingSession} />
      )}

      {(sendMessage.isError || uploadAttachment.isError || endSession.isError || screenshotError) && (
        <div className={"border-t border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive"}>
          {sendMessage.isError
            ? sendMessage.error.message
            : uploadAttachment.isError
              ? uploadAttachment.error.message
              : endSession.isError
                ? endSession.error?.message
                : screenshotError}
        </div>
      )}

      <ScreenshotCropper
        draft={screenshotDraft}
        open={Boolean(screenshotDraft)}
        onCancel={() => resolveScreenshotDraft(null)}
        onConfirm={(file) => resolveScreenshotDraft(file)}
      />
    </div>
  )
}

function SessionDivider({
  label,
}: {
  label: string
}) {
  return (
    <div className="py-0.5 text-center text-[11px] text-muted-foreground/70">
      {label}
    </div>
  )
}

const QUICK_EMOJIS = ['🙂', '😂', '🥹', '🤔', '👍', '👏', '😭', '🥳']

function EmojiMenu({
  onSelectEmoji,
  disabled,
}: {
  onSelectEmoji: (value: string) => void
  disabled?: boolean
}) {
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="添加表情"
              title="添加表情"
              data-testid="composer-emoji-trigger"
              className="h-8 w-8 rounded-lg p-0 text-muted-foreground hover:bg-transparent hover:text-foreground focus-visible:ring-0"
              disabled={disabled}
            >
              <Smile className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6}>添加表情</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start" side="top" className="w-44 p-2">
        <div className="grid grid-cols-4 gap-1">
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-lg transition-colors hover:bg-muted"
              onClick={() => onSelectEmoji(emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ComposerSearchControl({
  open,
  inputRef,
  value,
  matchCount,
  activeMatchIndex,
  onToggle,
  onChange,
  onPrev,
  onNext,
  onClose,
}: {
  open: boolean
  inputRef: React.RefObject<HTMLInputElement | null>
  value: string
  matchCount: number
  activeMatchIndex: number
  onToggle: () => void
  onChange: (value: string) => void
  onPrev: () => void
  onNext: () => void
  onClose: () => void
}) {
  return (
    <div className="flex items-center gap-0.5">
      <ToolbarIconButton
        label="搜索聊天"
        dataTestId="composer-search-trigger"
        onClick={onToggle}
        active={open}
      >
        <Search className="size-3.5" />
      </ToolbarIconButton>
      <div
        className={cn(
          "flex items-center gap-0.5 overflow-hidden transition-[max-width,opacity,margin] duration-200",
          open ? "ml-0.5 max-w-[28rem] opacity-100" : "max-w-0 opacity-0 pointer-events-none",
        )}
      >
        <input
          ref={inputRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="搜索这段聊天"
          className="h-8 w-44 min-w-0 appearance-none border-0 bg-transparent px-0 text-sm text-foreground outline-none placeholder:text-muted-foreground/75 sm:w-52"
        />
        <span className="shrink-0 px-0.5 text-xs text-muted-foreground">
          {matchCount > 0 ? `${activeMatchIndex}/${matchCount}` : value ? '无结果' : null}
        </span>
        <ToolbarIconButton label="上一个结果" onClick={onPrev} disabled={matchCount === 0}>
          <ChevronUp className="size-3.5" />
        </ToolbarIconButton>
        <ToolbarIconButton label="下一个结果" onClick={onNext} disabled={matchCount === 0}>
          <ChevronDown className="size-3.5" />
        </ToolbarIconButton>
        <ToolbarIconButton label="关闭搜索" onClick={onClose}>
          <X className="size-3.5" />
        </ToolbarIconButton>
      </div>
    </div>
  )
}

function ComposerMoreMenu({
  canReport,
  isReporting,
  onReportSession,
  onEndSession,
  ending,
}: {
  canReport: boolean
  isReporting: boolean
  onReportSession: () => void
  onEndSession: () => void
  ending: boolean
}) {
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="更多操作"
              title="更多操作"
              data-testid="composer-more-trigger"
              className="h-8 w-8 rounded-lg p-0 text-muted-foreground hover:bg-transparent hover:text-foreground focus-visible:ring-0"
            >
              <MoreHorizontalIcon className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6}>更多操作</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start" side="top" className="w-44">
        <DropdownMenuItem asChild>
          <Link to="/help/private-chat-verification">查看私聊规则</Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!canReport || isReporting}
          onSelect={(event) => {
            event.preventDefault()
            void onReportSession()
          }}
        >
          {isReporting ? '提交中…' : '发起聊天治理'}
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={ending}
          onSelect={(event) => {
            event.preventDefault()
            onEndSession()
          }}
        >
          {ending ? '结束中…' : '结束这一轮'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ToolbarIconButton({
  children,
  label,
  dataTestId,
  onClick,
  disabled,
  active,
}: {
  children: React.ReactNode
  label: string
  dataTestId?: string
  onClick?: () => void
  disabled?: boolean
  active?: boolean
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={label}
          title={label}
          data-testid={dataTestId}
          className={cn(
            "h-8 w-8 rounded-lg p-0 hover:bg-transparent focus-visible:ring-0",
            active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
          onClick={onClick}
          disabled={disabled}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

function ChatEmptyState({
  agentName,
  onNewSession,
  isCreating,
  errorMessage,
}: {
  agentName: string
  onNewSession: () => void
  isCreating: boolean
  errorMessage: string | null
}) {
  return (
    <div className={"flex flex-1 items-center justify-center px-5 py-10 text-center"} data-testid="private-chat-empty-state">
      <div className={"w-full max-w-md rounded-[2rem] border bg-muted/10 px-6 py-8"}>
        <p className={"text-lg font-semibold text-foreground"}>还没有开始聊天</p>
        <p className={"mt-2 text-sm text-muted-foreground"}>
          先跟 {agentName} 打个招呼，看看这段对话会往哪里走。
        </p>
        {errorMessage && <p className={"mt-4 text-sm text-destructive"}>{errorMessage}</p>}
        <div className={"mt-6 flex flex-col items-center gap-3"}>
          <Button className={"rounded-full px-5"} onClick={onNewSession} disabled={isCreating}>
            {isCreating ? '正在打开…' : '开始聊天'}
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/help/private-chat-verification">查看私聊规则</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}

function ChatSystemNote({
  children,
  tone = 'muted',
}: {
  children: string
  tone?: 'muted' | 'danger'
}) {
  return (
    <div className={"flex justify-center"}>
      <div
        className={cn(
          "rounded-full px-4 py-1.5 text-center text-xs",
          tone === 'danger'
            ? "bg-destructive/10 text-destructive"
            : "bg-muted text-muted-foreground",
        )}
      >
        {children}
      </div>
    </div>
  )
}

function ChatArchiveCard({
  notice,
}: {
  notice: NonNullable<ReturnType<typeof getPrivateDigestFallbackNotice>>
}) {
  return (
    <div
      className={cn(
        "mx-auto max-w-2xl rounded-[1.75rem] border px-5 py-4 text-sm",
        notice.tone === 'warning' && "border-warning/30 bg-warning/10 text-foreground",
        notice.tone === 'danger' && "border-destructive/40 bg-destructive/5 text-destructive",
        notice.tone === 'muted' && "border-dashed bg-background text-muted-foreground",
      )}
    >
      <p className={"font-medium"}>{notice.title}</p>
      <p className={"mt-1"}>{notice.body}</p>
    </div>
  )
}

function EndedSessionFooter({
  onNewSession,
  isCreating,
}: {
  onNewSession: () => void
  isCreating: boolean
}) {
  return (
    <div className={"shrink-0 border-t bg-background px-5 py-4"}>
      <div className={"mx-auto flex max-w-3xl items-center justify-between gap-4 rounded-[1.75rem] border bg-muted/10 px-4 py-3"}>
        <div>
          <p className={"text-sm font-medium text-foreground"}>这一轮先停在这里</p>
          <p className={"text-xs text-muted-foreground"}>想继续聊，可以再开一轮新的聊天。</p>
        </div>
        <Button className={"rounded-full px-5"} onClick={onNewSession} disabled={isCreating}>
          {isCreating ? '打开中…' : '新一轮聊天'}
        </Button>
      </div>
    </div>
  )
}

function MessageBubble({
  message,
  agentName,
  agentAvatarSrc,
  userAvatarSrc,
  searchMatched,
  searchActive,
}: {
  message: PrivateMessage
  agentName: string
  agentAvatarSrc: string | null
  userAvatarSrc: string | null
  searchMatched?: boolean
  searchActive?: boolean
}) {
  const isHuman = message.author_type === 'HUMAN'
  const deliveryLabel = message.delivery_status ? DELIVERY_BADGE[message.delivery_status] : null
  const attachments = message.attachments ?? []

  return (
    <div className={cn('flex items-start gap-2.5', isHuman && 'flex-row-reverse')}>
      <Avatar className={"h-7 w-7 shrink-0"}>
        {(isHuman ? userAvatarSrc : agentAvatarSrc) ? (
          <AvatarImage
            src={isHuman ? userAvatarSrc ?? undefined : agentAvatarSrc ?? undefined}
            alt={isHuman ? '当前用户头像' : `${agentName} 头像`}
            className="object-cover"
          />
        ) : null}
        <AvatarFallback
          className={cn(
            "text-xs",
            isHuman ? "bg-accent/10 text-accent" : "bg-primary/10",
          )}
        >
          {isHuman ? '我' : agentName[0]}
        </AvatarFallback>
      </Avatar>
      <div
        className={cn(
          "max-w-[80%] px-3 py-2 md:max-w-[70%]",
          isHuman
            ? "rounded-md bg-[color:color-mix(in_oklab,var(--color-primary)_58%,black_28%)] text-primary-foreground"
            : "rounded-md bg-muted/55 text-foreground",
          searchMatched && "ring-1 ring-primary/15",
          searchActive && "ring-2 ring-primary/35",
        )}
      >
        {attachments.length > 0 && (
          <div className="space-y-2">
            {attachments.map((attachment) => (
              <PrivateAttachmentPreview
                key={attachment.asset_id}
                attachment={attachment}
                compactTone={isHuman ? 'human' : 'agent'}
              />
            ))}
          </div>
        )}
        {message.content.trim().length > 0 && (
          <p className={cn("whitespace-pre-wrap break-words text-[13px] leading-[1.45]", attachments.length > 0 && 'mt-1.5')}>
            {message.content}
          </p>
        )}
        {deliveryLabel && (
          <div className={"mt-2"}>
            <Badge variant="outline" className={"h-5 text-[11px]"}>
              {deliveryLabel}
            </Badge>
          </div>
        )}
      </div>
    </div>
  )
}

function PrivateAttachmentPreview({
  attachment,
  compactTone,
}: {
  attachment: PrivateMessageAttachment
  compactTone: 'human' | 'agent'
}) {
  const [failed, setFailed] = useState(false)
  const displayUrl = attachment.display_url ?? undefined
  const showPlaceholder = attachment.state !== 'ready' || failed || !displayUrl

  if (showPlaceholder) {
    return (
      <div
        className={cn(
          'flex min-h-28 w-full items-center justify-center rounded-lg border border-dashed px-4 py-6 text-center text-xs',
          compactTone === 'human'
            ? 'border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground'
            : 'border-border bg-background text-muted-foreground',
        )}
      >
        {attachment.placeholder?.label ?? '图片暂不可用'}
      </div>
    )
  }

  return (
    <img
      src={displayUrl}
      alt={attachment.alt_text ?? '私聊图片附件'}
      className="max-h-72 w-full rounded-lg object-cover"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  )
}

function formatSessionDividerLabel(session: PrivateSession, index: number) {
  return formatTimelineMarker(session.started_at, index === 0)
}

function formatTimelineMarker(input: string, firstSession: boolean) {
  const date = new Date(input)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  const dayDiff = Math.round((today - target) / 86_400_000)

  if (!firstSession && dayDiff === 0) {
    return TIME_ONLY_FORMATTER.format(date)
  }
  if (dayDiff === 0) {
    return `今天 ${TIME_ONLY_FORMATTER.format(date)}`
  }
  if (dayDiff === 1) {
    return `昨天 ${TIME_ONLY_FORMATTER.format(date)}`
  }

  return SESSION_DIVIDER_FORMATTER.format(date)
}
