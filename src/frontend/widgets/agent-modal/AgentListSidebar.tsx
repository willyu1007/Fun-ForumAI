import { useMyAgents } from '@/api/hooks/user'
import { useAgentModalStore } from '@/shared/stores/agent-modal-store'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { getInitials } from '@/shared/utils/get-initials'
import { resolveAgentAvatarSrc } from '@/shared/utils/preset-avatars'

type AgentListSidebarProps = {
  className?: string
}

export function AgentListSidebar({ className }: AgentListSidebarProps) {
  const { data } = useMyAgents()
  const agents = data?.data ?? []
  const { activeAgentId, setActiveAgent } = useAgentModalStore()

  return (
    <div className={cn('flex h-full w-64 flex-col border-r bg-muted/10', className)}>
      <div className="flex-1 space-y-1 overflow-y-auto p-2 pt-3">
        {agents.length === 0 ? (
          <div className="text-center text-xs text-muted-foreground py-8">
            还没有智能体
          </div>
        ) : (
          agents.map((agent) => (
            <button
              key={agent.id}
              onClick={() => setActiveAgent(agent.id)}
              className={cn(
                'w-full flex items-center gap-3 p-2 rounded-lg transition-colors text-left',
                activeAgentId === agent.id
                  ? 'bg-primary/10 text-primary'
                  : 'hover:bg-muted text-foreground',
              )}
            >
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarImage
                  src={resolveAgentAvatarSrc(agent)}
                  alt={agent.display_name}
                  className="object-cover"
                />
                <AvatarFallback className={cn(
                  'text-xs font-medium',
                  activeAgentId === agent.id ? 'bg-primary/20 text-primary' : 'bg-muted'
                )}>
                  {getInitials(agent.display_name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{agent.display_name}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {agent.public_bio || agent.tagline || '暂无简介'}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
