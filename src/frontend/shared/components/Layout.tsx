import { Outlet, Link, useLocation, useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { AgentPanel } from './AgentPanel'
import { OnboardingBar } from './OnboardingBar'
import { DevAuthToolbar } from './DevAuthToolbar'
import { LeftSidebar } from './LeftSidebar'
import { RightSidebar } from './RightSidebar'
import { useAuth } from '@/shared/hooks/use-auth'
import { useSidebarStore } from '@/shared/stores/sidebar-store'
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from '@/api/hooks'
import { cn } from '@/lib/utils'
import { relativeTime } from '@/shared/utils/relative-time'
import logoSrc from '@/assets/logo.png'

function TopBar() {
  const { toggleLeft, leftOpen } = useSidebarStore()
  const { user, isAuthenticated, logout } = useAuth()
  const location = useLocation()

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-12 items-center gap-2 px-4">
        {/* Left: hamburger + logo */}
        <Button
          variant="ghost"
          size="sm"
          className="hidden h-8 w-8 p-0 md:flex"
          onClick={toggleLeft}
          aria-label={leftOpen ? '收起侧栏' : '展开侧栏'}
        >
          <span className="text-lg">☰</span>
        </Button>

        {/* Mobile sidebar trigger */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 md:hidden">
              <span className="text-lg">☰</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <div className="flex h-12 items-center gap-2 border-b px-3">
              <img src={logoSrc} alt="智域" className="h-7 w-7 rounded-lg" />
              <span className="font-bold">智域</span>
            </div>
            <LeftSidebar />
          </SheetContent>
        </Sheet>

        <Link to="/" className="flex items-center gap-1.5">
          <img src={logoSrc} alt="智域" className="h-7 w-7 rounded-lg" />
        </Link>

        <Separator orientation="vertical" className="mx-1 h-5" />

        {/* Center: spacer */}
        <div className="flex-1" />

        {/* Right: auth-dependent */}
        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <>
              <Button variant="ghost" size="sm" asChild className="hidden sm:flex">
                <Link to="/agents/manage">+ 创建</Link>
              </Button>

              <AgentPanel />
              <NotificationBell />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                      {user?.displayName?.charAt(0) ?? user?.email?.charAt(0) ?? '用'}
                    </span>
                    <span className="hidden max-w-24 truncate text-xs sm:block">
                      {user?.displayName ?? user?.email}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel className="text-xs">
                    {user?.displayName ?? user?.email}
                  </DropdownMenuLabel>
                  <DropdownMenuLabel className="pt-0 text-[10px] font-normal text-muted-foreground">
                    {user?.role === 'admin' ? '管理员' : '用户'}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/agents/manage">智能体管理</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/admin">管控台</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => logout()}
                    className="text-destructive focus:text-destructive"
                  >
                    退出登录
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/login" state={{ from: location.pathname }}>
                  登录
                </Link>
              </Button>
              <Button size="sm" asChild>
                <Link to="/register" state={{ from: location.pathname }}>
                  注册
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

const NOTIF_ICON: Record<string, string> = {
  AGENT_PROACTIVE: '💬',
  AGENT_MILESTONE: '🏆',
  SYSTEM: 'ℹ️',
}

function notifTargetUrl(n: { type: string; target_type: string | null; target_id: string | null }): string | null {
  if (!n.target_id) return null
  if (n.type === 'AGENT_PROACTIVE') return `/agents/${n.target_id}/chat`
  if (n.target_type === 'POST') return `/posts/${n.target_id}`
  if (n.target_type === 'AGENT') return `/agents/${n.target_id}`
  return null
}

function NotificationBell() {
  const navigate = useNavigate()
  const { data } = useNotifications()
  const markRead = useMarkNotificationRead()
  const markAll = useMarkAllNotificationsRead()
  const unread = data?.data?.unread_count ?? 0
  const items = data?.data?.items ?? []

  const handleClick = (n: { id: string; read: boolean; type: string; target_type: string | null; target_id: string | null }) => {
    if (!n.read) markRead.mutate(n.id)
    const url = notifTargetUrl(n)
    if (url) navigate(url)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="relative h-8 w-8 p-0">
          <span className="text-base">🔔</span>
          {unread > 0 && (
            <Badge className="absolute -right-1 -top-1 h-4 min-w-4 rounded-full px-1 text-[10px]">
              {unread > 9 ? '9+' : unread}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-h-80 overflow-y-auto">
        <div className="flex items-center justify-between px-2 py-1.5">
          <DropdownMenuLabel className="text-xs p-0">通知</DropdownMenuLabel>
          {unread > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto py-0.5 px-1 text-[10px]"
              onClick={() => markAll.mutate()}
            >
              全部已读
            </Button>
          )}
        </div>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <div className="px-2 py-4 text-center text-xs text-muted-foreground">暂无通知</div>
        ) : (
          items.slice(0, 10).map((n) => (
            <DropdownMenuItem
              key={n.id}
              className={cn('flex items-start gap-2 py-2 cursor-pointer', !n.read && 'bg-primary/5')}
              onClick={() => handleClick(n)}
            >
              <span className="text-base shrink-0 mt-0.5">{NOTIF_ICON[n.type] ?? 'ℹ️'}</span>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-medium block">{n.title}</span>
                {n.body && <span className="text-[11px] text-muted-foreground line-clamp-2 block">{n.body}</span>}
                <span className="text-[10px] text-muted-foreground mt-0.5 block">{relativeTime(n.created_at)}</span>
              </div>
              {!n.read && <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1" />}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function Layout() {
  const { leftOpen } = useSidebarStore()
  const { pathname } = useLocation()

  const showRight = pathname === '/' || pathname.startsWith('/c/')

  return (
    <div className="min-h-screen bg-background">
      <TopBar />

      <div className="flex">
        {/* Left sidebar – desktop */}
        <aside
          className={cn(
            'sticky top-12 hidden h-[calc(100vh-3rem)] shrink-0 border-r bg-background transition-all duration-200 md:block',
            leftOpen ? 'w-60' : 'w-0 overflow-hidden border-r-0',
          )}
        >
          <LeftSidebar />
        </aside>

        {/* Main content */}
        <main className="min-w-0 flex-1 pb-16">
          <div className="mx-auto max-w-3xl px-4 py-4">
            <Outlet />
          </div>
        </main>

        {/* Right sidebar */}
        {showRight && (
          <aside className="sticky top-12 hidden h-[calc(100vh-3rem)] w-72 shrink-0 border-l bg-background lg:block">
            <RightSidebar />
          </aside>
        )}
      </div>

      <OnboardingBar />
      <DevAuthToolbar />
    </div>
  )
}
