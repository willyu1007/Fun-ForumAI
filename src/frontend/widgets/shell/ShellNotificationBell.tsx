import { useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  useGuidanceBell,
  useGuidanceClientEvent,
  useGuidanceItemAction,
} from '@/api/hooks/guidance'
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '@/api/hooks/notifications'
import { isGuidanceBellEnabled } from '@/features/guidance/feature-flags'
import { relativeTime } from '@/shared/utils/relative-time'
import { Bell, Inbox, Info, MessageCircle, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Notification as NotificationItem } from '@/api/types'
import { ShellIconHint } from './ShellIconHint'
import { TopBarCountBadge } from './TopBarCountBadge'
import { topBarIconTriggerClassName } from './top-bar-icon-trigger'

type BellFilter = 'unread' | 'all'
type BellSurface = 'notifications' | 'guidance'

const NOTIF_ICON: Record<string, React.ReactNode> = {
  AGENT_PROACTIVE: <MessageCircle className="h-4 w-4 text-primary" />,
  GROWTH_MILESTONE: <Trophy className="h-4 w-4 text-accent" />,
  AGENT_FIRST_POST: <Trophy className="h-4 w-4 text-success" />,
  AFTERSHOW_CALLOUT: <MessageCircle className="h-4 w-4 text-success" />,
  GOVERNANCE: <Info className="h-4 w-4 text-muted-foreground" />,
  SYSTEM: <Info className="h-4 w-4 text-muted-foreground" />,
}

const NOTIF_PRIORITY: Record<string, number> = {
  GOVERNANCE: 0,
  GROWTH_MILESTONE: 1,
  AGENT_FIRST_POST: 1,
  AFTERSHOW_CALLOUT: 2,
  SYSTEM: 3,
  AGENT_PROACTIVE: 4,
}

const NOTIF_TYPE_LABEL: Record<string, string> = {
  AGENT_PROACTIVE: '主动私信提醒',
  GROWTH_MILESTONE: '成长里程碑',
  AGENT_FIRST_POST: '首帖发布',
  AFTERSHOW_CALLOUT: 'Aftershow 提醒',
  GOVERNANCE: '治理提醒',
  SYSTEM: '系统通知',
}

function compareNotifications(left: NotificationItem, right: NotificationItem) {
  if (left.read !== right.read) {
    return left.read ? 1 : -1
  }

  const leftPriority = NOTIF_PRIORITY[left.type] ?? 3
  const rightPriority = NOTIF_PRIORITY[right.type] ?? 3
  if (leftPriority !== rightPriority) {
    return leftPriority - rightPriority
  }

  return new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
}

function notifTargetUrl(notification: {
  type: string
  target_type: string | null
  target_id: string | null
}): string | null {
  const normalizedTargetType = notification.target_type?.toUpperCase() ?? null

  if (!notification.target_id) {
    return null
  }
  if (
    notification.type === 'AFTERSHOW_CALLOUT' ||
    normalizedTargetType === 'AFTERSHOW_CALLOUT'
  ) {
    const [postId, aftershowId, calloutIndex] = notification.target_id.split(':')
    if (!postId) {
      return null
    }
    const params = new URLSearchParams()
    if (aftershowId) {
      params.set('aftershow_id', aftershowId)
    }
    if (calloutIndex) {
      params.set('callout_index', calloutIndex)
    }
    const query = params.toString()
    return query ? `/posts/${postId}?${query}` : `/posts/${postId}`
  }
  if (notification.type === 'AGENT_PROACTIVE') {
    return `/agents/${notification.target_id}/chat`
  }
  if (normalizedTargetType === 'POST') {
    return `/posts/${notification.target_id}`
  }
  if (normalizedTargetType === 'AGENT') {
    return `/agents/${notification.target_id}`
  }
  return null
}

export function ShellNotificationBell() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [surface, setSurface] = useState<BellSurface>('notifications')
  const [filter, setFilter] = useState<BellFilter>('unread')
  const [isMarkingGuidanceAll, setIsMarkingGuidanceAll] = useState(false)
  const guidanceBellEnabled = isGuidanceBellEnabled()
  const { data: allNotifications } = useNotifications()
  const { data: unreadNotifications } = useNotifications({ read: false })
  const { data: guidanceBell } = useGuidanceBell()
  const guidanceClientEvent = useGuidanceClientEvent()
  const guidanceItemAction = useGuidanceItemAction()
  const markAll = useMarkAllNotificationsRead()
  const markRead = useMarkNotificationRead()
  const notificationUnread =
    unreadNotifications?.data?.unread_count ?? allNotifications?.data?.unread_count ?? 0
  const notificationItems =
    filter === 'unread'
      ? (unreadNotifications?.data?.items ?? [])
      : (allNotifications?.data?.items ?? [])
  const guidanceItems = guidanceBellEnabled ? (guidanceBell?.data?.items ?? []) : []
  const guidanceUnread = guidanceBellEnabled
    ? (guidanceBell?.data?.unread_count ?? 0)
    : 0
  const unread = guidanceUnread + notificationUnread

  const visibleGuidanceItems = [...guidanceItems]
    .filter((item) => filter === 'all' || item.unread)
    .sort((left, right) =>
      Number(right.unread) - Number(left.unread)
      || new Date(right.created_at).getTime() - new Date(left.created_at).getTime())

  const visibleNotifications = [...notificationItems].sort(compareNotifications)
  const hasVisibleGuidanceItems = visibleGuidanceItems.length > 0
  const hasVisibleNotifications = visibleNotifications.length > 0
  const activeUnread = surface === 'guidance' ? guidanceUnread : notificationUnread
  const hasVisibleItems = surface === 'guidance'
    ? hasVisibleGuidanceItems
    : hasVisibleNotifications

  const resetBellView = () => {
    setFilter('unread')
    setSurface(guidanceBellEnabled && guidanceUnread > 0 ? 'guidance' : 'notifications')
  }

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) {
      return
    }
    resetBellView()
  }

  const handleClick = (notification: {
    id: string
    read: boolean
    type: string
    target_type: string | null
    target_id: string | null
  }) => {
    if (!notification.read) {
      markRead.mutate(notification.id)
    }
    const url = notifTargetUrl(notification)
    if (url) {
      setOpen(false)
      navigate(url)
    }
  }

  const handleGuidanceClick = (item: {
    id: string
    unread: boolean
    reason_code: string
    title: string
    body: string
    cta: { target: string } | null
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
      setOpen(false)
      navigate(item.cta.target)
    }
  }

  const handleRowKeyDown = (
    event: KeyboardEvent<HTMLDivElement>,
    callback: () => void,
  ) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      callback()
    }
  }

  const handleMarkCurrentSurfaceRead = async () => {
    if (surface === 'notifications') {
      markAll.mutate()
      return
    }
    const unreadGuidanceItems = guidanceItems.filter((item) => item.unread)
    if (unreadGuidanceItems.length === 0) {
      return
    }
    setIsMarkingGuidanceAll(true)
    try {
      await Promise.all(
        unreadGuidanceItems.map((item) =>
          guidanceItemAction.mutateAsync({
            item_id: item.id,
            action: 'open',
          }),
        ),
      )
    } finally {
      setIsMarkingGuidanceAll(false)
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <ShellIconHint label="通知中心">
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(topBarIconTriggerClassName, 'relative size-9')}
            aria-label="通知中心"
            title="通知中心"
            onClick={() => {
              if (!open) {
                resetBellView()
              }
            }}
          >
            <Bell className="h-[18px] w-[18px]" />
            {unread > 0 && (
              <TopBarCountBadge value={unread > 9 ? '9+' : String(unread)} />
            )}
          </button>
        </DropdownMenuTrigger>
      </ShellIconHint>
      <DropdownMenuContent align="end" className="w-[24rem] overflow-hidden rounded-3xl border border-border/70 p-0 shadow-xl">
        <div className="border-b border-border/70 px-5 py-3.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <button
                type="button"
                aria-label={`通知，${notificationUnread} 条未读`}
                aria-pressed={surface === 'notifications'}
                className={cn(
                  'inline-flex items-center gap-1.5 border-b-2 pb-1 text-[14px] font-semibold leading-none transition-colors',
                  surface === 'notifications'
                    ? 'border-foreground text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
                onClick={() => setSurface('notifications')}
              >
                <span>通知</span>
                <span className={cn(
                  'text-[10px] font-medium leading-none',
                  surface === 'notifications' ? 'text-foreground/70' : 'text-muted-foreground',
                )}
                >
                  {notificationUnread}
                </span>
              </button>
              {guidanceBellEnabled && (
                <button
                  type="button"
                  aria-label={`引导，${guidanceUnread} 条未读`}
                  aria-pressed={surface === 'guidance'}
                  className={cn(
                    'inline-flex items-center gap-1.5 border-b-2 pb-1 text-[14px] font-semibold leading-none transition-colors',
                    surface === 'guidance'
                      ? 'border-foreground text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground',
                  )}
                  onClick={() => setSurface('guidance')}
                >
                  <span>引导</span>
                  <span className={cn(
                    'text-[10px] font-medium leading-none',
                    surface === 'guidance' ? 'text-foreground/70' : 'text-muted-foreground',
                  )}
                  >
                    {guidanceUnread}
                  </span>
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center rounded-2xl bg-muted/55 p-0.5">
                <button
                  type="button"
                  className={cn(
                    'h-7 min-w-[3.25rem] rounded-[1rem] px-3 text-[11px] font-medium transition-colors',
                    filter === 'all'
                      ? 'bg-foreground text-background'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                  onClick={() => setFilter('all')}
                >
                  全部
                </button>
                <button
                  type="button"
                  className={cn(
                    'h-7 min-w-[3.25rem] rounded-[1rem] px-3 text-[11px] font-medium transition-colors',
                    filter === 'unread'
                      ? 'bg-foreground text-background'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                  onClick={() => setFilter('unread')}
                >
                  未读
                </button>
              </div>
              {activeUnread > 0 && (
                <button
                  type="button"
                  className="text-[11px] font-medium leading-tight text-muted-foreground transition-colors hover:text-foreground"
                  onClick={() => void handleMarkCurrentSurfaceRead()}
                  disabled={markAll.isPending || isMarkingGuidanceAll}
                >
                  一键已读
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="max-h-[26rem] overflow-y-auto pb-2">
          {surface === 'guidance' && hasVisibleGuidanceItems && (
            <>
              {visibleGuidanceItems.map((item) => (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  className={cn(
                    'flex cursor-pointer items-start gap-3 px-5 py-3 outline-none transition-colors hover:bg-muted/30 focus-visible:bg-muted/30',
                  )}
                  onClick={() => handleGuidanceClick(item)}
                  onKeyDown={(event) => handleRowKeyDown(event, () => handleGuidanceClick(item))}
                >
                  <ShellIconHint label={item.module_type === 'RECEIPT' ? '引导回执' : '引导提醒'}>
                    <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center">
                      {item.module_type === 'RECEIPT' ? (
                        <MessageCircle className="h-4 w-4 text-success" />
                      ) : (
                        <Inbox className="h-4 w-4 text-primary" />
                      )}
                    </span>
                  </ShellIconHint>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <span className="line-clamp-1 text-[12px] font-semibold leading-5 text-foreground">
                        {item.title}
                      </span>
                      <div className="flex shrink-0 items-center gap-2 pt-0.5">
                        <span className="text-[10px] leading-none text-muted-foreground">
                          {relativeTime(item.created_at)}
                        </span>
                        {item.unread && <span className="h-2 w-2 rounded-full bg-accent" />}
                      </div>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-[11px] leading-[1.35] text-muted-foreground">
                      {item.body}
                    </p>
                  </div>
                </div>
              ))}
            </>
          )}
          {surface === 'notifications' && hasVisibleNotifications && (
            <>
              {visibleNotifications.map((notification) => (
                <div
                  key={notification.id}
                  role="button"
                  tabIndex={0}
                  className={cn(
                    'flex cursor-pointer items-start gap-3 px-5 py-3 outline-none transition-colors hover:bg-muted/30 focus-visible:bg-muted/30',
                  )}
                  onClick={() => handleClick(notification)}
                  onKeyDown={(event) => handleRowKeyDown(event, () => handleClick(notification))}
                >
                  <ShellIconHint label={NOTIF_TYPE_LABEL[notification.type] ?? '通知'}>
                    <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center">
                      {NOTIF_ICON[notification.type] ?? (
                        <Info className="h-4 w-4 text-muted-foreground" />
                      )}
                    </span>
                  </ShellIconHint>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <span className="line-clamp-1 text-[12px] font-semibold leading-5 text-foreground">
                        {notification.title}
                      </span>
                      <div className="flex shrink-0 items-center gap-2 pt-0.5">
                        <span className="text-[10px] leading-none text-muted-foreground">
                          {relativeTime(notification.created_at)}
                        </span>
                        {!notification.read && (
                          <span className="h-2 w-2 rounded-full bg-accent" />
                        )}
                      </div>
                    </div>
                    {notification.body && (
                      <p className="mt-0.5 line-clamp-2 text-[11px] leading-[1.35] text-muted-foreground">
                        {notification.body}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
          {!hasVisibleItems && (
            <div className="px-5 py-8 text-center text-[11px] text-muted-foreground">
              {surface === 'guidance'
                ? (filter === 'unread' ? '未读引导已处理完。' : '暂无引导。')
                : (filter === 'unread' ? '未读通知已处理完。' : '暂无通知。')}
            </div>
          )}
        </div>
        <div className="h-4 border-t border-border/70 bg-muted/25" />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
