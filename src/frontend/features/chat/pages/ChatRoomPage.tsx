import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router'
import {
  useCreateRoomCue,
  usePatchRoomMemberControl,
  usePatchRoomProgram,
  useRecallAgent,
  useRoom,
  useRoomCast,
  useRoomControlState,
  useRoomHighlights,
  useRoomLiveSnapshot,
  useRoomMessages,
  useRoomProgram,
} from '@/api/hooks'
import { useAuth } from '@/shared/hooks/use-auth'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { relativeTime } from '@/shared/utils/relative-time'
import type {
  ChatMessage,
  RoomBeatType,
  RoomCastRole,
  RoomControlState,
  RoomCueType,
  RoomHighlight,
  RoomMember,
  RoomSceneType,
} from '@/api/types'
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

const BEAT_LABEL: Record<RoomBeatType, string> = {
  OPENING: '开场',
  HOOK: '抛钩子',
  EXPLAIN: '展开',
  CLASH: '对撞',
  CALLBACK: '回收',
  COOL_DOWN: '缓和',
  RECAP: '回顾',
  LANDING: '落点',
}

const CUE_LABEL: Record<RoomCueType, string> = {
  ADVANCE: '推进',
  ASK: '追问',
  CALLBACK: '回收',
  SUMMARIZE: '总结',
  COOL_DOWN: '缓冲',
  CLOSE: '收束',
}

const OWNER_TABS = ['control', 'signals', 'memory'] as const

export function ChatRoomPage() {
  const { roomId } = useParams<{ roomId: string }>()
  const [showMembers, setShowMembers] = useState(false)
  const [showDirectorSheet, setShowDirectorSheet] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { user } = useAuth()

  const { data: roomData, isLoading: roomLoading } = useRoom(roomId ?? '')
  const { data: msgData } = useRoomMessages(roomId ?? '')
  const { data: snapshotData } = useRoomLiveSnapshot(roomId ?? '')
  const { data: castData } = useRoomCast(roomId ?? '')
  const { data: programData } = useRoomProgram(roomId ?? '')
  const { data: highlightData } = useRoomHighlights(roomId ?? '', { limit: 6 })
  const controlStateEnabled = Boolean(roomId && user && roomData?.data?.viewer_can_control)
  const { data: controlStateData } = useRoomControlState(roomId ?? '', { enabled: controlStateEnabled })

  const room = roomData?.data
  const messages = msgData?.data ?? []
  const snapshot = snapshotData?.data
  const cast = castData?.data
  const program = programData?.data
  const highlights = highlightData?.data ?? []
  const controlState = controlStateData?.data ?? null
  const { typingAgents } = useChatRoomSse(roomId ?? '')
  const highlightedMessageIds = new Set(highlights.map((item) => item.source_message_id))

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  if (roomLoading) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[60vh]" />
      </div>
    )
  }

  if (!room) {
    return <div className="p-4 text-destructive">聊天室不存在</div>
  }

  const publicContinuity = snapshot?.continuity_summary ?? room.watchability?.continuity_summary ?? null
  const publicCanon = snapshot?.canonization_note ?? room.watchability?.canonization_note ?? null
  const publicCameo = snapshot?.cameo_hint ?? room.watchability?.cameo_hint ?? null

  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-7xl">
      <div className="flex min-w-0 flex-1 flex-col">
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
          currentBeat={snapshot?.current_beat ?? program?.current_episode?.current_beat ?? null}
          lastHighlight={highlights[0] ?? null}
          energy={snapshot?.energy ?? room.watchability?.energy ?? 0}
          tension={snapshot?.tension ?? room.watchability?.tension ?? 0}
          onToggleMembers={() => setShowMembers((value) => !value)}
          onOpenDirector={() => setShowDirectorSheet(true)}
          showDirectorButton={Boolean(controlState)}
        />

        <ScrollArea className="flex-1 px-4 py-2">
          <div className="space-y-3">
            {(publicContinuity || publicCanon || publicCameo) && (
              <PublicStorylineRail
                continuitySummary={publicContinuity}
                canonizationNote={publicCanon}
                cameoHint={publicCameo}
              />
            )}
            {highlights.length > 0 && (
              <HighlightStrip highlights={highlights} />
            )}
            {messages.length === 0 && (
              <div className="py-10 text-center text-muted-foreground">
                暂时没有消息，等待 Agent 们开始对话...
              </div>
            )}
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                highlighted={highlightedMessageIds.has(msg.id)}
              />
            ))}
            {typingAgents.size > 0 && (
              <div className="animate-pulse pl-2 text-sm text-muted-foreground">
                {Array.from(typingAgents).join(', ')} 正在思考...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        <div className="border-t bg-muted/30 px-4 py-3 text-center text-sm text-muted-foreground">
          这是 Agent 之间的对话空间。公域页面只展示连续性、cameo 与 canon 结果。
        </div>
      </div>

      {showMembers && room.members && (
        <ParticipantsSidebar
          members={room.members}
          roomId={room.id}
        />
      )}

      {controlState && (
        <>
          <aside className="hidden w-[24rem] border-l bg-muted/10 lg:flex">
            <DirectorPanel roomId={room.id} controlState={controlState} />
          </aside>
          <Sheet open={showDirectorSheet} onOpenChange={setShowDirectorSheet}>
            <SheetContent side="right" className="w-full p-0 sm:max-w-lg">
              <SheetHeader className="border-b">
                <SheetTitle>导演面板</SheetTitle>
                <SheetDescription>仅 creator owner 可见的房间控制面。</SheetDescription>
              </SheetHeader>
              <DirectorPanel roomId={room.id} controlState={controlState} compact />
            </SheetContent>
          </Sheet>
        </>
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
  currentBeat,
  lastHighlight,
  energy,
  tension,
  onToggleMembers,
  onOpenDirector,
  showDirectorButton,
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
  currentBeat: RoomBeatType | null
  lastHighlight: RoomHighlight | null
  energy: number
  tension: number
  onToggleMembers: () => void
  onOpenDirector: () => void
  showDirectorButton: boolean
}) {
  const statusColor =
    status === 'active'
      ? 'bg-green-500'
      : status === 'cooling'
        ? 'bg-yellow-500'
        : 'bg-gray-400'

  return (
    <div className="space-y-3 border-b px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Link to="/rooms" className="text-sm text-muted-foreground hover:text-foreground">
            ← 返回
          </Link>
          <Separator orientation="vertical" className="h-5" />
          <h2 className="text-base font-semibold">{name}</h2>
          <span className={cn('h-2 w-2 rounded-full', statusColor)} />
          <Badge variant="outline" className="text-[10px]">
            {SCENE_LABEL[sceneType]}
          </Badge>
          {programEnabled && (
            <Badge variant="secondary" className="text-[10px]">
              Program On
            </Badge>
          )}
          {currentBeat && (
            <Badge variant="outline" className="text-[10px]">
              当前节奏 · {BEAT_LABEL[currentBeat]}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {showDirectorButton && (
            <Button variant="outline" size="sm" className="lg:hidden" onClick={onOpenDirector}>
              导演面板
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onToggleMembers}>
            {memberCount} 位成员
          </Button>
        </div>
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
        {lastHighlight && (
          <p className="text-xs text-muted-foreground">
            刚刚高光：{lastHighlight.text}
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

function PublicStorylineRail({
  continuitySummary,
  canonizationNote,
  cameoHint,
}: {
  continuitySummary: string | null
  canonizationNote: string | null
  cameoHint: string | null
}) {
  return (
    <div className="rounded-xl border bg-muted/20 px-3 py-3">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">公域连续性</p>
      <div className="mt-2 space-y-2">
        {continuitySummary && (
          <p className="text-sm leading-6">
            连续性：{continuitySummary}
          </p>
        )}
        {canonizationNote && (
          <p className="text-xs leading-5 text-muted-foreground">
            Canon：{canonizationNote}
          </p>
        )}
        {cameoHint && (
          <p className="text-xs leading-5 text-muted-foreground">
            Cameo：{cameoHint}
          </p>
        )}
      </div>
    </div>
  )
}

function HighlightStrip({ highlights }: { highlights: RoomHighlight[] }) {
  return (
    <div className="rounded-xl border bg-muted/30 px-3 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">刚刚有戏</p>
          <p className="mt-1 text-sm font-medium leading-6">{highlights[0].text}</p>
        </div>
        <Badge variant="secondary" className="shrink-0 text-[10px]">
          {highlights[0].kind}
        </Badge>
      </div>
      {highlights.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {highlights.slice(1, 4).map((highlight) => (
            <span key={highlight.id} className="rounded-full bg-background px-2 py-1 text-[11px] text-muted-foreground">
              {highlight.text}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function MessageBubble({ message, highlighted }: { message: ChatMessage; highlighted: boolean }) {
  const isSkip = message.message_kind === 'skip_feedback'
  const isAmbient = message.message_kind === 'ambient'
  const isGreeting = message.message_kind === 'greeting'

  if (isAmbient) {
    return (
      <div className="py-1 text-center text-xs text-muted-foreground">
        {message.body}
      </div>
    )
  }

  return (
    <div className={cn(
      'flex gap-3 rounded-xl px-2 py-2 transition-colors',
      isSkip && 'opacity-60',
      highlighted && 'bg-amber-50 ring-1 ring-amber-200',
    )}>
      <Avatar className="mt-0.5 h-8 w-8 shrink-0">
        <AvatarFallback className="bg-primary/10 text-xs">
          {message.author_id.slice(-2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">
            {message.author_id}
          </span>
          {isGreeting && (
            <Badge variant="outline" className="px-1 py-0 text-[10px]">
              入场
            </Badge>
          )}
          {isSkip && (
            <Badge variant="secondary" className="px-1 py-0 text-[10px]">
              反馈
            </Badge>
          )}
          {message.speaker_role && (
            <Badge variant="outline" className="px-1 py-0 text-[10px]">
              {ROLE_LABEL[message.speaker_role]}
            </Badge>
          )}
          {message.cue_type && (
            <Badge variant="secondary" className="px-1 py-0 text-[10px]">
              {CUE_LABEL[message.cue_type]}
            </Badge>
          )}
          {highlighted && (
            <Badge className="px-1 py-0 text-[10px]">高光</Badge>
          )}
          <span className="text-xs text-muted-foreground">
            {relativeTime(message.created_at)}
          </span>
        </div>
        <p className={cn(
          'mt-0.5 whitespace-pre-wrap text-sm',
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
    <div className="hidden w-64 flex-col border-l bg-muted/20 md:flex">
      <div className="border-b px-4 py-3">
        <h3 className="text-sm font-medium">成员 ({members.length})</h3>
      </div>
      <ScrollArea className="flex-1">
        <div className="space-y-2 p-3">
          {members.map((member) => (
            <div key={member.member_id} className="rounded-lg border bg-background/90 p-3">
              <p className="text-sm font-medium">{member.member_id}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                入场方式：{member.join_source}
              </p>
              {member.last_spoke_at && (
                <p className="mt-1 text-xs text-muted-foreground">
                  最后发言：{relativeTime(member.last_spoke_at)}
                </p>
              )}
              {user && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 h-7 px-2 text-xs"
                  onClick={() => recall.mutate({ roomId, agentId: member.member_id })}
                >
                  移出
                </Button>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}

function DirectorPanel({
  roomId,
  controlState,
  compact = false,
}: {
  roomId: string
  controlState: RoomControlState
  compact?: boolean
}) {
  const patchProgram = usePatchRoomProgram(roomId)
  const createCue = useCreateRoomCue(roomId)
  const patchMemberControl = usePatchRoomMemberControl(roomId)

  const [sceneType, setSceneType] = useState<RoomSceneType>(controlState.program.scene_type)
  const [shortHook, setShortHook] = useState(controlState.program.discoverability?.short_hook ?? '')
  const [cueType, setCueType] = useState<RoomCueType>('ADVANCE')
  const [cueGoal, setCueGoal] = useState('')
  const [targetRole, setTargetRole] = useState<'AUTO' | RoomCastRole>('AUTO')

  useEffect(() => {
    setSceneType(controlState.program.scene_type)
    setShortHook(controlState.program.discoverability?.short_hook ?? '')
  }, [controlState.program.discoverability?.short_hook, controlState.program.scene_type, roomId])

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col" data-ui="room-director-panel">
      <Tabs defaultValue={OWNER_TABS[0]} className="flex min-h-0 flex-1 flex-col">
        <div className="border-b px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Owner Control</p>
              <p className="mt-1 text-sm font-medium">
                {controlState.room_status === 'active' ? '房间正在直播' : `状态：${controlState.room_status}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {controlState.alerts.length > 0 && (
                <Badge variant="outline" className="text-[10px] text-amber-700">
                  {controlState.alerts.length} 条提醒
                </Badge>
              )}
              <Badge variant={controlState.program.enabled ? 'default' : 'secondary'} className="text-[10px]">
                {controlState.program.enabled ? 'Program On' : 'Program Off'}
              </Badge>
            </div>
          </div>
          <TabsList variant="line" className="mt-3 w-full">
            <TabsTrigger value="control">控制</TabsTrigger>
            <TabsTrigger value="signals">信号</TabsTrigger>
            <TabsTrigger value="memory">连续性</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="control" className="min-h-0 flex-1">
          <ScrollArea className="h-full">
            <div className={cn('space-y-4 p-4', compact && 'pb-8')}>
              <section className="space-y-3 rounded-xl border bg-background/70 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">节目控制</p>
                    <p className="text-xs text-muted-foreground">高层策略，不允许直接写台词。</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={controlState.program.enabled ? 'secondary' : 'default'}
                      disabled={patchProgram.isPending}
                      onClick={() => patchProgram.mutate({ enabled: !controlState.program.enabled })}
                    >
                      {controlState.program.enabled ? '暂停 Program' : '开启 Program'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={patchProgram.isPending}
                      onClick={() => patchProgram.mutate({
                        allow_wandering: !controlState.program.allow_wandering,
                        wander_policy: {
                          ...controlState.program.wander_policy,
                          enabled: !controlState.program.wander_policy.enabled,
                        },
                      })}
                    >
                      {controlState.program.allow_wandering ? '关闭 Wandering' : '开启 Wandering'}
                    </Button>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Scene</p>
                    <Select value={sceneType} onValueChange={(value) => setSceneType(value as RoomSceneType)}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(SCENE_LABEL).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Short Hook</p>
                    <Input value={shortHook} onChange={(event) => setShortHook(event.target.value)} />
                  </div>
                </div>
                <Button
                  size="sm"
                  disabled={patchProgram.isPending}
                  onClick={() => patchProgram.mutate({
                    scene_type: sceneType,
                    discoverability: { short_hook: shortHook || null },
                  })}
                >
                  保存节目设定
                </Button>
              </section>

              <section className="space-y-3 rounded-xl border bg-background/70 p-3">
                <div>
                  <p className="text-sm font-medium">手动 Cue</p>
                  <p className="text-xs text-muted-foreground">只接受高层目标和目标角色。</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Select value={cueType} onValueChange={(value) => setCueType(value as RoomCueType)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CUE_LABEL).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={targetRole} onValueChange={(value) => setTargetRole(value as 'AUTO' | RoomCastRole)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AUTO">自动选择</SelectItem>
                      {Object.entries(ROLE_LABEL).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Textarea
                  value={cueGoal}
                  onChange={(event) => setCueGoal(event.target.value)}
                  placeholder="例如：把“夜宵税”旧梗稳稳回收，并让主持人把悬念落到行为动机。"
                />
                <Button
                  size="sm"
                  disabled={createCue.isPending || !cueGoal.trim()}
                  onClick={() => createCue.mutate({
                    cue_type: cueType,
                    director_goal: cueGoal.trim(),
                    target_roles: targetRole === 'AUTO' ? undefined : [targetRole],
                  }, {
                    onSuccess: () => setCueGoal(''),
                  })}
                >
                  发送 Cue
                </Button>
              </section>

              <section className="space-y-3 rounded-xl border bg-background/70 p-3">
                <div>
                  <p className="text-sm font-medium">成员控制</p>
                  <p className="text-xs text-muted-foreground">role hint、spotlight、wandering 与压制窗口。</p>
                </div>
                <div className="space-y-3">
                  {controlState.members.map((member) => {
                    const isSuppressed = Boolean(member.suppressed_until && new Date(member.suppressed_until).getTime() > Date.now())
                    return (
                      <div key={member.member_id} className="rounded-lg border bg-muted/20 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium">{member.name}</p>
                            {member.projection?.public_projection_hint && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                {member.projection.public_projection_hint}
                              </p>
                            )}
                          </div>
                          <Badge variant="outline" className="text-[10px]">
                            {member.join_source}
                          </Badge>
                        </div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Role Hint</p>
                            <Select
                              value={member.role_hint ?? 'AUTO'}
                              onValueChange={(value) => patchMemberControl.mutate({
                                agentId: member.member_id,
                                role_hint: value === 'AUTO' ? null : value as RoomCastRole,
                              })}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="AUTO">自动</SelectItem>
                                {Object.entries(ROLE_LABEL).map(([value, label]) => (
                                  <SelectItem key={value} value={value}>{label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Spotlight</p>
                            <Input
                              defaultValue={String(member.spotlight_weight ?? 1)}
                              onBlur={(event) => {
                                const next = Number(event.target.value)
                                if (Number.isFinite(next) && next > 0 && next !== member.spotlight_weight) {
                                  patchMemberControl.mutate({
                                    agentId: member.member_id,
                                    spotlight_weight: next,
                                  })
                                }
                              }}
                            />
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={patchMemberControl.isPending}
                            onClick={() => patchMemberControl.mutate({
                              agentId: member.member_id,
                              wander_eligible: !(member.wander_eligible ?? true),
                            })}
                          >
                            {member.wander_eligible === false ? '恢复 Wandering' : '禁止 Wandering'}
                          </Button>
                          <Button
                            size="sm"
                            variant={isSuppressed ? 'secondary' : 'outline'}
                            disabled={patchMemberControl.isPending}
                            onClick={() => patchMemberControl.mutate({
                              agentId: member.member_id,
                              suppressed_until: isSuppressed
                                ? null
                                : new Date(Date.now() + 15 * 60 * 1000).toISOString(),
                            })}
                          >
                            {isSuppressed ? '解除压制' : '压制 15 分钟'}
                          </Button>
                        </div>
                        {member.projection?.signature_moves_json?.length ? (
                          <p className="mt-2 text-xs text-muted-foreground">
                            招牌动作：{member.projection.signature_moves_json.join('、')}
                          </p>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              </section>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="signals" className="min-h-0 flex-1">
          <ScrollArea className="h-full">
            <div className={cn('space-y-4 p-4', compact && 'pb-8')}>
              <section className="rounded-xl border bg-background/70 p-3">
                <p className="text-sm font-medium">Alerts</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {controlState.alerts.length > 0 ? controlState.alerts.map((alert) => (
                    <Badge key={alert} variant="outline" className="text-[10px]">
                      {alert}
                    </Badge>
                  )) : (
                    <p className="text-xs text-muted-foreground">当前没有提醒。</p>
                  )}
                </div>
              </section>

              <section className="rounded-xl border bg-background/70 p-3">
                <p className="text-sm font-medium">Recent Highlights</p>
                <div className="mt-3 space-y-2">
                  {controlState.recent_highlights.map((highlight) => (
                    <div key={highlight.id} className="rounded-lg border bg-muted/20 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="secondary" className="text-[10px]">{highlight.kind}</Badge>
                        <span className="text-xs text-muted-foreground">{relativeTime(highlight.created_at)}</span>
                      </div>
                      <p className="mt-2 text-sm leading-6">{highlight.text}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-xl border bg-background/70 p-3">
                <p className="text-sm font-medium">Program Events</p>
                <div className="mt-3 space-y-2">
                  {controlState.recent_program_events.map((event) => (
                    <div key={event.id} className="rounded-lg border bg-muted/20 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">{event.status}</Badge>
                          {event.cue_type && (
                            <Badge variant="secondary" className="text-[10px]">
                              {CUE_LABEL[event.cue_type]}
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">{relativeTime(event.created_at)}</span>
                      </div>
                      {event.director_goal && (
                        <p className="mt-2 text-sm leading-6">{event.director_goal}</p>
                      )}
                      {event.selection_reasons.length > 0 && (
                        <div className="mt-2 space-y-2">
                          {event.selection_reasons.slice(0, 3).map((reason) => (
                            <div key={reason.id} className="rounded-md bg-background/80 px-2 py-2 text-xs text-muted-foreground">
                              {reason.candidate_agent_id} · {reason.selected ? 'selected' : 'candidate'} · {reason.final_score.toFixed(2)}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="memory" className="min-h-0 flex-1">
          <ScrollArea className="h-full">
            <div className={cn('space-y-4 p-4', compact && 'pb-8')}>
              <section className="rounded-xl border bg-background/70 p-3">
                <p className="text-sm font-medium">Shared Memory</p>
                <div className="mt-3 space-y-2">
                  {controlState.recent_shared_memory.map((memory) => (
                    <div key={memory.id} className="rounded-lg border bg-muted/20 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="outline" className="text-[10px]">{memory.memory_kind}</Badge>
                        <span className="text-xs text-muted-foreground">{relativeTime(memory.created_at)}</span>
                      </div>
                      <p className="mt-2 text-sm leading-6">{memory.summary_text}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-xl border bg-background/70 p-3">
                <p className="text-sm font-medium">Projection Summaries</p>
                <div className="mt-3 space-y-2">
                  {controlState.members.map((member) => (
                    <div key={member.member_id} className="rounded-lg border bg-muted/20 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">{member.name}</p>
                        {member.projection?.role_tendency && (
                          <Badge variant="secondary" className="text-[10px]">
                            {ROLE_LABEL[member.projection.role_tendency]}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {member.projection?.public_projection_hint ?? '尚未生成公域投射摘要。'}
                      </p>
                      {member.projection?.signature_moves_json?.length ? (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Signature Moves：{member.projection.signature_moves_json.join('、')}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  )
}
