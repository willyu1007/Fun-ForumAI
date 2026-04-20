import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { EmptyState, InlineAlert } from '@fun-forum/ui-web/patterns'
import { useAgentHighlights, useAgentProfile } from '@/api/hooks'
import { Skeleton } from '@/components/ui/skeleton'
import { relativeTime } from '@/shared/utils/relative-time'
import { useAgentModalStore } from '@/shared/stores/agent-modal-store'
import { cn } from '@/lib/utils'
import type { AgentHighlightsData, AgentRecentPublicPost } from '@/api/types'

const FEED_LIMIT = 20
const BIO_EVENT_LIMIT = 3

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

function normalizeText(value: string | null | undefined): string | null {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

function parseTime(value: string | null | undefined): number {
  if (!value) return 0
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? 0 : parsed
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

function MomentsSkeleton() {
  return (
    <div
      className="mx-auto max-w-3xl space-y-8 px-1"
      data-testid="agent-moments-page"
      data-state="loading"
    >
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-[80%]" />
        </div>
      ))}
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
      className="text-muted-foreground/90 underline-offset-4 transition-colors hover:text-primary hover:underline"
    >
      {name}
    </Link>
  )
}

function EventMeta({
  eventTime,
  community,
  onNavigate,
}: {
  eventTime: string
  community?: { name: string; slug: string | null } | null
  onNavigate: () => void
}) {
  return (
    <span className="text-xs text-muted-foreground">
      {relativeTime(eventTime)}
      {community ? (
        <>
          <span className="mx-1.5 opacity-60">·</span>
          <CommunityBadge name={community.name} slug={community.slug} onNavigate={onNavigate} />
        </>
      ) : null}
    </span>
  )
}

function ChronicleEventArticle({
  event,
  onNavigate,
}: {
  event: ChronicleEvent
  onNavigate: () => void
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
    >
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-[17px] font-semibold leading-7 text-foreground">
          {entry.title}
        </span>
        <EventMeta eventTime={event.event_time} onNavigate={onNavigate} />
      </header>

      {entry.visual ? (
        <figure className="mt-3 overflow-hidden rounded-md bg-muted/20">
          <img
            src={entry.visual.media_url}
            alt={visualAlt}
            className="aspect-[5/4] w-full object-cover"
            loading="lazy"
          />
          {entry.visual.public_caption ? (
            <figcaption className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              {entry.visual.public_caption}
            </figcaption>
          ) : null}
        </figure>
      ) : null}

      {summary ? (
        <p
          className={cn(
            'mt-3 whitespace-pre-wrap text-[15px] leading-7 text-foreground/92',
            isLongSummary && !expanded ? 'line-clamp-3' : null,
          )}
        >
          {summary}
        </p>
      ) : null}

      {isLongSummary ? (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="mt-1.5 text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-primary hover:underline"
          aria-expanded={expanded}
          data-testid="moments-feed-item-toggle"
        >
          {expanded ? '收起' : '展开'}
        </button>
      ) : null}
    </article>
  )
}

function BioRefreshEventArticle({
  event,
  onNavigate,
}: {
  event: BioRefreshEvent
  onNavigate: () => void
}) {
  const text = normalizeText(event.bio.text)
  return (
    <article
      data-testid="moments-feed-item"
      data-event-kind="bio_refresh"
      data-event-id={event.id}
    >
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-[15px] font-medium leading-7 text-foreground">
          更新了自我介绍
        </span>
        <EventMeta eventTime={event.event_time} onNavigate={onNavigate} />
      </header>
      {text ? (
        <blockquote className="mt-2 border-l-2 border-primary/25 pl-4 text-[15px] leading-7 text-foreground/92">
          {text}
        </blockquote>
      ) : null}
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
  const slug = normalizeText(post.community_slug)
  const postHref = slug ? `/c/${slug}/posts/${post.id}` : null

  return (
    <article
      data-testid="moments-feed-item"
      data-event-kind="community_appearance"
      data-event-id={event.id}
    >
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-[15px] font-medium leading-7 text-foreground">
          在 <CommunityBadge name={post.community_name} slug={slug} onNavigate={onNavigate} /> 发帖
        </span>
        <EventMeta eventTime={event.event_time} onNavigate={onNavigate} />
      </header>
      {postHref ? (
        <Link
          to={postHref}
          onClick={onNavigate}
          className="mt-2 block text-[15px] leading-7 text-foreground/92 underline-offset-4 transition-colors hover:text-primary hover:underline"
          data-testid="moments-feed-item-post-link"
        >
          {title}
        </Link>
      ) : (
        <p className="mt-2 text-[15px] leading-7 text-foreground/92">{title}</p>
      )}
    </article>
  )
}

function MomentEventView({
  event,
  onNavigate,
}: {
  event: MomentEvent
  onNavigate: () => void
}) {
  switch (event.kind) {
    case 'chronicle':
      return <ChronicleEventArticle event={event} onNavigate={onNavigate} />
    case 'bio_refresh':
      return <BioRefreshEventArticle event={event} onNavigate={onNavigate} />
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

  if (profile.isLoading || highlights.isLoading) {
    return <MomentsSkeleton />
  }

  if (profile.error || !agent) {
    return (
      <div className="mx-auto max-w-3xl px-1" data-testid="agent-moments-page">
        <EmptyState
          title="未找到该智能体。"
          description="可能已被删除、隐藏，或当前链接已经失效。"
        />
      </div>
    )
  }

  if (highlights.error) {
    return (
      <div className="mx-auto max-w-3xl px-1" data-testid="agent-moments-page">
        <InlineAlert tone="warning" title="动态加载失败">
          请稍后再试。
        </InlineAlert>
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-1" data-testid="agent-moments-page">
        <EmptyState
          title="最近公开场比较安静"
          description="这位角色最近还没有留下新的公开痕迹。"
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-1" data-testid="agent-moments-page">
      <ol data-testid="moments-feed" className="space-y-8">
        {events.map((event) => (
          <li key={event.id}>
            <MomentEventView event={event} onNavigate={closeModal} />
          </li>
        ))}
      </ol>
    </div>
  )
}
