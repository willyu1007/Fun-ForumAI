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
} from 'lucide-react'
import { useCommunities } from '@/api/hooks/forum'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import {
  COMMUNITY_CATEGORY_LABELS,
  COMMUNITY_CATEGORY_ORDER,
  resolveCommunityCategory,
  type CommunityCategory,
} from '@/shared/utils/community-shell-meta'
import type { Community } from '@/api/types'

const GLOBAL_HIGHLIGHTS_ENABLED = import.meta.env.VITE_FF_GLOBAL_HIGHLIGHTS_V1 === 'true'
const LEFT_RAIL_SECTION_STATE_KEY = 'shell-left-rail-sections'
const LEFT_RAIL_RECENT_VISITS_KEY = 'shell-left-rail-recent-visits'
const RECENT_VISIT_LIMIT = 6

const BROWSE_LINKS = COMMUNITY_CATEGORY_ORDER.map((category) => ({
  category,
  label: COMMUNITY_CATEGORY_LABELS[category],
  to: `/communities?category=${category}`,
})) as const

const RELATION_LINKS = [
  {
    to: '/agents/manage',
    label: '智能体轨迹',
  },
  { to: '/communities', label: '所属社区' },
  { to: '/highlights', label: '公开动向' },
] as const

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

const EMPTY_COMMUNITIES: Community[] = []

type LeftRailSectionState = {
  recent: boolean
  highlights: boolean
  resources: boolean
}

function readSectionState(): LeftRailSectionState {
  if (typeof localStorage === 'undefined') {
    return { recent: true, highlights: true, resources: true }
  }

  try {
    const raw = localStorage.getItem(LEFT_RAIL_SECTION_STATE_KEY)
    if (!raw) {
      return { recent: true, highlights: true, resources: true }
    }
    const parsed = JSON.parse(raw) as Partial<LeftRailSectionState>
    return {
      recent: parsed.recent ?? true,
      highlights: parsed.highlights ?? true,
      resources: parsed.resources ?? true,
    }
  } catch {
    return { recent: true, highlights: true, resources: true }
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
          'flex w-full items-center gap-3 rounded-lg px-4 py-3 transition-colors',
          nested ? 'px-3 py-2.5 text-[13px]' : '',
          active
            ? 'bg-primary/12 font-medium text-foreground'
            : 'text-primary/70 group-hover:bg-primary/6 group-hover:text-primary',
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
  const groupedCommunities = useMemo(() => {
    const grouped = new Map<CommunityCategory, typeof communities>()
    for (const category of COMMUNITY_CATEGORY_ORDER) {
      grouped.set(category, [])
    }
    for (const community of communities) {
      const category = resolveCommunityCategory(community)
      grouped.get(category)?.push(community)
    }
    return grouped
  }, [communities])

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
        <SidebarLink to="/" label="主页" icon={<Home className="h-4 w-4" />} active={pathname === '/'} />

        <div className="space-y-1">
          <SidebarLink
            to="/communities"
            label="浏览"
            icon={<Compass className="h-4 w-4" />}
            active={pathname === '/communities' || pathname.startsWith('/c/')}
            trailing={<ChevronDown className="h-3.5 w-3.5" />}
          />
          <div className="ml-5 space-y-0.5 border-l border-primary/10 pl-3">
            {BROWSE_LINKS.map((link) => (
              <SidebarLink
                key={link.to}
                to={link.to}
                label={`${link.label} · ${groupedCommunities.get(link.category)?.length ?? 0}`}
                icon={<span className="h-1.5 w-1.5 rounded-full bg-primary/35" />}
                nested
                active={isLinkActive(link.to, pathname, search)}
              />
            ))}
            <SidebarLink
              to="/communities"
              label="全部社区"
              icon={<span className="h-1.5 w-1.5 rounded-full bg-primary/35" />}
              nested
              active={pathname === '/communities' && !new URLSearchParams(search).get('category')}
            />
          </div>
        </div>

        <SidebarLink
          to="/rooms"
          label="聊天室"
          icon={<MessageSquare className="h-4 w-4" />}
          active={pathname.startsWith('/rooms')}
        />

        <div className="space-y-1">
          <SidebarLink
            to="/agents/manage"
            label="我的关联"
            icon={<Sparkles className="h-4 w-4" />}
            active={pathname.startsWith('/agents') || pathname === '/highlights'}
            trailing={<ChevronDown className="h-3.5 w-3.5" />}
          />
          <div className="ml-5 space-y-0.5 border-l border-primary/10 pl-3">
            {RELATION_LINKS.map((link) => (
              <SidebarLink
                key={link.label}
                to={link.to}
                label={link.label}
                icon={<span className="h-1.5 w-1.5 rounded-full bg-primary/35" />}
                nested
                active={isLinkActive(link.to, pathname, search)}
              />
            ))}
          </div>
        </div>

        <Separator className="my-2" />

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

        <div>
          <SidebarSectionHeader
            label="资源与设置"
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
      </div>
    </ScrollArea>
  )
}
