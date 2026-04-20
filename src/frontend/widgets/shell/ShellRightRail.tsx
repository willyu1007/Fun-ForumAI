import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { ArrowRight, X } from 'lucide-react'
import {
  useFeed,
  useGuidanceClientEvent,
  useGuidanceItemAction,
  useMyAgents,
  useGuidanceSummary,
} from '@/api/hooks'
import { useCommunities } from '@/api/hooks/forum'
import type {
  Community,
  GuidanceActorState,
  GuidanceChecklistItem,
  GuidanceCta,
  GuidanceItemCard as GuidanceItemCardView,
  PostWithMeta,
} from '@/api/types'
import { useAuth } from '@/shared/hooks/use-auth'
import { useDevGuidanceStore } from '@/shared/stores/dev-guidance-store'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { isGuidanceEnabled } from '@/features/guidance/feature-flags'
import { relativeTime } from '@/shared/utils/relative-time'
import { getInitials } from '@/shared/utils/get-initials'
import { resolveAgentAvatarSrc } from '@/shared/utils/preset-avatars'
import { isAgentTargetString, openAppTarget } from '@/shared/utils/agent-target'
import {
  buildAuthRedirectState,
  isGuidanceAuthGatedTarget,
  locationToPath,
} from '@/shared/utils/auth-redirect'
import { COMMUNITY_VISIBILITY_LABELS } from '@/shared/utils/public-ui-glossary'
import {
  buildGuidanceRailSnoozeRecord,
  selectGuidanceRail,
} from '@/features/guidance/rail/selector'
import {
  readGuidanceRailSnoozeRecords,
  writeGuidanceRailSnoozeRecord,
} from '@/features/guidance/rail/snooze'
import type {
  GuidanceRailTakeoverReason,
  GuidanceRailSnoozeRecord,
} from '@/features/guidance/rail/types'

function getAgentInitials(name: string) {
  return getInitials(name)
}

function normalizePostTitle(title: string) {
  return title
    .trim()
    .toLowerCase()
    .replace(/[\s\u3000]+/g, ' ')
    .replace(/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~，。！？；：、“”‘’（）【】《》]/g, '')
}

function buildRecentAgentSpotlights(posts: PostWithMeta[], myAgentIds: Set<string>) {
  const latestByKey = new Map<string, PostWithMeta>()

  const sorted = posts
    .filter((post) => myAgentIds.has(post.author_agent_id))
    .slice()
    .sort((a, b) => {
      const aAt = new Date(a.last_reply_at ?? a.created_at).getTime()
      const bAt = new Date(b.last_reply_at ?? b.created_at).getTime()
      return bAt - aAt
    })

  for (const post of sorted) {
    const key = `${post.author_agent_id}:${post.community_id}:${normalizePostTitle(post.title)}`
    if (!latestByKey.has(key)) {
      latestByKey.set(key, post)
    }
  }

  return Array.from(latestByKey.values()).slice(0, 20)
}

const HOME_RECENT_ACTIVITY_CLEARED_AT_KEY = 'home-recent-activity-cleared-at'
const HOME_EXPLORE_SHORTCUTS_MIN_HEIGHT_CLASS = 'min-h-[4.5rem]'
const HOME_EXPLORE_SHORTCUTS_CONTENT_RESERVE_CLASS = 'pb-[7rem]'

const SNOOZE_DURATION_HOURS: Record<GuidanceRailTakeoverReason, number> = {
  NO_AGENT_BOOTSTRAP: 24,
  UNREAD_RECEIPT_READY: 12,
  FIRST_PRIVATE_CHAT_BLOCKER: 24,
  PUBLIC_EFFECT_READY: 12,
}

const TAKEOVER_COPY: Record<GuidanceRailTakeoverReason, { title: string; body: string }> = {
  NO_AGENT_BOOTSTRAP: {
    title: '你还没有自己的角色',
    body: '创建一个属于你的 Agent，看看它会在社区里活出什么样的故事。',
  },
  UNREAD_RECEIPT_READY: {
    title: '角色有新的变化了',
    body: '上次的互动产生了结果 — 来看看发生了什么。',
  },
  FIRST_PRIVATE_CHAT_BLOCKER: {
    title: '和角色说第一句话',
    body: '开始你们的第一次私聊，后面的故事从这里开始。',
  },
  PUBLIC_EFFECT_READY: {
    title: '影响被看见了',
    body: '你在幕后做的事，已经反映到公开讨论里了。去看看大家怎么说。',
  },
}

function readHomeRecentActivityClearedAt() {
  if (typeof localStorage === 'undefined') {
    return null
  }

  const raw = localStorage.getItem(HOME_RECENT_ACTIVITY_CLEARED_AT_KEY)
  if (!raw) {
    return null
  }

  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

function GuidanceCtaButton({
  cta,
  prominence = 'secondary',
  onBeforeNavigate,
}: {
  cta: GuidanceCta
  prominence?: 'primary' | 'secondary'
  onBeforeNavigate?: () => void
}) {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const location = useLocation()

  const requiresAuth = isGuidanceAuthGatedTarget(cta.target)
  const currentPath = locationToPath(location)
  const ctaTarget = !isAuthenticated && requiresAuth ? '/login' : cta.target
  const ctaState =
    !isAuthenticated && requiresAuth ? buildAuthRedirectState(currentPath, cta.target) : undefined
  const ctaLabel = !isAuthenticated && requiresAuth ? '登录后继续' : cta.label
  const isAgentCta = isAgentTargetString(ctaTarget)

  const isPrimary = prominence === 'primary'

  if (isAgentCta) {
    return (
      <Button
        variant={isPrimary ? 'default' : 'secondary'}
        size="sm"
        className={cn('mt-3 gap-1.5', !isPrimary && 'text-xs')}
        onClick={() => {
          onBeforeNavigate?.()
          openAppTarget(navigate, ctaTarget, 'manage')
        }}
      >
        {ctaLabel}
        {isPrimary && <ArrowRight className="size-3.5" />}
      </Button>
    )
  }

  if (isPrimary) {
    return (
      <Button
        asChild
        variant="default"
        size="sm"
        className="mt-3 gap-1.5"
      >
        <Link to={ctaTarget} state={ctaState} onClick={() => onBeforeNavigate?.()}>
          {ctaLabel}
          <ArrowRight className="size-3.5" />
        </Link>
      </Button>
    )
  }

  return (
    <Button
      asChild
      variant="secondary"
      size="sm"
      className="mt-3 gap-1 text-xs"
    >
      <Link to={ctaTarget} state={ctaState} onClick={() => onBeforeNavigate?.()}>
        {ctaLabel}
        <ArrowRight className="size-3" />
      </Link>
    </Button>
  )
}

function ChecklistActionCard({
  item,
  variant = 'default',
}: {
  item: GuidanceChecklistItem
  variant?: 'primary' | 'default' | 'muted'
}) {
  const guidanceEvent = useGuidanceClientEvent()

  const cardClasses = {
    primary: 'rounded-sm border border-border/60 border-t-2 border-t-foreground/60 bg-card px-4 pb-4 pt-3 shadow-sm transition-colors',
    default: 'rounded-sm border border-border/50 bg-muted/20 px-4 py-3 transition-colors',
    muted: 'rounded-sm bg-muted/10 px-4 py-3 transition-colors',
  }

  return (
    <div className={cardClasses[variant]}>
      <p className={cn('font-medium text-foreground', variant === 'primary' ? 'text-base' : 'text-sm')}>
        {item.title}
      </p>
      <p className={cn('mt-2 leading-6 text-muted-foreground', variant === 'default' ? 'text-sm' : 'text-xs')}>{item.body}</p>
      {item.cta ? (
        <GuidanceCtaButton
          cta={item.cta}
          prominence={variant === 'primary' ? 'primary' : 'secondary'}
          onBeforeNavigate={() => {
            if (!item.cta?.event_name) return
            guidanceEvent.mutate({
              event_type: item.cta.event_name,
              payload: item.cta.payload,
            })
          }}
        />
      ) : null}
    </div>
  )
}

function CompactGuidanceItem({
  item,
  variant = 'default',
}: {
  item: GuidanceItemCardView
  variant?: 'primary' | 'default' | 'muted'
}) {
  const itemAction = useGuidanceItemAction()

  const cardClasses = {
    primary: 'rounded-sm border border-border/60 border-t-2 border-t-foreground/60 bg-card px-4 pb-4 pt-3 shadow-sm transition-colors',
    default: 'rounded-sm border border-border/50 bg-muted/20 px-4 py-3 transition-colors',
    muted: 'rounded-sm bg-muted/10 px-4 py-3 transition-colors',
  }

  return (
    <div className={cardClasses[variant]}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="text-[10px]">{item.module_type === 'RECEIPT' ? '回执' : '提示'}</Badge>
          {item.unread && <Badge className="bg-accent text-[10px] text-accent-foreground">新</Badge>}
        </div>
        <span className="text-[11px] text-muted-foreground">{relativeTime(item.updated_at)}</span>
      </div>
      <p className={cn('mt-2 font-medium leading-5 text-foreground', variant === 'primary' ? 'text-base' : 'text-sm')}>
        {item.title}
      </p>
      <p className={cn('mt-2 leading-6 text-muted-foreground', variant === 'default' ? 'text-sm' : 'text-xs')}>{item.body}</p>
      {item.cta ? (
        <GuidanceCtaButton
          cta={item.cta}
          prominence={variant === 'primary' ? 'primary' : 'secondary'}
          onBeforeNavigate={() => {
            itemAction.mutate({ item_id: item.id, action: 'open' })
          }}
        />
      ) : null}
    </div>
  )
}

const PROGRESS_STEPS: Array<{ key: keyof GuidanceActorState['completed']; label: string }> = [
  { key: 'created_agent', label: '创建角色' },
  { key: 'started_private_chat', label: '第一次私聊' },
  { key: 'nurture_receipt_ready', label: '查看回执' },
  { key: 'watch_public_effect', label: '看到公开影响' },
]

function GuidanceProgressDots({ completed }: { completed: GuidanceActorState['completed'] }) {
  const firstIncompleteIndex = PROGRESS_STEPS.findIndex((step) => !completed[step.key])

  return (
    <div className="flex items-center gap-2" role="progressbar" aria-label="引导进度">
      {PROGRESS_STEPS.map((step, index) => {
        const isDone = completed[step.key]
        const isCurrent = index === firstIncompleteIndex
        return (
          <div key={step.key} className="flex items-center gap-2">
            <div
              className={cn(
                'h-2 w-2 rounded-full transition-colors',
                isDone && 'bg-primary',
                isCurrent && 'bg-primary/40 ring-2 ring-primary/60',
                !isDone && !isCurrent && 'bg-muted-foreground/20',
              )}
              title={step.label}
            />
            {index < PROGRESS_STEPS.length - 1 && (
              <div className={cn('h-px w-4', isDone ? 'bg-primary/40' : 'bg-muted-foreground/15')} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function SnoozeFeedbackBar({ reason }: { reason: GuidanceRailTakeoverReason }) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 3000)
    return () => clearTimeout(timer)
  }, [])

  if (!visible) return null

  const hours = SNOOZE_DURATION_HOURS[reason]
  const label = hours >= 24 ? '明天会再提醒你' : `${hours} 小时后会再提醒你`

  return (
    <div className="animate-in fade-in slide-in-from-top-2 mb-3 rounded-lg bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
      已收起，{label}
    </div>
  )
}

function GuidanceTakeoverRail({
  reason,
  primaryChecklistItem,
  primaryItem,
  secondaryActions,
  continuationItem,
  completed,
  onSnooze,
}: {
  reason: GuidanceRailTakeoverReason
  primaryChecklistItem: GuidanceChecklistItem | null
  primaryItem: GuidanceItemCardView | null
  secondaryActions: GuidanceChecklistItem[]
  continuationItem: GuidanceItemCardView | null
  completed: GuidanceActorState['completed'] | null
  onSnooze: () => void
}) {
  const copy = TAKEOVER_COPY[reason]

  return (
    <section
      className="overflow-hidden rounded-sm border border-border/45 bg-muted/35 p-5 backdrop-blur-md backdrop-saturate-150 supports-[backdrop-filter]:bg-muted/18"
      data-testid="home-guidance-rail"
    >
      <div className="-mx-5 -mt-5 mb-5 border-b border-border/35 bg-muted/25 px-5 pb-4 pt-5 backdrop-blur-sm supports-[backdrop-filter]:bg-muted/12">
        <div className="flex items-start gap-2">
          <h2 className="flex-1 text-xl font-semibold leading-7 tracking-tight text-foreground">{copy.title}</h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="mt-0.5 h-6 w-6 shrink-0 rounded-full text-muted-foreground/50 hover:text-muted-foreground"
            aria-label="暂时收起"
            onClick={onSnooze}
          >
            <X className="size-3.5" />
          </Button>
        </div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{copy.body}</p>
        {completed && (
          <div className="mt-4">
            <GuidanceProgressDots completed={completed} />
          </div>
        )}
      </div>

      {primaryItem ? (
        <CompactGuidanceItem item={primaryItem} variant="primary" />
      ) : primaryChecklistItem ? (
        <ChecklistActionCard item={primaryChecklistItem} variant="primary" />
      ) : null}

      {secondaryActions.length > 0 ? (
        <div className="mt-4 space-y-2 border-t border-border/25 pt-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/60">
            {'接下来'}
            {secondaryActions.length > 1 && (
              <span className="ml-1.5 tabular-nums">{secondaryActions.length}</span>
            )}
          </p>
          <div className="space-y-2">
            {secondaryActions.map((item) => (
              <ChecklistActionCard key={item.reason_code} item={item} variant="default" />
            ))}
          </div>
        </div>
      ) : null}

      {continuationItem ? (
        <div className="mt-4 border-t border-border/25 pt-4">
          <CompactGuidanceItem item={continuationItem} variant="muted" />
        </div>
      ) : null}
    </section>
  )
}

function RecentActivityRail({
  recentAgentSpotlights,
  onClear,
}: {
  recentAgentSpotlights: PostWithMeta[]
  onClear: () => void
}) {
  if (recentAgentSpotlights.length === 0) {
    return (
      <section
        className="overflow-hidden rounded-xl bg-muted/20 px-4 py-6 text-center"
        data-testid="home-recent-activity-rail"
      >
        <p className="text-sm text-muted-foreground">
          {'目前没有新的动态'}
        </p>
        <p className="mt-1.5 text-xs text-muted-foreground/70">
          {'去社区逛逛，发现有趣的角色。'}
        </p>
      </section>
    )
  }

  return (
    <section
      className="overflow-hidden rounded-xl bg-muted/20"
      data-testid="home-recent-activity-rail"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3.5">
        <h2 className="text-[13px] font-medium text-foreground/85">{'智能体动态'}</h2>
        <button
          type="button"
          className="ml-auto inline-flex h-8 items-center justify-center rounded-full px-3 text-[13px] font-medium text-primary transition-colors hover:bg-primary/8 hover:text-primary/80"
          onClick={onClear}
          aria-label="清除最近登场"
        >
          {'清除'}
        </button>
      </div>
      <div>
        {recentAgentSpotlights.map((post, index) => {
          const thumbnail = post.media.find((item) =>
            item.mime_type.startsWith('image/'),
          )?.media_url
          return (
            <Link
              key={post.id}
              to={`/posts/${post.id}`}
              className={cn(
                'block px-4 py-3.5 transition-colors hover:bg-background/50',
                index > 0 ? 'border-t border-border/65' : '',
              )}
            >
              <div className="flex items-start gap-3">
                <Avatar className="mt-0.5 h-10 w-10 shrink-0">
                  <AvatarImage
                    src={resolveAgentAvatarSrc({
                      id: post.author.id,
                      display_name: post.author.display_name,
                      avatar_url: post.author.avatar_url,
                    })}
                    alt={post.author.display_name}
                    className="object-cover"
                  />
                  <AvatarFallback className="bg-primary/10 text-[11px] font-semibold text-primary/80">
                    {getAgentInitials(post.author.display_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-1.5 text-[11px] leading-4.5 text-muted-foreground">
                    <span className="truncate text-foreground/85">{post.author.display_name}</span>
                    <span aria-hidden="true">&middot;</span>
                    <span className="truncate">{post.community_name}</span>
                    <span aria-hidden="true">&middot;</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground/70">
                      {relativeTime(post.last_reply_at ?? post.created_at)}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-[14px] leading-5.5 text-foreground/88">
                    {post.title}
                  </p>
                  <p className="mt-2.5 text-[11px] leading-4.5 text-muted-foreground">
                    {post.thread_turn_count} {'条发言，'}{post.vote_up} {'个被点赞'}
                  </p>
                </div>
                <div
                  className={cn(
                    'h-16 w-16 shrink-0 overflow-hidden rounded-lg',
                    thumbnail ? 'border border-border/60 bg-muted/25' : 'opacity-0',
                  )}
                  aria-hidden={thumbnail ? undefined : 'true'}
                >
                  {thumbnail ? (
                    <img src={thumbnail} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full" />
                  )}
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}

function HomeFeedRail() {
  const location = useLocation()
  const guidanceEnabled = isGuidanceEnabled()
  const guidanceSummary = useGuidanceSummary()
  const guidanceEvent = useGuidanceClientEvent()
  const { isAuthenticated } = useAuth()
  const myAgents = useMyAgents(isAuthenticated)
  const myAgentsMode = useDevGuidanceStore((state) => state.myAgentsMode)
  const recentPublicFeed = useFeed({ sort: 'new', limit: 50 })
  const [recentClearedAt, setRecentClearedAt] = useState<number | null>(
    readHomeRecentActivityClearedAt,
  )
  const [snoozeRecords, setSnoozeRecords] = useState<GuidanceRailSnoozeRecord[]>([])
  const [snoozedReason, setSnoozedReason] = useState<GuidanceRailTakeoverReason | null>(null)
  const currentPath = locationToPath(location)

  const summary = guidanceEnabled ? guidanceSummary.data?.data : undefined
  const actorId = summary?.actor.actor_id ?? null
  const myAgentsLoaded =
    myAgentsMode === 'EMPTY'
      ? true
      : !isAuthenticated || myAgents.data !== undefined || myAgents.isFetched === true
  const myAgentsData = myAgentsMode === 'EMPTY' ? [] : (myAgents.data?.data ?? [])
  const myAgentIds = new Set(myAgentsData.map((agent) => agent.id))
  const recentAgentSpotlights = buildRecentAgentSpotlights(
    recentPublicFeed.data?.data ?? [],
    myAgentIds,
  ).filter((post) => {
    if (recentClearedAt === null) {
      return true
    }
    return new Date(post.last_reply_at ?? post.created_at).getTime() > recentClearedAt
  })
  const railSelection = selectGuidanceRail({
    summary,
    myAgents: myAgentsData,
    myAgentsLoaded,
    isAuthenticated,
    snoozeRecords,
  })

  useEffect(() => {
    setSnoozeRecords(readGuidanceRailSnoozeRecords(actorId))
  }, [actorId])

  const handleClearRecentActivity = () => {
    const newestActivityAt = recentAgentSpotlights[0]
      ? new Date(
          recentAgentSpotlights[0].last_reply_at ?? recentAgentSpotlights[0].created_at,
        ).getTime()
      : null

    if (newestActivityAt === null) {
      return
    }

    localStorage.setItem(HOME_RECENT_ACTIVITY_CLEARED_AT_KEY, String(newestActivityAt))
    setRecentClearedAt(newestActivityAt)
  }

  const handleSnooze = () => {
    if (!actorId || !railSelection.candidate) {
      return
    }

    const record = buildGuidanceRailSnoozeRecord(railSelection.candidate)
    const nextRecords = writeGuidanceRailSnoozeRecord(actorId, record)
    setSnoozeRecords(nextRecords)
    setSnoozedReason(railSelection.candidate.reason)
    guidanceEvent.mutate({
      event_type: 'GUIDANCE_TAKEOVER_SNOOZED',
      payload: {
        reason: record.reason,
        scope_key: record.scope_key,
        expires_at: record.expires_at,
        surface: 'home_right_rail',
        source_item_id: railSelection.candidate.source_item_id,
      },
    })
  }

  const isGuidanceMode = railSelection.mode === 'GUIDANCE' && railSelection.candidate

  return (
    <div className="relative h-full pt-2 pr-1">
      <div
        className={cn(
          'h-full overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden',
          HOME_EXPLORE_SHORTCUTS_CONTENT_RESERVE_CLASS,
        )}
      >
        <div
          className={cn(
            'transition-opacity duration-300',
            isGuidanceMode ? 'animate-in fade-in duration-300' : '',
          )}
        >
          {isGuidanceMode && railSelection.candidate ? (
            <GuidanceTakeoverRail
              reason={railSelection.candidate.reason}
              primaryChecklistItem={railSelection.primary_checklist_item}
              primaryItem={railSelection.primary_item}
              secondaryActions={railSelection.secondary_actions}
              continuationItem={railSelection.continuation_item}
              completed={summary?.actor.completed ?? null}
              onSnooze={handleSnooze}
            />
          ) : (
            <>
              {snoozedReason && <SnoozeFeedbackBar reason={snoozedReason} />}
              <RecentActivityRail
                recentAgentSpotlights={recentAgentSpotlights}
                onClear={handleClearRecentActivity}
              />
            </>
          )}
        </div>
      </div>

      <section
        className={cn(
          'absolute bottom-0 left-0 right-0 z-10 flex items-end border-t border-border/55 bg-background/95 px-3 pb-1 pt-2.5 backdrop-blur-sm supports-[backdrop-filter]:bg-background/88',
          HOME_EXPLORE_SHORTCUTS_MIN_HEIGHT_CLASS,
        )}
        data-testid="home-explore-shortcuts"
      >
        <div className="flex items-center justify-start gap-3 whitespace-nowrap text-[12px] leading-5 text-muted-foreground">
          <Link
            to="/safety"
            className="transition-colors hover:text-foreground"
            aria-label="举报与申诉"
          >
            {'举报申诉'}
          </Link>
          <Link
            to="/feedback"
            state={{
              feedbackSourceRoute: currentPath,
              feedbackEntrySurface: 'home_shortcuts',
            }}
            className="transition-colors hover:text-foreground"
            aria-label="意见反馈"
          >
            {'意见反馈'}
          </Link>
          <Link
            to="/help"
            className="transition-colors hover:text-foreground"
            aria-label="规则与说明"
          >
            {'规则说明'}
          </Link>
        </div>
      </section>
    </div>
  )
}

function CommunityInfo({ slug, communities }: { slug: string; communities: Community[] }) {
  const community = communities.find((item) => item.slug === slug)

  if (!community) {
    return null
  }

  return (
    <section className="rounded-xl bg-muted/25 p-5">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{'关于'} {community.name}</h2>
            <p className="mt-1 text-xs text-muted-foreground">c/{community.slug}</p>
          </div>
          <Badge variant="outline" className="shrink-0">
            {COMMUNITY_VISIBILITY_LABELS[community.visibility_default.toLowerCase()] ??
              community.visibility_default}
          </Badge>
        </div>

        <p className="text-sm leading-6 text-muted-foreground">
          {community.description ?? '暂无描述。'}
        </p>

        <div className="grid grid-cols-2 gap-4 border-t pt-5 text-sm text-muted-foreground">
          <div>
            <div className="text-xs uppercase tracking-[0.2em]">{'创建于'}</div>
            <div className="mt-1 font-medium text-foreground">
              {new Date(community.created_at).toLocaleDateString('zh-CN', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.2em]">{'可见范围'}</div>
            <div className="mt-1 font-medium text-foreground">
              {COMMUNITY_VISIBILITY_LABELS[community.visibility_default.toLowerCase()] ??
                community.visibility_default}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export function ShellRightRail({ className }: { className?: string } = {}) {
  const { pathname } = useLocation()
  const params = useParams()
  const { data } = useCommunities()
  const communities = data?.data ?? []
  const isCommunityPage = pathname.startsWith('/c/') && params.slug
  const isFeedPage = pathname === '/' || pathname === '/feed'

  if (!isFeedPage && !isCommunityPage) {
    return null
  }

  if (isFeedPage) {
    return (
      <div className={cn('h-full', className)}>
        <HomeFeedRail />
      </div>
    )
  }

  return (
    <div className={cn('h-full overflow-y-auto space-y-4', className)}>
      {isCommunityPage && params.slug ? (
        <CommunityInfo slug={params.slug} communities={communities} />
      ) : null}
    </div>
  )
}
