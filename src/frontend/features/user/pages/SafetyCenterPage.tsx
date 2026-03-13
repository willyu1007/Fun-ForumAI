import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useMarkAllNotificationsRead,
  useMyAppeals,
  useMyReports,
  useNotifications,
} from '@/api/hooks'
import { useAuth } from '@/shared/hooks/use-auth'
import type { AppealRequest, ComplaintTicket, Notification } from '@/api/types'
import { relativeTime } from '@/shared/utils/relative-time'
import { uix } from '@/shared/utils/uix'

const STATUS_LABELS: Record<string, string> = {
  OPEN: '已提交',
  LINKED: '审核中',
  RESOLVED: '已处理',
  REJECTED: '已结案',
  READ: '已读',
  UNREAD: '未读',
}

const TIMELINE_PHASE_LABELS: Record<TimelinePhase, string> = {
  SUBMITTED: '已登记',
  QUEUED: '进入审核',
  REOPENED: '重新审核',
  RESOLVED: '处理完成',
  CLOSED: '流程结束',
  UPDATE: '状态同步',
}

const COMPLAINT_TYPE_LABELS: Record<string, string> = {
  CONTENT_REPORT: '内容举报',
  PRIVACY_REQUEST: '隐私请求',
  DELETION_REQUEST: '删除请求',
  IMPERSONATION_REPORT: '冒充举报',
  MISLABEL_REPORT: '误标举报',
  HARASSMENT_REPORT: '骚扰举报',
  OTHER: '其他投诉',
}

const APPEAL_TYPE_LABELS: Record<string, string> = {
  CONTENT_APPEAL: '内容申诉',
  ACCOUNT_LIMIT_APPEAL: '账号限制申诉',
  AGENT_RESTRICTION_APPEAL: '智能体限制申诉',
  OTHER: '其他申诉',
}

const TARGET_TYPE_LABELS: Record<string, string> = {
  post: '论坛帖子',
  comment: '评论区回复',
  message: '聊天室发言',
  private_session: '私聊会话',
  agent: '智能体主页',
  config_revision: '配置修订',
  complaint_ticket: '举报单',
  appeal_request: '申诉单',
}

type TimelinePhase = 'SUBMITTED' | 'QUEUED' | 'REOPENED' | 'RESOLVED' | 'CLOSED' | 'UPDATE'

type TimelineEntry = {
  id: string
  source: 'REPORT' | 'APPEAL' | 'GOVERNANCE'
  phase: TimelinePhase
  title: string
  body: string
  phase_copy: string
  surface_label: string
  target_label: string
  created_at: string
  status: string
  href: string | null
  unread: boolean
}

function targetHref(targetType: string, targetId: string): string | null {
  const normalized = normalizeTargetType(targetType)
  if (normalized === 'post') return `/posts/${targetId}`
  if (normalized === 'agent') return `/agents/${targetId}`
  return null
}

function readString(record: Record<string, unknown> | null | undefined, key: string): string | null {
  const value = record?.[key]
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function normalizeTargetType(targetType: string | null | undefined): string {
  return targetType?.trim().toLowerCase() ?? ''
}

function targetTypeLabel(targetType: string | null | undefined): string {
  const normalized = normalizeTargetType(targetType)
  const label = TARGET_TYPE_LABELS[normalized] ?? normalized
  return label || '治理对象'
}

function targetLabel(targetType: string | null | undefined, targetId: string | null | undefined): string {
  if (!targetId) return targetTypeLabel(targetType)
  return `${targetTypeLabel(targetType)} · ${targetId}`
}

function entrySurfaceLabel(input: {
  targetType: string | null | undefined
  reasonCode?: string | null
  notificationType?: string | null
}): string {
  const reasonCode = input.reasonCode?.trim().toLowerCase() ?? ''
  if (reasonCode === 'comment_report') return '评论区'
  if (reasonCode === 'chat_message_report') return '聊天室 live 对话'
  if (reasonCode === 'proactive_private_session_report') return '主动私信会话'
  if (reasonCode === 'private_session_report') return '私聊会话'
  if (reasonCode === 'proactive_outreach_report') return '通知中心的主动私信提醒'
  if (reasonCode === 'privacy_request') return '隐私请求入口'
  if (reasonCode === 'deletion_request') return '删除请求入口'
  if (reasonCode === 'impersonation_report') return '冒充举报入口'
  if (reasonCode === 'mislabel_report') return '误标举报入口'
  if (reasonCode === 'harassment_report') return '骚扰举报入口'
  if (input.notificationType === 'GOVERNANCE') return '治理状态同步'

  switch (normalizeTargetType(input.targetType)) {
    case 'post':
      return '帖子详情页'
    case 'comment':
      return '评论区'
    case 'message':
      return '聊天室 live 对话'
    case 'private_session':
      return '私聊会话'
    case 'agent':
      return '智能体主页'
    case 'config_revision':
      return '配置审核页'
    case 'complaint_ticket':
    case 'appeal_request':
      return 'Safety Center'
    default:
      return 'Safety Center'
  }
}

function complaintPhase(status: ComplaintTicket['status']): TimelinePhase {
  switch (status) {
    case 'OPEN':
      return 'SUBMITTED'
    case 'LINKED':
      return 'QUEUED'
    case 'RESOLVED':
      return 'RESOLVED'
    case 'REJECTED':
      return 'CLOSED'
    default:
      return 'UPDATE'
  }
}

function appealPhase(status: AppealRequest['status']): TimelinePhase {
  switch (status) {
    case 'OPEN':
      return 'SUBMITTED'
    case 'LINKED':
      return 'QUEUED'
    case 'RESOLVED':
      return 'RESOLVED'
    case 'REJECTED':
      return 'CLOSED'
    default:
      return 'UPDATE'
  }
}

function governancePhase(item: Notification): TimelinePhase {
  const title = item.title.trim()
  const body = item.body?.trim() ?? ''
  if (title.includes('重新进入审核')) return 'REOPENED'
  if (
    title.includes('进入审核')
    || title.includes('进入复核')
    || title.includes('热点复核')
    || body.includes('已进入')
    || body.includes('进入审核')
    || body.includes('进入复核')
    || body.includes('热点复核')
  ) {
    return 'QUEUED'
  }
  if (title.includes('已驳回') || title.includes('已结案')) return 'CLOSED'
  if (title.includes('已处理')) return 'RESOLVED'
  return 'UPDATE'
}

function isHotTopicUpdate(value: { title?: string | null; body?: string | null }): boolean {
  const text = `${value.title ?? ''} ${value.body ?? ''}`.toLowerCase()
  return (
    text.includes('热点')
    || text.includes('漂移')
    || text.includes('no_recommend')
    || text.includes('不参与推荐')
  )
}

function phaseCopy(entry: Pick<TimelineEntry, 'source' | 'phase'> & { hot_topic?: boolean }): string {
  if (entry.hot_topic) {
    switch (entry.phase) {
      case 'QUEUED':
        return '热点内容已进入复核队列，系统会继续核对允许域、漂移风险和分发范围。'
      case 'REOPENED':
        return '热点内容因漂移或分发限制被重新打开，复核会沿原 case 继续追加证据。'
      case 'RESOLVED':
        return '热点内容的分发结果已经更新，直达访问、推荐限制或恢复放行都会同步回这里。'
      case 'CLOSED':
        return '热点复核流程已结束，当前没有追加的限制动作。'
      case 'SUBMITTED':
      case 'UPDATE':
      default:
        return '这里会持续同步热点复核、漂移提醒和限制传播的状态回执。'
    }
  }

  if (entry.source === 'REPORT') {
    switch (entry.phase) {
      case 'SUBMITTED':
        return '举报已登记，系统会先建 case 并补齐证据快照。'
      case 'QUEUED':
        return '举报已挂到人工审核队列，结案或重开会继续沿同一条 case 链路同步。'
      case 'RESOLVED':
        return '举报已处理，结果和治理动作已经回写到你的记录里。'
      case 'CLOSED':
        return '举报已结案，当前没有追加动作。'
      case 'REOPENED':
        return '举报关联的 case 已重新打开，审核会继续追加证据。'
      case 'UPDATE':
      default:
        return '举报流程仍在推进，新的治理回执会继续出现在这里。'
    }
  }

  if (entry.source === 'APPEAL') {
    switch (entry.phase) {
      case 'SUBMITTED':
        return '申诉已登记，后续会和原始 evidence package 一起进入人工复核。'
      case 'QUEUED':
        return '申诉已进入复核队列，资深审核会继续比对原 case 的处理依据。'
      case 'RESOLVED':
        return '申诉已处理，新的治理结果已经同步回这条记录。'
      case 'CLOSED':
        return '申诉已结束，当前维持既有治理结论。'
      case 'REOPENED':
        return '申诉关联的 case 已重新打开，之前的结果会被重新审看。'
      case 'UPDATE':
      default:
        return '申诉流程仍在推进，新的复核回执会继续出现在这里。'
    }
  }

  switch (entry.phase) {
    case 'QUEUED':
      return '系统已把 case 状态变更同步给你，这类更新也会出现在通知 bell。'
    case 'REOPENED':
      return '原 case 已重新打开，之前的举报单或申诉单会继续沿用同一条审查链路。'
    case 'RESOLVED':
      return '治理动作已经执行完毕，处理结果会同步回对应的举报单或申诉单。'
    case 'CLOSED':
      return '治理流程已结束，当前没有追加的处理动作。'
    case 'SUBMITTED':
    case 'UPDATE':
    default:
      return '这里会持续收集人工审核和 case 流转过程中的状态回执。'
  }
}

function complaintDetail(item: ComplaintTicket): string {
  const resolutionAction = readString(item.resolution, 'resolution_action')
  const linkedCaseId = item.linked_case_id ?? readString(item.resolution, 'linked_case_id')
  if (resolutionAction && linkedCaseId) return `已关联 case ${linkedCaseId} · 动作 ${resolutionAction}`
  if (linkedCaseId) return `已关联 case ${linkedCaseId}`
  return '等待 case 建档'
}

function appealDetail(item: AppealRequest): string {
  const resolutionAction = readString(item.result, 'resolution_action')
  const linkedCaseId = item.linked_case_id ?? readString(item.result, 'linked_case_id')
  if (resolutionAction && linkedCaseId) return `已关联 case ${linkedCaseId} · 动作 ${resolutionAction}`
  if (linkedCaseId) return `已关联 case ${linkedCaseId}`
  return item.reason
}

function buildTimelineEntries(
  reports: ComplaintTicket[],
  appeals: AppealRequest[],
  governanceUpdates: Notification[],
): TimelineEntry[] {
  const reportEntries: TimelineEntry[] = reports.map((item) => ({
    id: `report-${item.id}`,
    source: 'REPORT',
    phase: complaintPhase(item.status),
    title: `已提交${COMPLAINT_TYPE_LABELS[item.complaint_type] ?? item.complaint_type}`,
    body: complaintDetail(item),
    phase_copy: phaseCopy({ source: 'REPORT', phase: complaintPhase(item.status) }),
    surface_label: entrySurfaceLabel({
      targetType: item.target_type,
      reasonCode: item.reason_code,
    }),
    target_label: targetLabel(item.target_type, item.target_id),
    created_at: item.created_at,
    status: item.status,
    href: targetHref(item.target_type, item.target_id),
    unread: false,
  }))

  const appealEntries: TimelineEntry[] = appeals.map((item) => ({
    id: `appeal-${item.id}`,
    source: 'APPEAL',
    phase: appealPhase(item.status),
    title: `已提交${APPEAL_TYPE_LABELS[item.appeal_type] ?? item.appeal_type}`,
    body: appealDetail(item),
    phase_copy: phaseCopy({ source: 'APPEAL', phase: appealPhase(item.status) }),
    surface_label: entrySurfaceLabel({
      targetType: item.target_type,
    }),
    target_label: targetLabel(item.target_type, item.target_id),
    created_at: item.created_at,
    status: item.status,
    href: targetHref(item.target_type, item.target_id),
    unread: false,
  }))

  const notificationEntries: TimelineEntry[] = governanceUpdates.map((item) => ({
    id: `notification-${item.id}`,
    source: 'GOVERNANCE',
    phase: governancePhase(item),
    title: item.title,
    body: item.body ?? '治理状态已更新',
    phase_copy: phaseCopy({
      source: 'GOVERNANCE',
      phase: governancePhase(item),
      hot_topic: isHotTopicUpdate({ title: item.title, body: item.body }),
    }),
    surface_label: entrySurfaceLabel({
      targetType: item.target_type,
      notificationType: item.type,
    }),
    target_label: targetLabel(item.target_type, item.target_id ?? item.id),
    created_at: item.created_at,
    status: item.read ? 'READ' : 'UNREAD',
    href: null,
    unread: !item.read,
  }))

  return [...notificationEntries, ...reportEntries, ...appealEntries]
    .sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      || b.id.localeCompare(a.id))
}

function TicketRow({
  title,
  status,
  createdAt,
  contextLine,
  detail,
  href,
}: {
  title: string
  status: string
  createdAt: string
  contextLine: string
  detail: string
  href: string | null
}) {
  return (
    <div className={uix('uix-d9ec640fb0')}>
      <div className="min-w-0 space-y-1">
        <p className={uix('uix-da8bf29040')}>{title}</p>
        <p className={uix('uix-abda0153e3')}>{contextLine}</p>
        {detail ? <p className={uix('uix-abda0153e3')}>{detail}</p> : null}
        <p className={uix('uix-cb59187521')}>{relativeTime(createdAt)}</p>
      </div>
      <div className="flex items-center gap-2">
        <Badge
          variant="outline"
          className={
            status === 'OPEN' || status === 'READ'
              ? uix('uix-acde912ea7')
              : status === 'LINKED'
                ? uix('uix-6b1dc864d8')
                : status === 'RESOLVED'
                  ? uix('uix-6196a83432')
                  : status === 'REJECTED'
                    ? uix('uix-34778b4db1')
                    : status === 'UNREAD'
                      ? uix('uix-acde22e5d7')
                      : ''
          }
        >
          {STATUS_LABELS[status] ?? status}
        </Badge>
        {href && (
          <Button size="sm" variant="outline" asChild>
            <Link to={href}>查看目标</Link>
          </Button>
        )}
      </div>
    </div>
  )
}

function TimelineCard({
  entries,
  unreadCount,
  loading,
  onMarkAllRead,
  isMarkingAllRead,
}: {
  entries: TimelineEntry[]
  unreadCount: number
  loading: boolean
  onMarkAllRead: () => void
  isMarkingAllRead: boolean
}) {
  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className={uix('uix-fc7473ca09')}>状态时间线</CardTitle>
            <p className={uix('uix-abda0153e3')}>
              Safety Center 会把“从哪儿发起、挂到哪个 case、现在卡在哪一步”连成一条可读的治理时间线。
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={unreadCount > 0 ? uix('uix-acde22e5d7') : ''}>
              {unreadCount > 0 ? `${unreadCount} 条未读治理更新` : '治理更新已读完'}
            </Badge>
            <Button
              size="sm"
              variant="outline"
              disabled={unreadCount === 0 || isMarkingAllRead}
              onClick={onMarkAllRead}
            >
              全部标记已读
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && (
          <>
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </>
        )}
        {!loading && entries.length === 0 && (
          <p className={uix('uix-abda0153e3')}>还没有治理记录，后续举报、申诉和审核通知会汇总在这里。</p>
        )}
        {entries.map((entry) => (
          <div
            key={entry.id}
            className={uix('uix-dc5f8042a1')}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className={uix('uix-da8bf29040')}>{entry.title}</p>
                  <Badge
                    variant="outline"
                    className={
                      entry.source === 'REPORT'
                        ? uix('uix-1e4ba8b8b0')
                        : entry.source === 'APPEAL'
                          ? uix('uix-650421c537')
                          : uix('uix-acde22e5d7')
                    }
                  >
                    {entry.source === 'REPORT' ? '举报单' : entry.source === 'APPEAL' ? '申诉单' : '治理通知'}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={
                      entry.phase === 'SUBMITTED'
                        ? uix('uix-acde912ea7')
                        : entry.phase === 'QUEUED'
                          ? uix('uix-6b1dc864d8')
                          : entry.phase === 'REOPENED'
                            ? uix('uix-1e4ba8b8b0')
                            : entry.phase === 'RESOLVED'
                              ? uix('uix-6196a83432')
                              : entry.phase === 'CLOSED'
                                ? uix('uix-34778b4db1')
                                : uix('uix-acde22e5d7')
                    }
                  >
                    {TIMELINE_PHASE_LABELS[entry.phase]}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={
                      entry.status === 'OPEN' || entry.status === 'READ'
                        ? uix('uix-acde912ea7')
                        : entry.status === 'LINKED'
                          ? uix('uix-6b1dc864d8')
                          : entry.status === 'RESOLVED'
                            ? uix('uix-6196a83432')
                            : entry.status === 'REJECTED'
                              ? uix('uix-34778b4db1')
                              : entry.status === 'UNREAD'
                                ? uix('uix-acde22e5d7')
                                : ''
                    }
                  >
                    {STATUS_LABELS[entry.status] ?? entry.status}
                  </Badge>
                  {entry.unread && (
                    <Badge variant="outline" className={uix('uix-acde22e5d7')}>
                      未读
                    </Badge>
                  )}
                </div>
                <p className={uix('uix-abda0153e3')}>{entry.phase_copy}</p>
                <p className={uix('uix-abda0153e3')}>提交入口 · {entry.surface_label}</p>
                <p className={uix('uix-abda0153e3')}>目标对象 · {entry.target_label}</p>
                <p className={uix('uix-abda0153e3')}>{entry.body}</p>
                <p className={uix('uix-cb59187521')}>{relativeTime(entry.created_at)}</p>
              </div>
              {entry.href && (
                <Button size="sm" variant="outline" asChild>
                  <Link to={entry.href}>查看目标</Link>
                </Button>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function renderComplaintRow(item: ComplaintTicket) {
  return (
    <TicketRow
      key={item.id}
      title={`${COMPLAINT_TYPE_LABELS[item.complaint_type] ?? item.complaint_type} · ${item.reason_code}`}
      status={item.status}
      createdAt={item.created_at}
      contextLine={`提交入口 · ${entrySurfaceLabel({ targetType: item.target_type, reasonCode: item.reason_code })} · 目标对象 · ${targetLabel(item.target_type, item.target_id)}`}
      detail={complaintDetail(item)}
      href={targetHref(item.target_type, item.target_id)}
    />
  )
}

function renderAppealRow(item: AppealRequest) {
  return (
    <TicketRow
      key={item.id}
      title={APPEAL_TYPE_LABELS[item.appeal_type] ?? item.appeal_type}
      status={item.status}
      createdAt={item.created_at}
      contextLine={`复核对象 · ${targetLabel(item.target_type, item.target_id)}`}
      detail={appealDetail(item)}
      href={targetHref(item.target_type, item.target_id)}
    />
  )
}

export function SafetyCenterPage() {
  const { isAuthenticated } = useAuth()
  const reports = useMyReports(undefined, isAuthenticated)
  const appeals = useMyAppeals(undefined, isAuthenticated)
  const notifications = useNotifications(undefined, isAuthenticated)
  const markAllNotificationsRead = useMarkAllNotificationsRead()

  if (!isAuthenticated) {
    return (
      <div className="space-y-4">
        <h1 className={uix('uix-65af6ac52c')}>举报与申诉</h1>
        <Card>
          <CardContent className={uix('uix-9ad47e61f2')}>
            <p className={uix('uix-fc7473ca09')}>登录后可以查看自己的举报和申诉处理状态。</p>
            <Button asChild>
              <Link to="/login">去登录</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const reportsData = reports.data?.data ?? []
  const appealsData = appeals.data?.data ?? []
  const notificationItems = notifications.data?.data?.items ?? []
  const governanceUpdates = notificationItems.filter((item) => item.type === 'GOVERNANCE')
  const unreadGovernanceCount = governanceUpdates.filter((item) => !item.read).length
  const timelineEntries = buildTimelineEntries(reportsData, appealsData, governanceUpdates)
  const loading = reports.isLoading || appeals.isLoading || notifications.isLoading

  return (
    <div className="space-y-4">
      <div>
        <h1 className={uix('uix-65af6ac52c')}>举报与申诉</h1>
        <p className={uix('uix-25be576b96')}>
          查看你提交过的举报与申诉。被风控拦截、折叠或需要人工复核的内容，会在这里留下状态轨迹。
        </p>
      </div>

      <div className={uix('uix-a10c4b5d31')}>
        当前受理入口已覆盖帖子、评论、聊天室发言、私聊会话和主动私信提醒。
        流程会按“已提交 → 建 case → 进入审核/复核 → 重开或结案”逐步回写到这里。
        私聊与主动私信仍默认受实名门槛约束。
        {' '}
        <Link to="/help/report-appeal-delete" className="underline underline-offset-4">
          查看完整流程说明
        </Link>
      </div>

      <div className={uix('uix-7df92ecb84')}>
        热点内容如果发生话题漂移，可能被改成“可直达，不参与推荐”，也可能重新进入 HOT_TOPIC 队列复核。
        这类限制传播和恢复放行的回执，同样会出现在时间线里。
        {' '}
        <Link to="/help/hot-topic-rules" className="underline underline-offset-4">
          查看热点规则
        </Link>
      </div>

      <TimelineCard
        entries={timelineEntries}
        unreadCount={unreadGovernanceCount}
        loading={loading}
        onMarkAllRead={() => markAllNotificationsRead.mutate()}
        isMarkingAllRead={markAllNotificationsRead.isPending}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className={uix('uix-fc7473ca09')}>我的举报</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading && (
              <>
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </>
            )}
            {!loading && reportsData.length === 0 && (
              <p className={uix('uix-abda0153e3')}>还没有提交过举报。</p>
            )}
            {reportsData.map(renderComplaintRow)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className={uix('uix-fc7473ca09')}>我的申诉</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading && (
              <>
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </>
            )}
            {!loading && appealsData.length === 0 && (
              <p className={uix('uix-abda0153e3')}>还没有提交过申诉。</p>
            )}
            {appealsData.map(renderAppealRow)}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
