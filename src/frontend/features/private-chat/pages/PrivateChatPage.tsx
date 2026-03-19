import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, Link } from 'react-router'
import {
  useAgentProfile,
  useCreateReport,
  useGuidanceInbox,
  usePrivateSessions,
  usePrivateMessages,
  useCreatePrivateSession,
  useSendPrivateMessage,
  useEndPrivateSession,
} from '@/api/hooks'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { relativeTime } from '@/shared/utils/relative-time'
import type { PrivateSession, PrivateMessage } from '@/api/types'
import { DEV_AUTH_TOOLBAR_SAFE_AREA_CLASS } from '@/shared/layout/dev-auth-toolbar'
import { MessageInput } from '../components/MessageInput'
import { SessionSidebar } from '../components/SessionSidebar'
import { usePrivateSessionSse } from '../hooks/use-private-session-sse'
import { GuidanceItemCard } from '@/features/guidance/components/GuidanceItemCard'
import { isGuidanceEnabled } from '@/features/guidance/feature-flags'
import { getPrivateDigestFallbackNotice } from '../digest-guidance'

const DELIVERY_BADGE: Partial<Record<NonNullable<PrivateMessage['delivery_status']>, string>> = {
  REWRITTEN: '已降温',
  REFUSED: '已拒送',
  BLOCKED: '已拦截',
  PENDING_REVIEW: '待复核',
}

export function PrivateChatPage() {
  const { agentId } = useParams<{
    agentId: string
  }>()
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [showSidebar, setShowSidebar] = useState(false)
  const { data: agentData, isLoading: agentLoading } = useAgentProfile(agentId ?? '')
  const { data: sessionsData, isLoading: sessionsLoading } = usePrivateSessions(agentId ?? '')
  const createSession = useCreatePrivateSession(agentId ?? '')
  const agent = agentData?.data
  const sessionItems = sessionsData?.data?.items
  const sessions = useMemo(() => sessionItems ?? [], [sessionItems])
  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null
  useEffect(() => {
    if (!activeSessionId && sessions.length > 0) {
      const active = sessions.find((s) => s.status === 'ACTIVE')
      if (active) setActiveSessionId(active.id)
      else setActiveSessionId(sessions[0].id)
    }
  }, [sessions, activeSessionId])
  const handleNewSession = async () => {
    try {
      const result = await createSession.mutateAsync()
      setActiveSessionId(result.data.id)
    } catch {
      // Mutation error is rendered in-page.
    }
  }
  if (agentLoading || sessionsLoading) {
    return (
      <div className={"p-4 space-y-3 max-w-4xl mx-auto"}>
        <Skeleton className="h-10 w-64" />
        <Skeleton className={"h-[70vh]"} />
      </div>
    )
  }
  if (!agent) {
    return <div className={"p-4 text-destructive"}>Agent 不存在</div>
  }
  return (
    <div className={cn("mx-auto flex h-[calc(100vh-4rem)] max-w-5xl", DEV_AUTH_TOOLBAR_SAFE_AREA_CLASS)}>
      {/* Session sidebar - desktop */}
      <div className={"hidden md:block w-64 border-r"}>
        <SessionSidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectSession={setActiveSessionId}
          onNewSession={handleNewSession}
          isCreating={createSession.isPending}
          agentName={agent.display_name}
        />
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        <ChatHeader
          agentName={agent.display_name}
          agentId={agent.id}
          activeSession={activeSession}
          sessionCount={sessions.length}
          onToggleSidebar={() => setShowSidebar(!showSidebar)}
          onNewSession={handleNewSession}
          isCreating={createSession.isPending}
        />

        {activeSessionId ? (
          <ChatThread
            agentId={agentId!}
            sessionId={activeSessionId}
            agentName={agent.display_name}
            session={activeSession}
          />
        ) : (
          <div className={"flex-1 flex items-center justify-center text-muted-foreground"}>
            <div className={"text-center space-y-3"}>
              <div className={"mb-4 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-left text-sm text-foreground"}>
                大陆首发风控已生效：新建私聊、发送私聊和接收主动私信前，需要先通过实名审核。
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/help/private-chat-verification">查看实名与私聊规则</Link>
              </Button>
              <p className={"text-lg"}>还没有对话</p>
              <p className={"text-sm"}>点击"新对话"开始与 {agent.display_name} 交流</p>
              {createSession.isError && (
                <p className={"mb-3 text-sm text-destructive"}>{createSession.error.message}</p>
              )}
              <Button onClick={handleNewSession} disabled={createSession.isPending}>
                开始新对话
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Mobile sidebar overlay */}
      {showSidebar && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className={"absolute inset-0 bg-foreground/50"} onClick={() => setShowSidebar(false)} />
          <div className={"absolute left-0 top-0 bottom-0 w-72 bg-background border-r"}>
            <SessionSidebar
              sessions={sessions}
              activeSessionId={activeSessionId}
              onSelectSession={(id) => {
                setActiveSessionId(id)
                setShowSidebar(false)
              }}
              onNewSession={handleNewSession}
              isCreating={createSession.isPending}
              agentName={agent.display_name}
            />
          </div>
        </div>
      )}
    </div>
  )
}
function ChatHeader({
  agentName,
  agentId,
  activeSession,
  sessionCount,
  onToggleSidebar,
  onNewSession,
  isCreating,
}: {
  agentName: string
  agentId: string
  activeSession: PrivateSession | null
  sessionCount: number
  onToggleSidebar: () => void
  onNewSession: () => void
  isCreating: boolean
}) {
  return (
    <div className={"flex items-center gap-3 px-4 py-3 border-b bg-background/95 backdrop-blur"}>
      <Button variant="ghost" size="sm" className="md:hidden" onClick={onToggleSidebar}>
        ☰
      </Button>

      <Link to={`/agents/${agentId}`} className={"font-semibold hover:underline"}>
        {agentName}
      </Link>

      {activeSession && (
        <Badge variant={activeSession.status === 'ACTIVE' ? 'default' : 'secondary'}>
          {activeSession.status === 'ACTIVE' ? '进行中' : '已结束'}
        </Badge>
      )}

      <span className={"text-xs text-muted-foreground"}>{sessionCount} 个对话</span>

      <Button variant="ghost" size="sm" asChild>
        <Link to="/help/private-chat-verification">实名规则</Link>
      </Button>

      <div className={"ml-auto"}>
        <Button variant="outline" size="sm" onClick={onNewSession} disabled={isCreating}>
          {isCreating ? '创建中...' : '新对话'}
        </Button>
      </div>
    </div>
  )
}
function ChatThread({
  agentId,
  sessionId,
  agentName,
  session,
}: {
  agentId: string
  sessionId: string
  agentName: string
  session: PrivateSession | null
}) {
  const guidanceEnabled = isGuidanceEnabled()
  const { data: msgData, isLoading } = usePrivateMessages(agentId, sessionId)
  const createReport = useCreateReport()
  const sendMessage = useSendPrivateMessage(agentId, sessionId)
  const endSession = useEndPrivateSession(agentId, sessionId)
  const guidanceInbox = useGuidanceInbox()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [sessionGovernanceMessage, setSessionGovernanceMessage] = useState<string | null>(null)
  usePrivateSessionSse(sessionId, agentId)
  const messages: PrivateMessage[] = msgData?.data?.items ?? []
  const sessionEnded =
    endSession.isSuccess || session?.status === 'ENDED' || session?.status === 'ARCHIVED'
  const receiptItem = guidanceEnabled
    ? (guidanceInbox.data?.data?.items.find((item) => item.related_session_id === sessionId) ??
      null)
    : null
  const fallbackNotice = sessionEnded
    ? getPrivateDigestFallbackNotice({
        messageCount: messages.length,
        digestStatus: session?.digest_status,
      })
    : null
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])
  const handleSend = async (content: string) => {
    try {
      await sendMessage.mutateAsync(content)
    } catch {
      // Mutation error is rendered in-page.
    }
  }
  const handleEnd = async () => {
    try {
      await endSession.mutateAsync()
    } catch {
      // Mutation error is rendered in-page.
    }
  }
  const handleReportSession = async () => {
    setSessionGovernanceMessage(null)
    try {
      await createReport.mutateAsync({
        target_type: 'private_session',
        target_id: sessionId,
        complaint_type: 'HARASSMENT_REPORT',
        reason_code: session?.initiator === 'AGENT'
          ? 'proactive_private_session_report'
          : 'private_session_report',
        detail_text: `Reported from private chat with ${agentName}: ${sessionId}`,
      })
      setSessionGovernanceMessage('私聊治理请求已提交，可在 Safety Center 查看处理进度。')
    } catch (error) {
      setSessionGovernanceMessage(error instanceof Error ? error.message : '私聊治理请求提交失败，请稍后重试。')
    }
  }
  if (isLoading) {
    return (
      <div className={"flex-1 p-4 space-y-3"}>
        <Skeleton className="h-12 w-3/4" />
        <Skeleton className={"h-12 w-1/2 ml-auto"} />
        <Skeleton className="h-12 w-2/3" />
      </div>
    )
  }
  return (
    <>
      <div className={"border-b border-border bg-secondary px-4 py-3 text-sm text-secondary-foreground"}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>
            私聊默认只允许更克制、非敏感的内容流转；触发规则的消息会被降温、拒送或拦截，并进入审查记录。
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={createReport.isPending}
            onClick={() => {
              void handleReportSession()
            }}
          >
            {createReport.isPending
              ? '提交中…'
              : session?.initiator === 'AGENT'
                ? '发起主动私信治理'
                : '发起私聊治理'}
          </Button>
        </div>
        {sessionGovernanceMessage && (
          <p className={sessionGovernanceMessage.includes('失败') ? "mt-2 text-sm text-destructive" : "mt-2 text-sm text-muted-foreground"}>
            {sessionGovernanceMessage}
          </p>
        )}
      </div>

      <ScrollArea className={"flex-1 p-4"}>
        <div className={"space-y-3 max-w-2xl mx-auto"}>
          {messages.length === 0 && (
            <div className={"text-center text-muted-foreground py-12"}>对话开始了，说点什么吧</div>
          )}

          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} agentName={agentName} />
          ))}

          {sendMessage.isPending && (
            <div className={"flex gap-2 items-start"}>
              <Avatar className={"h-8 w-8 shrink-0"}>
                <AvatarFallback className={"text-xs bg-primary/10"}>{agentName[0]}</AvatarFallback>
              </Avatar>
              <Card className={"px-3 py-2 max-w-[75%] bg-muted"}>
                <div className={"flex gap-1"}>
                  <span className="animate-bounce">·</span>
                  <span className={"animate-bounce [animation-delay:0.1s]"}>·</span>
                  <span className={"animate-bounce [animation-delay:0.2s]"}>·</span>
                </div>
              </Card>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      <MessageInput
        onSend={handleSend}
        onEndSession={handleEnd}
        disabled={sendMessage.isPending}
        sessionEnded={sessionEnded}
        messageCount={messages.length}
      />

      {(sendMessage.isError || endSession.isError) && (
        <div className={"border-t border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive"}>
          {sendMessage.isError ? sendMessage.error.message : endSession.error?.message}
        </div>
      )}

      {(receiptItem || sessionEnded || endSession.isSuccess) && (
        <div className={"border-t bg-muted/20 p-4"}>
          {receiptItem ? (
            <GuidanceItemCard item={receiptItem} />
          ) : fallbackNotice ? (
            <div
              className={cn(
                "rounded-xl px-4 py-3 text-sm",
                fallbackNotice.tone === 'warning' && "border border-warning/30 bg-warning/10 text-foreground",
                fallbackNotice.tone === 'danger' && "border border-destructive/40 bg-destructive/5 text-destructive",
                fallbackNotice.tone === 'muted' && "border border-dashed bg-background text-muted-foreground",
              )}
            >
              <p className={"font-medium"}>{fallbackNotice.title}</p>
              <p className={"mt-1"}>{fallbackNotice.body}</p>
            </div>
          ) : null}
        </div>
      )}
    </>
  )
}
function MessageBubble({ message, agentName }: { message: PrivateMessage; agentName: string }) {
  const isHuman = message.author_type === 'HUMAN'
  const deliveryLabel = message.delivery_status ? DELIVERY_BADGE[message.delivery_status] : null
  return (
    <div className={cn('flex gap-2 items-start', isHuman && 'flex-row-reverse')}>
      <Avatar className={"h-8 w-8 shrink-0"}>
        <AvatarFallback
          className={cn(
            "text-xs",
            isHuman ? "bg-accent/10 text-accent" : "bg-primary/10",
          )}
        >
          {isHuman ? '我' : agentName[0]}
        </AvatarFallback>
      </Avatar>

      <Card
        className={cn(
          "px-3 py-2 max-w-[75%]",
          isHuman ? "bg-primary text-primary-foreground" : "bg-muted",
        )}
      >
        <p className={"text-sm whitespace-pre-wrap break-words"}>{message.content}</p>
        <div className={"mt-2 flex flex-wrap items-center gap-2"}>
          <span
            className={cn(
              "text-[10px] mt-1 block",
              isHuman ? "text-primary-foreground/60" : "text-muted-foreground",
            )}
          >
            {relativeTime(message.created_at)}
          </span>
          {deliveryLabel && (
            <Badge variant="outline" className={"h-5 text-[11px]"}>
              {deliveryLabel}
            </Badge>
          )}
        </div>
      </Card>
    </div>
  )
}
