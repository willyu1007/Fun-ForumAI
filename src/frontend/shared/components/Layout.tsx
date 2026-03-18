import { useState } from 'react'
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
import { DevAuthToolbar } from './DevAuthToolbar'
import { LeftSidebar } from './LeftSidebar'
import { RightSidebar } from './RightSidebar'
import { useAuth } from '@/shared/hooks/use-auth'
import { useSidebarStore } from '@/shared/stores/sidebar-store'
import {
  useGuidanceBell,
  useGuidanceClientEvent,
  useGuidanceInbox,
  useGuidanceItemAction,
  useCreateReport,
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '@/api/hooks'
import { isGuidanceBellEnabled, isGuidanceEnabled } from '@/features/guidance/feature-flags'
import { Bell, MessageCircle, Trophy, Info, Inbox } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AppShell } from '@fun-forum/ui-web/shell'
import { relativeTime } from '@/shared/utils/relative-time'
import { buildAuthRedirectState, locationToPath } from '@/shared/utils/auth-redirect'
import { formatGlossaryLabel } from '@/shared/utils/public-ui-glossary'
import logoSrc from '@/assets/logo.png'
function TopBar() {
  const guidanceEnabled = isGuidanceEnabled()
  const { toggleLeft, leftOpen } = useSidebarStore()
  const { user, isAuthenticated, logout } = useAuth()
  const location = useLocation()
  const currentPath = locationToPath(location)
  const { data: guidanceInbox } = useGuidanceInbox()
  const guidanceUnread = guidanceEnabled ? (guidanceInbox?.data?.unread_count ?? 0) : 0
  return (
    <div className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
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
              <img src={logoSrc} alt="AI Talkshow" className="h-7 w-7 rounded-lg" />
              <span className="font-bold">AI Talkshow</span>
            </div>
            <LeftSidebar />
          </SheetContent>
        </Sheet>

        <Link to="/" className="flex items-center gap-1.5">
          <img src={logoSrc} alt="AI Talkshow" className="h-7 w-7 rounded-lg" />
        </Link>

        <Separator orientation="vertical" className="mx-1 h-5" />

        {/* Center: spacer */}
        <div className="flex-1" />

        {/* Right: auth-dependent */}
        <div className="flex items-center gap-2">
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
                    <Inbox className="h-4 w-4" />
                    <span>{formatGlossaryLabel('inbox')}</span>
                    {guidanceUnread > 0 && (
                      <Badge className="ml-1 h-4 min-w-4 rounded-full px-1 text-[10px]">
                        {guidanceUnread > 9 ? '9+' : guidanceUnread}
                      </Badge>
                    )}
                  </Link>
                </Button>
              )}
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
                  <DropdownMenuItem onClick={() => logout()} className="text-destructive focus:text-destructive">
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
        </div>
      </div>
    </div>
  )
}
const NOTIF_ICON: Record<string, React.ReactNode> = {
  AGENT_PROACTIVE: <MessageCircle className="h-4 w-4 text-primary" />,
  GROWTH_MILESTONE: <Trophy className="h-4 w-4 text-amber-500" />,
  AGENT_FIRST_POST: <Trophy className="h-4 w-4 text-emerald-500" />,
  AFTERSHOW_CALLOUT: <MessageCircle className="h-4 w-4 text-emerald-600" />,
  GOVERNANCE: <Info className="h-4 w-4 text-muted-foreground" />,
  SYSTEM: <Info className="h-4 w-4 text-muted-foreground" />,
}
function notifTargetUrl(n: {
  type: string
  target_type: string | null
  target_id: string | null
}): string | null {
  if (!n.target_id) return null
  if (n.type === 'AFTERSHOW_CALLOUT' || n.target_type === 'AFTERSHOW_CALLOUT') {
    const [postId, aftershowId, calloutIndex] = n.target_id.split(':')
    if (!postId) return null
    const params = new URLSearchParams()
    if (aftershowId) params.set('aftershow_id', aftershowId)
    if (calloutIndex) params.set('callout_index', calloutIndex)
    const query = params.toString()
    return query ? `/posts/${postId}?${query}` : `/posts/${postId}`
  }
  if (n.type === 'AGENT_PROACTIVE') return `/agents/${n.target_id}/chat`
  if (n.target_type === 'POST') return `/posts/${n.target_id}`
  if (n.target_type === 'AGENT') return `/agents/${n.target_id}`
  return null
}
function NotificationBell() {
  const navigate = useNavigate()
  const [proactiveReportState, setProactiveReportState] = useState<Record<string, string>>({})
  const guidanceBellEnabled = isGuidanceBellEnabled()
  const { data } = useNotifications()
  const { data: guidanceBell } = useGuidanceBell()
  const guidanceClientEvent = useGuidanceClientEvent()
  const guidanceItemAction = useGuidanceItemAction()
  const createReport = useCreateReport()
  const markRead = useMarkNotificationRead()
  const markAll = useMarkAllNotificationsRead()
  const notificationUnread = data?.data?.unread_count ?? 0
  const items = data?.data?.items ?? []
  const guidanceItems = guidanceBellEnabled ? (guidanceBell?.data?.items ?? []) : []
  const guidanceUnread = guidanceBellEnabled ? (guidanceBell?.data?.unread_count ?? 0) : 0
  const unread = guidanceUnread + notificationUnread
  const handleClick = (n: {
    id: string
    read: boolean
    type: string
    target_type: string | null
    target_id: string | null
  }) => {
    if (!n.read) markRead.mutate(n.id)
    const url = notifTargetUrl(n)
    if (url) navigate(url)
  }
  const handleReportProactive = async (n: {
    id: string
    target_type: string | null
    target_id: string | null
  }) => {
    if (!n.target_id) return
    setProactiveReportState((current) => ({
      ...current,
      [n.id]: '',
    }))
    try {
      await createReport.mutateAsync({
        target_type: n.target_type === 'private_session' ? 'private_session' : 'agent',
        target_id: n.target_id,
        complaint_type: 'HARASSMENT_REPORT',
        reason_code: 'proactive_outreach_report',
        detail_text: `Reported from AGENT_PROACTIVE notification: ${n.id}`,
      })
      setProactiveReportState((current) => ({
        ...current,
        [n.id]: '已提交治理',
      }))
    } catch (error) {
      setProactiveReportState((current) => ({
        ...current,
        [n.id]: error instanceof Error ? error.message : '提交治理失败',
      }))
    }
  }
  const handleGuidanceClick = (item: {
    id: string
    unread: boolean
    reason_code: string
    title: string
    body: string
    cta: {
      target: string
    } | null
    created_at: string
    updated_at: string
  }) => {
    guidanceClientEvent.mutate({
      event_type: 'GUIDANCE_BELL_OPENED',
      payload: {
        item_id: item.id,
        reason_code: item.reason_code,
      },
      dedup_key: `guidance_bell_opened:${item.id}:${item.updated_at}`,
    })
    if (item.unread) {
      guidanceItemAction.mutate({ item_id: item.id, action: 'open' })
    }
    if (item.cta?.target) {
      navigate(item.cta.target)
    }
  }
  const hasGuidanceItems = guidanceItems.length > 0
  const hasNotifications = items.length > 0
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="relative h-8 w-8 p-0" aria-label="通知中心">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <Badge className="absolute -right-1 -top-1 h-4 min-w-4 rounded-full px-1 text-[10px]">{unread > 9 ? '9+' : unread}</Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-h-80 overflow-y-auto">
        {hasGuidanceItems && (
          <>
            <div className="px-2 py-1.5">
              <DropdownMenuLabel className="p-0 text-xs">
                {formatGlossaryLabel('inbox')}
              </DropdownMenuLabel>
            </div>
            {guidanceItems.slice(0, 3).map((item) => (
              <DropdownMenuItem
                key={item.id}
                className={cn('flex cursor-pointer items-start gap-2 py-2', item.unread && 'bg-primary/5')}
                onClick={() => handleGuidanceClick(item)}
              >
                <span className="mt-0.5 shrink-0">
                  {item.module_type === 'RECEIPT' ? (
                    <MessageCircle className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Inbox className="h-4 w-4 text-primary" />
                  )}
                </span>
                <div className="flex-1 min-w-0">
                  <span className="block text-xs font-medium">{item.title}</span>
                  <span className="block line-clamp-2 text-[11px] text-muted-foreground">{item.body}</span>
                  <span className="mt-0.5 block text-[10px] text-muted-foreground">{relativeTime(item.created_at)}</span>
                </div>
                {item.unread && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </>
        )}
        <div className="flex items-center justify-between px-2 py-1.5">
          <DropdownMenuLabel className="p-0 text-xs">通知</DropdownMenuLabel>
          {notificationUnread > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto px-1 py-0.5 text-[10px]"
              onClick={() => markAll.mutate()}
            >
              全部已读
            </Button>
          )}
        </div>
        <DropdownMenuSeparator />
        {!hasGuidanceItems && !hasNotifications ? (
          <div className="px-2 py-4 text-center text-xs text-muted-foreground">暂无通知</div>
        ) : !hasNotifications ? (
          <div className="px-2 py-4 text-center text-xs text-muted-foreground">暂无通知</div>
        ) : (
          items.slice(0, 10).map((n) => (
            <DropdownMenuItem
              key={n.id}
              className={cn('flex cursor-pointer items-start gap-2 py-2', !n.read && 'bg-primary/5')}
              onClick={() => handleClick(n)}
            >
              <span className="mt-0.5 shrink-0">
                {NOTIF_ICON[n.type] ?? <Info className="h-4 w-4 text-muted-foreground" />}
              </span>
              <div className="min-w-0 flex-1">
                <span className="block text-xs font-medium">{n.title}</span>
                {n.body && <span className="block line-clamp-2 text-[11px] text-muted-foreground">{n.body}</span>}
                <span className="mt-0.5 block text-[10px] text-muted-foreground">{relativeTime(n.created_at)}</span>
                {n.type === 'AGENT_PROACTIVE' && n.target_id && (
                  <div className="mt-1 flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 shrink-0 px-2 text-xs"
                      disabled={createReport.isPending}
                      onClick={(event) => {
                        event.stopPropagation()
                        void handleReportProactive(n)
                      }}
                    >
                      {createReport.isPending ? '提交中…' : '发起主动私信治理'}
                    </Button>
                    {proactiveReportState[n.id] && (
                      <span className={proactiveReportState[n.id] === '已提交治理'
                        ? 'mt-0.5 block text-[10px] text-muted-foreground'
                        : 'text-xs text-destructive'}
                      >
                        {proactiveReportState[n.id]}
                      </span>
                    )}
                  </div>
                )}
              </div>
              {!n.read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />}
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
    <AppShell
      className="min-h-screen bg-background"
      topBar={<TopBar />}
      leftRail={(
        <div
          className={cn(
            'sticky top-12 hidden h-[calc(100vh-3rem)] shrink-0 border-r bg-background transition-all duration-200 md:block',
            leftOpen ? 'w-60' : 'w-0 overflow-hidden border-r-0',
          )}
        >
          <LeftSidebar />
        </div>
      )}
      rightRail={showRight ? <div className="sticky top-12 hidden h-[calc(100vh-3rem)] w-72 shrink-0 border-l bg-background lg:block"><RightSidebar /></div> : undefined}
      leftRailOpen={leftOpen}
      showRightRail={showRight}
      footer={<DevAuthToolbar />}
    >
      <div className="min-w-0 flex-1 pb-16">
        <div className="mx-auto max-w-3xl px-4 py-4">
          <Outlet />
        </div>
      </div>
    </AppShell>
  )
}
