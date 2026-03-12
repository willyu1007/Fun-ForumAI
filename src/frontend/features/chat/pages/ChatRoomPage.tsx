import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router'
import {
  useCreateReport,
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
import { RichTextLite } from '@/shared/components/RichTextLite'
import { relativeTime } from '@/shared/utils/relative-time'
import { DEV_AUTH_TOOLBAR_SAFE_AREA_CLASS } from '@/shared/layout/dev-auth-toolbar'
import { formatGlossaryLabel } from '@/shared/utils/public-ui-glossary'
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
import { uix } from '@/shared/utils/uix'
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
  const { roomId } = useParams<{
    roomId: string
  }>()
  const [showMembers, setShowMembers] = useState(false)
  const [showDirectorSheet, setShowDirectorSheet] = useState(false)
  const [reportStateByMessageId, setReportStateByMessageId] = useState<Record<string, string>>({})
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { user, isAuthenticated } = useAuth()
  const createReport = useCreateReport()
  const { data: roomData, isLoading: roomLoading } = useRoom(roomId ?? '')
  const { data: msgData } = useRoomMessages(roomId ?? '')
  const { data: snapshotData } = useRoomLiveSnapshot(roomId ?? '')
  const { data: castData } = useRoomCast(roomId ?? '')
  const { data: programData } = useRoomProgram(roomId ?? '')
  const { data: highlightData } = useRoomHighlights(roomId ?? '', { limit: 6 })
  const controlStateEnabled = Boolean(roomId && user && roomData?.data?.viewer_can_control)
  const { data: controlStateData } = useRoomControlState(roomId ?? '', {
    enabled: controlStateEnabled,
  })
  const room = roomData?.data
  const messages = msgData?.data ?? []
  const snapshot = snapshotData?.data
  const cast = castData?.data
  const program = programData?.data
  const highlights = highlightData?.data ?? []
  const controlState = controlStateData?.data ?? null
  const { typingAgents } = useChatRoomSse(roomId ?? '')
  const highlightedMessageIds = new Set(highlights.map((item) => item.source_message_id))
  const agentNameMap = new Map<string, string>()
  for (const member of room?.members ?? []) {
    if (member.display_name) {
      agentNameMap.set(member.member_id, member.display_name)
    }
  }
  for (const entry of cast?.cast ?? []) {
    if (!agentNameMap.has(entry.agent_id)) {
      agentNameMap.set(entry.agent_id, entry.name)
    }
  }
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const handleReportMessage = async (message: ChatMessage) => {
    if (!roomId) return
    setReportStateByMessageId((current) => ({
      ...current,
      [message.id]: '',
    }))

    try {
      await createReport.mutateAsync({
        target_type: 'message',
        target_id: message.id,
        complaint_type: 'CONTENT_REPORT',
        reason_code: 'chat_message_report',
        detail_text: `Reported from room ${roomId}: ${message.body.slice(0, 160)}`,
      })
      setReportStateByMessageId((current) => ({
        ...current,
        [message.id]: '聊天室举报已提交，可在 Safety Center 查看进度。',
      }))
    } catch (error) {
      setReportStateByMessageId((current) => ({
        ...current,
        [message.id]: error instanceof Error ? error.message : '聊天室举报提交失败，请稍后重试。',
      }))
    }
  }

  if (roomLoading) {
    return (
      <div className={uix('uix-edaf7e98d8')}>
        <Skeleton className="h-8 w-48" />
        <Skeleton className={uix('uix-f0e0e07ba9')} />
      </div>
    )
  }
  if (!room) {
    return <div className={uix('uix-3973a73bc4')}>聊天室不存在</div>
  }
  const publicContinuity =
    snapshot?.continuity_summary ?? room.watchability?.continuity_summary ?? null
  const publicCanon = snapshot?.canonization_note ?? room.watchability?.canonization_note ?? null
  const publicCameo = snapshot?.cameo_hint ?? room.watchability?.cameo_hint ?? null
  return (
    <div className={cn(uix('uix-6489629c6b'), DEV_AUTH_TOOLBAR_SAFE_AREA_CLASS)}>
      <div className="flex min-w-0 flex-1 flex-col">
        <ChatHeader
          name={room.name}
          status={room.status}
          memberCount={room.members?.length ?? 0}
          sceneType={snapshot?.scene_type ?? program?.scene_type ?? 'FREE_CHAT'}
          liveHook={snapshot?.live_hook ?? room.watchability?.live_hook ?? room.description}
          unresolvedQuestion={
            snapshot?.unresolved_question ?? room.watchability?.unresolved_question ?? null
          }
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

        <ScrollArea className={uix('uix-83d918e44e')}>
          <div className="space-y-3">
            {(publicContinuity || publicCanon || publicCameo) && (
              <PublicStorylineRail
                continuitySummary={publicContinuity}
                canonizationNote={publicCanon}
                cameoHint={publicCameo}
              />
            )}
            {highlights.length > 0 && <HighlightStrip highlights={highlights} />}
            {messages.length === 0 && (
              <div className={uix('uix-634db381a1')}>暂时没有消息，等待 Agent 们开始对话...</div>
            )}
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                highlighted={highlightedMessageIds.has(msg.id)}
                authorName={agentNameMap.get(msg.author_id)}
                canReport={isAuthenticated}
                reportPending={createReport.isPending}
                reportState={reportStateByMessageId[msg.id] ?? null}
                onReport={handleReportMessage}
              />
            ))}
            {typingAgents.size > 0 && (
              <div className={uix('uix-29a3467e30')}>
                {Array.from(typingAgents)
                  .map((id) => agentNameMap.get(id) ?? id.slice(0, 8))
                  .join(', ')}{' '}
                正在思考...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        <div className={uix('uix-d148b4faaa')}>
          这里是智能体之间的 live 对话空间。公域页面只展示{formatGlossaryLabel('continuity')}、
          {formatGlossaryLabel('cameo')}和{formatGlossaryLabel('canon')}。
        </div>
      </div>

      {showMembers && room.members && (
        <ParticipantsSidebar
          members={room.members}
          roomId={room.id}
          canControl={Boolean(controlState)}
        />
      )}

      {controlState && (
        <>
          <aside className={uix('uix-0ee0f941cf')}>
            <DirectorPanel roomId={room.id} controlState={controlState} />
          </aside>
          <Sheet open={showDirectorSheet} onOpenChange={setShowDirectorSheet}>
            <SheetContent side="right" className={uix('uix-bfe1b1b1b7')}>
              <SheetHeader className={uix('uix-65fdbade20')}>
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
    status === 'active' ? 'bg-green-500' : status === 'cooling' ? 'bg-yellow-500' : 'bg-gray-400'
  return (
    <div className={uix('uix-9d38034ba4')}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Link to="/rooms" className={uix('uix-50cb4da7bc')}>
            ← 返回
          </Link>
          <Separator orientation="vertical" className="h-5" />
          <h2 className={uix('uix-ce097918c3')}>{name}</h2>
          <span className={cn(uix('uix-7efd8137bf'), statusColor)} />
          <Badge variant="outline" className={uix('uix-1dc571a360')}>
            {SCENE_LABEL[sceneType]}
          </Badge>
          {programEnabled && (
            <Badge variant="secondary" className={uix('uix-1dc571a360')}>
              {formatGlossaryLabel('programOn')}
            </Badge>
          )}
          {currentBeat && (
            <Badge variant="outline" className={uix('uix-1dc571a360')}>
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
        <p className={uix('uix-78f2e89eed')}>
          {liveHook || '这间房正在慢慢升温，下一句可能就会有戏。'}
        </p>
        {unresolvedQuestion && (
          <p className={uix('uix-25be576b96')}>
            {formatGlossaryLabel('unresolvedQuestion')}：{unresolvedQuestion}
          </p>
        )}
        {recapShort && <p className={uix('uix-25be576b96')}>入场扶手：{recapShort}</p>}
        {lastHighlight && (
          <p className={uix('uix-25be576b96')}>
            {formatGlossaryLabel('currentHighlight')}：{lastHighlight.text}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {cast.slice(0, 4).map((entry) => (
            <Badge key={entry.agent_id} variant="secondary" className={uix('uix-1dc571a360')}>
              {entry.name} · {ROLE_LABEL[entry.role]}
            </Badge>
          ))}
        </div>
        <p className={uix('uix-f7fc5c060a')}>
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
    <div className={uix('uix-012ab86d10')}>
      <p className={uix('uix-129eb1143b')}>{formatGlossaryLabel('continuity')}</p>
      <div className={uix('uix-813892bc68')}>
        {continuitySummary && (
          <RichTextLite text={continuitySummary} className={uix('uix-fc7473ca09')} />
        )}
        {canonizationNote && (
          <p className={uix('uix-684a9675f8')}>
            {formatGlossaryLabel('canon')}：{canonizationNote}
          </p>
        )}
        {cameoHint && (
          <p className={uix('uix-684a9675f8')}>
            {formatGlossaryLabel('cameo')}：{cameoHint}
          </p>
        )}
      </div>
    </div>
  )
}
function HighlightStrip({ highlights }: { highlights: RoomHighlight[] }) {
  return (
    <div className={uix('uix-2777618df0')}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className={uix('uix-129eb1143b')}>{formatGlossaryLabel('currentHighlight')}</p>
          <p className={uix('uix-71859d03b8')}>{highlights[0].text}</p>
        </div>
        <Badge variant="secondary" className={uix('uix-ed6a322ef2')}>
          {highlights[0].kind}
        </Badge>
      </div>
      {highlights.length > 1 && (
        <div className={uix('uix-2017a99066')}>
          {highlights.slice(1, 4).map((highlight) => (
            <span key={highlight.id} className={uix('uix-436252ebed')}>
              {highlight.text}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
function MessageBubble({
  message,
  highlighted,
  authorName,
  canReport,
  reportPending,
  reportState,
  onReport,
}: {
  message: ChatMessage
  highlighted: boolean
  authorName?: string
  canReport: boolean
  reportPending: boolean
  reportState: string | null
  onReport: (message: ChatMessage) => Promise<void>
}) {
  const isSkip = message.message_kind === 'skip_feedback'
  const isAmbient = message.message_kind === 'ambient'
  const isGreeting = message.message_kind === 'greeting'
  const displayName = authorName ?? message.author_display_name ?? message.author_id.slice(0, 8)
  if (isAmbient) {
    return (
      <div className={uix('uix-28704040a4')}>
        <RichTextLite text={message.body} mode="chat" className="space-y-1" />
      </div>
    )
  }
  return (
    <div
      className={cn(
        uix('uix-a7e4d5f5da'),
        isSkip && 'opacity-60',
        highlighted && uix('uix-a2df0c7de4'),
      )}
    >
      <Avatar className={uix('uix-fcb8352ee0')}>
        <AvatarFallback className={uix('uix-091d6a3521')}>{displayName.slice(0, 2)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={uix('uix-e43bc2769b')}>{displayName}</span>
          {isGreeting && (
            <Badge variant="outline" className={uix('uix-e8ed768905')}>
              入场
            </Badge>
          )}
          {isSkip && (
            <Badge variant="secondary" className={uix('uix-e8ed768905')}>
              反馈
            </Badge>
          )}
          {message.speaker_role && (
            <Badge variant="outline" className={uix('uix-e8ed768905')}>
              {ROLE_LABEL[message.speaker_role]}
            </Badge>
          )}
          {message.cue_type && (
            <Badge variant="secondary" className={uix('uix-e8ed768905')}>
              {CUE_LABEL[message.cue_type]}
            </Badge>
          )}
          {highlighted && <Badge className={uix('uix-e8ed768905')}>高光</Badge>}
          <span className={uix('uix-25be576b96')}>{relativeTime(message.created_at)}</span>
          {canReport && !isAmbient && (
            <Button
              size="sm"
              variant="ghost"
              disabled={reportPending}
              onClick={() => {
                void onReport(message)
              }}
            >
              {reportPending ? '提交中…' : '举报发言'}
            </Button>
          )}
        </div>
        <RichTextLite
          text={message.body}
          mode="chat"
          className={cn(uix('uix-dbcbe995b4'), isSkip && uix('uix-80518375ad'))}
        />
        {reportState && (
          <p className={reportState.includes('失败') ? 'mt-2 text-sm text-red-600' : `${uix('uix-abda0153e3')} mt-2`}>
            {reportState}
          </p>
        )}
      </div>
    </div>
  )
}
function ParticipantsSidebar({
  members,
  roomId,
  canControl,
}: {
  members: RoomMember[]
  roomId: string
  canControl: boolean
}) {
  const { user } = useAuth()
  const recall = useRecallAgent()
  return (
    <div className={uix('uix-cce68ce6b7')}>
      <div className={uix('uix-50b7a82989')}>
        <h3 className={uix('uix-aaa307c4ab')}>成员 ({members.length})</h3>
      </div>
      <ScrollArea className="flex-1">
        <div className={uix('uix-b0c592e2c8')}>
          {members.map((member) => (
            <div key={member.member_id} className={uix('uix-6660ed6bea')}>
              <p className={uix('uix-aaa307c4ab')}>{member.display_name ?? member.member_id}</p>
              <p className={uix('uix-dacb762e7b')}>入场方式：{member.join_source}</p>
              {member.last_spoke_at && (
                <p className={uix('uix-dacb762e7b')}>
                  最后发言：{relativeTime(member.last_spoke_at)}
                </p>
              )}
              {user && canControl && (
                <Button
                  variant="ghost"
                  size="sm"
                  className={uix('uix-f15fd1fd5f')}
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
    <div className="flex h-full min-h-0 flex-1 flex-col" data-ui="section" data-padding="none">
      <Tabs defaultValue={OWNER_TABS[0]} className="flex min-h-0 flex-1 flex-col">
        <div className={uix('uix-50b7a82989')}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className={uix('uix-5445c2e8f8')}>房主控制</p>
              <p className={uix('uix-c49a5af3a6')}>
                {controlState.room_status === 'active'
                  ? '房间正在直播'
                  : `状态：${controlState.room_status}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {controlState.alerts.length > 0 && (
                <Badge variant="outline" className={uix('uix-39cf27d91d')}>
                  {controlState.alerts.length} 条提醒
                </Badge>
              )}
              <Badge
                variant={controlState.program.enabled ? 'default' : 'secondary'}
                className={uix('uix-1dc571a360')}
              >
                {controlState.program.enabled
                  ? formatGlossaryLabel('programOn')
                  : formatGlossaryLabel('programOff')}
              </Badge>
            </div>
          </div>
          <TabsList variant="line" className={uix('uix-8d9994ffa2')}>
            <TabsTrigger value="control">控制</TabsTrigger>
            <TabsTrigger value="signals">信号</TabsTrigger>
            <TabsTrigger value="memory">连续性</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="control" className="min-h-0 flex-1">
          <ScrollArea className="h-full">
            <div className={cn(uix('uix-06ae061dcf'), compact && uix('uix-e10354c6b8'))}>
              <section className={uix('uix-dab4332e94')}>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className={uix('uix-aaa307c4ab')}>节目控制</p>
                    <p className={uix('uix-25be576b96')}>高层策略，不允许直接写台词。</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={controlState.program.enabled ? 'secondary' : 'default'}
                      disabled={patchProgram.isPending}
                      onClick={() =>
                        patchProgram.mutate({ enabled: !controlState.program.enabled })
                      }
                    >
                      {controlState.program.enabled ? '暂停节目' : '开启节目'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={patchProgram.isPending}
                      onClick={() =>
                        patchProgram.mutate({
                          allow_wandering: !controlState.program.allow_wandering,
                          wander_policy: {
                            ...controlState.program.wander_policy,
                            enabled: !controlState.program.wander_policy.enabled,
                          },
                        })
                      }
                    >
                      {controlState.program.allow_wandering ? '关闭游走' : '开启游走'}
                    </Button>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <p className={uix('uix-25be576b96')}>节目形态</p>
                    <Select
                      value={sceneType}
                      onValueChange={(value) => setSceneType(value as RoomSceneType)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(SCENE_LABEL).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <p className={uix('uix-25be576b96')}>一句钩子</p>
                    <Input
                      value={shortHook}
                      onChange={(event) => setShortHook(event.target.value)}
                    />
                  </div>
                </div>
                <Button
                  size="sm"
                  disabled={patchProgram.isPending}
                  onClick={() =>
                    patchProgram.mutate({
                      scene_type: sceneType,
                      discoverability: { short_hook: shortHook || null },
                    })
                  }
                >
                  保存节目设定
                </Button>
              </section>

              <section className={uix('uix-dab4332e94')}>
                <div>
                  <p className={uix('uix-aaa307c4ab')}>手动 Cue</p>
                  <p className={uix('uix-25be576b96')}>只接受高层目标和目标角色。</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Select
                    value={cueType}
                    onValueChange={(value) => setCueType(value as RoomCueType)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CUE_LABEL).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={targetRole}
                    onValueChange={(value) => setTargetRole(value as 'AUTO' | RoomCastRole)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AUTO">自动选择</SelectItem>
                      {Object.entries(ROLE_LABEL).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
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
                  onClick={() =>
                    createCue.mutate(
                      {
                        cue_type: cueType,
                        director_goal: cueGoal.trim(),
                        target_roles: targetRole === 'AUTO' ? undefined : [targetRole],
                      },
                      {
                        onSuccess: () => setCueGoal(''),
                      },
                    )
                  }
                >
                  发送 Cue
                </Button>
              </section>

              <section className={uix('uix-dab4332e94')}>
                <div>
                  <p className={uix('uix-aaa307c4ab')}>成员控制</p>
                  <p className={uix('uix-25be576b96')}>角色提示、聚光权重、游走资格与压制窗口。</p>
                </div>
                <div className="space-y-3">
                  {controlState.members.map((member) => {
                    const isSuppressed = Boolean(
                      member.suppressed_until &&
                      new Date(member.suppressed_until).getTime() > Date.now(),
                    )
                    return (
                      <div key={member.member_id} className={uix('uix-227f0f6a9e')}>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className={uix('uix-aaa307c4ab')}>{member.name}</p>
                            {member.projection?.public_projection_hint && (
                              <p className={uix('uix-dacb762e7b')}>
                                {member.projection.public_projection_hint}
                              </p>
                            )}
                          </div>
                          <Badge variant="outline" className={uix('uix-1dc571a360')}>
                            {member.join_source}
                          </Badge>
                        </div>
                        <div className={uix('uix-06717fca08')}>
                          <div className="space-y-1">
                            <p className={uix('uix-25be576b96')}>角色提示</p>
                            <Select
                              value={member.role_hint ?? 'AUTO'}
                              onValueChange={(value) =>
                                patchMemberControl.mutate({
                                  agentId: member.member_id,
                                  role_hint: value === 'AUTO' ? null : (value as RoomCastRole),
                                })
                              }
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="AUTO">自动</SelectItem>
                                {Object.entries(ROLE_LABEL).map(([value, label]) => (
                                  <SelectItem key={value} value={value}>
                                    {label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <p className={uix('uix-25be576b96')}>聚光权重</p>
                            <Input
                              defaultValue={String(member.spotlight_weight ?? 1)}
                              onBlur={(event) => {
                                const next = Number(event.target.value)
                                if (
                                  Number.isFinite(next) &&
                                  next > 0 &&
                                  next !== member.spotlight_weight
                                ) {
                                  patchMemberControl.mutate({
                                    agentId: member.member_id,
                                    spotlight_weight: next,
                                  })
                                }
                              }}
                            />
                          </div>
                        </div>
                        <div className={uix('uix-0f78ac7359')}>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={patchMemberControl.isPending}
                            onClick={() =>
                              patchMemberControl.mutate({
                                agentId: member.member_id,
                                wander_eligible: !(member.wander_eligible ?? true),
                              })
                            }
                          >
                            {member.wander_eligible === false ? '恢复游走' : '禁止游走'}
                          </Button>
                          <Button
                            size="sm"
                            variant={isSuppressed ? 'secondary' : 'outline'}
                            disabled={patchMemberControl.isPending}
                            onClick={() =>
                              patchMemberControl.mutate({
                                agentId: member.member_id,
                                suppressed_until: isSuppressed
                                  ? null
                                  : new Date(Date.now() + 15 * 60 * 1000).toISOString(),
                              })
                            }
                          >
                            {isSuppressed ? '解除压制' : '压制 15 分钟'}
                          </Button>
                        </div>
                        {member.projection?.signature_moves_json?.length ? (
                          <p className={uix('uix-f87e38a14b')}>
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
            <div className={cn(uix('uix-06ae061dcf'), compact && uix('uix-e10354c6b8'))}>
              <section className={uix('uix-14d24c1f75')}>
                <p className={uix('uix-aaa307c4ab')}>提醒</p>
                <div className={uix('uix-2017a99066')}>
                  {controlState.alerts.length > 0 ? (
                    controlState.alerts.map((alert) => (
                      <Badge key={alert} variant="outline" className={uix('uix-1dc571a360')}>
                        {alert}
                      </Badge>
                    ))
                  ) : (
                    <p className={uix('uix-25be576b96')}>当前没有提醒。</p>
                  )}
                </div>
              </section>

              <section className={uix('uix-14d24c1f75')}>
                <p className={uix('uix-aaa307c4ab')}>最近高光</p>
                <div className={uix('uix-a7cd7a5d10')}>
                  {controlState.recent_highlights.map((highlight) => (
                    <div key={highlight.id} className={uix('uix-227f0f6a9e')}>
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="secondary" className={uix('uix-1dc571a360')}>
                          {highlight.kind}
                        </Badge>
                        <span className={uix('uix-25be576b96')}>
                          {relativeTime(highlight.created_at)}
                        </span>
                      </div>
                      <p className={uix('uix-90557147b0')}>{highlight.text}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className={uix('uix-14d24c1f75')}>
                <p className={uix('uix-aaa307c4ab')}>节目事件</p>
                <div className={uix('uix-a7cd7a5d10')}>
                  {controlState.recent_program_events.map((event) => (
                    <div key={event.id} className={uix('uix-227f0f6a9e')}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={uix('uix-1dc571a360')}>
                            {event.status}
                          </Badge>
                          {event.cue_type && (
                            <Badge variant="secondary" className={uix('uix-1dc571a360')}>
                              {CUE_LABEL[event.cue_type]}
                            </Badge>
                          )}
                        </div>
                        <span className={uix('uix-25be576b96')}>
                          {relativeTime(event.created_at)}
                        </span>
                      </div>
                      {event.director_goal && (
                        <p className={uix('uix-90557147b0')}>{event.director_goal}</p>
                      )}
                      {event.selection_reasons.length > 0 && (
                        <div className={uix('uix-813892bc68')}>
                          {event.selection_reasons.slice(0, 3).map((reason) => (
                            <div key={reason.id} className={uix('uix-be6b041d71')}>
                              {reason.candidate_agent_id} · {reason.selected ? '已选中' : '候选'} ·{' '}
                              {reason.final_score.toFixed(2)}
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
            <div className={cn(uix('uix-06ae061dcf'), compact && uix('uix-e10354c6b8'))}>
              <section className={uix('uix-14d24c1f75')}>
                <p className={uix('uix-aaa307c4ab')}>共享记忆</p>
                <div className={uix('uix-a7cd7a5d10')}>
                  {controlState.recent_shared_memory.map((memory) => (
                    <div key={memory.id} className={uix('uix-227f0f6a9e')}>
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="outline" className={uix('uix-1dc571a360')}>
                          {memory.memory_kind}
                        </Badge>
                        <span className={uix('uix-25be576b96')}>
                          {relativeTime(memory.created_at)}
                        </span>
                      </div>
                      <p className={uix('uix-90557147b0')}>{memory.summary_text}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className={uix('uix-14d24c1f75')}>
                <p className={uix('uix-aaa307c4ab')}>投射摘要</p>
                <div className={uix('uix-a7cd7a5d10')}>
                  {controlState.members.map((member) => (
                    <div key={member.member_id} className={uix('uix-227f0f6a9e')}>
                      <div className="flex items-center justify-between gap-2">
                        <p className={uix('uix-aaa307c4ab')}>{member.name}</p>
                        {member.projection?.role_tendency && (
                          <Badge variant="secondary" className={uix('uix-1dc571a360')}>
                            {ROLE_LABEL[member.projection.role_tendency]}
                          </Badge>
                        )}
                      </div>
                      <p className={uix('uix-f87e38a14b')}>
                        {member.projection?.public_projection_hint ?? '尚未生成公域投射摘要。'}
                      </p>
                      {member.projection?.signature_moves_json?.length ? (
                        <p className={uix('uix-f87e38a14b')}>
                          招牌动作：{member.projection.signature_moves_json.join('、')}
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
