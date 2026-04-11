import { tryOpenAgentModal } from '@/shared/stores/agent-modal-store'
import { isAgentTargetString } from '@/shared/utils/agent-target'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import {
  useMarkAllNotificationsRead,
  useMyAppeals,
  useMyReports,
  useNotifications,
} from '@/api/hooks'
import { useAuth } from '@/shared/hooks/use-auth'
import type { AppealRequest, ComplaintTicket, Notification } from '@/api/types'
import { relativeTime } from '@/shared/utils/relative-time'
import { buildAgentTarget } from '../../../../shared/agent-target.js'
import { useState } from 'react'

const c = {
  page: 'bg-background',
  title: 'text-foreground',
  accent: 'text-primary',
  accentBg: 'bg-primary',
  btn: 'bg-primary text-primary-foreground hover:bg-primary/90',
  pillOn: 'border-primary bg-primary text-primary-foreground',
  pillOff: 'border-border bg-transparent text-muted-foreground hover:border-ring/40 hover:bg-accent/40',
  muted: 'text-muted-foreground',
  sub: 'text-muted-foreground',
  line: 'border-border',
  lineBg: 'bg-border',
  dot: 'bg-border',
} as const

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

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
  thread_turn: '公共舞台发言',
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
  source_label: string
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

type ActiveTab = 'timeline' | 'reports' | 'appeals'

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function targetHref(targetType: string, targetId: string): string | null {
  const normalized = normalizeTargetType(targetType)
  if (normalized === 'post') return `/posts/${targetId}`
  if (normalized === 'agent') {
    return buildAgentTarget({ agentId: targetId, mode: 'readonly' })
  }
  return null
}

function TargetActionButton({ href }: { href: string }) {
  if (isAgentTargetString(href)) {
    return (
      <Button size="sm" variant="outline" className={cn('rounded-full', c.line)} onClick={() => tryOpenAgentModal(href, 'readonly')}>
        查看目标
      </Button>
    )
  }
  return (
    <Button size="sm" variant="outline" className={cn('rounded-full', c.line)} asChild>
      <Link to={href}>查看目标</Link>
    </Button>
  )
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

function governanceRequestLabel(reasonCode: string | null | undefined): string | null {
  const normalized = reasonCode?.trim().toLowerCase() ?? ''
  if (normalized === 'private_session_report') return '私聊治理'
  if (normalized === 'proactive_private_session_report' || normalized === 'proactive_outreach_report') {
    return '主动私信治理'
  }
  return null
}

function complaintDisplayLabel(complaintType: string | null | undefined, reasonCode: string | null | undefined): string {
  return governanceRequestLabel(reasonCode) ?? COMPLAINT_TYPE_LABELS[complaintType ?? ''] ?? complaintType ?? '治理申请'
}

function entrySurfaceLabel(input: {
  targetType: string | null | undefined
  reasonCode?: string | null
  notificationType?: string | null
}): string {
  const reasonCode = input.reasonCode?.trim().toLowerCase() ?? ''
  if (reasonCode === 'thread_stage_report') return '公共舞台'
  if (reasonCode === 'chat_message_report') return '聊天室 live 对话'
  if (reasonCode === 'proactive_private_session_report') return '主动私信治理入口'
  if (reasonCode === 'private_session_report') return '私聊治理入口'
  if (reasonCode === 'proactive_outreach_report') return '通知中心的主动私信治理入口'
  if (reasonCode === 'privacy_request') return '隐私请求入口'
  if (reasonCode === 'deletion_request') return '删除请求入口'
  if (reasonCode === 'impersonation_report') return '冒充举报入口'
  if (reasonCode === 'mislabel_report') return '误标举报入口'
  if (reasonCode === 'harassment_report') return '骚扰举报入口'
  if (input.notificationType === 'GOVERNANCE') return '治理状态同步'

  switch (normalizeTargetType(input.targetType)) {
    case 'post': return '帖子详情页'
    case 'thread_turn': return '公共舞台'
    case 'message': return '聊天室 live 对话'
    case 'private_session': return '私聊会话'
    case 'agent': return '智能体主页'
    case 'config_revision': return '配置审核页'
    case 'complaint_ticket':
    case 'appeal_request':
    default:
      return 'Safety Center'
  }
}

function complaintPhase(status: ComplaintTicket['status']): TimelinePhase {
  switch (status) {
    case 'OPEN': return 'SUBMITTED'
    case 'LINKED': return 'QUEUED'
    case 'RESOLVED': return 'RESOLVED'
    case 'REJECTED': return 'CLOSED'
    default: return 'UPDATE'
  }
}

function appealPhase(status: AppealRequest['status']): TimelinePhase {
  switch (status) {
    case 'OPEN': return 'SUBMITTED'
    case 'LINKED': return 'QUEUED'
    case 'RESOLVED': return 'RESOLVED'
    case 'REJECTED': return 'CLOSED'
    default: return 'UPDATE'
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
  ) return 'QUEUED'
  if (title.includes('已驳回') || title.includes('已结案')) return 'CLOSED'
  if (title.includes('已处理')) return 'RESOLVED'
  return 'UPDATE'
}

function isHotTopicUpdate(value: { title?: string | null; body?: string | null }): boolean {
  const text = `${value.title ?? ''} ${value.body ?? ''}`.toLowerCase()
  return text.includes('热点') || text.includes('漂移') || text.includes('no_recommend') || text.includes('不参与推荐')
}

function phaseCopy(
  entry: Pick<TimelineEntry, 'source' | 'phase'> & { hot_topic?: boolean; governance_label?: string | null },
): string {
  if (entry.hot_topic) {
    switch (entry.phase) {
      case 'QUEUED': return '相关内容正在复核中，结果更新后会通知你。'
      case 'REOPENED': return '相关内容已重新进入复核，处理结果可能调整。'
      case 'RESOLVED': return '相关内容的处理结果已更新。'
      case 'CLOSED': return '这次复核已结束。'
      default: return '复核进度更新后会显示在这里。'
    }
  }
  if (entry.source === 'REPORT' && entry.governance_label) {
    switch (entry.phase) {
      case 'SUBMITTED': return `${entry.governance_label}已提交，我们会核实相关内容和材料。`
      case 'QUEUED': return `${entry.governance_label}处理中，结果更新后会通知你。`
      case 'RESOLVED': return `${entry.governance_label}已处理，你可以查看最新结果。`
      case 'CLOSED': return `${entry.governance_label}已结束。`
      case 'REOPENED': return `${entry.governance_label}已重新进入审核。`
      default: return `${entry.governance_label}有新的进展。`
    }
  }
  if (entry.source === 'REPORT') {
    switch (entry.phase) {
      case 'SUBMITTED': return '举报已提交，我们会核实相关内容和材料。'
      case 'QUEUED': return '举报处理中，结果更新后会通知你。'
      case 'RESOLVED': return '举报已处理，你可以查看最新结果。'
      case 'CLOSED': return '举报已结束。'
      case 'REOPENED': return '举报已重新进入审核。'
      default: return '举报有新的进展。'
    }
  }
  if (entry.source === 'APPEAL') {
    switch (entry.phase) {
      case 'SUBMITTED': return '申诉已提交，我们会结合原处理结果继续复核。'
      case 'QUEUED': return '申诉处理中，结果更新后会通知你。'
      case 'RESOLVED': return '申诉已处理，你可以查看最新结果。'
      case 'CLOSED': return '申诉已结束。'
      case 'REOPENED': return '申诉已重新进入审核。'
      default: return '申诉有新的进展。'
    }
  }
  switch (entry.phase) {
    case 'QUEUED': return '处理中，结果更新后会通知你。'
    case 'REOPENED': return '该事项已重新进入审核。'
    case 'RESOLVED': return '处理结果已更新。'
    case 'CLOSED': return '本次处理已结束。'
    default: return '状态更新后会显示在这里。'
  }
}

function complaintDetail(item: ComplaintTicket): string {
  const linkedCaseId = item.linked_case_id ?? readString(item.resolution, 'linked_case_id')
  if (linkedCaseId) return `处理单号：${linkedCaseId}`
  return '等待受理'
}

function appealDetail(item: AppealRequest): string {
  const linkedCaseId = item.linked_case_id ?? readString(item.result, 'linked_case_id')
  if (linkedCaseId) return `处理单号：${linkedCaseId}`
  return item.reason
}

function buildTimelineEntries(
  reports: ComplaintTicket[],
  appeals: AppealRequest[],
  governanceUpdates: Notification[],
): TimelineEntry[] {
  const reportEntries: TimelineEntry[] = reports.map((item) => {
    const gl = governanceRequestLabel(item.reason_code)
    return {
      id: `report-${item.id}`,
      source: 'REPORT',
      source_label: gl ? '治理申请' : '举报单',
      phase: complaintPhase(item.status),
      title: `已提交${complaintDisplayLabel(item.complaint_type, item.reason_code)}`,
      body: complaintDetail(item),
      phase_copy: phaseCopy({
        source: 'REPORT',
        phase: complaintPhase(item.status),
        governance_label: gl ? `${gl}申请` : null,
      }),
      surface_label: entrySurfaceLabel({ targetType: item.target_type, reasonCode: item.reason_code }),
      target_label: targetLabel(item.target_type, item.target_id),
      created_at: item.created_at,
      status: item.status,
      href: targetHref(item.target_type, item.target_id),
      unread: false,
    }
  })

  const appealEntries: TimelineEntry[] = appeals.map((item) => ({
    id: `appeal-${item.id}`,
    source: 'APPEAL',
    source_label: '申诉单',
    phase: appealPhase(item.status),
    title: `已提交${APPEAL_TYPE_LABELS[item.appeal_type] ?? item.appeal_type}`,
    body: appealDetail(item),
    phase_copy: phaseCopy({ source: 'APPEAL', phase: appealPhase(item.status) }),
    surface_label: entrySurfaceLabel({ targetType: item.target_type }),
    target_label: targetLabel(item.target_type, item.target_id),
    created_at: item.created_at,
    status: item.status,
    href: targetHref(item.target_type, item.target_id),
    unread: false,
  }))

  const notificationEntries: TimelineEntry[] = governanceUpdates.map((item) => ({
    id: `notification-${item.id}`,
    source: 'GOVERNANCE',
    source_label: '治理通知',
    phase: governancePhase(item),
    title: item.title,
    body: item.body ?? '治理状态已更新',
    phase_copy: phaseCopy({
      source: 'GOVERNANCE',
      phase: governancePhase(item),
      hot_topic: isHotTopicUpdate({ title: item.title, body: item.body }),
    }),
    surface_label: entrySurfaceLabel({ targetType: item.target_type, notificationType: item.type }),
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

/* ------------------------------------------------------------------ */
/*  Phase badge color                                                 */
/* ------------------------------------------------------------------ */

function phaseBadgeClass(phase: TimelinePhase): string {
  switch (phase) {
    case 'QUEUED': return 'bg-primary/10 text-primary'
    case 'REOPENED': return 'bg-warning/10 text-warning'
    case 'RESOLVED': return 'bg-success/10 text-success'
    case 'CLOSED': return 'bg-muted text-muted-foreground'
    case 'UPDATE': return 'bg-muted text-muted-foreground'
    default: return 'bg-muted text-muted-foreground'
  }
}

function statusBadgeClass(status: string): string {
  if (status === 'LINKED' || status === 'UNREAD') return 'bg-primary/10 text-primary'
  if (status === 'RESOLVED') return 'bg-success/10 text-success'
  if (status === 'REJECTED') return 'bg-destructive/10 text-destructive'
  return 'bg-muted text-muted-foreground'
}

function sourceBadgeClass(source: string): string {
  if (source === 'REPORT') return 'bg-warning/10 text-warning'
  if (source === 'APPEAL') return 'bg-primary/10 text-primary'
  return 'bg-primary/10 text-primary'
}

/* ------------------------------------------------------------------ */
/*  Unauthenticated Gate                                              */
/* ------------------------------------------------------------------ */

function SafetyGate() {
  return (
    <div className={cn('min-h-screen', c.page)}>
      <div className="mx-auto max-w-3xl space-y-10 px-4 pt-10 pb-24">
        <div className="space-y-3">
          <h1 className={cn('text-2xl font-bold tracking-tight', c.title)}>举报与申诉</h1>
          <p className={cn('text-sm', c.sub)}>登录后可查看处理进度。</p>
        </div>
        <div className={cn('flex flex-col items-center justify-center gap-6 border-t pt-12 text-center', c.line)}>
          <Button asChild size="lg" className={cn('rounded-full px-8', c.btn)}>
            <Link to="/login">去登录</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Title bar: title + tabs + guide links                             */
/* ------------------------------------------------------------------ */

function SafetyTitleBar({
  activeTab,
  onTabChange,
}: {
  activeTab: ActiveTab
  onTabChange: (tab: ActiveTab) => void
}) {
  const tabs: { id: ActiveTab; label: string }[] = [
    { id: 'timeline', label: '时间线' },
    { id: 'reports', label: '举报' },
    { id: 'appeals', label: '申诉' },
  ]

  return (
    <div className={cn('border-b pb-3', c.line)}>
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
        <h1 className={cn('mr-2 text-xl font-semibold tracking-tight', c.title)}>
          举报与申诉
        </h1>

        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={cn(
              'border-b-2 pb-2.5 text-sm font-medium transition-colors',
              activeTab === tab.id
                ? cn('border-primary', c.title)
                : cn('border-transparent', c.sub, 'hover:border-border hover:text-foreground'),
            )}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}

        <div className="ml-auto flex items-baseline gap-4">
          <Link to="/help/report-appeal-delete" className={cn('text-xs underline-offset-4 hover:underline', c.muted, 'hover:text-primary')}>
            流程说明
          </Link>
          <Link to="/help/hot-topic-rules" className={cn('text-xs underline-offset-4 hover:underline', c.muted, 'hover:text-primary')}>
            热点规则
          </Link>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Timeline Tab                                                      */
/* ------------------------------------------------------------------ */

function TimelineTab({
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className={cn('text-lg font-semibold', c.title)}>状态时间线</h2>
        <div className="flex items-center gap-3">
          <span className={cn('text-xs', unreadCount > 0 ? c.accent : c.muted)}>
            {unreadCount > 0 ? `${unreadCount} 条未读更新` : '更新已读完'}
          </span>
          <Button
            size="sm"
            variant="outline"
            className={cn('rounded-full text-xs', c.line)}
            disabled={unreadCount === 0 || isMarkingAllRead}
            onClick={onMarkAllRead}
          >
            全部标记已读
          </Button>
        </div>
      </div>

      {loading && (
        <div className="space-y-4">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
      )}

      {!loading && entries.length === 0 && (
        <div className={cn('flex min-h-[200px] items-center justify-center border-t pt-12 text-center', c.line)}>
          <p className={cn('text-sm', c.sub)}>还没有治理记录。</p>
        </div>
      )}

      {!loading && entries.length > 0 && (
        <div className="space-y-0">
          {entries.map((entry, index) => (
            <div key={entry.id} className={cn(index < entries.length - 1 && 'border-b', c.line)}>
              <div className="py-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className={cn('text-base font-medium', c.title)}>{entry.title}</p>
                      <Badge className={cn('rounded-full border-transparent px-2 py-0.5 text-[11px]', sourceBadgeClass(entry.source))}>
                        {entry.source_label}
                      </Badge>
                      <Badge className={cn('rounded-full border-transparent px-2 py-0.5 text-[11px]', phaseBadgeClass(entry.phase))}>
                        {TIMELINE_PHASE_LABELS[entry.phase]}
                      </Badge>
                      <Badge className={cn('rounded-full border-transparent px-2 py-0.5 text-[11px]', statusBadgeClass(entry.status))}>
                        {STATUS_LABELS[entry.status] ?? entry.status}
                      </Badge>
                      {entry.unread && (
                        <Badge className="rounded-full border-transparent bg-primary px-2 py-0.5 text-[11px] text-primary-foreground">
                          未读
                        </Badge>
                      )}
                    </div>
                    <p className={cn('text-sm', c.title)}>{entry.phase_copy}</p>
                    <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-1 text-xs', c.muted)}>
                      <span>入口：{entry.surface_label}</span>
                      <span>目标：{entry.target_label}</span>
                      <span>{entry.body}</span>
                    </div>
                    <p className={cn('text-xs', c.muted)}>{relativeTime(entry.created_at)}</p>
                  </div>
                  {entry.href ? <TargetActionButton href={entry.href} /> : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Reports / Appeals Tab                                             */
/* ------------------------------------------------------------------ */

function TicketListTab({
  title,
  items,
  loading,
  emptyText,
  renderRow,
}: {
  title: string
  items: unknown[]
  loading: boolean
  emptyText: string
  renderRow: () => React.ReactNode
}) {
  return (
    <div className="space-y-6">
      <h2 className={cn('text-lg font-semibold', c.title)}>{title}</h2>

      {loading && (
        <div className="space-y-4">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className={cn('flex min-h-[200px] items-center justify-center border-t pt-12 text-center', c.line)}>
          <p className={cn('text-sm', c.sub)}>{emptyText}</p>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="space-y-0">{renderRow()}</div>
      )}
    </div>
  )
}

function ComplaintRow({ item }: { item: ComplaintTicket }) {
  const gl = governanceRequestLabel(item.reason_code)
  const rowTitle = gl
    ? `${gl} · ${entrySurfaceLabel({ targetType: item.target_type, reasonCode: item.reason_code })}`
    : `${complaintDisplayLabel(item.complaint_type, item.reason_code)} · ${item.reason_code}`

  return (
    <TicketRow
      title={rowTitle}
      status={item.status}
      createdAt={item.created_at}
      contextLine={`来源：${entrySurfaceLabel({ targetType: item.target_type, reasonCode: item.reason_code })} · 对象：${targetLabel(item.target_type, item.target_id)}`}
      detail={complaintDetail(item)}
      href={targetHref(item.target_type, item.target_id)}
    />
  )
}

function AppealRow({ item }: { item: AppealRequest }) {
  return (
    <TicketRow
      title={APPEAL_TYPE_LABELS[item.appeal_type] ?? item.appeal_type}
      status={item.status}
      createdAt={item.created_at}
      contextLine={`对象：${targetLabel(item.target_type, item.target_id)}`}
      detail={appealDetail(item)}
      href={targetHref(item.target_type, item.target_id)}
    />
  )
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
    <div className={cn('border-b py-5', c.line)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className={cn('text-base font-medium', c.title)}>{title}</p>
            <Badge className={cn('rounded-full border-transparent px-2 py-0.5 text-[11px]', statusBadgeClass(status))}>
              {STATUS_LABELS[status] ?? status}
            </Badge>
          </div>
          <p className={cn('text-sm', c.sub)}>{contextLine}</p>
          {detail ? <p className={cn('text-sm', c.sub)}>{detail}</p> : null}
          <p className={cn('text-xs', c.muted)}>{relativeTime(createdAt)}</p>
        </div>
        {href ? <TargetActionButton href={href} /> : null}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                         */
/* ------------------------------------------------------------------ */

export function SafetyCenterPage() {
  const { isAuthenticated } = useAuth()
  const reports = useMyReports(undefined, isAuthenticated)
  const appeals = useMyAppeals(undefined, isAuthenticated)
  const notifications = useNotifications(undefined, isAuthenticated)
  const markAllNotificationsRead = useMarkAllNotificationsRead()
  const [activeTab, setActiveTab] = useState<ActiveTab>('timeline')

  if (!isAuthenticated) {
    return <SafetyGate />
  }

  const reportsData = reports.data?.data ?? []
  const appealsData = appeals.data?.data ?? []
  const notificationItems = notifications.data?.data?.items ?? []
  const governanceUpdates = notificationItems.filter((item) => item.type === 'GOVERNANCE')
  const unreadGovernanceCount = governanceUpdates.filter((item) => !item.read).length
  const timelineEntries = buildTimelineEntries(reportsData, appealsData, governanceUpdates)
  const loading = reports.isLoading || appeals.isLoading || notifications.isLoading

  return (
    <div className={cn('min-h-screen', c.page)}>
    <div className="mx-auto w-full max-w-4xl space-y-8 px-4 pt-8 pb-20 md:pt-12">
      <SafetyTitleBar activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === 'timeline' && (
        <TimelineTab
          entries={timelineEntries}
          unreadCount={unreadGovernanceCount}
          loading={loading}
          onMarkAllRead={() => markAllNotificationsRead.mutate()}
          isMarkingAllRead={markAllNotificationsRead.isPending}
        />
      )}

      {activeTab === 'reports' && (
        <TicketListTab
          title="我的举报"
          items={reportsData}
          loading={loading}
          emptyText="还没有提交过举报。"
          renderRow={() => reportsData.map((item) => <ComplaintRow key={item.id} item={item} />)}
        />
      )}

      {activeTab === 'appeals' && (
        <TicketListTab
          title="我的申诉"
          items={appealsData}
          loading={loading}
          emptyText="还没有提交过申诉。"
          renderRow={() => appealsData.map((item) => <AppealRow key={item.id} item={item} />)}
        />
      )}
    </div>
    </div>
  )
}
