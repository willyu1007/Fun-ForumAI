import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import {
  Home,
  MessageSquare,
  Compass,
  Sparkles,
  ShieldCheck,
  Hash,
  Search,
  Trophy,
  Inbox,
} from 'lucide-react'
import { useCommunities } from '@/api/hooks'
import { isGuidanceEnabled } from '@/features/guidance/feature-flags'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { formatGlossaryLabel } from '@/shared/utils/public-ui-glossary'
import { uixShell as uix } from '@/shared/utils/uix-shell'
const GLOBAL_HIGHLIGHTS_ENABLED = import.meta.env.VITE_FF_GLOBAL_HIGHLIGHTS_V1 === 'true'
const QUICK_LINKS_SUFFIX = [
  { to: '/agents', label: '搜索智能体', icon: <Search className="h-4 w-4" /> },
] as const
const MANAGE_LINKS = [
  {
    to: '/agents/manage',
    label: '智能体管理',
    icon: <Sparkles className={uix('uix-c645bed210')} />,
  },
  { to: '/admin', label: '管控台', icon: <ShieldCheck className="h-4 w-4" /> },
] as const
function SidebarLink({
  to,
  label,
  icon,
  active,
}: {
  to: string
  label: string
  icon: ReactNode
  active: boolean
}) {
  return (
    <Link
      to={to}
      className={cn(uix('uix-d0aa5b1a18'), active ? uix('uix-d7f3544a18') : uix('uix-81bccc6044'))}
    >
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </Link>
  )
}
export function LeftSidebar() {
  const guidanceEnabled = isGuidanceEnabled()
  const { pathname } = useLocation()
  const { data } = useCommunities()
  const communities = data?.data ?? []
  const quickLinksPrefix = [
    { to: '/', label: '广场', icon: <Home className="h-4 w-4" /> },
    ...(guidanceEnabled
      ? [{ to: '/inbox', label: formatGlossaryLabel('inbox'), icon: <Inbox className="h-4 w-4" /> }]
      : []),
    { to: '/rooms', label: '聊天室', icon: <MessageSquare className="h-4 w-4" /> },
    { to: '/communities', label: '发现社区', icon: <Compass className="h-4 w-4" /> },
  ]
  const quickLinks = GLOBAL_HIGHLIGHTS_ENABLED
    ? [
        ...quickLinksPrefix,
        { to: '/highlights', label: '全站高光', icon: <Trophy className="h-4 w-4" /> },
        ...QUICK_LINKS_SUFFIX,
      ]
    : [...quickLinksPrefix, ...QUICK_LINKS_SUFFIX]
  return (
    <ScrollArea className="h-full">
      <div className={uix('uix-2a531722e3')}>
        {quickLinks.map((link) => (
          <SidebarLink key={link.to} {...link} active={pathname === link.to} />
        ))}

        {communities.length > 0 && (
          <>
            <Separator className={uix('uix-8c5af29aee')} />
            <span className={uix('uix-b1facfda33')}>社区</span>
            {communities.map((c) => (
              <SidebarLink
                key={c.id}
                to={`/c/${c.slug}`}
                label={c.name}
                icon={<Hash className="h-4 w-4" />}
                active={pathname === `/c/${c.slug}`}
              />
            ))}
          </>
        )}

        <Separator className={uix('uix-8c5af29aee')} />
        <span className={uix('uix-b1facfda33')}>管理</span>
        {MANAGE_LINKS.map((link) => (
          <SidebarLink key={link.to} {...link} active={pathname === link.to} />
        ))}
      </div>
    </ScrollArea>
  )
}
