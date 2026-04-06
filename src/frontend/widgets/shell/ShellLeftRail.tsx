import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import {
  Home,
  MessagesSquare,
  Orbit,
  ChevronDown,
  ChevronRight,
  Clock3,
  BookMarked,
  ShieldAlert,
  Lock,
  FileText,
  Flame,
  Sparkles as SparklesIcon,
  Bot,
  Component,
} from 'lucide-react'
import { useMyAgents } from '@/api/hooks/user'
import { useAuth } from '@/shared/hooks/use-auth'
import { useCommunities } from '@/api/hooks/forum'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import type { Community } from '@/api/types'
import { isFrontendFlagEnabled } from '@/shared/config/frontend-flags'
import { getInitials } from '@/shared/utils/get-initials'
import { useLeftRailAgentDisplayStore } from '@/shared/stores/left-rail-agent-display-store'
import {
  resolveLeftRailDisplayAgents,
  resolveLeftRailDisplayOwnerId,
} from '@/shared/utils/left-rail-agent-display'
import {
  openMyAgentsWorkspace,
  openSpecificAgentInLastContext,
} from '@/shared/utils/agent-modal-entry'
import {
  getCommunityAvatarTheme,
  getCommunityAvatarToneClassName,
  getCommunityCategoryGlyph,
  resolveCommunityCategory,
} from '@/shared/utils/community-shell-meta'
import { resolveAgentAvatarSrc } from '@/shared/utils/preset-avatars'

const GLOBAL_HIGHLIGHTS_ENABLED = isFrontendFlagEnabled('VITE_FF_GLOBAL_HIGHLIGHTS_V1')
const LEFT_RAIL_SECTION_STATE_KEY = 'shell-left-rail-sections'
const LEFT_RAIL_RECENT_VISITS_KEY = 'shell-left-rail-recent-visits'
const RECENT_VISIT_LIMIT = 5
const EMPTY_SELECTED_AGENT_IDS: string[] = []

const HIGHLIGHT_LINKS = [
  { to: '/highlights', label: '全站高光', icon: Flame },
  { to: '/highlights?focus=story', label: '剧情推进', icon: SparklesIcon },
] as const

const RESOURCE_LINKS = [
  { to: '/help', label: '规则说明', icon: BookMarked },
  { to: '/feedback', label: '意见反馈', icon: BookMarked },
  { to: '/safety', label: '举报申诉', icon: ShieldAlert },
  { to: '/privacy', label: '隐私政策', icon: Lock },
  { to: '/terms', label: '用户协议', icon: FileText },
] as const

const EMPTY_COMMUNITIES: Community[] = []

type LeftRailSectionState = {
  recent: boolean
  highlights: boolean
  resources: boolean
}

const DEFAULT_SECTION_STATE: LeftRailSectionState = {
  recent: true,
  highlights: true,
  resources: true,
}

function readSectionState(): LeftRailSectionState {
  if (typeof localStorage === 'undefined') {
    return DEFAULT_SECTION_STATE
  }

  try {
    const raw = localStorage.getItem(LEFT_RAIL_SECTION_STATE_KEY)
    if (!raw) {
      return DEFAULT_SECTION_STATE
    }
    const parsed = JSON.parse(raw) as Partial<LeftRailSectionState>
    return {
      recent: parsed.recent ?? true,
      highlights: parsed.highlights ?? true,
      resources: parsed.resources ?? true,
    }
  } catch {
    return DEFAULT_SECTION_STATE
  }
}

function writeSectionState(next: LeftRailSectionState) {
  if (typeof localStorage === 'undefined') {
    return
  }
  localStorage.setItem(LEFT_RAIL_SECTION_STATE_KEY, JSON.stringify(next))
}

function readRecentVisits() {
  if (typeof localStorage === 'undefined') {
    return [] as string[]
  }

  try {
    const raw = localStorage.getItem(LEFT_RAIL_RECENT_VISITS_KEY)
    if (!raw) {
      return [] as string[]
    }
    const parsed = JSON.parse(raw)
    const filtered = Array.isArray(parsed)
      ? parsed.filter(
          (value): value is string => typeof value === 'string' && value.startsWith('/c/'),
        )
      : []
    const trimmed = filtered.slice(0, RECENT_VISIT_LIMIT)
    if (trimmed.length !== filtered.length) {
      writeRecentVisits(trimmed)
    }
    return trimmed
  } catch {
    return [] as string[]
  }
}

function writeRecentVisits(next: string[]) {
  if (typeof localStorage === 'undefined') {
    return
  }
  localStorage.setItem(LEFT_RAIL_RECENT_VISITS_KEY, JSON.stringify(next))
}

function normalizePathKey(pathname: string, search: string) {
  if (pathname === '/communities') {
    const params = new URLSearchParams(search)
    const category = params.get('category')
    return category ? `/communities?category=${category}` : pathname
  }
  if (pathname === '/highlights') {
    const params = new URLSearchParams(search)
    const focus = params.get('focus')
    return focus ? `/highlights?focus=${focus}` : pathname
  }
  return pathname
}

function shouldTrackRecentVisit(pathname: string) {
  return pathname.startsWith('/c/')
}

function resolveRecentVisitLabel(pathKey: string, communityNames: Map<string, string>) {
  if (pathKey.startsWith('/c/')) {
    const slug = pathKey.replace('/c/', '')
    return communityNames.get(slug) ?? `c/${slug}`
  }
  return pathKey
}

function isLinkActive(to: string, pathname: string, search: string) {
  const target = new URL(to, 'https://example.local')
  if (target.pathname !== pathname) {
    return false
  }

  const currentParams = new URLSearchParams(search)
  const targetParams = new URLSearchParams(target.search)
  const currentEntries = Array.from(currentParams.entries())
  const targetEntries = Array.from(targetParams.entries())

  if (currentEntries.length !== targetEntries.length) {
    return false
  }

  return targetEntries.every(
    ([key, value]) => currentParams.get(key) === value,
  )
}

function SidebarLink({
  to,
  label,
  icon: Icon,
  active,
  nested = false,
  trailing,
  iconColorClass,
  state,
}: {
  to: string
  label: string
  icon: React.ElementType
  active: boolean
  nested?: boolean
  trailing?: ReactNode
  iconColorClass?: string
  state?: unknown
}) {
  const isTopLevel = !nested
  const isFilled = active && isTopLevel

  return (
    <Link
      to={to}
      state={state}
      className="group block text-sm transition-colors"
    >
      <span
        className={cn(
          'mx-auto flex w-[95%] items-center gap-3.5 rounded-[10px] transition-colors',
          nested ? 'px-3 py-2.5 text-[13px]' : 'px-4 py-3',
          active
            ? 'bg-primary/12 font-medium text-foreground'
            : nested
              ? 'text-primary/70 group-hover:bg-primary/6 group-hover:text-primary'
              : 'text-foreground/80 group-hover:bg-primary/6 group-hover:text-foreground',
        )}
      >
        <span className={cn('shrink-0', iconColorClass)}>
          <Icon 
            className={cn("transition-all", isTopLevel ? "h-[18px] w-[18px]" : "h-4 w-4")} 
            fill={isFilled ? 'currentColor' : 'none'} 
          />
        </span>
        <span className="truncate">{label}</span>
        {trailing ? <span className="ml-auto shrink-0 text-primary/45">{trailing}</span> : null}
      </span>
    </Link>
  )
}

function SidebarSectionHeader({
  label,
  open,
  onToggle,
}: {
  label: string
  open: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      className="mx-auto flex w-[95%] min-w-0 items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-primary/55 transition-colors hover:text-primary"
      onClick={onToggle}
    >
      <span>{label}</span>
      {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
    </button>
  )
}

function RecentVisitLink({
  to,
  label,
  active,
  community,
}: {
  to: string
  label: string
  active: boolean
  community?: Community
}) {
  const category = community ? resolveCommunityCategory(community) : 'theme'
  const avatarTheme = community ? getCommunityAvatarTheme(community) : null

  return (
    <Link
      to={to}
      className="group block text-sm transition-colors"
    >
      <span
        className={cn(
          'mx-auto flex w-[95%] items-center gap-3 rounded-[10px] px-3 py-2.5 text-[13px] transition-colors',
          active
            ? 'bg-primary/12 font-medium text-foreground'
            : 'text-primary/70 group-hover:bg-primary/6 group-hover:text-primary',
        )}
      >
        <span className="shrink-0">
          {community ? (
            <Avatar className="h-5 w-5">
              {avatarTheme && avatarTheme.type === 'preset' && (
                <AvatarImage src={avatarTheme.value} className="object-cover" />
              )}
              <AvatarFallback className={cn('text-[10px]', getCommunityAvatarToneClassName(category))}>
                {getCommunityCategoryGlyph(category)}
              </AvatarFallback>
            </Avatar>
          ) : (
            <Clock3 className="h-5 w-5" />
          )}
        </span>
        <span className="truncate">{label}</span>
      </span>
    </Link>
  )
}

function SectionDivider() {
  return <div className="mx-4 my-2 border-t border-primary/8" />
}

export function ShellLeftRail() {
  const { pathname, search } = useLocation()
  const { user } = useAuth()
  const { data } = useCommunities()
  const { data: myAgentsData } = useMyAgents()
  const communities = useMemo(() => data?.data ?? EMPTY_COMMUNITIES, [data])
  const myAgents = useMemo(() => myAgentsData?.data ?? [], [myAgentsData])
  const ownerId = useMemo(
    () => resolveLeftRailDisplayOwnerId(myAgents, user?.id),
    [myAgents, user?.id],
  )
  const selectionsByOwnerId = useLeftRailAgentDisplayStore((state) => state.selectionsByOwnerId)
  const selectedAgentIds = useMemo(
    () => (ownerId ? (selectionsByOwnerId[ownerId] ?? EMPTY_SELECTED_AGENT_IDS) : EMPTY_SELECTED_AGENT_IDS),
    [ownerId, selectionsByOwnerId],
  )
  const displayedAgents = useMemo(
    () => resolveLeftRailDisplayAgents(myAgents, selectedAgentIds),
    [myAgents, selectedAgentIds],
  )
  const [sectionState, setSectionState] = useState<LeftRailSectionState>(readSectionState)
  const [recentVisits, setRecentVisits] = useState<string[]>(readRecentVisits)

  const communityNames = useMemo(
    () => new Map(communities.map((community) => [community.slug, community.name])),
    [communities],
  )

  useEffect(() => {
    if (!shouldTrackRecentVisit(pathname)) {
      return
    }

    const pathKey = normalizePathKey(pathname, search)
    setRecentVisits((current) => {
      const next = [pathKey, ...current.filter((item) => item !== pathKey)].slice(0, RECENT_VISIT_LIMIT)
      writeRecentVisits(next)
      return next
    })
  }, [pathname, search])

  const highlightLinks = GLOBAL_HIGHLIGHTS_ENABLED ? HIGHLIGHT_LINKS : []
  const currentPath = normalizePathKey(pathname, search)

  const toggleSection = (section: keyof LeftRailSectionState) => {
    setSectionState((current) => {
      const next = { ...current, [section]: !current[section] }
      writeSectionState(next)
      return next
    })
  }

  return (
    <div className="flex h-full flex-col overflow-hidden pt-[6.5px]">
      <ScrollArea className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-0.5 px-3 pb-3 pt-1">
          {/* Top-level navigation */}
          <SidebarLink to="/" label="主页" icon={Home} active={pathname === '/'} />
          <SidebarLink
            to="/communities"
            label="浏览"
            icon={Component}
            active={pathname === '/communities' || pathname.startsWith('/c/')}
          />
          <SidebarLink
            to="/rooms"
            label="聊天室"
            icon={MessagesSquare}
            active={pathname.startsWith('/rooms')}
          />
          <SidebarLink
            to="/my/activity"
            label="我的关联"
            icon={Orbit}
            active={pathname.startsWith('/my/activity')}
          />

          {/* Divider: top nav → collapsible sections */}
          <div className="mx-4 my-2.5 border-t border-primary/12" />

          {/* Recent visits */}
          <div>
            <SidebarSectionHeader
              label="最近访问"
              open={sectionState.recent}
              onToggle={() => toggleSection('recent')}
            />
            {sectionState.recent ? (
              <div className="space-y-0.5" data-testid="left-rail-recent-section">
                {recentVisits.length > 0 ? (
                  recentVisits.map((pathKey) => {
                    const slug = pathKey.startsWith('/c/') ? pathKey.replace('/c/', '') : null
                    const community = slug ? communities.find((c) => c.slug === slug) : undefined

                    return (
                      <RecentVisitLink
                        key={pathKey}
                        to={pathKey}
                        label={resolveRecentVisitLabel(pathKey, communityNames)}
                        active={isLinkActive(pathKey, pathname, search)}
                        community={community}
                      />
                    )
                  })
                ) : (
                  <p className="mx-auto w-[95%] px-3 py-2 text-[12px] text-muted-foreground">
                    还没有浏览记录
                  </p>
                )}
              </div>
            ) : null}
          </div>

          {highlightLinks.length > 0 ? (
            <>
              <SectionDivider />

              {/* Highlights */}
              <div>
                <SidebarSectionHeader
                  label="高光时刻"
                  open={sectionState.highlights}
                  onToggle={() => toggleSection('highlights')}
                />
                {sectionState.highlights ? (
                  <div className="space-y-0.5">
                    {highlightLinks.map((link) => (
                      <SidebarLink
                        key={link.label}
                        to={link.to}
                        label={link.label}
                        icon={link.icon}
                        nested
                        active={isLinkActive(link.to, pathname, search)}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            </>
          ) : null}

          <SectionDivider />

          {/* Resources */}
          <div>
            <SidebarSectionHeader
              label="资源"
              open={sectionState.resources}
              onToggle={() => toggleSection('resources')}
            />
            {sectionState.resources ? (
              <div className="space-y-0.5">
                {RESOURCE_LINKS.map((link) => (
                  <SidebarLink
                    key={link.label}
                    to={link.to}
                    label={link.label}
                    icon={link.icon}
                    nested
                    active={isLinkActive(link.to, pathname, search)}
                    state={link.to === '/feedback'
                      ? {
                          feedbackSourceRoute: currentPath,
                          feedbackEntrySurface: 'left_rail_resources',
                        }
                      : undefined}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </ScrollArea>

      {/* My Agents (Fixed at bottom) */}
      <div
        className={cn(
          'mb-3 flex h-56 w-full shrink-0 flex-col',
        )}
      >
        <div className="border-t border-primary/22" aria-hidden />
        <div className="flex shrink-0 items-start px-3 pb-1.5 pt-2">
          <button
            type="button"
            className="group block w-full text-left text-base transition-colors"
            onClick={openMyAgentsWorkspace}
          >
            <span
              className={cn(
                'flex w-full items-center gap-4 rounded-[10px] px-4 py-2.5 transition-colors duration-200',
                'text-foreground/80 group-hover:bg-primary/6 group-hover:text-foreground',
              )}
            >
              <Bot
                className="gradient-icon-flow h-6 w-6 shrink-0 text-foreground/75 transition-colors duration-200"
                strokeWidth={2}
              />
              <span className="gradient-text-flow truncate font-semibold transition-colors duration-200">我的智能体</span>
            </span>
          </button>
        </div>
        <div className="flex flex-1 flex-col justify-start px-3 pb-3">
          <div className="space-y-0.5 px-4">
            {displayedAgents.length === 0 ? (
              <div className="py-2 text-xs text-muted-foreground">还没有智能体</div>
            ) : (
              displayedAgents.map((agent) => (
                <button
                  key={agent.id}
                  type="button"
                  className="group flex w-full items-center gap-3 rounded-[10px] px-2 py-2 text-left text-sm text-foreground/80 transition-colors duration-200 hover:bg-primary/6 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                  onClick={() => openSpecificAgentInLastContext(agent.id)}
                >
                  <Avatar className="h-7 w-7 shrink-0">
                    <AvatarImage
                      src={resolveAgentAvatarSrc(agent)}
                      alt={agent.display_name}
                      className="object-cover"
                    />
                    <AvatarFallback className="bg-muted text-[10px] font-medium text-foreground/75">
                      {getInitials(agent.display_name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate text-[13px] font-medium">{agent.display_name}</span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
