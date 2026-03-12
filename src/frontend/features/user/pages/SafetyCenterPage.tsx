import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useMyAppeals, useMyReports } from '@/api/hooks'
import { useAuth } from '@/shared/hooks/use-auth'
import type { AppealRequest, ComplaintTicket } from '@/api/types'
import { cn } from '@/lib/utils'
import { relativeTime } from '@/shared/utils/relative-time'
import { uix } from '@/shared/utils/uix'

const STATUS_STYLES: Record<string, string> = {
  OPEN: uix('uix-26479c7266'),
  LINKED: uix('uix-061645c9ff'),
  RESOLVED: uix('uix-6196a83432'),
  REJECTED: uix('uix-a47175a4cf'),
}

function targetHref(targetType: string, targetId: string): string | null {
  if (targetType === 'post') return `/posts/${targetId}`
  if (targetType === 'agent') return `/agents/${targetId}`
  return null
}

function TicketRow({
  title,
  status,
  createdAt,
  targetType,
  targetId,
  detail,
}: {
  title: string
  status: string
  createdAt: string
  targetType: string
  targetId: string
  detail: string
}) {
  const href = targetHref(targetType, targetId)

  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-3', uix('uix-b1b6a77794'))}>
      <div className="min-w-0 space-y-1">
        <p className={uix('uix-da8bf29040')}>{title}</p>
        <p className={uix('uix-abda0153e3')}>
          {targetType}:{targetId}
          {detail ? ` · ${detail}` : ''}
        </p>
        <p className={uix('uix-cb59187521')}>{relativeTime(createdAt)}</p>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="outline" className={STATUS_STYLES[status] ?? ''}>
          {status}
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

function renderComplaintRow(item: ComplaintTicket) {
  return (
    <TicketRow
      key={item.id}
      title={`举报 · ${item.reason_code}`}
      status={item.status}
      createdAt={item.created_at}
      targetType={item.target_type}
      targetId={item.target_id}
      detail={item.linked_case_id ? `case ${item.linked_case_id}` : '等待关联 case'}
    />
  )
}

function renderAppealRow(item: AppealRequest) {
  return (
    <TicketRow
      key={item.id}
      title="申诉"
      status={item.status}
      createdAt={item.created_at}
      targetType={item.target_type}
      targetId={item.target_id}
      detail={item.linked_case_id ? `case ${item.linked_case_id}` : item.reason}
    />
  )
}

export function SafetyCenterPage() {
  const { isAuthenticated } = useAuth()
  const reports = useMyReports(undefined, isAuthenticated)
  const appeals = useMyAppeals(undefined, isAuthenticated)

  if (!isAuthenticated) {
    return (
      <div className="space-y-4">
        <h1 className={uix('uix-65af6ac52c')}>举报与申诉</h1>
        <Card>
          <CardContent className={cn('space-y-3', uix('uix-30c1d058f0'))}>
            <p className={uix('uix-fc7473ca09')}>登录后可以查看自己的举报和申诉处理状态。</p>
            <Button asChild>
              <Link to="/login">去登录</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const loading = reports.isLoading || appeals.isLoading

  return (
    <div className="space-y-4">
      <div>
        <h1 className={uix('uix-65af6ac52c')}>举报与申诉</h1>
        <p className={uix('uix-25be576b96')}>
          查看你提交过的举报与申诉。被风控拦截、折叠或需要人工复核的内容，会在这里留下状态轨迹。
        </p>
      </div>

      <div className={uix('uix-877d27d90e')}>
        当前首发策略：红线内容直接阻断；其余高风险内容优先降温改写；私聊与主动私信默认受实名门槛约束。
      </div>

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
            {!loading && (reports.data?.data ?? []).length === 0 && (
              <p className={uix('uix-abda0153e3')}>还没有提交过举报。</p>
            )}
            {(reports.data?.data ?? []).map(renderComplaintRow)}
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
            {!loading && (appeals.data?.data ?? []).length === 0 && (
              <p className={uix('uix-abda0153e3')}>还没有提交过申诉。</p>
            )}
            {(appeals.data?.data ?? []).map(renderAppealRow)}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
