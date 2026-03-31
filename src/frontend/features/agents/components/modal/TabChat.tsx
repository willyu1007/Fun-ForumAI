import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, ImageIcon, MoreHorizontalIcon, Plus, Scissors, Search, Smile, X } from 'lucide-react'
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
import type {
  PrivateMessage,
  PrivateMessageAttachment,
  PrivateSession,
  SendPrivateMessageInput,
} from '@/api/types'
import { MessageInput } from '@/features/private-chat/components/MessageInput'
import { usePrivateSessionSse } from '@/features/private-chat/hooks/use-private-session-sse'
import { GuidanceItemCard } from '@/features/guidance/components/GuidanceItemCard'
import { isGuidanceEnabled } from '@/features/guidance/feature-flags'
import { getPrivateDigestFallbackNotice } from '@/features/private-chat/digest-guidance'
import { PrivateChatVerificationContent } from '@/features/help/components/PrivateChatVerificationContent'
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

function hasHttpStatus(error: unknown, status: number): boolean {
  if (typeof error !== 'object' || error === null || !('response' in error)) {
    return false
  }
  const response = (error as { response?: { status?: unknown } }).response
  return response?.status === status
}

function isIdentityGateError(error: unknown): boolean {
  if (!error) return false
  if (hasHttpStatus(error, 403)) return true
  return error instanceof Error && error.message.includes('实名审核')
}

export function TabChat({
  agentId,
  onCaptureScreenshot,
  captureErrorMessage,
}: {
  agentId: string
  onCaptureScreenshot?: () => Promise<File | null>
  captureErrorMessage?: string | null
}) {
  const [focusedSessionId, setFocusedSessionId] = useState<string | null>(null)
  const [sessionGovernanceMessage, setSessionGovernanceMessage] = useState<string | null>(null)
  const [rulesOpen, setRulesOpen] = useState(false)
  const sessionAnchorRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const rulesAutoOpenedRef = useRef(false)
  const { data: agentData, isLoading: agentLoading } = useAgentProfile(agentId)
  const resolvedAgentAvatarSrc = agentData?.data ? resolveAgentAvatarSrc(agentData.data) : null
  const {
    data: sessionsData,
    isLoading: sessionsLoading,
    isError: sessionsError,
    error: sessionsQueryError,
  } = usePrivateSessions(agentId)
  const createSession = useCreatePrivateSession(agentId)
  const createReport = useCreateReport()
  const agent = agentData?.data
  const privateHeaderBio = agent?.social_bio?.private_header_bio?.trim() || ''
  const presenceNote = agent?.social_bio?.presence_note?.trim() || ''
  const showBioHeader = privateHeaderBio.length > 0 || presenceNote.length > 0
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
  const sessionErrorMessage = sessionsError ? sessionsQueryError?.message ?? '私聊列表加载失败，请稍后重试。' : null

  const openRules = (auto = false) => {
    rulesAutoOpenedRef.current = auto
    setRulesOpen(true)
  }

  const closeRules = () => {
    rulesAutoOpenedRef.current = false
    setRulesOpen(false)
  }

  useEffect(() => {
    if (resolvedVisibleFocusSessionId !== focusedSessionId) {
      setFocusedSessionId(resolvedVisibleFocusSessionId)
    }
  }, [focusedSessionId, resolvedVisibleFocusSessionId])

  useEffect(() => {
    setSessionGovernanceMessage(null)
  }, [agentId, currentSession?.id])

  useEffect(() => {
    closeRules()
  }, [agentId])

  useEffect(() => {
    const hasGateError =
      isIdentityGateError(sessionsQueryError)
      || isIdentityGateError(createSession.error)
      || isIdentityGateError(timeline.error)
    if (hasGateError) {
      openRules(true)
      return
    }
    if (rulesAutoOpenedRef.current) {
      closeRules()
    }
  }, [createSession.error, sessionsQueryError, timeline.error])

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

  if (agent.surface_access?.private_chat_enabled === false) {
    return (
      <div className="mx-auto flex h-full w-full max-w-2xl items-center justify-center p-6">
        <div className="rounded-[2rem] border border-border/70 bg-background/95 px-6 py-8 text-center shadow-sm">
          <p className="text-sm font-medium text-foreground">该角色未开放私域聊天</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            这个节目席位只参与公域内容和关注关系，不进入私聊通道。
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex h-full min-h-0 w-full overflow-hidden" data-testid="private-chat-root">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden" data-testid="private-chat-main-area">
        {showBioHeader && (
          <div className="border-b bg-background/90">
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-1 px-6 py-4">
              {privateHeaderBio ? (
                <p className="text-sm leading-relaxed text-foreground">{privateHeaderBio}</p>
              ) : null}
              {presenceNote ? (
                <p className="text-xs text-muted-foreground">{presenceNote}</p>
              ) : null}
            </div>
          </div>
        )}
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
            onCaptureScreenshot={onCaptureScreenshot}
            captureErrorMessage={captureErrorMessage ?? null}
            onOpenRules={() => openRules(false)}
          />
        ) : (
          <ChatEmptyState
            agentName={agent.display_name}
            onNewSession={handleNewSession}
            isCreating={createSession.isPending}
            errorMessage={
              createSession.isError
                ? createSession.error.message
                : sessionErrorMessage
            }
            onOpenRules={() => openRules(false)}
          />
        )}
      </div>
      <PrivateChatRulesPanel open={rulesOpen} onClose={closeRules} />
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
  onCaptureScreenshot,
  captureErrorMessage,
  onOpenRules,
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
  onCaptureScreenshot?: () => Promise<File | null>
  captureErrorMessage: string | null
  onOpenRules: () => void
}) {
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
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeSearchResultIndex, setActiveSearchResultIndex] = useState(0)
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
          onCaptureScreenshot={onCaptureScreenshot}
          onEndSession={handleEnd}
          draftStorageKey={`private-chat-draft:${agentId}:${currentSessionId}`}
          disabled={sendMessage.isPending}
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
                    blockedLabel="当前一次只能附一张图片，先移除现有图片后再上传。"
                    dataTestId="composer-attachment-trigger"
                    onClick={openFilePicker}
                    disabled={disabled}
                    blocked={hasAttachment}
                  >
                    <ImageIcon className="size-3.5" />
                  </ToolbarIconButton>
                  <ToolbarIconButton
                    label="截图"
                    blockedLabel="当前一次只能附一张图片，先移除现有图片后再截图。"
                    dataTestId="composer-screenshot-trigger"
                    onClick={captureScreenshot}
                    disabled={disabled}
                    blocked={hasAttachment}
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
                    onOpenRules={onOpenRules}
                  />
                </div>
              </div>
            </TooltipProvider>
          )}
        />
      ) : (
        <EndedSessionFooter onNewSession={onNewSession} isCreating={isCreatingSession} />
      )}

      {(sendMessage.isError || uploadAttachment.isError || endSession.isError || captureErrorMessage) && (
        <div className={"border-t border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive"}>
          {sendMessage.isError
            ? sendMessage.error.message
            : uploadAttachment.isError
              ? uploadAttachment.error.message
              : endSession.isError
                ? endSession.error?.message
                : captureErrorMessage}
        </div>
      )}
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
              className="h-8 w-8 rounded-lg border-transparent p-0 text-muted-foreground hover:bg-transparent hover:text-foreground focus-visible:border-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
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
  onOpenRules,
}: {
  canReport: boolean
  isReporting: boolean
  onReportSession: () => void
  onEndSession: () => void
  ending: boolean
  onOpenRules: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="更多操作"
          data-testid="composer-more-trigger"
          className="h-8 w-8 rounded-lg border-transparent p-0 text-muted-foreground hover:bg-transparent hover:text-foreground focus-visible:border-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
        >
          <MoreHorizontalIcon className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-44">
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault()
            setMenuOpen(false)
            onOpenRules()
          }}
        >
          查看私聊规则
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
  blockedLabel,
  dataTestId,
  onClick,
  disabled,
  blocked,
  active,
}: {
  children: React.ReactNode
  label: string
  blockedLabel?: string
  dataTestId?: string
  onClick?: () => void
  disabled?: boolean
  blocked?: boolean
  active?: boolean
}) {
  const currentLabel = blocked ? blockedLabel ?? label : label

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={currentLabel}
          aria-disabled={blocked ? true : undefined}
          title={currentLabel}
          data-testid={dataTestId}
          className={cn(
            "h-8 w-8 rounded-lg p-0 hover:bg-transparent focus-visible:ring-0",
            active
              ? "text-foreground"
              : blocked
                ? "cursor-not-allowed text-muted-foreground/30 opacity-70"
                : "text-muted-foreground hover:text-foreground",
          )}
          onClick={blocked ? undefined : onClick}
          disabled={disabled}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6}>
        {currentLabel}
      </TooltipContent>
    </Tooltip>
  )
}

function ChatEmptyState({
  agentName,
  onNewSession,
  isCreating,
  errorMessage,
  onOpenRules,
}: {
  agentName: string
  onNewSession: () => void
  isCreating: boolean
  errorMessage: string | null
  onOpenRules: () => void
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
          <Button variant="ghost" size="sm" onClick={onOpenRules}>
            查看私聊规则
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

function PrivateChatRulesPanel({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  return (
    <div
      data-testid="private-chat-rules-panel"
      className={cn(
        'absolute inset-0 z-20 flex justify-end bg-background/16 backdrop-blur-[1px] transition-opacity duration-200',
        open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
      )}
    >
      <div
        className={cn(
          'flex h-full w-full max-w-xl flex-col border-l bg-background shadow-2xl transition-transform duration-200',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <div className="text-sm font-semibold text-foreground">私聊规则</div>
            <div className="text-xs text-muted-foreground">不离开当前聊天窗口，直接查看私聊实名与治理说明。</div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="关闭私聊规则"
            title="关闭私聊规则"
            onClick={onClose}
            className="h-8 w-8 rounded-lg"
          >
            <X className="size-4" />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <PrivateChatVerificationContent compact />
        </div>
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
            ? "rounded-md bg-muted/65 text-foreground"
            : "rounded-md bg-[color:color-mix(in_oklab,var(--color-primary)_62%,black_24%)] text-primary-foreground",
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
            ? 'border-border bg-background text-foreground'
            : 'border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground',
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
