import { useNavigate } from 'react-router'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Sparkles, MessageCircle } from 'lucide-react'
import { useMyAgents, useNotifications } from '@/api/hooks'
import type { Agent, Notification as NotifType } from '@/api/types'

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: '活跃',
  LIMITED: '受限',
  QUARANTINED: '隔离',
  BANNED: '封禁',
}

export function AgentPanel() {
  const navigate = useNavigate()
  const { data: agentsData } = useMyAgents()
  const { data: notifData } = useNotifications()

  const agents: Agent[] = agentsData?.data ?? []
  const notifications: NotifType[] = notifData?.data?.items ?? []

  const hasProactive = agents.some((a) =>
    notifications.some(
      (n) => !n.read && n.type === 'AGENT_PROACTIVE' && n.target_id === a.id,
    ),
  )

  if (agents.length === 0) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="relative h-8 w-8 p-0">
          <Sparkles className="h-4 w-4 text-amber-500" />
          {hasProactive && (
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-primary animate-pulse" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="text-xs">我的智能体</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {agents.map((agent) => {
          const initials = agent.display_name
            .split(/[\s-]+/)
            .map((w) => w[0])
            .join('')
            .slice(0, 2)
            .toUpperCase()

          const agentNotif = notifications.find(
            (n) => !n.read && n.type === 'AGENT_PROACTIVE' && n.target_id === agent.id,
          )

          return (
            <DropdownMenuItem
              key={agent.id}
              className="flex items-center gap-3 py-2.5 cursor-pointer"
              onClick={() => navigate(`/agents/${agent.id}/chat`)}
            >
              <Avatar className="h-9 w-9 shrink-0">
                <AvatarFallback
                  className={`text-xs font-medium ${agentNotif ? 'bg-primary/20 text-primary animate-bounce' : 'bg-muted'}`}
                >
                  {initials}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium truncate">{agent.display_name}</span>
                  <Badge
                    variant="outline"
                    className="text-[9px] px-1 py-0 shrink-0"
                  >
                    {STATUS_LABELS[agent.status] ?? agent.status}
                  </Badge>
                </div>
                {agentNotif ? (
                  <p className="text-[11px] text-primary truncate">{agentNotif.title}</p>
                ) : (
                  <p className="text-[11px] text-muted-foreground">{agent.model}</p>
                )}
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 h-7 px-2 text-xs"
                onClick={(e) => {
                  e.stopPropagation()
                  navigate(`/agents/${agent.id}/chat`)
                }}
              >
                <MessageCircle className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuItem>
          )
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-xs text-muted-foreground justify-center"
          onClick={() => navigate('/agents/manage')}
        >
          管理智能体
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
