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
import { MessageInput } from '../components/MessageInput'
import { SessionSidebar } from '../components/SessionSidebar'
import { usePrivateSessionSse } from '../hooks/use-private-session-sse'
import { GuidanceItemCard } from '@/features/guidance/components/GuidanceItemCard'

export function PrivateChatPage() {
  const { agentId } = useParams<{ agentId: string }>()
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [showSidebar, setShowSidebar] = useState(false)

  const { data: agentData, isLoading: agentLoading } = useAgentProfile(agentId ?? '')
  const { data: sessionsData, isLoading: sessionsLoading } = usePrivateSessions(agentId ?? '')
  const createSession = useCreatePrivateSession(agentId ?? '')

  const agent = agentData?.data
  const sessionItems = sessionsData?.data?.items
  const sessions = useMemo(() => sessionItems ?? [], [sessionItems])

  useEffect(() => {
    if (!activeSessionId && sessions.length > 0) {
      const active = sessions.find((s) => s.status === 'ACTIVE')
      if (active) setActiveSessionId(active.id)
      else setActiveSessionId(sessions[0].id)
    }
  }, [sessions, activeSessionId])

  const handleNewSession = async () => {
    const result = await createSession.mutateAsync()
    setActiveSessionId(result.data.id)
  }

  if (agentLoading || sessionsLoading) {
    return (
      <div className="p-4 space-y-3 max-w-4xl mx-auto">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[70vh]" />
      </div>
    )
  }

  if (!agent) {
    return <div className="p-4 text-destructive">Agent 不存在</div>
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] max-w-5xl mx-auto">
      {/* Session sidebar - desktop */}
      <div className="hidden md:block w-64 border-r">
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
          activeSession={sessions.find((s) => s.id === activeSessionId) ?? null}
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
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center space-y-3">
              <p className="text-lg">还没有对话</p>
              <p className="text-sm">点击"新对话"开始与 {agent.display_name} 交流</p>
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
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowSidebar(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-background border-r">
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
    <div className="flex items-center gap-3 px-4 py-3 border-b bg-background/95 backdrop-blur">
      <Button variant="ghost" size="sm" className="md:hidden" onClick={onToggleSidebar}>
        ☰
      </Button>

      <Link to={`/agents/${agentId}`} className="font-semibold hover:underline">
        {agentName}
      </Link>

      {activeSession && (
        <Badge variant={activeSession.status === 'ACTIVE' ? 'default' : 'secondary'}>
          {activeSession.status === 'ACTIVE' ? '进行中' : '已结束'}
        </Badge>
      )}

      <span className="text-xs text-muted-foreground">{sessionCount} 个对话</span>

      <div className="ml-auto">
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
}: {
  agentId: string
  sessionId: string
  agentName: string
}) {
  const { data: msgData, isLoading } = usePrivateMessages(sessionId)
  const sendMessage = useSendPrivateMessage(agentId, sessionId)
  const endSession = useEndPrivateSession(agentId, sessionId)
  const guidanceInbox = useGuidanceInbox()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  usePrivateSessionSse(sessionId, agentId)

  const messages: PrivateMessage[] = msgData?.data?.items ?? []
  const receiptItem = guidanceInbox.data?.data?.items.find((item) => item.related_session_id === sessionId) ?? null

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const handleSend = async (content: string) => {
    await sendMessage.mutateAsync(content)
  }

  const handleEnd = async () => {
    await endSession.mutateAsync()
  }

  if (isLoading) {
    return (
      <div className="flex-1 p-4 space-y-3">
        <Skeleton className="h-12 w-3/4" />
        <Skeleton className="h-12 w-1/2 ml-auto" />
        <Skeleton className="h-12 w-2/3" />
      </div>
    )
  }

  return (
    <>
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-3 max-w-2xl mx-auto">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground py-12">
              对话开始了，说点什么吧
            </div>
          )}

          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              agentName={agentName}
            />
          ))}

          {sendMessage.isPending && (
            <div className="flex gap-2 items-start">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="text-xs bg-primary/10">
                  {agentName[0]}
                </AvatarFallback>
              </Avatar>
              <Card className="px-3 py-2 max-w-[75%] bg-muted">
                <div className="flex gap-1">
                  <span className="animate-bounce">·</span>
                  <span className="animate-bounce" style={{ animationDelay: '0.1s' }}>·</span>
                  <span className="animate-bounce" style={{ animationDelay: '0.2s' }}>·</span>
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
        sessionEnded={endSession.isSuccess}
      />

      {(receiptItem || endSession.isSuccess) && (
        <div className="border-t bg-muted/20 p-4">
          {receiptItem ? (
            <GuidanceItemCard item={receiptItem} />
          ) : (
            <div className="rounded-xl border border-dashed bg-background px-4 py-3 text-sm text-muted-foreground">
              对话已结束，记忆摘要正在生成中...
            </div>
          )}
        </div>
      )}
    </>
  )
}

function MessageBubble({
  message,
  agentName,
}: {
  message: PrivateMessage
  agentName: string
}) {
  const isHuman = message.author_type === 'HUMAN'

  return (
    <div className={cn('flex gap-2 items-start', isHuman && 'flex-row-reverse')}>
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className={cn('text-xs', isHuman ? 'bg-blue-100' : 'bg-primary/10')}>
          {isHuman ? '我' : agentName[0]}
        </AvatarFallback>
      </Avatar>

      <Card
        className={cn(
          'px-3 py-2 max-w-[75%]',
          isHuman ? 'bg-primary text-primary-foreground' : 'bg-muted',
        )}
      >
        <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
        <span
          className={cn(
            'text-[10px] mt-1 block',
            isHuman ? 'text-primary-foreground/60' : 'text-muted-foreground',
          )}
        >
          {relativeTime(message.created_at)}
        </span>
      </Card>
    </div>
  )
}
