import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, Link } from 'react-router'
import {
  useAgentProfile,
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
import { uix } from '@/shared/utils/uix'

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
      <div className={uix('uix-1acd49fb50')}>
        <Skeleton className="h-10 w-64" />
        <Skeleton className={uix('uix-e14c642c26')} />
      </div>
    )
  }
  if (!agent) {
    return <div className={uix('uix-3973a73bc4')}>Agent 不存在</div>
  }
  return (
    <div className={cn(uix('uix-7e9650e827'), DEV_AUTH_TOOLBAR_SAFE_AREA_CLASS)}>
      {/* Session sidebar - desktop */}
      <div className={uix('uix-3bf51bf1ea')}>
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
          <div className={uix('uix-894f9af854')}>
            <div className={uix('uix-043556acb2')}>
              <div
                className={cn(
                  uix('uix-877a153952'),
                  uix('uix-877d27d90e'),
                  uix('uix-94807178f7'),
                )}
              >
                大陆首发风控已生效：新建私聊、发送私聊和接收主动私信前，需要先通过实名审核。
              </div>
              <p className={uix('uix-42536e69e6')}>还没有对话</p>
              <p className={uix('uix-fc7473ca09')}>点击"新对话"开始与 {agent.display_name} 交流</p>
              {createSession.isError && (
                <p className={uix('uix-611864a2c0')}>{createSession.error.message}</p>
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
          <div className={uix('uix-d90d8e1509')} onClick={() => setShowSidebar(false)} />
          <div className={uix('uix-94e1620257')}>
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
    <div className={uix('uix-27671266a7')}>
      <Button variant="ghost" size="sm" className="md:hidden" onClick={onToggleSidebar}>
        ☰
      </Button>

      <Link to={`/agents/${agentId}`} className={uix('uix-2c0ac2ad39')}>
        {agentName}
      </Link>

      {activeSession && (
        <Badge variant={activeSession.status === 'ACTIVE' ? 'default' : 'secondary'}>
          {activeSession.status === 'ACTIVE' ? '进行中' : '已结束'}
        </Badge>
      )}

      <span className={uix('uix-25be576b96')}>{sessionCount} 个对话</span>

      <div className={uix('uix-fb56d9cff3')}>
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
  const { data: msgData, isLoading } = usePrivateMessages(sessionId)
  const sendMessage = useSendPrivateMessage(agentId, sessionId)
  const endSession = useEndPrivateSession(agentId, sessionId)
  const guidanceInbox = useGuidanceInbox()
  const messagesEndRef = useRef<HTMLDivElement>(null)
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
  if (isLoading) {
    return (
      <div className={uix('uix-ba5c7544cc')}>
        <Skeleton className="h-12 w-3/4" />
        <Skeleton className={uix('uix-3d549328b0')} />
        <Skeleton className="h-12 w-2/3" />
      </div>
    )
  }
  return (
    <>
      <div className={cn(uix('uix-50b7a82989'), uix('uix-73a6145db6'), uix('uix-26f026f8ad'))}>
        私聊默认只允许更克制、非敏感的内容流转；触发规则的消息会被降温、拒送或拦截，并进入审查记录。
      </div>

      <ScrollArea className={uix('uix-396cd874b5')}>
        <div className={uix('uix-6adf5992c8')}>
          {messages.length === 0 && (
            <div className={uix('uix-6776cc4881')}>对话开始了，说点什么吧</div>
          )}

          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} agentName={agentName} />
          ))}

          {sendMessage.isPending && (
            <div className="flex gap-2 items-start">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className={uix('uix-c2ff24b045')}>{agentName[0]}</AvatarFallback>
              </Avatar>
              <Card className={uix('uix-eebdac32e1')}>
                <div className="flex gap-1">
                  <span className="animate-bounce">·</span>
                  <span className={uix('uix-typing-dot-delay-100')}>·</span>
                  <span className={uix('uix-typing-dot-delay-200')}>·</span>
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
        <div className={cn(uix('uix-21d66ab640'), uix('uix-a47175a4cf'), uix('uix-fc7473ca09'))}>
          {sendMessage.isError ? sendMessage.error.message : endSession.error?.message}
        </div>
      )}

      {(receiptItem || sessionEnded || endSession.isSuccess) && (
        <div className={uix('uix-f5c93a678c')}>
          {receiptItem ? (
            <GuidanceItemCard item={receiptItem} />
          ) : fallbackNotice ? (
            <div
              className={cn(
                uix('uix-d46112421b'),
                fallbackNotice.tone === 'warning' && uix('uix-077886b048'),
                fallbackNotice.tone === 'danger' && uix('uix-16d839ad3d'),
                fallbackNotice.tone === 'muted' && uix('uix-e968d23e0a'),
              )}
            >
              <p className={uix('uix-2689f39580')}>{fallbackNotice.title}</p>
              <p className={uix('uix-b6b02c0ebe')}>{fallbackNotice.body}</p>
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
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback
          className={cn(
            uix('uix-359090c2d5'),
            isHuman ? uix('uix-2eb3df8f1f') : uix('uix-375dc44df6'),
          )}
        >
          {isHuman ? '我' : agentName[0]}
        </AvatarFallback>
      </Avatar>

      <Card
        className={cn(
          uix('uix-dd9b87af6b'),
          isHuman ? uix('uix-47e7dfa4ff') : uix('uix-2ef11f1cb2'),
        )}
      >
        <p className={uix('uix-d6b7157957')}>{message.content}</p>
        <div className={uix('uix-4e79a06bb7')}>
          <span
            className={cn(
              uix('uix-cb59187521'),
              isHuman ? uix('uix-6ce381ea94') : uix('uix-bfa6031907'),
            )}
          >
            {relativeTime(message.created_at)}
          </span>
          {deliveryLabel && (
            <Badge variant="outline" className={cn('h-5', uix('uix-ee664e1eab'))}>
              {deliveryLabel}
            </Badge>
          )}
        </div>
      </Card>
    </div>
  )
}
