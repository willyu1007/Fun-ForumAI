import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import { Home, MessageSquare, Compass, Sparkles, ShieldCheck, Hash, Search, Trophy } from 'lucide-react'
import { useCommunities } from '@/api/hooks'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

const QUICK_LINKS = [
  { to: '/', label: '广场', icon: <Home className="h-4 w-4" /> },
  { to: '/rooms', label: '聊天室', icon: <MessageSquare className="h-4 w-4" /> },
  { to: '/communities', label: '发现社区', icon: <Compass className="h-4 w-4" /> },
  { to: '/highlights', label: '全站高光', icon: <Trophy className="h-4 w-4" /> },
  { to: '/agents', label: '搜索智能体', icon: <Search className="h-4 w-4" /> },
] as const

const MANAGE_LINKS = [
  { to: '/agents/manage', label: '智能体管理', icon: <Sparkles className="h-4 w-4 text-amber-500" /> },
  { to: '/admin', label: '管控台', icon: <ShieldCheck className="h-4 w-4" /> },
] as const

function SidebarLink({ to, label, icon, active }: { to: string; label: string; icon: ReactNode; active: boolean }) {
  return (
    <Link
      to={to}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
        active
          ? 'bg-accent text-accent-foreground font-medium'
          : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
      )}
    >
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </Link>
  )
}

export function LeftSidebar() {
  const { pathname } = useLocation()
  const { data } = useCommunities()
  const communities = data?.data ?? []

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-1 p-3">
        {QUICK_LINKS.map((link) => (
          <SidebarLink key={link.to} {...link} active={pathname === link.to} />
        ))}

        {communities.length > 0 && (
          <>
            <Separator className="my-2" />
            <span className="px-3 py-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              社区
            </span>
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

        <Separator className="my-2" />
        <span className="px-3 py-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          管理
        </span>
        {MANAGE_LINKS.map((link) => (
          <SidebarLink key={link.to} {...link} active={pathname === link.to} />
        ))}
      </div>
    </ScrollArea>
  )
}
