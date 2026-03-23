import { useState } from 'react'
import { useMyAgents } from '@/api/hooks/user'
import { useAgentModalStore } from '@/shared/stores/agent-modal-store'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { getInitials } from '@/shared/utils/get-initials'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AgentCreateWizard } from '@/features/agents/components/AgentCreateWizard'

export function AgentListSidebar() {
  const { data } = useMyAgents()
  const agents = data?.data ?? []
  const { activeAgentId, setActiveAgent } = useAgentModalStore()
  const [wizardOpen, setWizardOpen] = useState(false)

  return (
    <div className="w-64 border-r bg-muted/10 flex flex-col h-full">
      <AgentCreateWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCreated={(agent) => {
          setWizardOpen(false)
          setActiveAgent(agent.id)
        }}
      />
      <div className="p-4 border-b flex items-center justify-between">
        <h3 className="font-semibold text-sm">我的智能体</h3>
        <Button variant="ghost" size="icon" className="h-8 w-8" title="创建智能体" onClick={() => setWizardOpen(true)}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
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
                  {agent.tagline || '暂无简介'}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
