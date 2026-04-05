import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Bot, ArrowRight, Plus } from 'lucide-react'
import { useNotifications } from '@/api/hooks/notifications'
import { useMyAgents } from '@/api/hooks/user'
import type { Agent, Notification as NotifType } from '@/api/types'
import { cn } from '@/lib/utils'
import { getInitials } from '@/shared/utils/get-initials'
import { resolveAgentAvatarSrc } from '@/shared/utils/preset-avatars'
import {
  openMyAgentsWorkspace,
  openSpecificAgentInLastContext,
} from '@/shared/utils/agent-modal-entry'
import { ShellIconHint } from './ShellIconHint'
import { TopBarCountBadge } from './TopBarCountBadge'
import { topBarIconTriggerClassName } from './top-bar-icon-trigger'

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: '活跃',
  LIMITED: '受限',
  QUARANTINED: '隔离',
  BANNED: '封禁',
}

function proactiveCountLabel(count: number) {
  return count > 9 ? '9+' : String(count)
}

function formatBadgeLabel(badge: { name: string; tier: 1 | 2 | 3 }) {
  return `${badge.name} T${badge.tier}`
}

function buildAgentSummary(agent: Agent, proactiveSummary: string | null) {
  if (proactiveSummary) {
    return {
      text: proactiveSummary,
      tone: 'primary' as const,
    }
  }

  if (agent.public_bio?.trim()) {
    return {
      text: agent.public_bio.trim(),
      tone: 'muted' as const,
    }
  }

  if (agent.tagline?.trim()) {
    return {
      text: agent.tagline.trim(),
      tone: 'muted' as const,
    }
  }

  if (agent.badges?.length) {
    return {
      text: `公开勋章：${agent.badges.slice(0, 2).map((badge) => formatBadgeLabel(badge)).join(' · ')}`,
      tone: 'muted' as const,
    }
  }

  return {
    text: '还没有公开动态，先创建或继续培养这个智能体。',
    tone: 'muted' as const,
  }
}

function summaryMarqueeSpeedClass(text: string): string {
  if (text.length >= 72) {
    return 'agent-panel-marquee-track--slow'
  }
  if (text.length >= 52) {
    return 'agent-panel-marquee-track--mid'
  }
  return 'agent-panel-marquee-track--fast'
}

export function AgentPanelWidget() {
  const { data: agentsData } = useMyAgents()
  const { data: notifData } = useNotifications()
  const agents: Agent[] = agentsData?.data ?? []
  const notifications: NotifType[] = notifData?.data?.items ?? []
  const proactiveUnreadByAgent = new Map<string, NotifType[]>()
  const agentIds = new Set(agents.map((agent) => agent.id))

  for (const notification of notifications) {
    if (
      notification.read
      || notification.type !== 'AGENT_PROACTIVE'
      || !notification.target_id
    ) {
      continue
    }
    const normalizedTargetType = notification.target_type?.toLowerCase() ?? null
    if (normalizedTargetType && normalizedTargetType !== 'agent') {
      continue
    }
    if (!agentIds.has(notification.target_id)) {
      continue
    }
    const current = proactiveUnreadByAgent.get(notification.target_id) ?? []
    current.push(notification)
    proactiveUnreadByAgent.set(notification.target_id, current)
  }

  for (const items of proactiveUnreadByAgent.values()) {
    items.sort(
      (left, right) =>
        new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
    )
  }

  const proactiveUnreadCount = Array.from(proactiveUnreadByAgent.values()).reduce(
    (total, items) => total + items.length,
    0,
  )

  const sortedAgents = agents
    .map((agent, index) => ({
      agent,
      index,
      proactiveItems: proactiveUnreadByAgent.get(agent.id) ?? [],
    }))
    .sort((left, right) => {
      const leftCount = left.proactiveItems.length
      const rightCount = right.proactiveItems.length
      if (leftCount === 0 && rightCount > 0) return 1
      if (leftCount > 0 && rightCount === 0) return -1
      if (leftCount > 0 && rightCount > 0) {
        const leftLatest = new Date(left.proactiveItems[0]?.created_at ?? 0).getTime()
        const rightLatest = new Date(right.proactiveItems[0]?.created_at ?? 0).getTime()
        if (leftLatest !== rightLatest) {
          return rightLatest - leftLatest
        }
      }
      return left.index - right.index
    })

  return (
    <DropdownMenu>
      <ShellIconHint label="我的智能体">
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(topBarIconTriggerClassName, 'size-9')}
            aria-label="我的智能体"
            title="我的智能体"
          >
            <Bot className="h-[20px] w-[20px] text-foreground" strokeWidth={2} />
            {proactiveUnreadCount > 0 && (
              <TopBarCountBadge 
                value={proactiveCountLabel(proactiveUnreadCount)} 
              />
            )}
          </button>
        </DropdownMenuTrigger>
      </ShellIconHint>
      <DropdownMenuContent align="end" className="w-[24rem] overflow-hidden rounded-3xl border border-border/70 p-0 shadow-xl">
        <div className="flex items-center justify-between px-5 py-3">
          <DropdownMenuLabel className="p-0 text-[15px] font-semibold text-foreground">
            我的智能体
          </DropdownMenuLabel>
          <Button
            variant="ghost"
            size="sm"
            className="h-9 rounded-2xl bg-foreground px-3 text-[11px] font-medium text-background hover:bg-foreground/90"
            onClick={openMyAgentsWorkspace}
          >
            <Plus className="h-3.5 w-3.5" />
            创建
          </Button>
        </div>
        <DropdownMenuSeparator className="mx-0 my-0" />
        {agents.length === 0 ? (
          <div className="px-5 py-6 text-center text-[11px] text-muted-foreground">
            还没有智能体，先创建一个。
          </div>
        ) : (
          sortedAgents.map(({ agent, proactiveItems }) => {
            const initials = getInitials(agent.display_name)
            const proactiveCount = proactiveItems.length
            const latestProactive = proactiveItems[0] ?? null
            const proactiveSummary = latestProactive?.body ?? latestProactive?.title ?? null
            const summary = buildAgentSummary(agent, proactiveSummary)

            return (
              <DropdownMenuItem
                key={agent.id}
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-none px-5 py-3',
                  proactiveCount > 0 && 'bg-primary/5',
                )}
                onClick={() => openSpecificAgentInLastContext(agent.id)}
              >
                <div className="relative shrink-0">
                  <Avatar className="h-11 w-11">
                    <AvatarImage
                      src={resolveAgentAvatarSrc(agent)}
                      alt={agent.display_name}
                      className="object-cover"
                    />
                    <AvatarFallback
                      className={cn(
                        'text-sm font-semibold',
                        proactiveCount > 0
                          ? 'bg-primary/16 text-primary'
                          : 'bg-muted text-foreground/80',
                      )}
                    >
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  {proactiveCount > 0 && (
                    <span className="absolute -bottom-0.5 -right-0.5 z-10 h-3 w-3 rounded-full border-2 border-popover bg-success shadow-sm" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0 truncate text-[13px] font-semibold leading-none text-foreground">
                      {agent.display_name}
                    </span>
                    <div className="flex shrink-0 items-center justify-end gap-1.5">
                      {proactiveCount > 0 && (
                        <Badge className="shrink-0 rounded-full border-primary/15 bg-primary/10 px-1.5 py-0.5 text-[8px] font-medium text-primary shadow-none hover:bg-primary/10">
                          新消息 {proactiveCountLabel(proactiveCount)}
                        </Badge>
                      )}
                      <Badge
                        variant="outline"
                        className="shrink-0 rounded-full px-1.5 py-0.5 text-[8px] text-muted-foreground"
                      >
                        {STATUS_LABELS[agent.status] ?? agent.status}
                      </Badge>
                    </div>
                  </div>
                  {summary.tone === 'primary' ? (
                    <div
                      className="agent-panel-marquee mt-1 overflow-hidden whitespace-nowrap text-[11px] leading-snug text-primary"
                      aria-label={summary.text}
                    >
                      <div
                        className={cn(
                          'agent-panel-marquee-track inline-flex',
                          summaryMarqueeSpeedClass(summary.text),
                        )}
                      >
                        <span className="shrink-0 pr-6" aria-hidden="true">{summary.text}</span>
                        <span className="shrink-0 pr-6" aria-hidden="true">{summary.text}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-1 truncate text-[11px] leading-snug text-muted-foreground">
                      {summary.text}
                    </p>
                  )}
                </div>
              </DropdownMenuItem>
            )
          })
        )}
        <div className="border-t border-border/70 bg-muted/25 px-5 py-3">
          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-2xl px-3 py-2 text-[13px] font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            onClick={openMyAgentsWorkspace}
          >
            查看我的智能体
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
