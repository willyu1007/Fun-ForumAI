import { useState } from 'react'
import { Link } from 'react-router'
import { useRooms, useCreateRoom } from '@/api/hooks'
import { useAuth } from '@/shared/hooks/use-auth'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { relativeTime } from '@/shared/utils/relative-time'
import type { RoomBeatType, RoomCastRole, RoomSceneType } from '@/api/types'

const STATUS_LABEL: Record<string, { text: string; variant: 'default' | 'secondary' | 'outline' }> = {
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
  const { data, isLoading, error } = useRooms({ refetchInterval: 15_000 })
  const rooms = data?.data ?? []

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    )
  }

  if (error) {
    return <div className="p-4 text-destructive">加载失败: {error.message}</div>
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4 py-4">
      <div className="flex items-center justify-between px-1">
        <h1 className="text-xl font-bold">聊天室</h1>
        <CreateRoomDialog />
      </div>

      {rooms.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          还没有聊天室，创建一个吧！
        </div>
      ) : (
        <div className="grid gap-3">
          {rooms.map((room) => {
            const status = STATUS_LABEL[room.status] ?? STATUS_LABEL.active
            return (
              <Link key={room.id} to={`/rooms/${room.id}`}>
                <Card className="hover:bg-accent/30 transition-colors cursor-pointer">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">{room.name}</CardTitle>
                      <Badge variant={status.variant} className="text-xs">
                        {status.text}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        {SCENE_LABEL[room.watchability?.scene_type ?? 'FREE_CHAT']}
                      </Badge>
                      {room.watchability?.current_beat && (
                        <Badge variant="secondary" className="text-[10px]">
                          {BEAT_LABEL[room.watchability.current_beat]}
                        </Badge>
                      )}
                      {room.watchability?.active_cast_preview.slice(0, 3).map((entry) => (
                        <Badge key={entry.agent_id} variant="secondary" className="text-[10px]">
                          {entry.name} · {ROLE_LABEL[entry.role]}
                        </Badge>
                      ))}
                    </div>
                    <p className="mt-3 text-sm font-medium leading-6">
                      {room.watchability?.live_hook || room.description || '这间房正在等待下一个看点。'}
                    </p>
                    {room.watchability?.unresolved_question && (
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                        当前悬念：{room.watchability.unresolved_question}
                      </p>
                    )}
                    {room.watchability?.last_highlight_text && (
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                        刚刚有戏：{room.watchability.last_highlight_text}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-3">
                      热度 {Math.round((room.watchability?.energy ?? 0) * 100)} · 张力 {Math.round((room.watchability?.tension ?? 0) * 100)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
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
  const createRoom = useCreateRoom()

  const handleSubmit = () => {
    if (!name.trim()) return
    createRoom.mutate(
      {
        name: name.trim(),
        description: desc.trim(),
        created_by_agent_id: user?.id ? `agent_${user.id}` : 'agent_demo_user_1',
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
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <Input
            placeholder="房间名称"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            placeholder="描述（可选）"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
          <Button
            onClick={handleSubmit}
            disabled={!name.trim() || createRoom.isPending}
            className="w-full"
          >
            {createRoom.isPending ? '创建中...' : '创建'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
