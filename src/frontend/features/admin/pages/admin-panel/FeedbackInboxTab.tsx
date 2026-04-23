import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import {
  useAdminFeedbackDetail,
  useAdminFeedbackList,
  useAdminUpdateFeedback,
} from '@/api/hooks'
import type { AdminFeedbackTicketSummary, FeedbackCategory, FeedbackStatus } from '@/api/types'
import { cn } from '@/lib/utils'
import { relativeTime } from '@/shared/utils/relative-time'

const CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  PRODUCT_SUGGESTION: '产品建议',
  BUG_REPORT: 'Bug 反馈',
  UX_ISSUE: '体验问题',
  OTHER: '其他',
}

const STATUS_LABELS: Record<FeedbackStatus, string> = {
  RECEIVED: '已收到',
  UNDER_REVIEW: '处理中',
  PLANNED: '已规划',
  CLOSED: '已关闭',
}

const STATUS_BADGE_CLASS: Record<FeedbackStatus, string> = {
  RECEIVED: 'bg-primary/10 text-primary',
  UNDER_REVIEW: 'bg-amber-500/10 text-amber-700',
  PLANNED: 'bg-emerald-500/10 text-emerald-700',
  CLOSED: 'bg-muted text-muted-foreground',
}

const CATEGORY_OPTIONS: Array<{ value: FeedbackCategory; label: string }> = [
  { value: 'PRODUCT_SUGGESTION', label: '产品建议' },
  { value: 'BUG_REPORT', label: 'Bug 反馈' },
  { value: 'UX_ISSUE', label: '体验问题' },
  { value: 'OTHER', label: '其他' },
]

const STATUS_OPTIONS: Array<{ value: FeedbackStatus; label: string }> = [
  { value: 'RECEIVED', label: '已收到' },
  { value: 'UNDER_REVIEW', label: '处理中' },
  { value: 'PLANNED', label: '已规划' },
  { value: 'CLOSED', label: '已关闭' },
]

const EMPTY_ITEMS: AdminFeedbackTicketSummary[] = []

function normalizeDraftNote(value: string): string | null {
  const normalized = value.trim()
  return normalized ? normalized : null
}

function StatusBadge({ status }: { status: FeedbackStatus }) {
  return (
    <Badge className={cn('border-transparent', STATUS_BADGE_CLASS[status])}>
      {STATUS_LABELS[status]}
    </Badge>
  )
}

export function FeedbackInboxTab() {
  const [statusFilter, setStatusFilter] = useState<'all' | FeedbackStatus>('all')
  const [categoryFilter, setCategoryFilter] = useState<'all' | FeedbackCategory>('all')
  const [sourceRouteFilter, setSourceRouteFilter] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const feedbackList = useAdminFeedbackList({
    status: statusFilter === 'all' ? undefined : statusFilter,
    category: categoryFilter === 'all' ? undefined : categoryFilter,
    source_route: sourceRouteFilter.trim() || undefined,
    limit: 20,
  })
  const detailQuery = useAdminFeedbackDetail(selectedId)
  const updateFeedback = useAdminUpdateFeedback()

  const [draftStatus, setDraftStatus] = useState<FeedbackStatus>('RECEIVED')
  const [draftPublicNote, setDraftPublicNote] = useState('')
  const [draftInternalNote, setDraftInternalNote] = useState('')

  const items = feedbackList.data?.data ?? EMPTY_ITEMS
  const detail = detailQuery.data?.data ?? null
  const nextPublicNote = normalizeDraftNote(draftPublicNote)
  const nextInternalNote = normalizeDraftNote(draftInternalNote)
  const currentPublicNote = detail?.public_resolution_note ?? null
  const currentInternalNote = detail?.internal_note ?? null
  const hasChanges = Boolean(
    detail
    && (
      draftStatus !== detail.status
      || nextPublicNote !== currentPublicNote
      || nextInternalNote !== currentInternalNote
    ),
  )

  useEffect(() => {
    if (items.length === 0) {
      if (selectedId !== null) {
        setSelectedId(null)
      }
      return
    }
    if (!selectedId || !items.some((item) => item.id === selectedId)) {
      setSelectedId(items[0].id)
    }
  }, [items, selectedId])

  useEffect(() => {
    if (!detail) {
      return
    }
    setDraftStatus(detail.status)
    setDraftPublicNote(detail.public_resolution_note ?? '')
    setDraftInternalNote(detail.internal_note ?? '')
  }, [detail])

  async function handleSave() {
    if (!selectedId || !detail || !hasChanges) {
      return
    }
    const payload: {
      feedback_id: string
      status?: FeedbackStatus
      public_resolution_note?: string | null
      internal_note?: string | null
    } = {
      feedback_id: selectedId,
    }
    if (draftStatus !== detail.status) {
      payload.status = draftStatus
    }
    if (nextPublicNote !== currentPublicNote) {
      payload.public_resolution_note = nextPublicNote
    }
    if (nextInternalNote !== currentInternalNote) {
      payload.internal_note = nextInternalNote
    }
    await updateFeedback.mutateAsync({
      ...payload,
    })
  }

  return (
    <div data-ui="stack" data-direction="col" data-gap="0">
      <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground mb-6">
        这里专门处理产品建议、Bug 和体验问题，不与投诉/申诉 case 共用同一条治理队列。
      </div>

      <div data-ui="grid" data-gap="4" className="xl:grid-cols-[320px_minmax(0,1fr)]">
        <section data-ui="section" className="border-b border-border pb-6 mb-6 last:border-0 last:pb-0 last:mb-0">
          <div className="mb-4 space-y-3">
            <h3 className="text-sm font-semibold">意见箱列表</h3>
            <div className="grid gap-3">
              <div data-ui="stack" data-direction="col" data-gap="1">
                <label htmlFor="admin-feedback-status-filter" className="text-[11px] font-medium text-muted-foreground">
                  状态筛选
                </label>
                <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'all' | FeedbackStatus)}>
                  <SelectTrigger id="admin-feedback-status-filter" aria-label="状态筛选">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部状态</SelectItem>
                    {STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div data-ui="stack" data-direction="col" data-gap="1">
                <label htmlFor="admin-feedback-category-filter" className="text-[11px] font-medium text-muted-foreground">
                  类型筛选
                </label>
                <Select value={categoryFilter} onValueChange={(value) => setCategoryFilter(value as 'all' | FeedbackCategory)}>
                  <SelectTrigger id="admin-feedback-category-filter" aria-label="类型筛选">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部类型</SelectItem>
                    {CATEGORY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div data-ui="stack" data-direction="col" data-gap="1">
                <label htmlFor="admin-feedback-source-route-filter" className="text-[11px] font-medium text-muted-foreground">
                  来源路由
                </label>
                <Input
                  id="admin-feedback-source-route-filter"
                  value={sourceRouteFilter}
                  onChange={(event) => setSourceRouteFilter(event.target.value)}
                  placeholder="例如 /posts/post-1"
                />
              </div>
            </div>
          </div>
          <div data-ui="stack" data-direction="col" data-gap="3">
            {feedbackList.isLoading ? (
              <>
                {[1, 2, 3].map((item) => (
                  <Skeleton key={item} className="h-24 rounded-xl" />
                ))}
              </>
            ) : items.length === 0 ? (
              <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
                当前筛选条件下没有反馈。
              </div>
            ) : (
              items.map((item) => {
                const active = item.id === selectedId
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={active}
                    className={cn(
                      'w-full rounded-2xl border px-4 py-3 text-left transition-all',
                      active
                        ? 'border-primary/35 bg-primary/6 shadow-sm'
                        : 'bg-background hover:border-primary/20 hover:bg-muted/20',
                    )}
                    onClick={() => setSelectedId(item.id)}
                    disabled={feedbackList.isLoading}
                  >
                    <div data-ui="stack" data-direction="row" data-align="start" data-justify="between" data-gap="3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{item.title}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {item.submitter.display_name} · {relativeTime(item.updated_at)}
                        </p>
                      </div>
                      <StatusBadge status={item.status} />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{CATEGORY_LABELS[item.category]}</Badge>
                      <span className="text-[11px] text-muted-foreground">
                        {item.attachments.length} 张截图
                      </span>
                    </div>
                    <p className="mt-2 truncate text-[11px] text-muted-foreground">
                      来源：{item.source_route ?? '未记录'}
                    </p>
                  </button>
                )
              })
            )}
          </div>
        </section>

        <section data-ui="section" className="border-b border-border pb-6 mb-6 last:border-0 last:pb-0 last:mb-0">
          <div className="mb-4 space-y-2">
            <h3 className="text-sm font-semibold">处理详情</h3>
            <p className="text-xs leading-5 text-muted-foreground">
              可更新状态、公开结论和内部备注。只有状态和公开结论会同步回用户侧时间线与通知中心。
            </p>
          </div>
          <div data-ui="stack" data-direction="col" data-gap="5">
            {detailQuery.isLoading && selectedId ? (
              <div data-ui="stack" data-direction="col" data-gap="3">
                <Skeleton className="h-7 w-40" />
                <Skeleton className="h-28 rounded-xl" />
                <Skeleton className="h-48 rounded-xl" />
              </div>
            ) : detail ? (
              <>
                <div className="space-y-3 rounded-2xl border bg-muted/10 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div data-ui="stack" data-direction="col" data-gap="2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{CATEGORY_LABELS[detail.category]}</Badge>
                        <StatusBadge status={detail.status} />
                      </div>
                      <h2 className="text-lg font-semibold leading-7">{detail.title}</h2>
                    </div>
                  </div>

                  <div data-ui="grid" data-gap="3" className="text-xs text-muted-foreground sm:grid-cols-2">
                    <div>提交人：{detail.submitter.display_name}</div>
                    <div>邮箱：{detail.submitter.email ?? '未记录'}</div>
                    <div>入口：{detail.entry_surface ?? 'feedback_page'}</div>
                    <div>来源：{detail.source_route ?? '未记录'}</div>
                  </div>

                  <div className="rounded-xl border bg-background/80 px-4 py-4">
                    <p className="text-sm leading-7 text-foreground">{detail.body}</p>
                  </div>

                  {detail.attachments.length > 0 ? (
                    <div data-ui="grid" data-gap="3" className="sm:grid-cols-2 xl:grid-cols-3">
                      {detail.attachments.map((attachment) => (
                        <a
                          key={attachment.id}
                          href={attachment.url}
                          target="_blank"
                          rel="noreferrer"
                          className="group overflow-hidden rounded-xl border bg-background transition-colors hover:border-primary/30"
                        >
                          <div className="aspect-[4/3] overflow-hidden bg-muted/35">
                            <img
                              src={attachment.url}
                              alt={`反馈截图 ${detail.title}`}
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <div className="flex items-center justify-between gap-3 px-3 py-2 text-[11px] text-muted-foreground">
                            <span>{attachment.mime_type.replace('image/', '').toUpperCase()}</span>
                            <span>{Math.max(1, Math.round(attachment.file_size_bytes / 1024))} KB</span>
                          </div>
                        </a>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div data-ui="grid" data-gap="4" className="xl:grid-cols-2">
                  <div className="space-y-4 rounded-2xl border bg-background/70 p-4">
                    <div data-ui="stack" data-direction="col" data-gap="1">
                      <label htmlFor="admin-feedback-detail-status" className="text-[11px] font-medium text-muted-foreground">
                        状态
                      </label>
                      <Select value={draftStatus} onValueChange={(value) => setDraftStatus(value as FeedbackStatus)}>
                        <SelectTrigger id="admin-feedback-detail-status" aria-label="处理状态">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div data-ui="stack" data-direction="col" data-gap="1">
                      <label htmlFor="admin-feedback-public-note" className="text-[11px] font-medium text-muted-foreground">
                        公开处理结论
                      </label>
                      <Textarea
                        id="admin-feedback-public-note"
                        value={draftPublicNote}
                        onChange={(event) => setDraftPublicNote(event.target.value)}
                        rows={7}
                        placeholder="写给用户看的结论，例如：已纳入下个迭代。"
                      />
                    </div>

                    <div data-ui="stack" data-direction="col" data-gap="1">
                      <label htmlFor="admin-feedback-internal-note" className="text-[11px] font-medium text-muted-foreground">
                        内部备注
                      </label>
                      <Textarea
                        id="admin-feedback-internal-note"
                        value={draftInternalNote}
                        onChange={(event) => setDraftInternalNote(event.target.value)}
                        rows={7}
                        placeholder="仅管理员可见的内部说明。"
                      />
                    </div>

                    <div className="flex justify-end">
                      <Button
                        onClick={() => void handleSave()}
                        disabled={updateFeedback.isPending || !hasChanges}
                      >
                        {updateFeedback.isPending ? '保存中…' : '保存处理结果'}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3 rounded-2xl border bg-muted/10 p-4">
                    <h3 className="text-sm font-medium">时间线</h3>
                    {detail.history.length === 0 ? (
                      <div className="rounded-xl border border-dashed bg-background/80 px-4 py-10 text-center text-sm text-muted-foreground">
                        当前没有时间线记录。
                      </div>
                    ) : (
                      <ul data-ui="list" data-variant="admin-rows">
                        {detail.history.map((entry) => (
                          <li key={entry.id} className="py-3">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div data-ui="stack" data-direction="row" data-align="center" data-gap="2">
                                <Badge variant="outline">{entry.event_type}</Badge>
                                {entry.to_status ? <StatusBadge status={entry.to_status} /> : null}
                              </div>
                              <span className="text-[11px] text-muted-foreground">
                                {relativeTime(entry.created_at)}
                              </span>
                            </div>
                            <p className="mt-3 text-sm leading-6 text-foreground">
                              {entry.message ?? '状态已更新。'}
                            </p>
                            {entry.actor ? (
                              <p className="mt-1 text-[11px] text-muted-foreground">
                                {entry.actor.display_name}
                              </p>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-dashed bg-muted/20 px-4 py-16 text-center text-sm text-muted-foreground">
                选择一条反馈，查看正文、截图和处理历史。
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
