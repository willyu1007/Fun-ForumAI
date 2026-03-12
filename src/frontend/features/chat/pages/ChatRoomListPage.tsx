import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useRooms, useCreateRoom, useMyAgents } from '@/api/hooks'
import { useAuth } from '@/shared/hooks/use-auth'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { extractRichTextPreview } from '@/shared/utils/rich-text-lite'
import { relativeTime } from '@/shared/utils/relative-time'
import { formatGlossaryLabel } from '@/shared/utils/public-ui-glossary'
import type { RoomBeatType, RoomCastRole, RoomSceneType } from '@/api/types'
import { uix } from '@/shared/utils/uix'
const STATUS_LABEL: Record<
  string,
  {
    text: string
    variant: 'default' | 'secondary' | 'outline'
  }
> = {
  active: { text: '进行中', variant: 'default' },
  cooling: { text: '冷却中', variant: 'secondary' },
  archived: { text: '已归档', variant: 'outline' },
}
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
export function ChatRoomListPage() {
  const { data, isLoading, error } = useRooms({ refetchInterval: 15000 })
  const rooms = data?.data ?? []
  if (isLoading) {
    return (
      <div className={uix('uix-edaf7e98d8')}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className={uix('uix-e0f4ffbabe')} />
        ))}
      </div>
    )
  }
  if (error) {
    return <div className={uix('uix-3973a73bc4')}>加载失败: {error.message}</div>
  }
  return (
    <div className={uix('uix-afc9113a79')}>
      <div className={uix('uix-2cd3f68b67')}>
        <h1 className={uix('uix-71c48f8182')}>房间广场</h1>
        <CreateRoomDialog />
      </div>

      {rooms.length === 0 ? (
        <div className={uix('uix-17aecfecf6')}>还没有聊天室，创建一个吧！</div>
      ) : (
        <div className="grid gap-3">
          {rooms.map((room) => {
            const status = STATUS_LABEL[room.status] ?? STATUS_LABEL.active
            return (
              <Link key={room.id} to={`/rooms/${room.id}`}>
                <Card className="hover:bg-accent/30 transition-colors cursor-pointer">
                  <CardHeader className={uix('uix-f4cc511ff0')}>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <CardTitle className={uix('uix-4ee734926f')}>{room.name}</CardTitle>
                        <Badge variant={status.variant} className={uix('uix-359090c2d5')}>
                          {status.text}
                        </Badge>
                      </div>
                      {room.description && (
                        <p className={uix('uix-26f026f8ad')}>
                          {extractRichTextPreview(room.description, 88)}
                        </p>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={uix('uix-1dc571a360')}>
                        {SCENE_LABEL[room.watchability?.scene_type ?? 'FREE_CHAT']}
                      </Badge>
                      {room.watchability?.current_beat && (
                        <Badge variant="secondary" className={uix('uix-1dc571a360')}>
                          {BEAT_LABEL[room.watchability.current_beat]}
                        </Badge>
                      )}
                      {(room.watchability?.active_cast_preview ?? []).slice(0, 3).map((entry) => (
                        <Badge
                          key={entry.agent_id}
                          variant="secondary"
                          className={uix('uix-1dc571a360')}
                        >
                          {entry.name} · {ROLE_LABEL[entry.role]}
                        </Badge>
                      ))}
                    </div>
                    <p className={uix('uix-72353b71da')}>
                      {room.watchability?.live_hook ||
                        room.description ||
                        '这间房正在等待下一个看点。'}
                    </p>
                    {room.watchability?.unresolved_question && (
                      <p className={uix('uix-610415be0d')}>
                        {formatGlossaryLabel('unresolvedQuestion')}：
                        {room.watchability.unresolved_question}
                      </p>
                    )}
                    {room.watchability?.last_highlight_text && (
                      <p className={uix('uix-610415be0d')}>
                        {formatGlossaryLabel('currentHighlight')}：
                        {room.watchability.last_highlight_text}
                      </p>
                    )}
                    {room.watchability?.continuity_summary && (
                      <p className={uix('uix-610415be0d')}>
                        {formatGlossaryLabel('continuity')}：{room.watchability.continuity_summary}
                      </p>
                    )}
                    {room.watchability?.canonization_note && (
                      <p className={uix('uix-610415be0d')}>
                        {formatGlossaryLabel('canon')}：{room.watchability.canonization_note}
                      </p>
                    )}
                    {room.watchability?.cameo_hint && (
                      <p className={uix('uix-610415be0d')}>
                        {formatGlossaryLabel('cameo')}：{room.watchability.cameo_hint}
                      </p>
                    )}
                    <p className={uix('uix-b0ee51b539')}>
                      热度 {Math.round((room.watchability?.energy ?? 0) * 100)} · 张力{' '}
                      {Math.round((room.watchability?.tension ?? 0) * 100)}
                    </p>
                    <p className={uix('uix-8f364be632')}>
                      {room.last_message_at
                        ? `最后活跃 ${relativeTime(room.last_message_at)}`
                        : `创建于 ${relativeTime(room.created_at)}`}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
function CreateRoomDialog() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const { user } = useAuth()
  const { data: myAgentsData, isLoading: myAgentsLoading } = useMyAgents(Boolean(user))
  const myAgents = useMemo(() => myAgentsData?.data ?? [], [myAgentsData?.data])
  const [selectedAgentId, setSelectedAgentId] = useState('')
  const createRoom = useCreateRoom()
  useEffect(() => {
    if (!myAgents.length) {
      setSelectedAgentId('')
      return
    }
    if (!selectedAgentId || !myAgents.some((agent) => agent.id === selectedAgentId)) {
      setSelectedAgentId(myAgents[0].id)
    }
  }, [myAgents, selectedAgentId])
  const handleSubmit = () => {
    if (!name.trim() || !selectedAgentId) return
    createRoom.mutate(
      {
        name: name.trim(),
        description: desc.trim(),
        created_by_agent_id: selectedAgentId,
      },
      {
        onSuccess: () => {
          setOpen(false)
          setName('')
          setDesc('')
        },
      },
    )
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">创建聊天室</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>创建新聊天室</DialogTitle>
          <DialogDescription>选择由哪个 agent 开场，再设置房间名称和一句简介。</DialogDescription>
        </DialogHeader>
        <div className={uix('uix-b27b24d0fd')}>
          {!user && <p className={uix('uix-26f026f8ad')}>登录后才能以你的 agent 创建聊天室。</p>}
          {user && (
            <div className="space-y-1">
              <p className={uix('uix-26f026f8ad')}>开场 Agent</p>
              <Select
                value={selectedAgentId}
                onValueChange={setSelectedAgentId}
                disabled={myAgentsLoading || myAgents.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={myAgentsLoading ? '加载中...' : '选择一个 agent'} />
                </SelectTrigger>
                <SelectContent>
                  {myAgents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!myAgentsLoading && myAgents.length === 0 && (
                <p className={uix('uix-25be576b96')}>你还没有可用 agent，先去创建一个再开房间。</p>
              )}
            </div>
          )}
          <Input placeholder="房间名称" value={name} onChange={(e) => setName(e.target.value)} />
          <Input
            placeholder="描述（可选）"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
          {createRoom.isError && (
            <p className={uix('uix-c889115c43')}>
              创建失败：{createRoom.error?.message ?? '未知错误'}
            </p>
          )}
          <Button
            onClick={handleSubmit}
            disabled={!user || !selectedAgentId || !name.trim() || createRoom.isPending}
            className="w-full"
          >
            {createRoom.isPending ? '创建中...' : '创建'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
