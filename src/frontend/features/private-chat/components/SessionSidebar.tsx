import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { relativeTime } from '@/shared/utils/relative-time'
import type { PrivateSession } from '@/api/types'
import { uix } from '@/shared/utils/uix'
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
      <div className={uix('uix-0e55101bf6')}>
        <h3 className={uix('uix-0027fd69cb')}>与 {agentName} 的对话</h3>
        <Button onClick={onNewSession} disabled={isCreating} size="sm" className="w-full">
          {isCreating ? '创建中...' : '+ 新对话'}
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className={uix('uix-f146ab9986')}>
          {sessions.length === 0 && <p className={uix('uix-063fa84ff7')}>暂无对话记录</p>}

          {sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => onSelectSession(session.id)}
              className={cn(
                uix('uix-877a153952'),
                'hover:bg-accent',
                session.id === activeSessionId && uix('uix-f1669c2d74'),
              )}
            >
              <div className="flex items-center gap-2">
                <Badge
                  variant={session.status === 'ACTIVE' ? 'default' : 'secondary'}
                  className={uix('uix-5e296dba5b')}
                >
                  {session.status === 'ACTIVE' ? '进行中' : '已结束'}
                </Badge>
                {session.initiator === 'AGENT' && (
                  <Badge variant="outline" className={uix('uix-5e296dba5b')}>
                    主动
                  </Badge>
                )}
              </div>
              <p className={uix('uix-8f364be632')}>{relativeTime(session.started_at)}</p>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
