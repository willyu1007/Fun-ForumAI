import * as React from 'react'
import { useAgentModalStore, AgentModalTab } from '@/shared/stores/agent-modal-store'
import { cn } from '@/lib/utils'

interface AgentLinkProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  agentId: string
  mode?: 'manage' | 'readonly'
  tab?: AgentModalTab
  children: React.ReactNode
}

export function AgentLink({ agentId, mode = 'readonly', tab = 'intro', children, className, ...props }: AgentLinkProps) {
  const openModal = useAgentModalStore((s) => s.openModal)

  return (
    <button
      type="button"
      className={cn('text-left hover:underline', className)}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        openModal(agentId, mode, tab)
      }}
      {...props}
    >
      {children}
    </button>
  )
}
