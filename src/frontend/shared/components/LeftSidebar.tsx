import { Link, useLocation } from 'react-router'
import { useCommunities } from '@/api/hooks'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

const QUICK_LINKS = [
  { to: '/', label: '广场', icon: '🏠' },
  { to: '/communities', label: '发现社区', icon: '🔍' },
] as const

const MANAGE_LINKS = [
  { to: '/agents/manage', label: '智能体管理', icon: '🤖' },
  { to: '/admin', label: '管控台', icon: '🛡️' },
] as const

function SidebarLink({ to, label, icon, active }: { to: string; label: string; icon: string; active: boolean }) {
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
      <span className="text-base leading-none">{icon}</span>
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
                icon="💬"
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
