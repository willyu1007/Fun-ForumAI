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
  CalendarDays,
  Bot,
  Component,
} from 'lucide-react'
import { useAgentModalStore } from '@/shared/stores/agent-modal-store'
import { useCommunities } from '@/api/hooks/forum'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import type { Community } from '@/api/types'
import {
  getCommunityAvatarTheme,
  getCommunityAvatarToneClassName,
  getCommunityCategoryGlyph,
  resolveCommunityCategory,
} from '@/shared/utils/community-shell-meta'

const GLOBAL_HIGHLIGHTS_ENABLED = import.meta.env.VITE_FF_GLOBAL_HIGHLIGHTS_V1 === 'true'
const LEFT_RAIL_SECTION_STATE_KEY = 'shell-left-rail-sections'
const LEFT_RAIL_RECENT_VISITS_KEY = 'shell-left-rail-recent-visits'
const RECENT_VISIT_LIMIT = 6

const HIGHLIGHT_LINKS = [
  { to: '/highlights', label: '全站高光', icon: Flame },
  { to: '/highlights?focus=story', label: '剧情推进', icon: SparklesIcon },
  { to: '/highlights?focus=weekly', label: '本周亮点', icon: CalendarDays },
] as const

const RESOURCE_LINKS = [
  { to: '/help', label: '规则说明', icon: BookMarked },
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
    return Array.isArray(parsed)
      ? parsed.filter(
          (value): value is string => typeof value === 'string' && value.startsWith('/c/'),
        )
      : []
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
  return Array.from(targetParams.entries()).every(
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
}: {
  to: string
  label: string
  icon: React.ElementType
  active: boolean
  nested?: boolean
  trailing?: ReactNode
  iconColorClass?: string
}) {
  const isTopLevel = !nested
  const isFilled = active && isTopLevel

  return (
    <Link
      to={to}
      className="group block text-sm transition-colors"
    >
      <span
        className={cn(
          'flex w-full items-center gap-3.5 rounded-lg transition-colors',
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
      className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-primary/55 transition-colors hover:text-primary"
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
          'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] transition-colors',
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
  const { data } = useCommunities()
  const communities = useMemo(() => data?.data ?? EMPTY_COMMUNITIES, [data])
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

  const highlightLinks = GLOBAL_HIGHLIGHTS_ENABLED ? HIGHLIGHT_LINKS : HIGHLIGHT_LINKS.slice(1)

  const toggleSection = (section: keyof LeftRailSectionState) => {
    setSectionState((current) => {
      const next = { ...current, [section]: !current[section] }
      writeSectionState(next)
      return next
    })
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <ScrollArea className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-1 px-3 pb-3 pt-1">
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
                  <p className="px-3 py-2 text-[12px] text-muted-foreground">还没有浏览记录</p>
                )}
              </div>
            ) : null}
          </div>

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
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </ScrollArea>

      {/* My Agents (Fixed at bottom) */}
      <div className="shrink-0 px-3 pb-4 pt-1">
        <SectionDivider />
        <div className="pt-1">
          <button
            type="button"
            className="group block w-full text-left text-sm transition-colors"
            onClick={() => useAgentModalStore.getState().openModal(null, 'manage')}
          >
            <span
              className={cn(
                'flex w-full items-center gap-3.5 rounded-lg px-4 py-3 transition-colors',
                'text-foreground/80 group-hover:bg-primary/6 group-hover:text-foreground',
              )}
            >
              <Bot className="h-[18px] w-[18px] shrink-0 transition-all" />
              <span className="truncate font-medium">我的智能体</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
