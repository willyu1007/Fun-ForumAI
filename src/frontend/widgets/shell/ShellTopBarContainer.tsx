import type { UserProfile } from '@/api/auth'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { useAuth } from '@/shared/hooks/use-auth'
import { buildAuthRedirectState, locationToPath } from '@/shared/utils/auth-redirect'
import { Link, useLocation } from 'react-router'
import { Search } from 'lucide-react'
import { AgentPanelWidget } from './AgentPanelWidget'
import { ActivityPanelWidget } from './ActivityPanelWidget'
import { ShellFeedChromeControls } from './ShellFeedChromeControls'
import { ShellIconHint } from './ShellIconHint'
import { ShellLeftRail } from './ShellLeftRail'
import { ShellNotificationBell } from './ShellNotificationBell'
import { ShellTopBar } from './ShellTopBar'
import { topBarIconTriggerClassName } from './top-bar-icon-trigger'
import { getInitials } from '@/shared/utils/get-initials'

interface ShellTopBarContainerProps {
  leftOpen: boolean
  onToggleLeft: () => void
}

function getUserAvatarFallback(user: UserProfile) {
  const source = user.displayName?.trim() || user.email.split('@')[0] || 'U'
  const parts = source.split(/[\s_-]+/).filter(Boolean)
  if (parts.length >= 2) {
    return getInitials(parts.slice(0, 2).join(' '))
  }
  return (Array.from(source)[0] ?? 'U').toUpperCase()
}

function ShellMobileMenu() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 md:hidden">
          <span className="text-lg">☰</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0">
        <div className="flex h-[52px] items-center border-b px-3">
          <span className="text-sm font-semibold uppercase tracking-[0.28em] text-foreground">
            AI TALKSHOW
          </span>
        </div>
        <ShellLeftRail />
      </SheetContent>
    </Sheet>
  )
}

function TopBarSearchEntry() {
  return (
    <div className="mx-auto flex w-full items-center justify-center gap-3.5">
      <Link
        to="/agents"
        aria-label="搜索入口"
        className="flex h-9 w-full max-w-[23rem] min-w-0 items-center gap-2 rounded-full border border-border/75 bg-muted/55 px-4 text-sm text-muted-foreground/75 transition-colors hover:bg-muted/70 hover:text-foreground lg:max-w-[25rem] xl:max-w-[27rem]"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="truncate">搜索智能体、社区、话题</span>
      </Link>
      <ShellFeedChromeControls />
    </div>
  )
}

function UserMenu({
  user,
  onLogout,
}: {
  user: UserProfile
  onLogout: () => void
}) {
  const avatarFallback = getUserAvatarFallback(user)

  return (
    <DropdownMenu>
      <ShellIconHint label="账户菜单">
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(topBarIconTriggerClassName, 'group size-10')}
            aria-label="账户菜单"
            title="账户菜单"
          >
            <Avatar className="size-9 border border-border/65 bg-muted/60 shadow-xs transition-colors group-hover:bg-muted/72 data-[state=open]:bg-muted/72">
              {user.avatarUrl ? (
                <AvatarImage src={user.avatarUrl} alt={user.displayName ?? user.email} className="object-cover" />
              ) : null}
              <AvatarFallback className="bg-muted/70 text-[11px] font-semibold text-foreground">
                {avatarFallback}
              </AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
      </ShellIconHint>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="text-xs">
          {user.displayName ?? user.email}
        </DropdownMenuLabel>
        <DropdownMenuLabel className="pt-0 text-[10px] font-normal text-muted-foreground">
          {user.role === 'admin' ? '管理员' : '用户'}
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
          onClick={onLogout}
          className="text-destructive focus:text-destructive"
        >
          退出登录
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function GuestAuthActions({ currentPath }: { currentPath: string }) {
  return (
    <>
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
  )
}

export function ShellTopBarContainer({
  leftOpen,
  onToggleLeft,
}: ShellTopBarContainerProps) {
  const { user, isAuthenticated, logout } = useAuth()
  const location = useLocation()
  const currentPath = locationToPath(location)

  const primaryActions = isAuthenticated && user ? (
    <div className="flex items-center gap-3 md:gap-3.5">
      <ActivityPanelWidget />
      <AgentPanelWidget />
      <ShellNotificationBell />
    </div>
  ) : null

  const accountArea = isAuthenticated && user ? (
    <div className="pl-1 md:pl-1.5">
      <UserMenu user={user} onLogout={() => void logout()} />
    </div>
  ) : (
    <GuestAuthActions currentPath={currentPath} />
  )

  return (
    <ShellTopBar
      leftOpen={leftOpen}
      onToggleLeft={onToggleLeft}
      mobileMenuTrigger={<ShellMobileMenu />}
      navigation={<TopBarSearchEntry />}
      primaryActions={primaryActions}
      accountArea={accountArea}
    />
  )
}
