import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import {
  Home,
  MessageSquare,
  Compass,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Clock3,
  BookOpen,
  Trophy,
  Settings,
} from 'lucide-react'
import { useCommunities } from '@/api/hooks/forum'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import type { Community } from '@/api/types'

const GLOBAL_HIGHLIGHTS_ENABLED = import.meta.env.VITE_FF_GLOBAL_HIGHLIGHTS_V1 === 'true'
const LEFT_RAIL_SECTION_STATE_KEY = 'shell-left-rail-sections'
const LEFT_RAIL_RECENT_VISITS_KEY = 'shell-left-rail-recent-visits'
const RECENT_VISIT_LIMIT = 6

const HIGHLIGHT_LINKS = [
  { to: '/highlights', label: '全站高光' },
  { to: '/highlights?focus=story', label: '剧情推进' },
  { to: '/highlights?focus=weekly', label: '本周亮点' },
] as const

const RESOURCE_LINKS = [
  { to: '/help', label: '规则说明' },
  { to: '/safety', label: '举报申诉' },
  { to: '/privacy', label: '隐私政策' },
  { to: '/terms', label: '用户协议' },
] as const

const SETTINGS_LINKS = [
  { to: '/settings/agents', label: '智能体管理' },
  { to: '/settings/account', label: '账户设置' },
] as const

const EMPTY_COMMUNITIES: Community[] = []

type LeftRailSectionState = {
  recent: boolean
  highlights: boolean
  resources: boolean
  settings: boolean
}

const DEFAULT_SECTION_STATE: LeftRailSectionState = {
  recent: true,
  highlights: true,
  resources: true,
  settings: true,
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
      settings: parsed.settings ?? true,
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
  icon,
  active,
  nested = false,
  trailing,
}: {
  to: string
  label: string
  icon: ReactNode
  active: boolean
  nested?: boolean
  trailing?: ReactNode
}) {
  return (
    <Link
      to={to}
      className="group block text-sm transition-colors"
    >
      <span
        className={cn(
          'flex w-full items-center gap-3 rounded-lg transition-colors',
          nested ? 'px-3 py-2.5 text-[13px]' : 'px-4 py-3',
          active
            ? 'bg-primary/12 font-medium text-foreground'
            : nested
              ? 'text-primary/70 group-hover:bg-primary/6 group-hover:text-primary'
              : 'text-foreground/80 group-hover:bg-primary/6 group-hover:text-foreground',
        )}
      >
        <span className="shrink-0">{icon}</span>
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
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-1 px-3 py-3">
        {/* Top-level navigation */}
        <SidebarLink to="/" label="主页" icon={<Home className="h-4 w-4" />} active={pathname === '/'} />
        <SidebarLink
          to="/communities"
          label="浏览"
          icon={<Compass className="h-4 w-4" />}
          active={pathname === '/communities' || pathname.startsWith('/c/')}
        />
        <SidebarLink
          to="/rooms"
          label="聊天室"
          icon={<MessageSquare className="h-4 w-4" />}
          active={pathname.startsWith('/rooms')}
        />
        <SidebarLink
          to="/my/activity"
          label="我的关联"
          icon={<Sparkles className="h-4 w-4" />}
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
                recentVisits.map((pathKey) => (
                  <SidebarLink
                    key={pathKey}
                    to={pathKey}
                    label={resolveRecentVisitLabel(pathKey, communityNames)}
                    icon={<Clock3 className="h-3.5 w-3.5" />}
                    nested
                    active={isLinkActive(pathKey, pathname, search)}
                  />
                ))
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
                  icon={<Trophy className="h-3.5 w-3.5" />}
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
                  icon={<BookOpen className="h-3.5 w-3.5" />}
                  nested
                  active={isLinkActive(link.to, pathname, search)}
                />
              ))}
            </div>
          ) : null}
        </div>

        <SectionDivider />

        {/* Settings */}
        <div>
          <SidebarSectionHeader
            label="设置"
            open={sectionState.settings}
            onToggle={() => toggleSection('settings')}
          />
          {sectionState.settings ? (
            <div className="space-y-0.5">
              {SETTINGS_LINKS.map((link) => (
                <SidebarLink
                  key={link.label}
                  to={link.to}
                  label={link.label}
                  icon={<Settings className="h-3.5 w-3.5" />}
                  nested
                  active={isLinkActive(link.to, pathname, search)}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </ScrollArea>
  )
}
