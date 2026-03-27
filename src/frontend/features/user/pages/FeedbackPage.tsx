import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { useCreateFeedback, useMyFeedback, useMyFeedbackDetail } from '@/api/hooks/user'
import type {
  FeedbackCategory,
  FeedbackHistoryEntry,
  FeedbackStatus,
  FeedbackTicketSummary,
} from '@/api/types'
import { cn } from '@/lib/utils'
import { useAuth } from '@/shared/hooks/use-auth'
import { relativeTime } from '@/shared/utils/relative-time'

const CATEGORY_OPTIONS: Array<{ value: FeedbackCategory; label: string; hint: string }> = [
  {
    value: 'PRODUCT_SUGGESTION',
    label: '产品建议',
    hint: '你希望新增什么能力，或者哪些体验值得升级。',
  },
  {
    value: 'BUG_REPORT',
    label: 'Bug 反馈',
    hint: '页面报错、接口异常、状态不一致等问题。',
  },
  {
    value: 'UX_ISSUE',
    label: '体验问题',
    hint: '流程绕、文案不清、布局不顺手等体验障碍。',
  },
  {
    value: 'OTHER',
    label: '其他',
    hint: '以上都不匹配时使用这一项。',
  },
]

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

const HISTORY_LABELS: Record<FeedbackHistoryEntry['event_type'], string> = {
  SUBMITTED: '已提交',
  STATUS_CHANGED: '状态更新',
  PUBLIC_NOTE_UPDATED: '公开结论更新',
  INTERNAL_NOTE_UPDATED: '内部备注更新',
}

type FeedbackLocationState = {
  feedbackSourceRoute?: string
  feedbackEntrySurface?: string
} | null

const EMPTY_TICKETS: FeedbackTicketSummary[] = []

function FeedbackGate() {
  return (
    <div className="space-y-5">
      <Card className="overflow-hidden border-primary/20 bg-warning/[0.04]">
        <CardHeader className="space-y-3">
          <Badge variant="outline" className="w-fit">Feedback Inbox</Badge>
          <div className="space-y-2">
            <h1 className="text-xl font-semibold tracking-tight">意见反馈</h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              登录后可以提交产品建议、Bug 和体验问题，并在这里持续看到管理员的公开处理结论。
            </p>
          </div>
        </CardHeader>
      </Card>

      <Card className="border-dashed">
        <CardContent className="flex flex-col gap-4 p-8 text-center">
          <div className="space-y-1">
            <p className="text-sm font-medium">先登录，再提交意见</p>
            <p className="text-xs text-muted-foreground">
              截图和状态回执都需要绑定到你的账号，游客不能使用该入口。
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link to="/login">登录</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/help">查看规则说明</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function FeedbackStatusBadge({ status }: { status: FeedbackStatus }) {
  return (
    <Badge className={cn('border-transparent', STATUS_BADGE_CLASS[status])}>
      {STATUS_LABELS[status]}
    </Badge>
  )
}

function TicketAttachmentStrip({ attachments }: { attachments: FeedbackTicketSummary['attachments'] }) {
  if (attachments.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-5 text-xs text-muted-foreground">
        这条反馈没有附带截图。
      </div>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {attachments.map((attachment, index) => (
        <a
          key={attachment.id}
          href={attachment.url}
          target="_blank"
          rel="noreferrer"
          className="group overflow-hidden rounded-xl border bg-muted/15 transition-colors hover:border-primary/30"
        >
          <div className="aspect-[4/3] overflow-hidden bg-muted/35">
            <img
              src={attachment.url}
              alt={`反馈截图 ${index + 1}`}
              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
            />
          </div>
          <div className="flex items-center justify-between gap-3 px-3 py-2 text-[11px] text-muted-foreground">
            <span>{attachment.mime_type.replace('image/', '').toUpperCase()}</span>
            <span>{Math.max(1, Math.round(attachment.file_size_bytes / 1024))} KB</span>
          </div>
        </a>
      ))}
    </div>
  )
}

function FeedbackTimeline({ history }: { history: FeedbackHistoryEntry[] }) {
  if (history.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-5 text-xs text-muted-foreground">
        这条反馈还没有新的处理记录。
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {history.map((entry) => (
        <div key={entry.id} className="rounded-xl border bg-background/80 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline">{HISTORY_LABELS[entry.event_type]}</Badge>
              {entry.to_status ? <FeedbackStatusBadge status={entry.to_status} /> : null}
            </div>
            <span className="text-[11px] text-muted-foreground">{relativeTime(entry.created_at)}</span>
          </div>
          <div className="mt-3 space-y-1">
            {entry.message ? (
              <p className="text-sm leading-6 text-foreground">{entry.message}</p>
            ) : (
              <p className="text-sm leading-6 text-muted-foreground">
                状态已更新。
              </p>
            )}
            {entry.actor ? (
              <p className="text-[11px] text-muted-foreground">
                操作人：{entry.actor.display_name}
              </p>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  )
}

export function FeedbackPage() {
  const { isAuthenticated } = useAuth()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const locationStateRef = useRef<FeedbackLocationState>((location.state ?? null) as FeedbackLocationState)
  if (location.state && !locationStateRef.current) {
    locationStateRef.current = location.state as FeedbackLocationState
  }
  const locationState = locationStateRef.current
  const feedbackList = useMyFeedback(undefined, isAuthenticated)
  const createFeedback = useCreateFeedback()
  const selectedTicketId = searchParams.get('ticketId')
  const detailQuery = useMyFeedbackDetail(selectedTicketId, isAuthenticated && Boolean(selectedTicketId))

  const [category, setCategory] = useState<FeedbackCategory>('PRODUCT_SUGGESTION')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [previewUrls, setPreviewUrls] = useState<Array<{ name: string; url: string }>>([])

  const tickets = feedbackList.data?.data ?? EMPTY_TICKETS
  const selectedSummary = tickets.find((item) => item.id === selectedTicketId) ?? tickets[0] ?? null
  const selectedDetail = detailQuery.data?.data ?? null
  const sourceRoute = locationState?.feedbackSourceRoute ?? null
  const entrySurface = locationState?.feedbackEntrySurface ?? null

  useEffect(() => {
    const nextUrls = files.map((file) => ({
      name: file.name,
      url: URL.createObjectURL(file),
    }))
    setPreviewUrls(nextUrls)
    return () => {
      nextUrls.forEach((item) => URL.revokeObjectURL(item.url))
    }
  }, [files])

  useEffect(() => {
    if (selectedTicketId || tickets.length === 0) {
      return
    }
    const next = new URLSearchParams(searchParams)
    next.set('ticketId', tickets[0].id)
    setSearchParams(next, { replace: true, state: locationState ?? undefined })
  }, [locationState, searchParams, selectedTicketId, setSearchParams, tickets])

  useEffect(() => {
    if (!selectedTicketId || !detailQuery.isError) {
      return
    }
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      if (tickets[0]) {
        next.set('ticketId', tickets[0].id)
      } else {
        next.delete('ticketId')
      }
      return next
    }, { replace: true, state: locationState ?? undefined })
  }, [detailQuery.isError, locationState, selectedTicketId, setSearchParams, tickets])

  if (!isAuthenticated) {
    return <FeedbackGate />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const created = await createFeedback.mutateAsync({
      category,
      title,
      body,
      entry_surface: entrySurface ?? 'feedback_page',
      source_route: sourceRoute ?? null,
      attachments: files,
    })

    setTitle('')
    setBody('')
    setFiles([])
    setCategory('PRODUCT_SUGGESTION')
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      next.set('ticketId', created.data.id)
      return next
    }, { state: locationState ?? undefined })
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-primary/20 bg-success/[0.04]">
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="outline">Feedback Inbox</Badge>
            {sourceRoute ? (
              <Badge variant="secondary">来源：{sourceRoute}</Badge>
            ) : (
              <Badge variant="secondary">站内意见通道</Badge>
            )}
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-semibold tracking-tight">意见反馈</h1>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              这里专门收产品建议、Bug 和体验问题，不会和举报申诉混在一起。提交后，管理员的公开处理结论会直接回到你的历史记录和通知中心。
            </p>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.45fr)]">
        <Card className="border-primary/15">
          <CardHeader className="space-y-2">
            <CardTitle>提交反馈</CardTitle>
            <p className="text-xs leading-5 text-muted-foreground">
              选择反馈类型，写清楚问题或建议。截图会作为管理员查看的受保护材料，只对你本人和管理员可见。
            </p>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
              <div className="space-y-2">
                <label htmlFor="feedback-category-trigger" className="text-xs font-medium text-muted-foreground">
                  反馈类型
                </label>
                <Select value={category} onValueChange={(value) => setCategory(value as FeedbackCategory)}>
                  <SelectTrigger id="feedback-category-trigger" aria-label="反馈类型">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] leading-5 text-muted-foreground">
                  {CATEGORY_OPTIONS.find((option) => option.value === category)?.hint}
                </p>
              </div>

              <div className="space-y-2">
                <label htmlFor="feedback-title" className="text-xs font-medium text-muted-foreground">
                  标题
                </label>
                <Input
                  id="feedback-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={200}
                  placeholder="例如：帖子页的图片切换逻辑会闪烁"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="feedback-body" className="text-xs font-medium text-muted-foreground">
                  详细描述
                </label>
                <Textarea
                  id="feedback-body"
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  maxLength={5000}
                  rows={7}
                  placeholder="请尽量写清触发步骤、预期行为和实际表现。"
                />
              </div>

              <div className="rounded-xl border bg-muted/20 px-3 py-3 text-[11px] leading-5 text-muted-foreground">
                <div>入口位置：{entrySurface ?? 'feedback_page'}</div>
                <div>来源路由：{sourceRoute ?? '未记录，表示你是直接进入该页'}</div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="feedback-attachments" className="text-xs font-medium text-muted-foreground">
                    截图上传
                  </label>
                  <span className="text-[11px] text-muted-foreground">最多 3 张，支持 PNG / JPEG / WebP</span>
                </div>
                <Input
                  id="feedback-attachments"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  multiple
                  onClick={(event) => {
                    event.currentTarget.value = ''
                  }}
                  onChange={(event) => {
                    const nextFiles = Array.from(event.target.files ?? []) as File[]
                    const limitedFiles = nextFiles.slice(0, 3)
                    setFiles(limitedFiles)
                  }}
                />
                {previewUrls.length > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-3">
                    {previewUrls.map((item, index) => (
                      <div key={item.url} className="overflow-hidden rounded-xl border bg-muted/15">
                        <div className="aspect-[4/3] overflow-hidden bg-muted/40">
                          <img src={item.url} alt={`待上传截图 ${index + 1}`} className="h-full w-full object-cover" />
                        </div>
                        <div className="flex items-center justify-between gap-2 px-3 py-2">
                          <p className="truncate text-[11px] text-muted-foreground">{item.name}</p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-[11px]"
                            onClick={() => {
                              setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))
                            }}
                          >
                            移除
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="flex items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setCategory('PRODUCT_SUGGESTION')
                    setTitle('')
                    setBody('')
                    setFiles([])
                  }}
                >
                  清空
                </Button>
                <Button type="submit" disabled={createFeedback.isPending}>
                  {createFeedback.isPending ? '提交中…' : '提交反馈'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-primary/15">
            <CardHeader className="space-y-2">
              <CardTitle>我的意见</CardTitle>
              <p className="text-xs leading-5 text-muted-foreground">
                这里集中显示你的全部反馈、当前状态和管理员公开结论。点开任意一条，可以看到截图和时间线。
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {feedbackList.isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((item) => (
                    <Skeleton key={item} className="h-24 rounded-xl" />
                  ))}
                </div>
              ) : tickets.length === 0 ? (
                <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-10 text-center">
                  <p className="text-sm font-medium">还没有提交过反馈</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    第一条建议、第一张截图和后续处理结论都会从这里开始沉淀。
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 xl:grid-cols-[minmax(0,0.72fr)_minmax(0,1fr)]">
                  <div className="space-y-3">
                    {tickets.map((ticket) => {
                      const isSelected = ticket.id === (selectedTicketId ?? selectedSummary?.id)
                      return (
                        <button
                          key={ticket.id}
                          type="button"
                          aria-pressed={isSelected}
                          className={cn(
                            'w-full rounded-2xl border px-4 py-3 text-left transition-all',
                            isSelected
                              ? 'border-primary/35 bg-primary/6 shadow-sm'
                              : 'bg-background hover:border-primary/20 hover:bg-muted/20',
                          )}
                          onClick={() => {
                            setSearchParams((current) => {
                              const next = new URLSearchParams(current)
                              next.set('ticketId', ticket.id)
                              return next
                            }, { state: locationState ?? undefined })
                          }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{ticket.title}</p>
                              <p className="mt-1 text-[11px] text-muted-foreground">
                                {relativeTime(ticket.updated_at)}
                              </p>
                            </div>
                            <FeedbackStatusBadge status={ticket.status} />
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <Badge variant="outline">{CATEGORY_LABELS[ticket.category]}</Badge>
                            <span className="text-[11px] text-muted-foreground">
                              {ticket.attachments.length > 0 ? `${ticket.attachments.length} 张截图` : '无截图'}
                            </span>
                          </div>
                          <p className="mt-3 line-clamp-2 text-xs leading-5 text-muted-foreground">
                            {ticket.public_resolution_note ?? ticket.body}
                          </p>
                          {ticket.attachments.length > 0 ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {ticket.attachments.slice(0, 3).map((attachment, index) => (
                                <div
                                  key={attachment.id}
                                  className="h-12 w-12 overflow-hidden rounded-lg border bg-muted/20"
                                >
                                  <img
                                    src={attachment.url}
                                    alt={`反馈缩略图 ${index + 1}`}
                                    className="h-full w-full object-cover"
                                  />
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </button>
                      )
                    })}
                  </div>

                  <div className="space-y-5 rounded-2xl border bg-muted/10 p-4">
                    {detailQuery.isLoading && selectedTicketId ? (
                      <div className="space-y-3">
                        <Skeleton className="h-8 w-32" />
                        <Skeleton className="h-20 rounded-xl" />
                        <Skeleton className="h-48 rounded-xl" />
                      </div>
                    ) : selectedDetail ?? selectedSummary ? (
                      <>
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline">
                                  {CATEGORY_LABELS[(selectedDetail ?? selectedSummary)!.category]}
                                </Badge>
                                <FeedbackStatusBadge status={(selectedDetail ?? selectedSummary)!.status} />
                              </div>
                              <h2 className="mt-3 text-lg font-semibold leading-7">
                                {(selectedDetail ?? selectedSummary)!.title}
                              </h2>
                            </div>
                          </div>

                          <div className="rounded-xl border bg-background/80 px-4 py-4">
                            <p className="text-sm leading-7 text-foreground">
                              {(selectedDetail ?? selectedSummary)!.body}
                            </p>
                          </div>

                          {(selectedDetail ?? selectedSummary)!.public_resolution_note ? (
                            <div className="rounded-xl border border-success/25 bg-success/[0.06] px-4 py-4">
                              <p className="text-xs font-medium uppercase tracking-[0.18em] text-success">
                                公开处理结论
                              </p>
                              <p className="mt-2 text-sm leading-6 text-foreground">
                                {(selectedDetail ?? selectedSummary)!.public_resolution_note}
                              </p>
                            </div>
                          ) : null}
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-3">
                            <h3 className="text-sm font-medium">截图材料</h3>
                            <span className="text-[11px] text-muted-foreground">
                              {(selectedDetail ?? selectedSummary)!.attachments.length} 张
                            </span>
                          </div>
                          <TicketAttachmentStrip attachments={(selectedDetail ?? selectedSummary)!.attachments} />
                        </div>

                        {selectedDetail ? (
                          <div className="space-y-3">
                            <h3 className="text-sm font-medium">处理时间线</h3>
                            <FeedbackTimeline history={selectedDetail.history} />
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <div className="rounded-xl border border-dashed bg-background/70 px-4 py-12 text-center text-sm text-muted-foreground">
                        选择一条反馈，查看它的完整状态和处理记录。
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-dashed">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-xs text-muted-foreground">
              <span>举报、申诉、隐私和删除请求仍在独立的 Safety Center 中处理。</span>
              <Button asChild variant="outline" size="sm">
                <Link to="/safety">前往 Safety Center</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
