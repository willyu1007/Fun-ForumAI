import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'
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

const CATEGORY_OPTIONS: Array<{ value: FeedbackCategory; label: string }> = [
  { value: 'PRODUCT_SUGGESTION', label: '产品建议' },
  { value: 'BUG_REPORT', label: 'Bug 反馈' },
  { value: 'UX_ISSUE', label: '体验问题' },
  { value: 'OTHER', label: '其他' },
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
  UNDER_REVIEW: 'bg-warning/10 text-warning',
  PLANNED: 'bg-success/10 text-success',
  CLOSED: 'bg-muted text-muted-foreground',
}

const HISTORY_LABELS: Record<FeedbackHistoryEntry['event_type'], string> = {
  SUBMITTED: '已提交',
  STATUS_CHANGED: '状态更新',
  PUBLIC_NOTE_UPDATED: '公开结论更新',
  INTERNAL_NOTE_UPDATED: '内部备注更新',
}

const STATUS_STEPS: FeedbackStatus[] = ['RECEIVED', 'UNDER_REVIEW', 'PLANNED', 'CLOSED']

type FeedbackLocationState = {
  feedbackSourceRoute?: string
  feedbackEntrySurface?: string
} | null

type ActiveTab = 'submit' | 'history'
type HistoryFilter = 'ALL' | FeedbackStatus

const EMPTY_TICKETS: FeedbackTicketSummary[] = []

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function getStepIndex(status: FeedbackStatus): number {
  const idx = STATUS_STEPS.indexOf(status)
  return idx === -1 ? 0 : idx
}

function getFeedbackSourceLabel(sourceRoute: string | null) {
  if (!sourceRoute) return null
  if (sourceRoute.startsWith('/posts/')) return '帖子详情'
  if (sourceRoute.startsWith('/c/')) return '社区页'
  if (['/safety', '/help', '/feedback'].includes(sourceRoute)) return null
  const normalized = sourceRoute.replace(/^\//, '')
  return normalized || null
}

/* ------------------------------------------------------------------ */
/*  Small Components                                                  */
/* ------------------------------------------------------------------ */

function FeedbackStatusBadge({ status }: { status: FeedbackStatus }) {
  return (
    <Badge className={cn('border-transparent', STATUS_BADGE_CLASS[status])}>
      {STATUS_LABELS[status]}
    </Badge>
  )
}

function StepProgressBar({ status }: { status: FeedbackStatus }) {
  const current = getStepIndex(status)
  return (
    <div className="flex items-center gap-1">
      {STATUS_STEPS.map((step, i) => {
        const done = i <= current
        return (
          <div key={step} className="flex items-center gap-1">
            <div className="flex flex-col items-center">
              <div className={cn('h-2 w-2 rounded-full', done ? c.accentBg : c.dot)} />
              <span className={cn('mt-1 text-[10px] leading-none', done ? cn('font-medium', c.title) : c.sub)}>
                {STATUS_LABELS[step]}
              </span>
            </div>
            {i < STATUS_STEPS.length - 1 && (
              <div className={cn('mb-3.5 h-[1.5px] w-4 sm:w-6', i < current ? c.accentBg : c.dot)} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function FeedbackTimeline({ history }: { history: FeedbackHistoryEntry[] }) {
  if (history.length === 0) {
    return <p className={cn('py-2 text-xs', c.sub)}>暂无处理记录。</p>
  }

  return (
    <div className="space-y-3">
      {history.map((entry) => (
        <div key={entry.id} className="flex gap-3">
          <div className="flex flex-col items-center pt-1.5">
            <div className={cn('h-1.5 w-1.5 rounded-full', c.accentBg)} />
            <div className={cn('w-px flex-1', c.lineBg)} />
          </div>
          <div className="pb-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn('text-xs font-medium', c.title)}>{HISTORY_LABELS[entry.event_type]}</span>
              {entry.to_status ? <FeedbackStatusBadge status={entry.to_status} /> : null}
              <span className={cn('text-[11px]', c.muted)}>{relativeTime(entry.created_at)}</span>
            </div>
            {entry.message ? (
              <p className={cn('mt-1 text-sm leading-relaxed', c.title)}>{entry.message}</p>
            ) : null}
            {entry.actor ? (
              <p className={cn('mt-0.5 text-[11px]', c.sub)}>操作人：{entry.actor.display_name}</p>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Unauthenticated Gate                                              */
/* ------------------------------------------------------------------ */

function FeedbackGate() {
  return (
    <div className={cn('mx-auto max-w-3xl space-y-10 pt-10 pb-24 px-4', c.page)}>
      <div className="space-y-3">
        <h1 className={cn('text-2xl font-bold tracking-tight', c.title)}>意见反馈</h1>
        <p className={cn('text-sm leading-relaxed', c.sub)}>
          登录后可提交反馈并查看处理结果。
        </p>
      </div>

      <div className={cn('flex flex-col items-center justify-center gap-6 border-t pt-12 text-center', c.line)}>
        <div className="space-y-2">
          <h2 className={cn('text-lg font-medium', c.title)}>先登录，再提交意见</h2>
          <p className={cn('text-sm', c.sub)}>登录后可保留反馈记录和处理进度。</p>
        </div>
        <div className="flex flex-wrap justify-center gap-4">
          <Button asChild size="lg" className={cn('rounded-full px-8', c.btn)}>
            <Link to="/login">登录</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className={cn('rounded-full px-8', c.line)}>
            <Link to="/help">查看规则说明</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Hero — open, no card                                              */
/* ------------------------------------------------------------------ */

function FeedbackHero({ sourceLabel }: { sourceLabel: string | null }) {
  return (
    <div className="space-y-3">
      {sourceLabel ? (
        <span className={cn('inline-flex items-center rounded-full bg-accent/40 px-3 py-1 text-xs', c.sub)}>
          来自 {sourceLabel}
        </span>
      ) : null}
      <h1 className={cn('text-3xl font-semibold tracking-tight sm:text-[2.4rem]', c.title)}>
        每一条<em className={cn('not-italic', c.accent)}>声音</em>，都在推动改变。
      </h1>
      <p className={cn('text-sm', c.sub)}>
        你的反馈是我们改进的起点，无论建议还是问题都会被认真对待。
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Stats line + Tab switcher — no card, just a divider row           */
/* ------------------------------------------------------------------ */

function StatsBar({
  totalCount,
  underReviewCount,
  plannedCount,
  activeTab,
  onTabChange,
}: {
  totalCount: number
  underReviewCount: number
  plannedCount: number
  activeTab: ActiveTab
  onTabChange: (tab: ActiveTab) => void
}) {
  return (
    <div className={cn('border-b pb-4', c.line)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-5">
          <StatItem label="已提交" value={totalCount} />
          <div className={cn('h-4 w-px', c.lineBg)} />
          <StatItem label="处理中" value={underReviewCount} />
          <div className={cn('h-4 w-px', c.lineBg)} />
          <StatItem label="已规划" value={plannedCount} />
        </div>

        <div className={cn('flex gap-1 rounded-full p-0.5', 'border', c.line)}>
          {([
            { id: 'submit' as const, label: '提交意见' },
            { id: 'history' as const, label: '反馈记录' },
          ]).map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={cn(
                'rounded-full px-5 py-1.5 text-sm font-medium transition-all',
                activeTab === tab.id
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : cn(c.sub, 'hover:text-foreground'),
              )}
              onClick={() => onTabChange(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function StatItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className={cn('text-[11px] font-medium uppercase tracking-widest', c.muted)}>{label}</span>
      <span className={cn('text-xl font-semibold tabular-nums', c.title)}>{value}</span>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Tab 1 — Submit                                                    */
/* ------------------------------------------------------------------ */

function SubmitTab({
  category,
  setCategory,
  title,
  setTitle,
  body,
  setBody,
  setFiles,
  previewUrls,
  isPending,
  onSubmit,
}: {
  category: FeedbackCategory
  setCategory: (v: FeedbackCategory) => void
  title: string
  setTitle: (v: string) => void
  body: string
  setBody: (v: string) => void
  setFiles: (fn: (prev: File[]) => File[]) => void
  previewUrls: Array<{ name: string; url: string }>
  isPending: boolean
  onSubmit: (e: FormEvent<HTMLFormElement>) => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_minmax(0,18rem)] lg:items-stretch">
      {/* form */}
      <form className="space-y-8" onSubmit={onSubmit}>
        <div>
          <label htmlFor="feedback-title" className={cn('text-sm font-medium', c.title)}>
            反馈主题
          </label>
          <Textarea
            id="feedback-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            rows={2}
            placeholder="概括你的想法"
            className={cn(
              'mt-4 !field-sizing-fixed !min-h-0 resize-none rounded-none border-0 border-b bg-transparent px-0 py-1 text-lg font-medium leading-snug placeholder:text-muted-foreground/60 focus-visible:border-ring focus-visible:ring-0',
              c.line,
              c.title,
            )}
          />
        </div>

        <div>
          <label htmlFor="feedback-body" className={cn('text-sm font-medium', c.title)}>
            详细描述
          </label>
          <div className="relative">
            <Textarea
              id="feedback-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={5000}
              rows={6}
              placeholder="请写清触发步骤、预期行为和实际表现……"
              className={cn(
                'mt-4 resize-none border-0 border-b bg-transparent pr-10 placeholder:text-muted-foreground/60 focus-visible:border-ring focus-visible:ring-0',
                c.line,
                c.title,
              )}
            />
            <button
              type="button"
              className={cn(
                'absolute bottom-2 right-0 flex h-7 w-7 items-center justify-center rounded-full transition-colors',
                c.muted,
                'hover:text-foreground',
              )}
              aria-label="截图上传"
              onClick={() => fileInputRef.current?.click()}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </button>
            <Input
              ref={fileInputRef}
              id="feedback-attachments"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              className="hidden"
              onClick={(e) => { e.currentTarget.value = '' }}
              onChange={(e) => {
                const next = Array.from(e.target.files ?? []) as File[]
                setFiles(() => next.slice(0, 3))
              }}
            />
          </div>
        </div>

        {previewUrls.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {previewUrls.map((item, index) => (
              <div key={item.url} className={cn('group relative h-14 w-14 overflow-hidden rounded-lg border', c.line)}>
                <img src={item.url} alt={`待上传截图 ${index + 1}`} className="h-full w-full object-cover" />
                <button
                  type="button"
                  className="absolute inset-0 flex items-center justify-center bg-background/80 text-foreground opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={() => setFiles((cur) => cur.filter((_, i) => i !== index))}
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span className="sr-only">移除</span>
                </button>
              </div>
            ))}
            <span className={cn('self-center text-xs', c.muted)}>最多 3 张</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Select value={category} onValueChange={(v) => setCategory(v as FeedbackCategory)}>
            <SelectTrigger
              id="feedback-category-trigger"
              aria-label="反馈类型"
              className={cn('h-10 w-auto rounded-full px-4', c.line, c.title)}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORY_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="submit" size="lg" className={cn('rounded-full px-8', c.btn)} disabled={isPending}>
            {isPending ? '提交中…' : '提交反馈'}
            {!isPending && (
              <svg className="ml-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            )}
          </Button>
        </div>
      </form>

      <aside className="flex flex-col justify-between lg:pt-1">
        <div>
          <h3 className={cn('text-sm font-semibold', c.title)}>提交指引</h3>
          <dl className="mt-5 space-y-5">
            {[
              { num: '01', text: '具体描述你遇到的问题或想法，详细的信息能帮助我们更精准地改进。' },
              { num: '02', text: '说明操作路径和上下文，告诉我们"怎么到达那里的"同样重要。' },
              { num: '03', text: '有想法就写上来，我们欢迎协作式的设计思考。' },
            ].map((item) => (
              <div key={item.num}>
                <dt className={cn('text-sm font-bold tabular-nums', c.accent)}>{item.num}.</dt>
                <dd className={cn('mt-1 text-sm leading-relaxed', c.sub)}>{item.text}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="mt-8 flex items-center gap-2">
          <svg className={cn('h-4 w-4 shrink-0', c.accent)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <p className={cn('text-xs', c.sub)}>
            <span className={cn('font-medium', c.title)}>隐私保障</span> — 你的反馈默认匿名处理。
          </p>
        </div>
      </aside>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Tab 2 — History                                                   */
/* ------------------------------------------------------------------ */

function HistoryTab({
  tickets,
  isLoading,
  selectedTicketId,
  onSelectTicket,
}: {
  tickets: FeedbackTicketSummary[]
  isLoading: boolean
  selectedTicketId: string | null
  onSelectTicket: (id: string) => void
}) {
  const [filter, setFilter] = useState<HistoryFilter>('ALL')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filteredTickets = filter === 'ALL'
    ? tickets
    : tickets.filter((t) => t.status === filter)

  const FILTER_OPTIONS: Array<{ value: HistoryFilter; label: string }> = [
    { value: 'ALL', label: '全部' },
    { value: 'RECEIVED', label: '已收到' },
    { value: 'UNDER_REVIEW', label: '处理中' },
    { value: 'PLANNED', label: '已规划' },
    { value: 'CLOSED', label: '已关闭' },
  ]

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
    )
  }

  if (tickets.length === 0) {
    return (
      <div className={cn('flex min-h-[280px] flex-col items-center justify-center gap-3 border-t pt-12 text-center', c.line)}>
        <p className={cn('text-base font-medium', c.title)}>还没有反馈记录</p>
        <p className={cn('text-sm', c.sub)}>提交你的第一条意见吧</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            aria-pressed={filter === opt.value}
            className={cn(
              'rounded-full border px-4 py-1.5 text-sm font-medium transition-all',
              filter === opt.value ? c.pillOn : c.pillOff,
            )}
            onClick={() => setFilter(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {filteredTickets.length === 0 ? (
        <p className={cn('py-12 text-center text-sm', c.sub)}>该筛选条件下暂无记录。</p>
      ) : (
        <div className="space-y-0">
          {filteredTickets.map((ticket, index) => {
            const isExpanded = expandedId === ticket.id
            return (
              <ExpandableTicketRow
                key={ticket.id}
                ticket={ticket}
                isExpanded={isExpanded}
                isLast={index === filteredTickets.length - 1}
                onToggle={() => {
                  setExpandedId(isExpanded ? null : ticket.id)
                  if (!isExpanded) onSelectTicket(ticket.id)
                }}
                selectedTicketId={selectedTicketId}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

function ExpandableTicketRow({
  ticket,
  isExpanded,
  isLast,
  onToggle,
  selectedTicketId,
}: {
  ticket: FeedbackTicketSummary
  isExpanded: boolean
  isLast: boolean
  onToggle: () => void
  selectedTicketId: string | null
}) {
  const detailQuery = useMyFeedbackDetail(
    ticket.id,
    isExpanded && ticket.id === selectedTicketId,
  )
  const detail = detailQuery.data?.data ?? null

  return (
    <div className={cn(!isLast && !isExpanded && 'border-b', c.line)}>
      <button
        type="button"
        className="w-full py-5 text-left transition-colors hover:bg-accent/30"
        aria-expanded={isExpanded}
        onClick={onToggle}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn('text-xs', c.sub)}>{CATEGORY_LABELS[ticket.category]}</span>
              <FeedbackStatusBadge status={ticket.status} />
            </div>
            <p className={cn('mt-1.5 truncate text-base font-medium', c.title)}>{ticket.title}</p>
            <p className={cn('mt-1 text-xs', c.muted)}>
              {relativeTime(ticket.updated_at)}
              {ticket.attachments.length > 0 ? ` · ${ticket.attachments.length} 张截图` : ''}
            </p>
          </div>
          <svg
            className={cn('mt-1 h-4 w-4 shrink-0 transition-transform', c.muted, isExpanded && 'rotate-180')}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        <div className="mt-3">
          <StepProgressBar status={ticket.status} />
        </div>
      </button>

      {isExpanded && (
        <div className={cn('space-y-5 border-t pb-6 pt-4', c.line)}>
          <p className={cn('whitespace-pre-wrap text-sm leading-relaxed', c.title)}>
            {ticket.body}
          </p>

          {ticket.public_resolution_note && (
            <div className="border-l-2 border-success/40 pl-4">
              <p className="text-xs font-bold tracking-widest text-success">处理结果</p>
              <p className={cn('mt-1 whitespace-pre-wrap text-sm leading-relaxed', c.title)}>
                {ticket.public_resolution_note}
              </p>
            </div>
          )}

          {ticket.attachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {ticket.attachments.map((att, i) => (
                <a key={att.id} href={att.url} target="_blank" rel="noreferrer" className={cn('h-14 w-14 overflow-hidden rounded-lg border transition-colors hover:border-primary/30', c.line)}>
                  <img src={att.url} alt={`反馈截图 ${i + 1}`} className="h-full w-full object-cover" />
                </a>
              ))}
            </div>
          )}

          {detailQuery.isLoading ? (
            <Skeleton className="h-16 rounded-lg" />
          ) : detail ? (
            <div>
              <h4 className={cn('mb-3 text-xs font-semibold uppercase tracking-widest', c.muted)}>处理记录</h4>
              <FeedbackTimeline history={detail.history} />
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                         */
/* ------------------------------------------------------------------ */

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

  const [activeTab, setActiveTab] = useState<ActiveTab>('submit')
  const [category, setCategory] = useState<FeedbackCategory>('PRODUCT_SUGGESTION')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [previewUrls, setPreviewUrls] = useState<Array<{ name: string; url: string }>>([])

  const tickets = feedbackList.data?.data ?? EMPTY_TICKETS
  const sourceRoute = locationState?.feedbackSourceRoute ?? null
  const entrySurface = locationState?.feedbackEntrySurface ?? null
  const sourceLabel = getFeedbackSourceLabel(sourceRoute)
  const underReviewCount = tickets.filter((t) => t.status === 'UNDER_REVIEW').length
  const plannedCount = tickets.filter((t) => t.status === 'PLANNED').length

  useEffect(() => {
    const nextUrls = files.map((f) => ({ name: f.name, url: URL.createObjectURL(f) }))
    setPreviewUrls(nextUrls)
    return () => { nextUrls.forEach((u) => URL.revokeObjectURL(u.url)) }
  }, [files])

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
    setActiveTab('history')
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      next.set('ticketId', created.data.id)
      return next
    }, { state: locationState ?? undefined })
  }

  function handleSelectTicket(id: string) {
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      next.set('ticketId', id)
      return next
    }, { state: locationState ?? undefined })
  }

  return (
    <div className={cn('mx-auto w-full max-w-4xl space-y-10 px-4 pt-8 pb-20 md:pt-12', c.page)}>
      <FeedbackHero sourceLabel={sourceLabel} />

      <StatsBar
        totalCount={tickets.length}
        underReviewCount={underReviewCount}
        plannedCount={plannedCount}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {activeTab === 'submit' ? (
        <SubmitTab
          category={category}
          setCategory={setCategory}
          title={title}
          setTitle={setTitle}
          body={body}
          setBody={setBody}
          setFiles={setFiles}
          previewUrls={previewUrls}
          isPending={createFeedback.isPending}
          onSubmit={(e) => void handleSubmit(e)}
        />
      ) : (
        <HistoryTab
          tickets={tickets}
          isLoading={feedbackList.isLoading}
          selectedTicketId={selectedTicketId}
          onSelectTicket={handleSelectTicket}
        />
      )}
    </div>
  )
}
