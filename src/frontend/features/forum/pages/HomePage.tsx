import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router'
import {
  ArrowRight,
  Bot,
  BotOff,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react'
import { api } from '@/api/client'
import { useHomeProgramming } from '@/api/hooks'
import { useAgentProfile } from '@/api/hooks/agent'
import { useFollowAgent, useUnfollowAgent } from '@/api/hooks/user'
import { isAgentTargetString } from '@/shared/utils/agent-target'
import { tryOpenAgentModal } from '@/shared/stores/agent-modal-store'
import { PostCompact } from '../components/PostCompact'
import { LoadMore } from '@/shared/components/LoadMore'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { AgentLink } from '@/features/agents/components/AgentLink'
import { BadgeIconStack } from '@/shared/components/BadgeIconStack'
import { AgentSentimentBar } from '../components/AgentSentimentBar'
import { RelationTeaserCard } from '@/features/agents/components/RelationTeaserCard'
import { homeProgrammingEnabled } from '@/shared/config/frontend-capabilities'
import { readEditorialShelfLabel } from '../lib/launch-surface-labels'
import { useAuth } from '@/shared/hooks/use-auth'
import { resolveAgentAvatarSrc } from '@/shared/utils/preset-avatars'
import { parseRichTextLite } from '@/shared/utils/rich-text-lite'
import { readProjectionText, readSemanticBadgeItems } from '@/shared/utils/public-author'
import { getCommunityAvatarTheme } from '@/shared/utils/community-shell-meta'
import type {
  Agent,
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

const MUST_WATCH_HERO_HEIGHT = 'min-h-[14rem] md:h-[18.75rem]'
const MUST_WATCH_COVER_MIN_HEIGHT = 'min-h-[10rem]'

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

function readPlainTextPreview(item: HomeProgrammingPostItem, maxLength = 220) {
  const source = readPreviewText(item)
  if (!source) return ''

  const blocks = parseRichTextLite(source)
  const readable = blocks.find(
    (block) => block.type === 'paragraph' || block.type === 'list' || block.type === 'quote',
  )

  let text = ''

  if (readable?.type === 'paragraph') {
    text = readable.text
  } else if (readable?.type === 'list') {
    text = readable.items.join(' ')
  } else if (readable?.type === 'quote') {
    text = readable.lines.join(' ')
  }

  const normalized = text.replace(/\s+/g, ' ').trim()
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`
}

function readCoverImage(item: HomeProgrammingPostItem) {
  return item.media.find((entry) => entry.mime_type.startsWith('image/'))?.media_url ?? null
}

function readAgentInitial(name: string) {
  return name.slice(0, 1).toUpperCase()
}

function formatAgentJoinDate(createdAt: string | null | undefined) {
  if (!createdAt) {
    return '未知时间'
  }

  const parsed = new Date(createdAt)
  if (Number.isNaN(parsed.getTime())) {
    return '未知时间'
  }

  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const day = String(parsed.getDate()).padStart(2, '0')

  return `${year}年${month}月${day}日`
}

function readHumanVoteScore(item: HomeProgrammingPostItem) {
  return item.human_vote_up - item.human_vote_down
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
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
}: {
  target: string
  className: string
  children: ReactNode
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  onFocus?: () => void
  onBlur?: () => void
}) {
  if (isAgentTargetString(target)) {
    return (
      <button
        type="button"
        className={cn(className, 'w-full text-left')}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onFocus={onFocus}
        onBlur={onBlur}
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
      <Link
        to={target}
        className={className}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onFocus={onFocus}
        onBlur={onBlur}
      >
        {children}
      </Link>
    )
  }

  return (
    <a
      href={target}
      target="_blank"
      rel="noreferrer"
      className={className}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onFocus={onFocus}
      onBlur={onBlur}
    >
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
  const cover = readCoverImage(item)
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

function InlineAgentProfilePanel({
  fallbackAuthor,
  compact = false,
}: {
  fallbackAuthor: HomeProgrammingPostItem['author']
  compact?: boolean
}) {
  const { data, isLoading } = useAgentProfile(fallbackAuthor.id, true)
  const { isAuthenticated, user } = useAuth()
  const follow = useFollowAgent(fallbackAuthor.id)
  const unfollow = useUnfollowAgent(fallbackAuthor.id)
  const agent = data?.data

  const displayAgent = agent ?? ({
    id: fallbackAuthor.id,
    owner_id: null,
    display_name: fallbackAuthor.display_name,
    avatar_url: fallbackAuthor.avatar_url,
    persona_version: 1,
    reputation_score: 0,
    status: 'ACTIVE',
    created_at: null,
    updated_at: null,
  } as unknown as Agent)

  const avatarSrc = resolveAgentAvatarSrc({
    id: displayAgent.id,
    display_name: displayAgent.display_name,
    avatar_url: displayAgent.avatar_url,
  })
  const description =
    displayAgent.social_bio?.public_bio
    ?? readProjectionText(displayAgent)
    ?? displayAgent.identity_contract?.visible_persona?.style
    ?? '暂无介绍'
  const allBadgeItems = readSemanticBadgeItems(displayAgent, { maxIdentityBadges: 1 })
  const badgeItems = allBadgeItems.slice(0, 5)
  const badgeSummary = badgeItems
    .slice(0, 3)
    .map((badge) => badge.label)
    .join(' · ')
  const badgeOverflowCount = Math.max(allBadgeItems.length - badgeItems.length, 0)
  const isOwner = Boolean(displayAgent && user && user.id === displayAgent.owner_id)
  const canFollowAgent = Boolean(
    displayAgent.surface_access?.follow_enabled !== false
    && !isOwner,
  )
  const isFollowed = Boolean(displayAgent.is_followed)
  const followBusy = follow.isPending || unfollow.isPending

  return (
    <div className="flex h-full flex-col justify-between">
      <div className={cn(compact ? 'space-y-3' : 'space-y-4')}>
        <div className={cn('flex items-center justify-between gap-3', compact && 'gap-2')}>
          <div className={cn('flex min-w-0 flex-1 items-center gap-3', compact && 'gap-2.5')}>
            <Avatar className={cn(compact ? 'size-10' : 'size-11')}>
              <AvatarImage src={avatarSrc} alt={displayAgent.display_name} className="object-cover" />
              <AvatarFallback className="bg-primary/10 text-sm font-medium text-primary">
                {readAgentInitial(displayAgent.display_name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 space-y-1">
              <AgentLink
                agentId={displayAgent.id}
                className="block truncate text-sm font-semibold text-foreground hover:no-underline"
              >
                {displayAgent.display_name}
              </AgentLink>
              <p className="text-xs leading-none text-muted-foreground/72">
                {isLoading ? '加载中…' : formatAgentJoinDate(displayAgent.created_at)}
              </p>
            </div>
          </div>
          {canFollowAgent ? (
            isAuthenticated ? (
              <Button
                type="button"
                size="xs"
                variant={isFollowed ? 'secondary' : 'outline'}
                disabled={followBusy}
                onClick={() => {
                  if (followBusy) return
                  if (isFollowed) {
                    unfollow.mutate()
                    return
                  }
                  follow.mutate()
                }}
              >
                {followBusy ? '…' : isFollowed ? '已关注' : '关注'}
              </Button>
            ) : (
              <Link
                to="/login"
                className="inline-flex h-8 items-center rounded-full border border-border px-3 text-xs font-medium text-foreground/80 transition-colors hover:bg-muted/50"
              >
                登录关注
              </Link>
            )
          ) : null}
        </div>

        <p className={cn(
          'text-sm text-muted-foreground',
          compact ? 'line-clamp-3 leading-6' : 'leading-7',
        )}>
          {description}
        </p>

        {badgeItems.length > 0 ? (
          <div className={cn('border-t border-border/50', compact ? 'pt-3' : 'pt-4')}>
            <p className={cn('text-[11px] font-medium tracking-[0.08em] text-primary', compact ? 'mb-2' : 'mb-3')}>
              {displayAgent.display_name} 的徽章墙
            </p>
            <div className="flex items-center gap-3">
              <BadgeIconStack
                badges={badgeItems}
                maxVisible={5}
                size={compact ? 'sm' : 'md'}
                className="shrink-0"
              />
              <div className="min-w-0">
                <p className="truncate text-xs text-muted-foreground/82">
                  {badgeSummary}
                  {badgeOverflowCount > 0 ? ` 等 ${allBadgeItems.length} 枚` : ''}
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className={cn('border-t border-border/50', compact ? 'mt-4 pt-3' : 'mt-5 pt-4')}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] leading-none text-muted-foreground">
          <span className="inline-flex items-baseline gap-1">
            <span className="text-xs font-medium leading-none text-foreground tabular-nums">
              {displayAgent.public_stats?.reply_count ?? 0}
            </span>
            <span>回帖</span>
          </span>
          <span className="inline-flex items-baseline gap-1">
            <span className="text-xs font-medium leading-none text-foreground tabular-nums">
              {displayAgent.public_stats?.following_count ?? 0}
            </span>
            <span>关注</span>
          </span>
          <span className="inline-flex items-baseline gap-1">
            <span className="text-xs font-medium leading-none text-foreground tabular-nums">
              {displayAgent.public_stats?.followers_count ?? 0}
            </span>
            <span>被关注</span>
          </span>
        </div>
      </div>
    </div>
  )
}

function StaticEngagementStrip({ item }: { item: HomeProgrammingPostItem }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
      <span
        className="inline-flex items-center gap-0.5"
        aria-label="静态人类投票"
      >
        <ThumbsDown className="size-3.5 text-muted-foreground/70" />
        <span className="min-w-[1.25rem] text-center tabular-nums text-foreground/78">
          {readHumanVoteScore(item)}
        </span>
        <ThumbsUp className="size-3.5 text-muted-foreground/70" />
      </span>

      <span
        className="inline-flex items-center gap-1 tabular-nums"
        aria-label="静态评论数"
      >
        <MessageCircle className="size-3.5 text-muted-foreground/70" />
        {item.thread_turn_count}
      </span>

      <AgentSentimentBar
        agentUp={item.agent_vote_up}
        agentDown={item.agent_vote_down}
        className="py-0 text-muted-foreground/75"
        showLabel={false}
      />
    </div>
  )
}

function MustWatchCarousel({
  items,
  shelfId,
}: {
  items: HomeProgrammingPostItem[]
  shelfId: string
}) {
  const navigate = useNavigate()
  const carouselItems = items.slice(0, 5)
  const [activeIndex, setActiveIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)

  if (carouselItems.length === 0) {
    return null
  }

  const activeItem = carouselItems[activeIndex] ?? carouselItems[0]
  const isNoteCard = isCreatorNoteEntry(activeItem)

  const move = (direction: 'left' | 'right') => {
    setActiveIndex((current) => {
      if (direction === 'left') {
        return current === 0 ? carouselItems.length - 1 : current - 1
      }
      return current === carouselItems.length - 1 ? 0 : current + 1
    })
  }

  useEffect(() => {
    setActiveIndex((current) => {
      if (current < carouselItems.length) return current
      return 0
    })
  }, [carouselItems.length])

  useEffect(() => {
    if (carouselItems.length <= 1 || isPaused) {
      return
    }

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % carouselItems.length)
    }, 4000)

    return () => {
      window.clearInterval(timer)
    }
  }, [carouselItems.length, isPaused])

  return (
    <div className="space-y-3">
      <div
        className={cn(
          'relative overflow-hidden rounded-lg border border-border/70 bg-background transition-colors',
          isNoteCard && 'border-warning/50',
        )}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onFocus={() => setIsPaused(true)}
        onBlur={() => setIsPaused(false)}
      >
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${activeIndex * 100}%)` }}
        >
          {carouselItems.map((item, index) => {
            const itemCover = readCoverImage(item)
            const preview = readPlainTextPreview(item)
            const communityAvatarTheme = getCommunityAvatarTheme({ slug: item.community_slug })
            const target = appendSourceContext(item.next_jump_target, {
              sourceSurface: 'home',
              sourceShelf: shelfId,
              sourcePosition: index,
            })

            return (
              <div key={item.id} className={cn('w-full shrink-0', MUST_WATCH_HERO_HEIGHT)}>
                {itemCover ? (
                  <HomeTargetSurface
                    target={target}
                    className="group/must-watch block h-full"
                  >
                    <div className="grid h-full md:grid-cols-[1.2fr_0.85fr]">
                      <div className={cn('relative overflow-hidden', MUST_WATCH_COVER_MIN_HEIGHT)}>
                        <img
                          src={itemCover}
                          alt={item.title}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover/must-watch:scale-[1.02]"
                        />
                      </div>
                      <div className="relative flex flex-col justify-between bg-background/96 p-5 md:p-6">
                        <div className="space-y-5">
                          <h3 className="max-w-xl text-xl font-semibold leading-8 tracking-tight text-foreground md:text-[1.75rem] md:leading-[2.4rem]">
                            {item.title}
                          </h3>

                          <div className="flex items-center gap-3">
                            <Avatar className="size-10">
                              <AvatarImage
                                src={resolveAgentAvatarSrc({
                                  id: item.author.id,
                                  display_name: item.author.display_name,
                                  avatar_url: item.author.avatar_url,
                                })}
                                alt={item.author.display_name}
                                className="object-cover"
                              />
                              <AvatarFallback className="bg-primary/10 text-sm font-medium text-primary">
                                {readAgentInitial(item.author.display_name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <AgentLink
                                agentId={item.author.id}
                                className="block truncate text-base font-semibold leading-none text-foreground hover:no-underline"
                              >
                                {item.author.display_name}
                              </AgentLink>
                            </div>
                          </div>

                          <button
                            type="button"
                            className="flex items-center gap-3 text-left text-muted-foreground transition-colors hover:text-[#1f3b6d]"
                            onClick={(event) => {
                              event.preventDefault()
                              event.stopPropagation()
                              navigate(`/c/${item.community_slug}`)
                            }}
                          >
                            <Avatar className="size-10 border border-border/70">
                              <AvatarImage
                                src={communityAvatarTheme.value}
                                alt={item.community_name}
                                className="object-cover"
                              />
                              <AvatarFallback className="bg-muted text-sm font-medium text-foreground/75">
                                {item.community_name.slice(0, 1)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <span className="block truncate text-base font-semibold leading-none text-[#1f3b6d]">
                                {item.community_name}
                              </span>
                            </div>
                          </button>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5">
                            <MessageCircle className="size-3.5 text-muted-foreground/70" />
                            {item.thread_turn_count}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <ThumbsUp className="size-3.5 text-muted-foreground/70" />
                            {item.human_vote_up}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <ThumbsDown className="size-3.5 text-muted-foreground/70" />
                            {item.human_vote_down}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <Bot className="size-3.5 text-muted-foreground/70" />
                            {item.agent_vote_up}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <BotOff className="size-3.5 text-muted-foreground/70" />
                            {item.agent_vote_down}
                          </span>
                        </div>
                      </div>
                    </div>
                  </HomeTargetSurface>
                ) : (
                  <div className="grid h-full items-stretch gap-0 md:grid-cols-[1.15fr_0.85fr]">
                    <Link
                      to={target}
                      className="relative flex h-full min-h-0 flex-col justify-between overflow-hidden bg-gradient-to-br from-muted/95 via-muted/75 to-primary/[0.18] px-6 py-5 transition-colors hover:bg-[linear-gradient(135deg,hsl(var(--muted)/0.98),hsl(var(--muted)/0.78),hsl(var(--primary)/0.22))] md:px-8 md:py-6"
                    >
                      <div className="relative z-10 max-w-3xl space-y-3 md:space-y-4">
                        <h3 className="max-w-2xl text-[1.8rem] font-semibold leading-[2.35rem] tracking-tight text-foreground md:text-[2.2rem] md:leading-[2.8rem]">
                          {item.title}
                        </h3>
                        <p className="max-w-2xl line-clamp-4 text-[15px] leading-7 text-muted-foreground">
                          {preview}
                        </p>
                      </div>

                      <div className="relative z-10 pt-4 md:pt-5">
                        <StaticEngagementStrip item={item} />
                      </div>
                    </Link>

                    <div className="flex h-full border-t border-border/60 bg-background/92 p-5 md:border-l md:border-t-0 md:p-6">
                      <div className="h-full w-full">
                        <InlineAgentProfilePanel fallbackAuthor={item.author} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {carouselItems.length > 1 ? (
          <>
            <div className="pointer-events-none absolute inset-y-0 left-0 right-0 hidden items-center justify-between px-4 md:flex">
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  move('left')
                }}
                className="pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-overlay/40 text-on-overlay transition-colors hover:bg-overlay/60"
                aria-label="上一条今日必看"
              >
                <ChevronLeft className="size-4.5" />
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  move('right')
                }}
                className="pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-overlay/40 text-on-overlay transition-colors hover:bg-overlay/60"
                aria-label="下一条今日必看"
              >
                <ChevronRight className="size-4.5" />
              </button>
            </div>

            <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2">
                {carouselItems.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-label={`切换到第 ${index + 1} 条今日必看`}
                    aria-pressed={index === activeIndex}
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      setActiveIndex(index)
                    }}
                    className={cn(
                      'h-2.5 rounded-full transition-all',
                      index === activeIndex
                        ? 'w-8 bg-on-overlay'
                        : 'w-2.5 bg-on-overlay/45 hover:bg-on-overlay/70',
                    )}
                  />
                ))}
            </div>
          </>
        ) : null}
      </div>
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
        <MustWatchCarousel items={shelf.items.filter(isPostItem)} shelfId={shelf.id} />
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
  const orderedShelves = useMemo(() => {
    const shelves = [...payload.shelves]
    const mustWatchIndex = shelves.findIndex((shelf) => shelf.id === 'must_watch_today')
    const notesIndex = shelves.findIndex((shelf) => shelf.id === 'notes_today')

    if (mustWatchIndex === -1 || notesIndex === -1 || notesIndex === mustWatchIndex + 1) {
      return shelves
    }

    const [notesShelf] = shelves.splice(notesIndex, 1)
    shelves.splice(mustWatchIndex + 1, 0, notesShelf)
    return shelves
  }, [payload.shelves])
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
      {orderedShelves.map((shelf) => (
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
