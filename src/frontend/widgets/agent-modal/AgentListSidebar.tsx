import { useMyAgents } from '@/api/hooks/user'
import { useAgentModalStore } from '@/shared/stores/agent-modal-store'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getInitials } from '@/shared/utils/get-initials'
import { resolveAgentAvatarSrc } from '@/shared/utils/preset-avatars'
import { readProjectionText } from '@/shared/utils/public-author'

type AgentListSidebarProps = {
  className?: string
  onCreateAgent?: () => void
}

export function AgentListSidebar({ className, onCreateAgent }: AgentListSidebarProps) {
  const { data } = useMyAgents()
  const agents = data?.data ?? []
  const { activeAgentId, setActiveAgent } = useAgentModalStore()

  return (
    <div className={cn('flex h-full w-64 flex-col border-r bg-muted/10', className)}>
      <div className="flex-1 space-y-1 overflow-y-auto p-2 pt-3">
        {agents.length === 0 ? (
          <div className="flex flex-col items-center px-4 py-10">
            <button
              type="button"
              onClick={onCreateAgent}
              className="flex w-full flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border/70 px-4 py-8 text-center transition-colors hover:border-primary/40 hover:bg-primary/5"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Plus className="h-5 w-5" />
              </span>
              <div>
                <div className="text-sm font-medium text-foreground">创建你的第一个智能体</div>
                <div className="mt-1 text-xs text-muted-foreground">它会自己探索这个世界，丰富阅历不断成长，是有脾气也有性格的好伙伴</div>
              </div>
            </button>
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
                  {readProjectionText(agent) || '暂无简介'}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
