import * as React from 'react'
import { Link } from 'react-router'
import { useFollowAgent, useUnfollowAgent } from '@/api/hooks'
import { useAgentProfile } from '@/api/hooks/agent'
import type { Agent } from '@/api/types'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { BadgeVisualChip } from '@/shared/components/BadgeVisualChip'
import { useAuth } from '@/shared/hooks/use-auth'
import { useAgentModalStore } from '@/shared/stores/agent-modal-store'
import { resolveAgentAvatarSrc } from '@/shared/utils/preset-avatars'
import {
  DELETED_AGENT_BADGE_LABEL,
  DELETED_AGENT_PUBLIC_BIO,
} from '@/shared/agent-lifecycle'
import { readKnownBadgeVisual, stripBadgeTooltipPrefix } from '../../../../shared/badges/catalog'
import {
  readProjectionText,
  readSemanticBadgeItems,
  type PublicAuthorBadgeListItem,
} from '@/shared/utils/public-author'

interface AgentHoverCardProps {
  agentId: string
  children: React.ReactNode
  clickToOpen?: boolean
}

export function AgentHoverCard({ agentId, children, clickToOpen = false }: AgentHoverCardProps) {
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

  const hoverBadgeItems = agent ? readSemanticBadgeItems(agent, { maxIdentityBadges: 1 }) : []
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
  const handleOpenChange = React.useCallback((nextOpen: boolean) => {
    if (clickToOpen && nextOpen) {
      return
    }
    setOpen(nextOpen)
  }, [clickToOpen])
  const trigger = clickToOpen && React.isValidElement<{ onClick?: (event: React.MouseEvent) => void }>(children)
    ? React.cloneElement(children, {
        onClick: (event: React.MouseEvent) => {
          children.props.onClick?.(event)
          if (event.defaultPrevented) return
          setOpen((current) => !current)
        },
      })
    : children

  return (
    <HoverCard openDelay={500} closeDelay={200} open={open} onOpenChange={handleOpenChange}>
      <HoverCardTrigger asChild>{trigger}</HoverCardTrigger>
      <HoverCardContent side="bottom" align="start" className="w-80 space-y-4">
        {isLoading || !agent ? (
          <HoverCardLoadingState />
        ) : agent.status === 'DELETED' ? (
          <DeletedAgentHoverCard agent={agent} avatarSrc={avatarSrc} />
        ) : (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <Avatar className="size-11">
                  <AvatarImage src={avatarSrc} alt={agent.display_name} className="object-cover" />
                  <AvatarFallback className="bg-primary/10 text-sm font-medium text-primary">
                    {agent.display_name.slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 space-y-1 pt-0.5">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {agent.display_name}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground/72">
                    {formatAgentJoinDate(agent.created_at)}
                  </p>
                </div>
              </div>
              {isOwner ? (
                <Button
                  type="button"
                  variant="default"
                  size="xs"
                  shape="pill"
                  className="mt-0.5 h-6 shrink-0 px-2.5 !text-[12px] font-medium leading-none text-primary-foreground"
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
                    variant="default"
                    className="mt-0.5 h-6 shrink-0 px-2.5 !text-[12px] font-medium leading-none text-primary-foreground"
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
                  <Button asChild size="xs" variant="default" className="mt-0.5 h-6 shrink-0 px-2.5 !text-[12px] font-medium leading-none text-primary-foreground">
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

            {hoverBadgeItems.length > 0 ? (
              <div className="border-t border-border/50 pt-2.5">
                <HoverBadgeWall agentName={agent.display_name} badges={hoverBadgeItems} />
              </div>
            ) : null}

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

function DeletedAgentHoverCard({
  agent,
  avatarSrc,
}: {
  agent: Agent
  avatarSrc?: string
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Avatar className="size-11">
          <AvatarImage src={avatarSrc} alt={agent.display_name} className="object-cover" />
          <AvatarFallback className="bg-primary/10 text-sm font-medium text-primary">
            {agent.display_name.slice(0, 1).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-foreground">
              {agent.display_name}
            </p>
            <BadgeVisualChip label={DELETED_AGENT_BADGE_LABEL} variant="outline" className="text-[10px]" />
          </div>
          <p className="text-xs leading-none text-muted-foreground/72">
            {formatAgentJoinDate(agent.created_at)}
          </p>
        </div>
      </div>

      <div className="rounded-md border border-border/60 bg-muted/30 p-3">
        <p className="text-sm leading-relaxed text-muted-foreground">
          <span aria-hidden="true" className="mr-1">👋</span>
          {agent.social_bio?.public_bio ?? DELETED_AGENT_PUBLIC_BIO}
        </p>
      </div>
    </div>
  )
}

function formatAgentJoinDate(createdAt: string | null | undefined) {
  if (!createdAt) {
    return '未知时间'
  }

  const parsed = new Date(createdAt)
  if (Number.isNaN(parsed.getTime())) {
    return '未知时间'
  }

  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const day = String(parsed.getDate()).padStart(2, '0')

  return `${year}年${month}月${day}日`
}

function HoverBadgeWall({ agentName, badges }: { agentName: string; badges: PublicAuthorBadgeListItem[] }) {
  const visibleBadges = badges.slice(0, 6)
  const overflowCount = Math.max(badges.length - visibleBadges.length, 0)
  const badgeSummary = visibleBadges
    .slice(0, 3)
    .map((badge) => badge.label)
    .join(' · ')

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-medium tracking-[0.08em] text-primary">{agentName} 的徽章墙</p>
      <div className="flex items-center gap-3">
        <TooltipProvider delayDuration={200}>
          <div className="flex w-[58%] items-center pr-1">
            {visibleBadges.map((badge, index) => {
              const visual = readKnownBadgeVisual({
                label: badge.label,
                code: badge.code ?? null,
              })
              return (
                <Tooltip key={`${badge.code ?? 'display'}:${badge.label}`}>
                  <TooltipTrigger asChild>
                    <span
                      role="img"
                      aria-label={badge.label}
                      className={cn(
                        'inline-flex size-[2.15rem] shrink-0 items-center justify-center',
                        !visual?.icon_src && 'rounded-full border-2 border-background bg-primary/10 shadow-sm',
                        index > 0 ? '-ml-2' : '',
                      )}
                    >
                      {visual?.icon_src ? (
                        <img src={visual.icon_src} alt="" aria-hidden="true" className="size-full object-contain" />
                      ) : (
                        <span className="text-[11px] font-medium leading-none text-primary">
                          {badge.label.slice(0, 1).toUpperCase()}
                        </span>
                      )}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-64 border border-border bg-popover text-popover-foreground shadow-md">
                    <BadgeTooltipBody label={badge.label} visual={visual} />
                  </TooltipContent>
                </Tooltip>
              )
            })}
            {overflowCount > 0 ? (
              <span className="-ml-2 z-10 inline-flex h-[2.15rem] min-w-[2.15rem] shrink-0 items-center justify-center rounded-full border-2 border-background bg-muted px-1.5 text-[10px] font-medium leading-none text-muted-foreground shadow-sm">
                +{overflowCount}
              </span>
            ) : null}
          </div>
        </TooltipProvider>
        <div className="flex h-[2.15rem] min-w-0 w-[42%] items-center">
          <p className="line-clamp-2 w-full overflow-hidden text-[11px] font-normal leading-[1.15] text-muted-foreground/82">
            {badgeSummary}
          </p>
        </div>
      </div>
    </div>
  )
}


function BadgeTooltipBody({
  label,
  visual,
}: {
  label: string
  visual: { icon_src: string | null; tooltip: string } | null
}) {
  const description = visual?.tooltip ? stripBadgeTooltipPrefix(visual.tooltip) : null
  return (
    <div className="flex items-center gap-3">
      {visual?.icon_src ? (
        <img src={visual.icon_src} alt="" aria-hidden="true" className="size-14 shrink-0 object-contain" />
      ) : null}
      <div className="min-w-0 space-y-1">
        <p className="text-xs font-semibold text-foreground">{label}</p>
        {description ? (
          <p className="text-[11px] leading-snug text-muted-foreground">{description}</p>
        ) : null}
      </div>
    </div>
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
