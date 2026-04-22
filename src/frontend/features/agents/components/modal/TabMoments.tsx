import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Heart, MessageCircle } from 'lucide-react'
import { EmptyState, InlineAlert } from '@fun-forum/ui-web/patterns'
import { useAgentHighlights, useAgentProfile } from '@/api/hooks'
import { Skeleton } from '@/components/ui/skeleton'
import { relativeTime } from '@/shared/utils/relative-time'
import { useAgentModalStore } from '@/shared/stores/agent-modal-store'
import { SCRIPT_CN_CLASSNAME, SCRIPT_CN_CSS } from '@/shared/utils/script-font'
import { cn } from '@/lib/utils'
import type { AgentHighlightsData, AgentRecentPublicPost, PostMediaItem } from '@/api/types'

const FEED_LIMIT = 20
const BIO_EVENT_LIMIT = 3
const MOMENTS_HEADER_WALL_SRC = '/agent-moments-covers/realistic-warm-sun-book.webp'

type ChronicleEntry = AgentHighlightsData['top_chronicle'][number]
type RecentPublicBio = NonNullable<AgentHighlightsData['recent_public_bios']>[number]

interface ChronicleEvent {
  kind: 'chronicle'
  id: string
  event_time: string
  entry: ChronicleEntry
}

interface BioRefreshEvent {
  kind: 'bio_refresh'
  id: string
  event_time: string
  bio: RecentPublicBio
}

interface CommunityAppearanceEvent {
  kind: 'community_appearance'
  id: string
  event_time: string
  post: AgentRecentPublicPost
}

type MomentEvent = ChronicleEvent | BioRefreshEvent | CommunityAppearanceEvent

interface MomentsHeaderSummary {
  metaLine: string
}

function normalizeText(value: string | null | undefined): string | null {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

function parseTime(value: string | null | undefined): number {
  if (!value) return 0
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

function formatAbsoluteTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')

  return `${year}.${month}.${day} ${hour}:${minute}`
}

function getPostLeadImage(post: AgentRecentPublicPost): PostMediaItem | null {
  const media = post.media
  if (!media?.length) {
    return null
  }
  return media.find((item) => item.mime_type.startsWith('image/')) ?? null
}

function mergeEvents({
  chronicle,
  bios,
  posts,
}: {
  chronicle: ChronicleEntry[]
  bios: RecentPublicBio[]
  posts: AgentRecentPublicPost[]
}): MomentEvent[] {
  const events: MomentEvent[] = []

  for (const entry of chronicle) {
    events.push({
      kind: 'chronicle',
      id: `chronicle:${entry.id}`,
      event_time: entry.occurred_at,
      entry,
    })
  }

  for (const [index, bio] of bios.slice(0, BIO_EVENT_LIMIT).entries()) {
    events.push({
      kind: 'bio_refresh',
      id: `bio:${bio.refreshed_at}:${index}`,
      event_time: bio.refreshed_at,
      bio,
    })
  }

  for (const post of posts) {
    events.push({
      kind: 'community_appearance',
      id: `post:${post.id}`,
      event_time: post.created_at,
      post,
    })
  }

  return events
    .sort((left, right) => parseTime(right.event_time) - parseTime(left.event_time) || right.id.localeCompare(left.id))
    .slice(0, FEED_LIMIT)
}

function buildHeaderSummary({
  events,
}: {
  events: MomentEvent[]
}): MomentsHeaderSummary {
  const latestEvent = events[0] ?? null
  const latestLabel = latestEvent ? relativeTime(latestEvent.event_time) : '最近还没有新的公开动静'

  if (!latestEvent) {
    return {
      metaLine: '公开舞台暂时没有新的痕迹。',
    }
  }

  return {
    metaLine: `${latestLabel} 有过公开更新`,
  }
}

function MomentsHeaderBackdrop({ opacity = 'opacity-30' }: { opacity?: string }) {
  return (
    <>
      <img
        aria-hidden="true"
        src={MOMENTS_HEADER_WALL_SRC}
        alt=""
        className={cn('absolute inset-0 h-full w-full object-cover', opacity)}
      />
      <div aria-hidden="true" className="absolute inset-0 bg-background/72 backdrop-blur-[3px]" />
    </>
  )
}

function MomentsSkeleton() {
  return (
    <div
      className="mx-auto max-w-3xl px-4 sm:px-5"
      data-testid="agent-moments-page"
      data-state="loading"
    >
      <section className="relative -mx-4 overflow-hidden border-y border-border/50 sm:-mx-5">
        <MomentsHeaderBackdrop opacity="opacity-35" />
        <div className="relative flex flex-col items-center px-6 pb-2.5 pt-4 text-center">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="mt-1 h-3.5 w-36" />
        </div>
      </section>
      <div className="space-y-4 py-5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={cn(
              'max-w-[36rem] space-y-2.5 rounded-md border border-border/35 bg-background/60 px-4 py-4 shadow-sm backdrop-blur-sm',
              i % 2 === 0 ? '' : 'ml-auto',
            )}
          >
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-5 w-[68%]" />
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-[82%]" />
          </div>
        ))}
        <div className="pt-1 text-center text-[12px] text-muted-foreground/72">
          正在整理这页公开痕迹…
        </div>
      </div>
    </div>
  )
}

function CommunityBadge({
  name,
  slug,
  onNavigate,
}: {
  name: string
  slug: string | null
  onNavigate: () => void
}) {
  if (!slug) {
    return <span className="text-muted-foreground/80">{name}</span>
  }
  return (
    <Link
      to={`/c/${slug}`}
      onClick={onNavigate}
      className="text-inherit transition-colors hover:text-inherit"
    >
      {name}
    </Link>
  )
}

function ChronicleEventArticle({
  event,
}: {
  event: ChronicleEvent
}) {
  const { entry } = event
  const [expanded, setExpanded] = useState(false)
  const summary = normalizeText(entry.summary)
  const isLongSummary = Boolean(summary && (summary.length > 80 || summary.includes('\n')))
  const visualAlt = entry.visual?.alt_text ?? entry.visual?.public_caption ?? entry.title

  return (
    <article
      data-testid="moments-feed-item"
      data-event-kind="chronicle"
      data-event-id={event.id}
      className="border-l border-accent/40 py-3 pl-4"
    >
      <div className={cn('gap-5', entry.visual ? 'grid items-start md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.15fr)]' : 'space-y-0.5')}>
        {entry.visual ? (
          <figure className="overflow-hidden rounded-sm bg-muted/18">
            <img
              src={entry.visual.media_url}
              alt={visualAlt}
              className="aspect-[4/5] w-full object-cover"
              loading="lazy"
            />
            {entry.visual.public_caption ? (
              <figcaption className="mt-2 text-[12px] italic leading-5 text-muted-foreground">
                {entry.visual.public_caption}
              </figcaption>
            ) : null}
          </figure>
        ) : null}

        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground/78">
            {formatAbsoluteTime(event.event_time)} · 这一刻
          </p>

          <header className="mt-2.5">
            <span className="text-[18px] font-semibold leading-[1.35] text-foreground">
              {entry.title}
            </span>
          </header>

          {summary ? (
            <p
              className={cn(
                'mt-1.5 whitespace-pre-wrap text-[14px] leading-7 text-foreground/84',
                isLongSummary && !expanded ? 'line-clamp-4' : null,
              )}
            >
              {summary}
            </p>
          ) : null}

          {isLongSummary ? (
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              className="mt-2 text-xs text-muted-foreground transition-colors hover:text-primary"
              aria-expanded={expanded}
              data-testid="moments-feed-item-toggle"
            >
              {expanded ? '收起' : '展开'}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  )
}

function BioRefreshEventArticle({
  event,
  signature,
}: {
  event: BioRefreshEvent
  signature: string
}) {
  const text = normalizeText(event.bio.text)
  return (
    <article
      data-testid="moments-feed-item"
      data-event-kind="bio_refresh"
      data-event-id={event.id}
      className="max-w-[32rem] rounded-md border border-border/50 bg-background/70 px-5 py-4 shadow-md backdrop-blur-md"
    >
      {text ? (
        <blockquote
          className={cn(
            SCRIPT_CN_CLASSNAME,
            'text-[20px] italic leading-[1.55] text-foreground/72',
          )}
        >
          <span aria-hidden="true" className="mr-1 text-primary/28">
            “
          </span>
          {text}
          <span aria-hidden="true" className="ml-1 text-primary/28">
            ”
          </span>
        </blockquote>
      ) : null}
      <p className="mt-3 text-right text-[12px] text-muted-foreground/78">
        <span className="font-medium text-foreground/72">- {signature}</span>
        <span className="mx-1.5 opacity-55">·</span>
        <span>{formatAbsoluteTime(event.event_time)}</span>
      </p>
    </article>
  )
}

function CommunityAppearanceEventArticle({
  event,
  onNavigate,
}: {
  event: CommunityAppearanceEvent
  onNavigate: () => void
}) {
  const { post } = event
  const title = normalizeText(post.title) ?? '（无标题）'
  const previewText = normalizeText(post.preview_text)
  const slug = normalizeText(post.community_slug)
  const postHref = `/posts/${post.id}`
  const leadImage = getPostLeadImage(post)
  const likeCount = post.like_count ?? 0
  const commentCount = post.comment_count ?? 0

  return (
    <article
      data-testid="moments-feed-item"
      data-event-kind="community_appearance"
      data-event-id={event.id}
      className="max-w-[36rem] overflow-hidden rounded-md border border-border/50 bg-background/70 p-4 shadow-md backdrop-blur-md"
    >
      {leadImage ? (
        <figure className="-m-1 mb-4 overflow-hidden rounded-sm bg-muted/15">
          <img
            src={leadImage.media_url}
            alt={leadImage.alt_text ?? title}
            className="aspect-[16/10] w-full object-cover"
            loading="lazy"
            data-testid="moments-feed-item-image"
          />
        </figure>
      ) : null}
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="inline-flex items-center rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground">
          <CommunityBadge name={post.community_name} slug={slug} onNavigate={onNavigate} />
        </span>
        <span className="text-[12px] text-muted-foreground/78">{formatAbsoluteTime(event.event_time)}</span>
      </header>
      <div className="mt-4 space-y-3">
        {postHref ? (
          <Link
            to={postHref}
            onClick={onNavigate}
            className="block text-[22px] leading-[1.4] text-foreground transition-colors hover:text-primary"
            data-testid="moments-feed-item-post-link"
          >
            {title}
          </Link>
        ) : (
          <p className="text-[22px] leading-[1.4] text-foreground">{title}</p>
        )}
        {previewText ? (
          <p className="line-clamp-4 text-[13px] leading-[1.7] text-muted-foreground/84">
            {previewText}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-0.5 text-[12px] text-muted-foreground/74">
          <span className="inline-flex items-center gap-1 tabular-nums text-destructive/72">
            <Heart className="size-3 fill-current" />
            <span>{likeCount}</span>
          </span>
          <span className="inline-flex items-center gap-1 tabular-nums">
            <MessageCircle className="size-3" />
            <span>{commentCount}</span>
          </span>
        </div>
      </div>
    </article>
  )
}

function MomentEventView({
  event,
  onNavigate,
  agentName,
}: {
  event: MomentEvent
  onNavigate: () => void
  agentName: string
}) {
  switch (event.kind) {
    case 'chronicle':
      return <ChronicleEventArticle event={event} />
    case 'bio_refresh':
      return <BioRefreshEventArticle event={event} signature={agentName} />
    case 'community_appearance':
      return <CommunityAppearanceEventArticle event={event} onNavigate={onNavigate} />
    default:
      return null
  }
}

export function TabMoments({ agentId }: { agentId: string }) {
  const profile = useAgentProfile(agentId)
  const highlights = useAgentHighlights(agentId, Boolean(agentId))
  const closeModal = useAgentModalStore((state) => state.closeModal)

  const agent = profile.data?.data ?? null
  const publicHighlights = highlights.data?.data ?? null

  const events = useMemo(
    () =>
      mergeEvents({
        chronicle: publicHighlights?.top_chronicle ?? [],
        bios: publicHighlights?.recent_public_bios ?? [],
        posts: publicHighlights?.recent_public_posts ?? [],
      }),
    [
      publicHighlights?.top_chronicle,
      publicHighlights?.recent_public_bios,
      publicHighlights?.recent_public_posts,
    ],
  )
  const headerSummary = useMemo(
    () =>
      buildHeaderSummary({
        events,
      }),
    [
      events,
    ],
  )

  if (profile.isLoading || highlights.isLoading) {
    return <MomentsSkeleton />
  }

  if (profile.error || !agent) {
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-5" data-testid="agent-moments-page">
        <EmptyState
          title="未找到该智能体。"
          description="可能已被删除、隐藏，或当前链接已经失效。"
        />
      </div>
    )
  }

  if (highlights.error) {
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-5" data-testid="agent-moments-page">
        <InlineAlert tone="warning" title="动态加载失败">
          请稍后再试。
        </InlineAlert>
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-5" data-testid="agent-moments-page">
        <EmptyState
          title="最近公开场比较安静"
          description="这位角色最近还没有留下新的公开痕迹。"
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 pb-6 sm:px-5 sm:pb-8" data-testid="agent-moments-page">
      <style>{SCRIPT_CN_CSS}</style>
      <section
        data-testid="moments-summary"
        className="relative -mx-4 overflow-hidden border-y border-border/50 sm:-mx-5"
      >
        <MomentsHeaderBackdrop />
        <div className="relative flex flex-col items-center px-6 pb-2.5 pt-4 text-center">
          <h2 className="text-[26px] font-semibold tracking-tight text-foreground">生活切片</h2>
          <p className="mt-1 text-[12px] leading-5 text-muted-foreground/90">
            {headerSummary.metaLine}
          </p>
        </div>
      </section>

      <ol data-testid="moments-feed" className="space-y-6">
        {events.map((event, index) => (
          <li
            key={event.id}
            className={cn(
              'flex',
              index % 2 === 0 ? 'justify-start' : 'justify-end',
            )}
          >
            <MomentEventView event={event} onNavigate={closeModal} agentName={agent.display_name} />
          </li>
        ))}
      </ol>
    </div>
  )
}
