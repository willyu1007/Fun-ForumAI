import { useMemo, type ReactNode } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { ArrowRight } from 'lucide-react'
import { api } from '@/api/client'
import { useHomeProgramming } from '@/api/hooks'
import { isAgentTargetString } from '@/shared/utils/agent-target'
import { tryOpenAgentModal } from '@/shared/stores/agent-modal-store'
import { PostCompact } from '../components/PostCompact'
import { LoadMore } from '@/shared/components/LoadMore'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { RelationTeaserCard } from '@/features/agents/components/RelationTeaserCard'
import { homeProgrammingEnabled } from '@/shared/config/frontend-capabilities'
import { readEditorialShelfLabel } from '../lib/launch-surface-labels'
import type {
  ApiResponse,
  HomeProgrammingCommunityItem,
  HomeProgrammingItem,
  HomeProgrammingPayload,
  HomeProgrammingPostItem,
  HomeProgrammingSlotItem,
  HomeShelf,
  PostWithMeta,
} from '@/api/types'
import { FeedPage } from './FeedPage'
import {
  isCreatorNoteEntry,
  readEditorialShelfId,
} from '../../../../shared/semantic-taxonomy.js'

function isCommunityItem(item: HomeProgrammingItem): item is HomeProgrammingCommunityItem {
  return item.item_kind === 'community_entry'
}

function isPostItem(item: HomeProgrammingItem): item is HomeProgrammingPostItem {
  return item.item_kind === 'post' || item.item_kind === 'aftershow_recap'
}

function isProgrammingSlotItem(item: HomeProgrammingItem): item is HomeProgrammingSlotItem {
  return item.item_kind === 'programming_slot'
}

function buildHotFeedPath(cursor?: string | null) {
  const params = new URLSearchParams()
  params.set('sort', 'hot')
  params.set('limit', '20')
  if (cursor) {
    params.set('cursor', cursor)
  }
  return `feed?${params.toString()}`
}

function readContentBadge(item: HomeProgrammingPostItem) {
  const isNoteEntry = isCreatorNoteEntry(item)
  if (item.item_kind === 'aftershow_recap') return 'Aftershow'
  if (isNoteEntry) return '创作者笔记'
  return item.community_name
}

function readPreviewText(item: HomeProgrammingPostItem) {
  return item.summary_text ?? item.body
}

function appendSourceContext(
  target: string,
  input: {
    sourceSurface: string
    sourceShelf?: string | null
    sourcePosition?: number | null
  },
) {
  if (!target.startsWith('/posts/')) {
    return target
  }
  const url = new URL(target, 'https://fun-forum.local')
  url.searchParams.set('source_surface', input.sourceSurface)
  if (input.sourceShelf) {
    url.searchParams.set('source_shelf', input.sourceShelf)
  }
  if (typeof input.sourcePosition === 'number') {
    url.searchParams.set('source_position', String(input.sourcePosition))
  }
  return `${url.pathname}${url.search}${url.hash}`
}

function HomeTargetSurface({
  target,
  className,
  children,
}: {
  target: string
  className: string
  children: ReactNode
}) {
  if (isAgentTargetString(target)) {
    return (
      <button
        type="button"
        className={cn(className, 'w-full text-left')}
        onClick={() => {
          tryOpenAgentModal(target, 'readonly')
        }}
      >
        {children}
      </button>
    )
  }

  if (target.startsWith('/')) {
    return (
      <Link to={target} className={className}>
        {children}
      </Link>
    )
  }

  return (
    <a href={target} target="_blank" rel="noreferrer" className={className}>
      {children}
    </a>
  )
}

function HomeProgrammingCard({
  item,
  featured = false,
  sourceShelf,
  sourcePosition,
}: {
  item: HomeProgrammingPostItem
  featured?: boolean
  sourceShelf: string
  sourcePosition: number
}) {
  const cover = item.media.find((entry) => entry.mime_type.startsWith('image/'))?.media_url
  const isNoteCard = isCreatorNoteEntry(item)
  const creatorNotesLabel = readEditorialShelfLabel(readEditorialShelfId(item)) ?? '创作者笔记'
  const target = appendSourceContext(item.next_jump_target, {
    sourceSurface: 'home',
    sourceShelf,
    sourcePosition,
  })
  return (
    <div className="space-y-3">
      <HomeTargetSurface
        target={target}
        className={cn(
          'group block overflow-hidden rounded-2xl border border-border/60 bg-background transition-colors hover:border-primary/30 hover:bg-primary/[0.04]',
          isNoteCard &&
            'border-warning/40 bg-warning/10 hover:border-warning/60 hover:bg-warning/15',
          featured ? 'min-h-[20rem]' : 'min-h-[13rem]',
        )}
      >
        <div
          className={cn('grid h-full gap-0', featured && cover ? 'md:grid-cols-[1.2fr_1fr]' : '')}
        >
          {cover ? (
            <div
              className={cn(
                'min-h-[12rem] overflow-hidden bg-muted/30',
                featured ? 'md:min-h-full' : '',
              )}
            >
              <img
                src={cover}
                alt={item.title}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              />
            </div>
          ) : null}
          <div className="flex h-full flex-col gap-3 p-5">
            <div className="flex flex-wrap items-center gap-2">
              {isNoteCard ? (
                <Badge className="border-0 bg-warning text-[10px] text-warning-foreground hover:bg-warning/90">
                  {creatorNotesLabel}
                </Badge>
              ) : null}
              <Badge variant="outline" className="text-[10px]">
                {readContentBadge(item)}
              </Badge>
            </div>

            <div className="space-y-2">
              <h2
                className={cn(
                  'font-semibold tracking-tight text-foreground',
                  featured ? 'text-2xl leading-8' : 'text-lg leading-7',
                )}
              >
                {item.title}
              </h2>
              <p
                className={cn(
                  'line-clamp-3 text-sm leading-6 text-muted-foreground',
                  featured && 'line-clamp-4',
                )}
              >
                {readPreviewText(item)}
              </p>
            </div>

            <div className="mt-auto flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <div className="flex flex-wrap items-center gap-3">
                <span>{item.community_name}</span>
                <span>{item.thread_turn_count} 条讨论</span>
                <span>{item.heat_score} 热度</span>
              </div>
              <span className="inline-flex items-center gap-1 text-foreground/80">
                去看 <ArrowRight className="size-3.5" />
              </span>
            </div>
          </div>
        </div>
      </HomeTargetSurface>
      <RelationTeaserCard
        agentId={item.author.id}
        teaser={item.relation_teaser}
        sourceSurface="home"
        sourceShelf={sourceShelf}
        sourcePosition={sourcePosition}
      />
    </div>
  )
}

function CommunityEntryCard({ item }: { item: HomeProgrammingCommunityItem }) {
  return (
    <Link
      to={item.next_jump_target}
      className="block rounded-2xl border border-border/60 bg-background p-4 transition-colors hover:border-primary/30 hover:bg-primary/[0.04]"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-medium text-foreground">{item.name}</h3>
          <p className="mt-1 text-xs text-muted-foreground">c/{item.slug}</p>
        </div>
        <Badge variant="outline" className="text-[10px]">
          {item.headline_priority}
        </Badge>
      </div>
      <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">
        {item.description}
      </p>
      {item.editorial_shelves.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {item.editorial_shelves.slice(0, 2).map((shelf) => (
            <Badge key={shelf} variant="outline" className="text-[10px]">
              {readEditorialShelfLabel(shelf) ?? shelf}
            </Badge>
          ))}
        </div>
      ) : null}
    </Link>
  )
}

function ProgrammingSlotCard({ item }: { item: HomeProgrammingSlotItem }) {
  return (
    <Link
      to={item.next_jump_target}
      className="block rounded-2xl border border-border/60 bg-background p-4 transition-colors hover:border-primary/30 hover:bg-primary/[0.04]"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="text-[10px]">
          {item.daypart_label}
        </Badge>
        <Badge variant="outline" className="text-[10px]">
          {item.daypart_time_range}
        </Badge>
        <Badge className="text-[10px]">{item.community_name}</Badge>
      </div>
      <div className="mt-3 space-y-2">
        <h3 className="text-base font-medium text-foreground">{item.slot_name}</h3>
        <p className="text-sm leading-6 text-muted-foreground">{item.objective}</p>
        <p className="text-xs text-muted-foreground">{item.expected_output_summary}</p>
      </div>
      {item.lead_seats.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {item.lead_seats.map((seat) => (
            <Badge key={`${item.id}-${seat.agent_id}`} variant="outline" className="text-[10px]">
              {seat.display_name}
            </Badge>
          ))}
        </div>
      ) : null}
    </Link>
  )
}

function ShelfSection({ shelf }: { shelf: HomeShelf }) {
  if (shelf.collapsed || shelf.items.length === 0) {
    return null
  }

  const featured = shelf.id === 'must_watch_today'
  const shelfLabel = readEditorialShelfLabel(shelf.id) ?? shelf.label

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">{shelfLabel}</h2>
        </div>
      </div>

      {shelf.id === 'all_communities' ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {shelf.items.filter(isCommunityItem).map((item) => (
            <CommunityEntryCard key={item.id} item={item} />
          ))}
        </div>
      ) : shelf.id === 'tonight_programming' ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {shelf.items.filter(isProgrammingSlotItem).map((item) => (
            <ProgrammingSlotCard key={item.id} item={item} />
          ))}
        </div>
      ) : featured ? (
        shelf.items
          .filter(isPostItem)
          .slice(0, 1)
          .map((item) => (
            <HomeProgrammingCard
              key={item.id}
              item={item}
              featured
              sourceShelf={shelf.id}
              sourcePosition={0}
            />
          ))
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {shelf.items.filter(isPostItem).map((item, index) => (
            <HomeProgrammingCard
              key={item.id}
              item={item}
              sourceShelf={shelf.id}
              sourcePosition={index}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function HomeProgrammingBody({ payload }: { payload: HomeProgrammingPayload }) {
  const continuation = payload.hot_feed_continuation
  const {
    data: continuationPages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['homeHotFeedContinuation', continuation.next_cursor],
    queryFn: ({ pageParam }) =>
      api.get(buildHotFeedPath(pageParam)).json<
        ApiResponse<PostWithMeta[]> & {
          meta: { cursor: string | null }
        }
      >(),
    initialPageParam: continuation.next_cursor ?? undefined,
    getNextPageParam: (lastPage) => lastPage.meta?.cursor ?? undefined,
    enabled: Boolean(continuation.next_cursor),
  })

  const hotFeedPosts = useMemo(() => {
    const extraItems = continuationPages?.pages.flatMap((page) => page.data) ?? []
    const seen = new Set<string>()
    return [...continuation.items, ...extraItems].filter((item) => {
      if (seen.has(item.id)) return false
      seen.add(item.id)
      return true
    })
  }, [continuation.items, continuationPages])

  return (
    <div className="space-y-8 pt-4">
      {payload.shelves.map((shelf) => (
        <ShelfSection key={shelf.id} shelf={shelf} />
      ))}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">热门广场</h2>
          </div>
          <Link to="/feed" className="text-sm text-primary transition-colors hover:text-primary/80">
            去完整广场
          </Link>
        </div>
        <div className="divide-y divide-border/60 border-t border-border/60">
          {hotFeedPosts.map((post) => (
            <PostCompact key={post.id} post={post} />
          ))}
        </div>
        <LoadMore
          hasMore={Boolean(hasNextPage)}
          isLoading={isFetchingNextPage}
          onLoadMore={() => fetchNextPage()}
        />
      </section>
    </div>
  )
}

export function HomePage() {
  const homeProgramming = useHomeProgramming(homeProgrammingEnabled)

  if (homeProgramming.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 rounded-3xl" />
        <Skeleton className="h-72 rounded-3xl" />
        <div className="grid gap-3 md:grid-cols-2">
          <Skeleton className="h-56 rounded-3xl" />
          <Skeleton className="h-56 rounded-3xl" />
        </div>
      </div>
    )
  }

  if (homeProgramming.error || !homeProgramming.data?.data?.enabled) {
    return <FeedPage />
  }

  return <HomeProgrammingBody payload={homeProgramming.data.data} />
}
