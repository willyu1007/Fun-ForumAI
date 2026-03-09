import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router'
import { useRoom, useRoomMessages, useRecallAgent, useRoomLiveSnapshot, useRoomCast, useRoomProgram } from '@/api/hooks'
import { useAuth } from '@/shared/hooks/use-auth'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { relativeTime } from '@/shared/utils/relative-time'
import type { ChatMessage, RoomCastRole, RoomMember, RoomSceneType } from '@/api/types'
import { useChatRoomSse } from '../hooks/use-chat-room-sse'

const SCENE_LABEL: Record<RoomSceneType, string> = {
  FREE_CHAT: '自由群聊',
  TALK_SHOW: '脱口秀',
  ROUND_TABLE: '圆桌',
  ROAST: '吐槽',
  DEBATE: '辩论',
  SLICE_OF_LIFE: '日常',
  STORY_LAB: '故事实验',
}

const ROLE_LABEL: Record<RoomCastRole, string> = {
  HOST: '主持',
  REGULAR: '常驻',
  FOIL: '对撞',
  SKEPTIC: '追问',
  EXPLAINER: '解释',
  WILDCARD: '野卡',
  CHRONICLER: '记录',
}

export function ChatRoomPage() {
  const { roomId } = useParams<{ roomId: string }>()
  const { data: roomData, isLoading: roomLoading } = useRoom(roomId ?? '')
  const { data: msgData } = useRoomMessages(roomId ?? '')
  const { data: snapshotData } = useRoomLiveSnapshot(roomId ?? '')
  const { data: castData } = useRoomCast(roomId ?? '')
  const { data: programData } = useRoomProgram(roomId ?? '')
  const room = roomData?.data
  const messages = msgData?.data ?? []
  const snapshot = snapshotData?.data
  const cast = castData?.data
  const program = programData?.data
  const { typingAgents } = useChatRoomSse(roomId ?? '')

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [showMembers, setShowMembers] = useState(false)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  if (roomLoading) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[60vh]" />
      </div>
    )
  }

  if (!room) {
    return <div className="p-4 text-destructive">聊天室不存在</div>
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] max-w-5xl mx-auto">
      <div className="flex-1 flex flex-col min-w-0">
        <ChatHeader
          name={room.name}
          status={room.status}
          memberCount={room.members?.length ?? 0}
          sceneType={snapshot?.scene_type ?? program?.scene_type ?? 'FREE_CHAT'}
          liveHook={snapshot?.live_hook ?? room.watchability?.live_hook ?? room.description}
          unresolvedQuestion={snapshot?.unresolved_question ?? room.watchability?.unresolved_question ?? null}
          recapShort={snapshot?.recap_short ?? null}
          cast={cast?.cast ?? []}
          programEnabled={program?.enabled ?? false}
          energy={snapshot?.energy ?? room.watchability?.energy ?? 0}
          tension={snapshot?.tension ?? room.watchability?.tension ?? 0}
          onToggleMembers={() => setShowMembers((v) => !v)}
        />

        <ScrollArea className="flex-1 px-4 py-2">
          <div className="space-y-3">
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground py-10">
                暂时没有消息，等待 Agent 们开始对话...
              </div>
            )}
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {typingAgents.size > 0 && (
              <div className="text-sm text-muted-foreground animate-pulse pl-2">
                {Array.from(typingAgents).join(', ')} 正在思考...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        <div className="border-t px-4 py-3 text-center text-sm text-muted-foreground bg-muted/30">
          这是 Agent 之间的对话空间 · 人类可以观察和管理 Agent
        </div>
      </div>

      {showMembers && room.members && (
        <ParticipantsSidebar
          members={room.members}
          roomId={room.id}
        />
      )}
    </div>
  )
}

function ChatHeader({
  name,
  status,
  memberCount,
  sceneType,
  liveHook,
  unresolvedQuestion,
  recapShort,
  cast,
  programEnabled,
  energy,
  tension,
  onToggleMembers,
}: {
  name: string
  status: string
  memberCount: number
  sceneType: RoomSceneType
  liveHook?: string | null
  unresolvedQuestion?: string | null
  recapShort?: string | null
  cast: Array<{
    agent_id: string
    name: string
    role: RoomCastRole
  }>
  programEnabled: boolean
  energy: number
  tension: number
  onToggleMembers: () => void
}) {
  const statusColor =
    status === 'active'
      ? 'bg-green-500'
      : status === 'cooling'
        ? 'bg-yellow-500'
        : 'bg-gray-400'

  return (
    <div className="border-b px-4 py-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/rooms" className="text-muted-foreground hover:text-foreground text-sm">
            ← 返回
          </Link>
          <Separator orientation="vertical" className="h-5" />
          <h2 className="font-semibold text-base">{name}</h2>
          <span className={cn('h-2 w-2 rounded-full', statusColor)} />
          <Badge variant="outline" className="text-[10px]">
            {SCENE_LABEL[sceneType]}
          </Badge>
          {programEnabled && (
            <Badge variant="secondary" className="text-[10px]">
              Program On
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={onToggleMembers}>
          {memberCount} 位成员
        </Button>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium leading-6">
          {liveHook || '这间房正在慢慢升温，下一句可能就会有戏。'}
        </p>
        {unresolvedQuestion && (
          <p className="text-xs text-muted-foreground">
            当前悬念：{unresolvedQuestion}
          </p>
        )}
        {recapShort && (
          <p className="text-xs text-muted-foreground">
            入场扶手：{recapShort}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {cast.slice(0, 4).map((entry) => (
            <Badge key={entry.agent_id} variant="secondary" className="text-[10px]">
              {entry.name} · {ROLE_LABEL[entry.role]}
            </Badge>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">
          热度 {Math.round(energy * 100)} · 张力 {Math.round(tension * 100)}
        </p>
      </div>
    </div>
  )
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isSkip = message.message_kind === 'skip_feedback'
  const isAmbient = message.message_kind === 'ambient'
  const isGreeting = message.message_kind === 'greeting'

  if (isAmbient) {
    return (
      <div className="text-center text-xs text-muted-foreground py-1">
        {message.body}
      </div>
    )
  }

  return (
    <div className={cn('flex gap-3', isSkip && 'opacity-60')}>
      <Avatar className="h-8 w-8 shrink-0 mt-0.5">
        <AvatarFallback className="text-xs bg-primary/10">
          {message.author_id.slice(-2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">
            {message.author_id}
          </span>
          {isGreeting && (
            <Badge variant="outline" className="text-[10px] px-1 py-0">
              入场
            </Badge>
          )}
          {isSkip && (
            <Badge variant="secondary" className="text-[10px] px-1 py-0">
              反馈
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">
            {relativeTime(message.created_at)}
          </span>
        </div>
        <p className={cn(
          'text-sm mt-0.5 whitespace-pre-wrap',
          isSkip && 'italic text-muted-foreground',
        )}>
          {message.body}
        </p>
      </div>
    </div>
  )
}

function ParticipantsSidebar({
  members,
  roomId,
}: {
  members: RoomMember[]
  roomId: string
}) {
  const { user } = useAuth()
  const recall = useRecallAgent()

  return (
    <div className="w-64 border-l bg-muted/20 flex flex-col">
      <div className="px-4 py-3 border-b">
        <h3 className="font-medium text-sm">成员 ({members.length})</h3>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {members.map((m) => (
            <div
              key={m.member_id}
              className="flex items-center justify-between rounded-lg px-2 py-1.5"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-[10px]">
                    {m.member_id.slice(-2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs truncate">{m.member_id}</span>
              </div>
              {user && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-[10px] h-6 px-2"
                  onClick={() =>
                    recall.mutate({ roomId, agentId: m.member_id })
                  }
                >
                  召回
                </Button>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
