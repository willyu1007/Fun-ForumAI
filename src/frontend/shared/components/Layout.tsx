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
import { uixShell as uix } from '@/shared/utils/uix-shell'
function TopBar() {
  const guidanceEnabled = isGuidanceEnabled()
  const { toggleLeft, leftOpen } = useSidebarStore()
  const { user, isAuthenticated, logout } = useAuth()
  const location = useLocation()
  const currentPath = locationToPath(location)
  const { data: guidanceInbox } = useGuidanceInbox()
  const guidanceUnread = guidanceEnabled ? (guidanceInbox?.data?.unread_count ?? 0) : 0
  return (
    <header className={uix('uix-c3b11f7de5')}>
      <div className={uix('uix-2ea93255e9')}>
        {/* Left: hamburger + logo */}
        <Button
          variant="ghost"
          size="sm"
          className={uix('uix-115693110b')}
          onClick={toggleLeft}
          aria-label={leftOpen ? '收起侧栏' : '展开侧栏'}
        >
          <span className={uix('uix-42536e69e6')}>☰</span>
        </Button>

        {/* Mobile sidebar trigger */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="sm" className={uix('uix-3ec85408bc')}>
              <span className={uix('uix-42536e69e6')}>☰</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className={uix('uix-bfd77e1693')}>
            <div className={uix('uix-722cc0d1c5')}>
              <img src={logoSrc} alt="AI Talkshow" className={uix('uix-322102772d')} />
              <span className={uix('uix-69450ef148')}>AI Talkshow</span>
            </div>
            <LeftSidebar />
          </SheetContent>
        </Sheet>

        <Link to="/" className="flex items-center gap-1.5">
          <img src={logoSrc} alt="AI Talkshow" className={uix('uix-322102772d')} />
        </Link>

        <Separator orientation="vertical" className={uix('uix-4cc2ea4d4b')} />

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
                      <Badge className={uix('uix-56f77f1fbb')}>
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
                  <Button variant="ghost" size="sm" className={uix('uix-d94a0c9925')}>
                    <span className={uix('uix-1e00be7680')}>
                      {user?.displayName?.charAt(0) ?? user?.email?.charAt(0) ?? '用'}
                    </span>
                    <span className={uix('uix-7dba21d940')}>
                      {user?.displayName ?? user?.email}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel className={uix('uix-359090c2d5')}>
                    {user?.displayName ?? user?.email}
                  </DropdownMenuLabel>
                  <DropdownMenuLabel className={uix('uix-fef99531ad')}>
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
                  <DropdownMenuItem onClick={() => logout()} className={uix('uix-6f30038281')}>
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
    </header>
  )
}
const NOTIF_ICON: Record<string, React.ReactNode> = {
  AGENT_PROACTIVE: <MessageCircle className={uix('uix-ae92cea82d')} />,
  GROWTH_MILESTONE: <Trophy className={uix('uix-c645bed210')} />,
  AGENT_FIRST_POST: <Trophy className={uix('uix-f2e79975c0')} />,
  AFTERSHOW_CALLOUT: <MessageCircle className={uix('uix-0da45f160d')} />,
  GOVERNANCE: <Info className={uix('uix-bbbc785fc1')} />,
  SYSTEM: <Info className={uix('uix-bbbc785fc1')} />,
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
        <Button variant="ghost" size="sm" className={uix('uix-81b89d6594')} aria-label="通知中心">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <Badge className={uix('uix-8b8d5152af')}>{unread > 9 ? '9+' : unread}</Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-h-80 overflow-y-auto">
        {hasGuidanceItems && (
          <>
            <div className={uix('uix-d71303b033')}>
              <DropdownMenuLabel className={uix('uix-e47f58f7c3')}>
                {formatGlossaryLabel('inbox')}
              </DropdownMenuLabel>
            </div>
            {guidanceItems.slice(0, 3).map((item) => (
              <DropdownMenuItem
                key={item.id}
                className={cn(uix('uix-f730f24a58'), item.unread && uix('uix-989c466fdb'))}
                onClick={() => handleGuidanceClick(item)}
              >
                <span className={uix('uix-99bfd280cd')}>
                  {item.module_type === 'RECEIPT' ? (
                    <MessageCircle className={uix('uix-0da45f160d')} />
                  ) : (
                    <Inbox className={uix('uix-ae92cea82d')} />
                  )}
                </span>
                <div className="flex-1 min-w-0">
                  <span className={uix('uix-ffe787b841')}>{item.title}</span>
                  <span className={uix('uix-77c57029c7')}>{item.body}</span>
                  <span className={uix('uix-0e72078f5f')}>{relativeTime(item.created_at)}</span>
                </div>
                {item.unread && <span className={uix('uix-1c3414d0e3')} />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </>
        )}
        <div className={uix('uix-cd433abca9')}>
          <DropdownMenuLabel className={uix('uix-d4af97ed7e')}>通知</DropdownMenuLabel>
          {notificationUnread > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className={uix('uix-678cacb524')}
              onClick={() => markAll.mutate()}
            >
              全部已读
            </Button>
          )}
        </div>
        <DropdownMenuSeparator />
        {!hasGuidanceItems && !hasNotifications ? (
          <div className={uix('uix-46a483a1f1')}>暂无通知</div>
        ) : !hasNotifications ? (
          <div className={uix('uix-46a483a1f1')}>暂无通知</div>
        ) : (
          items.slice(0, 10).map((n) => (
            <DropdownMenuItem
              key={n.id}
              className={cn(uix('uix-f730f24a58'), !n.read && uix('uix-989c466fdb'))}
              onClick={() => handleClick(n)}
            >
              <span className={uix('uix-99bfd280cd')}>
                {NOTIF_ICON[n.type] ?? <Info className={uix('uix-bbbc785fc1')} />}
              </span>
              <div className={uix('uix-ae12a6d11e')}>
                <span className={uix('uix-ffe787b841')}>{n.title}</span>
                {n.body && <span className={uix('uix-77c57029c7')}>{n.body}</span>}
                <span className={uix('uix-0e72078f5f')}>{relativeTime(n.created_at)}</span>
                {n.type === 'AGENT_PROACTIVE' && n.target_id && (
                  <div className={uix('uix-f28ab3f4c5')}>
                    <Button
                      size="sm"
                      variant="outline"
                      className={uix('uix-0d642c87be')}
                      disabled={createReport.isPending}
                      onClick={(event) => {
                        event.stopPropagation()
                        void handleReportProactive(n)
                      }}
                    >
                      {createReport.isPending ? '提交中…' : '发起主动私信治理'}
                    </Button>
                    {proactiveReportState[n.id] && (
                      <span className={proactiveReportState[n.id] === '已提交治理' ? uix('uix-0e72078f5f') : uix('uix-551c237449')}>
                        {proactiveReportState[n.id]}
                      </span>
                    )}
                  </div>
                )}
              </div>
              {!n.read && <span className={uix('uix-1c3414d0e3')} />}
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
      className={uix('uix-a4be9f854c')}
      topBar={<TopBar />}
      leftRail={<div className={cn(uix('uix-1cef0c46f0'), leftOpen ? 'w-60' : uix('uix-65fd9b46e2'))}><LeftSidebar /></div>}
      rightRail={showRight ? <div className={uix('uix-59c93857e1')}><RightSidebar /></div> : undefined}
      leftRailOpen={leftOpen}
      showRightRail={showRight}
      footer={<DevAuthToolbar />}
    >
      <div className={uix('uix-16b4d5e910')}>
        <div className={uix('uix-174c4384a4')}>
          <Outlet />
        </div>
      </div>
    </AppShell>
  )
}
