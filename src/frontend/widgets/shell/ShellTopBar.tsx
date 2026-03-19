import { Link, useLocation } from 'react-router'
import { TopBar as UiTopBar } from '@fun-forum/ui-web/shell'
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
import { useAuth } from '@/shared/hooks/use-auth'
import { useSidebarStore } from '@/shared/stores/sidebar-store'
import { useGuidanceInbox } from '@/api/hooks/guidance'
import { isGuidanceEnabled } from '@/features/guidance/feature-flags'
import { buildAuthRedirectState, locationToPath } from '@/shared/utils/auth-redirect'
import { formatGlossaryLabel } from '@/shared/utils/public-ui-glossary'
import logoSrc from '@/assets/logo.png'
import { AgentPanelWidget } from './AgentPanelWidget'
import { ShellNotificationBell } from './ShellNotificationBell'
import { ShellLeftRail } from './ShellLeftRail'

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-1.5">
      <img src={logoSrc} alt="AI Talkshow" className="h-7 w-7 rounded-lg" />
    </Link>
  )
}

function MobileMenuTrigger() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 md:hidden">
          <span className="text-lg">☰</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0">
        <div className="flex h-12 items-center gap-2 border-b px-3">
          <img src={logoSrc} alt="AI Talkshow" className="h-7 w-7 rounded-lg" />
          <span className="font-bold">AI Talkshow</span>
        </div>
        <ShellLeftRail />
      </SheetContent>
    </Sheet>
  )
}

export function ShellTopBar() {
  const guidanceEnabled = isGuidanceEnabled()
  const { toggleLeft, leftOpen } = useSidebarStore()
  const { user, isAuthenticated, logout } = useAuth()
  const location = useLocation()
  const currentPath = locationToPath(location)
  const { data: guidanceInbox } = useGuidanceInbox()
  const guidanceUnread = guidanceEnabled ? (guidanceInbox?.data?.unread_count ?? 0) : 0

  return (
    <div className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <UiTopBar
        className="h-12 px-4"
        mobileMenuTrigger={<MobileMenuTrigger />}
        logo={
          <>
            <Button
              variant="ghost"
              size="sm"
              className="hidden h-8 w-8 p-0 md:flex"
              onClick={toggleLeft}
              aria-label={leftOpen ? '收起侧栏' : '展开侧栏'}
            >
              <span className="text-lg">☰</span>
            </Button>
            <Logo />
            <Separator orientation="vertical" className="mx-1 hidden h-5 md:block" />
          </>
        }
        actions={
          <>
            <Button variant="ghost" size="sm" asChild className="hidden sm:flex">
              <Link to="/help">帮助</Link>
            </Button>
            {isAuthenticated ? (
              <>
                <Button variant="ghost" size="sm" asChild className="hidden sm:flex">
                  <Link to="/agents/manage">+ 创建</Link>
                </Button>

                {guidanceEnabled && (
                  <Button variant="ghost" size="sm" asChild className="relative hidden sm:flex">
                    <Link to="/inbox">
                      <span>{formatGlossaryLabel('inbox')}</span>
                      {guidanceUnread > 0 && (
                        <Badge className="ml-1 h-4 min-w-4 rounded-full px-1 text-[10px]">
                          {guidanceUnread > 9 ? '9+' : guidanceUnread}
                        </Badge>
                      )}
                    </Link>
                  </Button>
                )}
                <AgentPanelWidget />
                <ShellNotificationBell />

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
                      <Link to="/agents">搜索智能体</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/agents/manage">智能体管理</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/safety">举报与申诉</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/help">规则与说明</Link>
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
                {guidanceEnabled && (
                  <Button variant="ghost" size="sm" asChild className="hidden sm:flex">
                    <Link to="/inbox">{formatGlossaryLabel('inbox')}</Link>
                  </Button>
                )}
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/login" state={buildAuthRedirectState(currentPath)}>
                    登录
                  </Link>
                </Button>
                <Button size="sm" asChild>
                  <Link to="/register" state={buildAuthRedirectState(currentPath)}>
                    注册
                  </Link>
                </Button>
              </>
            )}
          </>
        }
      />
    </div>
  )
}
