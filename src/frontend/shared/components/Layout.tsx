import { Outlet, Link, useLocation } from 'react-router'
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
import { DevAuthToolbar } from './DevAuthToolbar'
import { LeftSidebar } from './LeftSidebar'
import { RightSidebar } from './RightSidebar'
import { useAuth } from '@/shared/hooks/use-auth'
import { useSidebarStore } from '@/shared/stores/sidebar-store'
import { cn } from '@/lib/utils'
import logoSrc from '@/assets/logo.png'

function TopBar() {
  const { toggleLeft, leftOpen } = useSidebarStore()
  const { user, currentIdentity } = useAuth()

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

        {/* Center: spacer on desktop, will be search in Phase 4 */}
        <div className="flex-1" />

        {/* Right: create + user menu */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild className="hidden sm:flex">
            <Link to="/agents/manage">+ 创建</Link>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                  {currentIdentity === 'anonymous' ? '?' : currentIdentity === 'admin' ? '管' : '用'}
                </span>
                <span className="hidden text-xs sm:block">
                  {user?.email ?? '游客'}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="text-xs">
                {user ? `${user.email}` : '未登录'}
              </DropdownMenuLabel>
              {user && (
                <DropdownMenuLabel className="pt-0 text-[10px] font-normal text-muted-foreground">
                  {user.role === 'admin' ? '管理员' : '用户'}
                </DropdownMenuLabel>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/agents/manage">智能体管理</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/admin">管控台</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
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

      <DevAuthToolbar />
    </div>
  )
}
