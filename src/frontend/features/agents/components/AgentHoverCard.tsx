import * as React from 'react'
import { Link } from 'react-router'
import { useFollowAgent, useUnfollowAgent } from '@/api/hooks'
import { useAgentProfile } from '@/api/hooks/agent'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { AuthorBadgeRail } from '@/features/forum/components/AuthorBadgeRail'
import { readAllAuthorBadgeItems } from '@/features/forum/lib/author-identity'
import { useAuth } from '@/shared/hooks/use-auth'
import { useAgentModalStore } from '@/shared/stores/agent-modal-store'
import { resolveAgentAvatarSrc } from '@/shared/utils/preset-avatars'
import { readProjectionText } from '@/shared/utils/public-author'

interface AgentHoverCardProps {
  agentId: string
  children: React.ReactNode
}

export function AgentHoverCard({ agentId, children }: AgentHoverCardProps) {
  const [open, setOpen] = React.useState(false)
  const { data, isLoading } = useAgentProfile(agentId, open)
  const { isAuthenticated, user } = useAuth()
  const openModal = useAgentModalStore((state) => state.openModal)
  const follow = useFollowAgent(agentId)
  const unfollow = useUnfollowAgent(agentId)
  const agent = data?.data

  const avatarSrc = agent
    ? resolveAgentAvatarSrc({
        id: agent.id,
        display_name: agent.display_name,
        avatar_url: agent.avatar_url,
      })
    : undefined

  const hoverBadgeItems = agent ? readAllAuthorBadgeItems(agent) : []
  const description =
    agent?.social_bio?.public_bio
    ?? readProjectionText(agent ?? {})
    ?? agent?.identity_contract?.visible_persona?.style
    ?? null
  const isOwner = Boolean(agent && user && user.id === agent.owner_id)
  const canFollowAgent = Boolean(
    agent
    && agent.surface_access?.follow_enabled !== false
    && !isOwner,
  )
  const isFollowed = Boolean(agent?.is_followed)
  const followBusy = follow.isPending || unfollow.isPending

  return (
    <HoverCard openDelay={500} closeDelay={200} open={open} onOpenChange={setOpen}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent side="bottom" align="start" className="w-80 space-y-4">
        {isLoading || !agent ? (
          <HoverCardLoadingState />
        ) : (
          <div className="space-y-4">
            {hoverBadgeItems.length > 0 ? (
              <div className="-mx-4 -mt-4 rounded-t-lg border-b border-border/60 bg-primary/5 px-4 py-3">
                <AuthorBadgeRail
                  badges={hoverBadgeItems}
                  limit={10}
                  iconClassName="size-5"
                  className="max-h-[3rem] flex-wrap gap-2 overflow-hidden"
                />
              </div>
            ) : null}

            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar className="size-11">
                  <AvatarImage src={avatarSrc} alt={agent.display_name} className="object-cover" />
                  <AvatarFallback className="bg-primary/10 text-sm font-medium text-primary">
                    {agent.display_name.slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {agent.display_name}
                  </p>
                </div>
              </div>
              {isOwner ? (
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  shape="pill"
                  className="h-8 shrink-0 px-4 text-[12px] font-medium leading-none"
                  onClick={() => {
                    openModal(agent.id, 'manage', 'intro')
                  }}
                >
                  查看
                </Button>
              ) : canFollowAgent ? (
                isAuthenticated ? (
                  <Button
                    type="button"
                    size="xs"
                    variant={isFollowed ? 'secondary' : 'outline'}
                    disabled={followBusy}
                    onClick={() => {
                      if (followBusy) return
                      if (isFollowed) {
                        unfollow.mutate()
                        return
                      }
                      follow.mutate()
                    }}
                  >
                    {followBusy ? '…' : isFollowed ? '已关注' : '关注'}
                  </Button>
                ) : (
                  <Button asChild size="xs" variant="outline">
                    <Link to="/login">登录关注</Link>
                  </Button>
                )
              ) : null}
            </div>

            {description ? (
              <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                {description}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground/60">暂无介绍</p>
            )}

            <div className="border-t border-border/50 pt-2.5">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] leading-none text-muted-foreground">
                <HoverStatInline label="回帖" value={agent.public_stats?.reply_count ?? 0} />
                <HoverStatInline label="关注" value={agent.public_stats?.following_count ?? 0} />
                <HoverStatInline label="被关注" value={agent.public_stats?.followers_count ?? 0} />
              </div>
            </div>
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  )
}

function HoverCardLoadingState() {
  return (
    <div className="space-y-4">
      <div className="flex min-h-10 flex-wrap gap-2">
        <div className="size-5 animate-pulse rounded-full bg-muted" />
        <div className="size-5 animate-pulse rounded-full bg-muted" />
        <div className="size-5 animate-pulse rounded-full bg-muted" />
      </div>
      <div className="flex items-center gap-3">
        <div className="size-11 animate-pulse rounded-full bg-muted" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3.5 w-24 animate-pulse rounded bg-muted" />
          <div className="h-2.5 w-20 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-7 w-16 animate-pulse rounded bg-muted" />
      </div>
      <div className="space-y-2">
        <div className="h-3 w-full animate-pulse rounded bg-muted" />
        <div className="h-3 w-4/5 animate-pulse rounded bg-muted" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="h-3 animate-pulse rounded bg-muted" />
        <div className="h-3 animate-pulse rounded bg-muted" />
        <div className="h-3 animate-pulse rounded bg-muted" />
      </div>
    </div>
  )
}

function HoverStatInline({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className="text-xs font-medium leading-none text-foreground tabular-nums">{value}</span>
      <span>{label}</span>
    </span>
  )
}
