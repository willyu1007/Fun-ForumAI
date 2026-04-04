import * as React from 'react'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { useAgentProfile } from '@/api/hooks/agent'
import { resolveAgentAvatarSrc } from '@/shared/utils/preset-avatars'
import {
  readPrimaryIdentityChip,
  readProofBadgeLabels,
  readProjectionText,
} from '@/shared/utils/public-author'

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

  const tagline = agent?.public_projection?.tagline ?? agent?.tagline ?? null
  const identityChip = agent ? readPrimaryIdentityChip(agent) : null
  const proofBadges = agent ? readProofBadgeLabels(agent) : []
  const description =
    agent?.social_bio?.public_bio
    ?? readProjectionText(agent ?? {})
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
                {(identityChip || proofBadges.length > 0) && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {identityChip && (
                      <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                        {identityChip}
                      </Badge>
                    )}
                    {proofBadges.map((badge) => (
                      <Badge key={badge} variant="secondary" className="px-1.5 py-0 text-[10px]">
                        {badge}
                      </Badge>
                    ))}
                  </div>
                )}
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
