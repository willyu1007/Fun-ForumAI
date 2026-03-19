import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
import { useCreateReport } from '@/api/hooks/user'
import { isGuidanceBellEnabled } from '@/features/guidance/feature-flags'
import { relativeTime } from '@/shared/utils/relative-time'
import { formatGlossaryLabel } from '@/shared/utils/public-ui-glossary'
import { Bell, Inbox, Info, MessageCircle, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'

const NOTIF_ICON: Record<string, React.ReactNode> = {
  AGENT_PROACTIVE: <MessageCircle className="h-4 w-4 text-primary" />,
  GROWTH_MILESTONE: <Trophy className="h-4 w-4 text-warning" />,
  AGENT_FIRST_POST: <Trophy className="h-4 w-4 text-success" />,
  AFTERSHOW_CALLOUT: <MessageCircle className="h-4 w-4 text-success" />,
  GOVERNANCE: <Info className="h-4 w-4 text-muted-foreground" />,
  SYSTEM: <Info className="h-4 w-4 text-muted-foreground" />,
}

function notifTargetUrl(notification: {
  type: string
  target_type: string | null
  target_id: string | null
}): string | null {
  if (!notification.target_id) {
    return null
  }
  if (
    notification.type === 'AFTERSHOW_CALLOUT' ||
    notification.target_type === 'AFTERSHOW_CALLOUT'
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
  if (notification.target_type === 'POST') {
    return `/posts/${notification.target_id}`
  }
  if (notification.target_type === 'AGENT') {
    return `/agents/${notification.target_id}`
  }
  return null
}

export function ShellNotificationBell() {
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
  const guidanceUnread = guidanceBellEnabled
    ? (guidanceBell?.data?.unread_count ?? 0)
    : 0
  const unread = guidanceUnread + notificationUnread

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
      navigate(url)
    }
  }

  const handleReportProactive = async (notification: {
    id: string
    target_type: string | null
    target_id: string | null
  }) => {
    if (!notification.target_id) {
      return
    }
    setProactiveReportState((current) => ({
      ...current,
      [notification.id]: '',
    }))
    try {
      await createReport.mutateAsync({
        target_type:
          notification.target_type === 'private_session' ? 'private_session' : 'agent',
        target_id: notification.target_id,
        complaint_type: 'HARASSMENT_REPORT',
        reason_code: 'proactive_outreach_report',
        detail_text: `Reported from AGENT_PROACTIVE notification: ${notification.id}`,
      })
      setProactiveReportState((current) => ({
        ...current,
        [notification.id]: '已提交治理',
      }))
    } catch (error) {
      setProactiveReportState((current) => ({
        ...current,
        [notification.id]: error instanceof Error ? error.message : '提交治理失败',
      }))
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
            <Badge className="absolute -right-1 -top-1 h-4 min-w-4 rounded-full px-1 text-[10px]">
              {unread > 9 ? '9+' : unread}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-80 w-80 overflow-y-auto">
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
                className={cn(
                  'flex cursor-pointer items-start gap-2 py-2',
                  item.unread && 'bg-primary/5',
                )}
                onClick={() => handleGuidanceClick(item)}
              >
                <span className="mt-0.5 shrink-0">
                  {item.module_type === 'RECEIPT' ? (
                    <MessageCircle className="h-4 w-4 text-success" />
                  ) : (
                    <Inbox className="h-4 w-4 text-primary" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <span className="block text-xs font-medium">{item.title}</span>
                  <span className="block line-clamp-2 text-[11px] text-muted-foreground">
                    {item.body}
                  </span>
                  <span className="mt-0.5 block text-[10px] text-muted-foreground">
                    {relativeTime(item.created_at)}
                  </span>
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
          items.slice(0, 10).map((notification) => (
            <DropdownMenuItem
              key={notification.id}
              className={cn(
                'flex cursor-pointer items-start gap-2 py-2',
                !notification.read && 'bg-primary/5',
              )}
              onClick={() => handleClick(notification)}
            >
              <span className="mt-0.5 shrink-0">
                {NOTIF_ICON[notification.type] ?? (
                  <Info className="h-4 w-4 text-muted-foreground" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <span className="block text-xs font-medium">{notification.title}</span>
                {notification.body && (
                  <span className="block line-clamp-2 text-[11px] text-muted-foreground">
                    {notification.body}
                  </span>
                )}
                <span className="mt-0.5 block text-[10px] text-muted-foreground">
                  {relativeTime(notification.created_at)}
                </span>
                {notification.type === 'AGENT_PROACTIVE' && notification.target_id && (
                  <div className="mt-1 flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 shrink-0 px-2 text-xs"
                      disabled={createReport.isPending}
                      onClick={(event) => {
                        event.stopPropagation()
                        void handleReportProactive(notification)
                      }}
                    >
                      {createReport.isPending ? '提交中…' : '发起主动私信治理'}
                    </Button>
                    {proactiveReportState[notification.id] && (
                      <span
                        className={
                          proactiveReportState[notification.id] === '已提交治理'
                            ? 'mt-0.5 block text-[10px] text-muted-foreground'
                            : 'text-xs text-destructive'
                        }
                      >
                        {proactiveReportState[notification.id]}
                      </span>
                    )}
                  </div>
                )}
              </div>
              {!notification.read && (
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
              )}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
