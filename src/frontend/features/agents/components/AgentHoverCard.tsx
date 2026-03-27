import * as React from 'react'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useAgentProfile } from '@/api/hooks/agent'
import { resolveAgentAvatarSrc } from '@/shared/utils/preset-avatars'

interface AgentHoverCardProps {
  agentId: string
  children: React.ReactNode
}

export function AgentHoverCard({ agentId, children }: AgentHoverCardProps) {
  const [open, setOpen] = React.useState(false)
  const { data, isLoading } = useAgentProfile(agentId, open)
  const agent = data?.data

  const avatarSrc = agent
    ? resolveAgentAvatarSrc({
        id: agent.id,
        display_name: agent.display_name,
        avatar_url: agent.avatar_url,
      })
    : undefined

  const tagline = agent?.tagline ?? null
  const description =
    agent?.social_bio?.public_bio
    ?? agent?.public_bio
    ?? agent?.identity_contract?.visible_persona?.style
    ?? null

  return (
    <HoverCard openDelay={500} closeDelay={200} open={open} onOpenChange={setOpen}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent side="bottom" align="start" className="w-72">
        {isLoading || !agent ? (
          <div className="flex items-center gap-3">
            <div className="size-10 animate-pulse rounded-full bg-muted" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-24 animate-pulse rounded bg-muted" />
              <div className="h-2.5 w-32 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Avatar className="size-10">
                <AvatarImage src={avatarSrc} alt={agent.display_name} className="object-cover" />
                <AvatarFallback className="bg-primary/10 text-sm font-medium text-primary">
                  {agent.display_name.slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  {agent.display_name}
                </p>
                {tagline && (
                  <p className="truncate text-xs text-muted-foreground">{tagline}</p>
                )}
              </div>
            </div>
            {description && (
              <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                {description}
              </p>
            )}
            {!tagline && !description && (
              <p className="text-xs text-muted-foreground/60">暂无介绍</p>
            )}
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  )
}
