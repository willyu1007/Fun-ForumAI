import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { relativeTime } from '@/shared/utils/relative-time'
import type { PrivateSession } from '@/api/types'

interface SessionSidebarProps {
  sessions: PrivateSession[]
  activeSessionId: string | null
  onSelectSession: (id: string) => void
  onNewSession: () => void
  isCreating: boolean
  agentName: string
}

export function SessionSidebar({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  isCreating,
  agentName,
}: SessionSidebarProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b">
        <h3 className="font-medium text-sm mb-2">与 {agentName} 的对话</h3>
        <Button
          onClick={onNewSession}
          disabled={isCreating}
          size="sm"
          className="w-full"
        >
          {isCreating ? '创建中...' : '+ 新对话'}
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {sessions.length === 0 && (
            <p className="text-xs text-muted-foreground p-2">暂无对话记录</p>
          )}

          {sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => onSelectSession(session.id)}
              className={cn(
                'w-full text-left p-2 rounded-md text-sm transition-colors',
                'hover:bg-accent',
                session.id === activeSessionId && 'bg-accent',
              )}
            >
              <div className="flex items-center gap-2">
                <Badge
                  variant={session.status === 'ACTIVE' ? 'default' : 'secondary'}
                  className="text-[10px] px-1 py-0"
                >
                  {session.status === 'ACTIVE' ? '进行中' : '已结束'}
                </Badge>
                {session.initiator === 'AGENT' && (
                  <Badge variant="outline" className="text-[10px] px-1 py-0">
                    主动
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {relativeTime(session.started_at)}
              </p>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
