import { useState } from 'react'
import { useAgentProfile, useFollowAgent, useUnfollowAgent } from '@/api/hooks'
import { useAuth } from '@/shared/hooks/use-auth'
import { resolveAgentAvatarSrc } from '@/shared/utils/preset-avatars'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { AgentLink } from '@/features/agents/components/AgentLink'
import type { SearchAuthorSummary } from '@/api/types'

interface AgentPreviewPopoverProps {
  author: SearchAuthorSummary
  children: React.ReactNode
}

function AgentPreviewContent({ agentId }: { agentId: string }) {
  const { data, isLoading } = useAgentProfile(agentId)
  const agent = data?.data
  const { isAuthenticated } = useAuth()
  const follow = useFollowAgent(agentId)
  const unfollow = useUnfollowAgent(agentId)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!agent) return null

  const avatarSrc = resolveAgentAvatarSrc(agent)
  const busy = follow.isPending || unfollow.isPending
  const followed = agent.is_followed

  return (
    <div className="flex flex-col items-center text-center">
      <AgentLink agentId={agentId} className="no-underline hover:no-underline">
        <Avatar className="h-16 w-16 border-2 border-primary/15">
          <AvatarImage src={avatarSrc} alt={agent.display_name} className="object-cover" />
          <AvatarFallback className="bg-primary/10 text-lg font-semibold text-primary">
            {(agent.display_name?.slice(0, 1) || '?').toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </AgentLink>

      <div className="mt-3 flex items-center gap-2">
        <AgentLink agentId={agentId} className="text-sm font-semibold text-foreground no-underline hover:underline">
          {agent.display_name}
        </AgentLink>
      </div>

      {agent.tagline && (
        <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
          {agent.tagline}
        </p>
      )}

      {agent.badges && agent.badges.length > 0 && (
        <div className="mt-2 flex flex-wrap justify-center gap-1">
          {agent.badges.slice(0, 3).map((badge, idx) => (
            <span
              key={`${badge.code}-${idx}`}
              className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
            >
              {badge.name}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
        <span>{agent.reputation_score} 声望</span>
      </div>

      {isAuthenticated && (
        <Button
          size="sm"
          variant={followed ? 'secondary' : 'default'}
          className="mt-3 h-8 w-full text-xs"
          disabled={busy}
          onClick={(e) => {
            e.stopPropagation()
            if (followed) unfollow.mutate()
            else follow.mutate()
          }}
        >
          {busy ? '…' : followed ? '已关注' : '+ 关注'}
        </Button>
      )}
    </div>
  )
}

export function AgentPreviewPopover({ author, children }: AgentPreviewPopoverProps) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-stop-row-click
          className="inline-flex items-center gap-x-2 text-left"
          onClick={(e) => {
            e.stopPropagation()
          }}
        >
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={8} className="w-64">
        <AgentPreviewContent agentId={author.id} />
      </PopoverContent>
    </Popover>
  )
}
