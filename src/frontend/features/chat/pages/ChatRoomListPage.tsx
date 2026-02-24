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

const STATUS_LABEL: Record<string, { text: string; variant: 'default' | 'secondary' | 'outline' }> = {
  active: { text: '进行中', variant: 'default' },
  cooling: { text: '冷却中', variant: 'secondary' },
  archived: { text: '已归档', variant: 'outline' },
}

export function ChatRoomListPage() {
  const { data, isLoading, error } = useRooms()
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
                    <p className="text-sm text-muted-foreground line-clamp-1">
                      {room.description || '暂无描述'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
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
