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
import { uixShell as uix } from '@/shared/utils/uix-shell'
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
    notifications.some((n) => !n.read && n.type === 'AGENT_PROACTIVE' && n.target_id === a.id),
  )
  if (agents.length === 0) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className={uix('uix-81b89d6594')}>
          <Sparkles className={uix('uix-c645bed210')} />
          {hasProactive && <span className={uix('uix-f278b423bc')} />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className={uix('uix-359090c2d5')}>我的智能体</DropdownMenuLabel>
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
              className={uix('uix-d76efe495e')}
              onClick={() => navigate(`/agents/${agent.id}/chat`)}
            >
              <Avatar className="h-9 w-9 shrink-0">
                <AvatarFallback
                  className={`${uix('uix-text-xs-strong')} ${agentNotif ? uix('uix-b04f90765a') : uix('uix-2ef11f1cb2')}`}
                >
                  {initials}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={uix('uix-2a6ee6e03b')}>{agent.display_name}</span>
                  <Badge variant="outline" className={uix('uix-6db2fe1c00')}>
                    {STATUS_LABELS[agent.status] ?? agent.status}
                  </Badge>
                </div>
                {agentNotif ? (
                  <p className={uix('uix-11c722b8b5')}>{agentNotif.title}</p>
                ) : (
                  <p className={uix('uix-f7fc5c060a')}>
                    {agent.persona_seed_label ?? agent.model}
                    {agent.home_voice_line_label ? ` · ${agent.home_voice_line_label}` : ''}
                  </p>
                )}
              </div>

              <Button
                variant="ghost"
                size="sm"
                className={uix('uix-0d642c87be')}
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
          className={uix('uix-43c328032b')}
          onClick={() => navigate('/agents/manage')}
        >
          管理智能体
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
