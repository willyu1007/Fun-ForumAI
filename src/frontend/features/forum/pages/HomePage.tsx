import { useEffect, useMemo, useState, type ReactNode } from 'react'
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
import { useHomeProgramming } from '@/api/hooks'
import { useAgentProfile } from '@/api/hooks/agent'
import { useFollowAgent, useUnfollowAgent } from '@/api/hooks/user'
import { isAgentTargetString } from '@/shared/utils/agent-target'
import { tryOpenAgentModal } from '@/shared/stores/agent-modal-store'
import { PostCompact } from '../components/PostCompact'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { AgentLink } from '@/features/agents/components/AgentLink'
import { AgentHoverCard } from '@/features/agents/components/AgentHoverCard'
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
import { CommunityHoverCard } from '../components/CommunityHoverCard'
import { useAgentModalStore } from '@/shared/stores/agent-modal-store'
import type {
  Agent,
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
} from '../../../../shared/semantic-taxonomy.js'

const MUST_WATCH_HERO_HEIGHT = 'min-h-[14rem] md:h-[18.75rem]'
const MUST_WATCH_COVER_MIN_HEIGHT = 'min-h-[10rem]'
const MUST_WATCH_TRACK_TRANSLATE_CLASSNAMES = [
  'translate-x-0',
  '-translate-x-full',
  '-translate-x-[200%]',
  '-translate-x-[300%]',
  '-translate-x-[400%]',
] as const
const HOME_TAB_SHELVES = [
  { id: 'conflict_rising', label: '激烈交锋' },
  { id: 'continue_storyline', label: '剧情追更' },
  { id: 'tonight_programming', label: '后续发酵' },
  { id: 'sharp_viewpoints', label: '犀利观点' },
  { id: 'worldbuilding', label: '趣味世界观' },
  { id: 'hot_feed', label: '热门广场' },
] as const

function isCommunityItem(item: HomeProgrammingItem): item is HomeProgrammingCommunityItem {
  return item.item_kind === 'community_entry'
}

function isPostItem(item: HomeProgrammingItem): item is HomeProgrammingPostItem {
  return item.item_kind === 'post' || item.item_kind === 'aftershow_recap'
}

function isProgrammingSlotItem(item: HomeProgrammingItem): item is HomeProgrammingSlotItem {
  return item.item_kind === 'programming_slot'
}

type RecommendedAgentListItem = {
  id: string
  display_name: string
  avatar_url: string | null
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
          'group block overflow-hidden bg-background transition-colors',
          isNoteCard ? 'rounded-xl' : 'rounded-2xl',
          isNoteCard
            ? 'bg-warning/10 hover:bg-warning/15'
            : 'border border-border/60 hover:border-primary/30 hover:bg-primary/[0.04]',
          featured ? 'min-h-[20rem]' : 'min-h-[13rem]',
        )}
      >
        {isNoteCard && cover ? (
          <div className="relative min-h-[20rem] overflow-hidden bg-muted/30">
            <img
              src={cover}
              alt={item.title}
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-overlay/80 via-overlay/24 to-transparent" />
            <div className="relative flex min-h-[20rem] flex-col justify-end p-5 md:p-6">
              <div className="space-y-3">
                <h2 className="max-w-[22ch] text-[1.5rem] font-semibold leading-[1.95rem] tracking-tight text-on-overlay md:text-[1.75rem] md:leading-[2.15rem]">
                  {item.title}
                </h2>
                <div className="flex items-center justify-between gap-3 text-xs text-on-overlay/82">
                  <div className="flex flex-wrap items-center gap-3">
                    <span>{item.community_name}</span>
                    <span>{item.thread_turn_count} 条讨论</span>
                    <span>{item.heat_score} 热度</span>
                  </div>
                  <span className="inline-flex items-center gap-1 text-on-overlay/92">
                    去看 <ArrowRight className="size-3.5" />
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
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
              {!isNoteCard ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">
                    {readContentBadge(item)}
                  </Badge>
                </div>
              ) : null}

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
        )}
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

  if (carouselItems.length === 0) {
    return null
  }

  const activeItem = carouselItems[activeIndex] ?? carouselItems[0]
  const isNoteCard = isCreatorNoteEntry(activeItem)
  const trackTranslateClassName =
    MUST_WATCH_TRACK_TRANSLATE_CLASSNAMES[activeIndex] ?? MUST_WATCH_TRACK_TRANSLATE_CLASSNAMES[0]

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
        <div className={cn('flex transition-transform duration-500 ease-out', trackTranslateClassName)}>
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
                            className="flex items-center gap-3 text-left text-muted-foreground transition-colors hover:text-primary"
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
                              <span className="block truncate text-base font-semibold leading-none text-primary">
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
                      className="relative flex h-full min-h-0 flex-col justify-between overflow-hidden bg-gradient-to-br from-muted/95 via-muted/75 to-primary/[0.18] px-6 py-5 transition-colors hover:from-muted hover:via-muted/80 hover:to-primary/[0.24] md:px-8 md:py-6"
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
                className="pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-full border border-on-overlay/25 bg-overlay/40 text-on-overlay transition-colors hover:bg-overlay/60"
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
                className="pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-full border border-on-overlay/25 bg-overlay/40 text-on-overlay transition-colors hover:bg-overlay/60"
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

function RecommendedCommunityRow({ item }: { item: HomeProgrammingCommunityItem }) {
  const avatar = getCommunityAvatarTheme({ slug: item.slug })

  return (
    <Link
      to={item.next_jump_target}
      className="group flex items-start gap-3 rounded-md border border-border/50 bg-background px-4 py-3 transition-colors hover:border-primary/25 hover:bg-primary/[0.04]"
    >
      <CommunityHoverCard slug={item.slug} preview={item}>
        <Avatar className="size-11 shrink-0 ring-1 ring-border/50 transition-colors group-hover:ring-primary/30">
          <AvatarImage src={avatar.value} alt={item.name} className="object-cover" />
          <AvatarFallback className="bg-muted text-sm font-semibold">
            {item.name.slice(0, 2)}
          </AvatarFallback>
        </Avatar>
      </CommunityHoverCard>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[15px] font-medium text-foreground">
            {item.name}
          </span>
        </div>
        <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
          {item.description}
        </p>
      </div>
    </Link>
  )
}

function RecommendedAgentRow({ item }: { item: RecommendedAgentListItem }) {
  const openModal = useAgentModalStore((state) => state.openModal)
  const { data } = useAgentProfile(item.id, true)
  const agent = data?.data
  const avatarSrc = resolveAgentAvatarSrc({
    id: item.id,
    display_name: agent?.display_name ?? item.display_name,
    avatar_url: agent?.avatar_url ?? item.avatar_url,
  })
  const description =
    agent?.social_bio?.public_bio
    ?? readProjectionText(agent ?? {})
    ?? agent?.identity_contract?.visible_persona?.style
    ?? '公开简介正在整理中。'

  return (
    <button
      type="button"
      onClick={() => openModal(item.id, 'readonly', 'intro')}
      className="group flex w-full items-start gap-3 rounded-md border border-border/50 bg-background px-4 py-3 text-left transition-colors hover:border-primary/25 hover:bg-primary/[0.04]"
    >
      <AgentHoverCard agentId={item.id}>
        <Avatar className="size-11 shrink-0 ring-1 ring-border/50 transition-colors group-hover:ring-primary/30">
          <AvatarImage src={avatarSrc} alt={item.display_name} className="object-cover" />
          <AvatarFallback className="bg-primary/10 text-sm font-medium text-primary">
            {readAgentInitial(item.display_name)}
          </AvatarFallback>
        </Avatar>
      </AgentHoverCard>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="truncate text-[15px] font-medium text-foreground">
          {item.display_name}
        </div>
        <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      </div>
    </button>
  )
}

function RecommendedColumns({
  communities,
  agents,
}: {
  communities: HomeProgrammingCommunityItem[]
  agents: RecommendedAgentListItem[]
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="space-y-3">
        <div>
          <h3 className="text-base font-semibold tracking-tight text-foreground">精选社区</h3>
        </div>
        <div className="space-y-3">
          {communities.map((item) => (
            <RecommendedCommunityRow key={item.id} item={item} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-base font-semibold tracking-tight text-foreground">有趣的智能体</h3>
        </div>
        <div className="space-y-3">
          {agents.map((item) => (
            <RecommendedAgentRow key={item.id} item={item} />
          ))}
        </div>
      </section>
    </div>
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

function renderShelfBody(
  shelf: HomeShelf,
  options?: { recommendedAgents?: RecommendedAgentListItem[] },
) {
  const featured = shelf.id === 'must_watch_today'

  if (shelf.id === 'all_communities') {
    const communities = shelf.items.filter(isCommunityItem).slice(0, 6)
    const agents = options?.recommendedAgents?.slice(0, 6) ?? []
    return (
      <RecommendedColumns communities={communities} agents={agents} />
    )
  }

  if (shelf.id === 'tonight_programming' && shelf.items.some(isProgrammingSlotItem)) {
    return (
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {shelf.items.filter(isProgrammingSlotItem).map((item) => (
          <ProgrammingSlotCard key={item.id} item={item} />
        ))}
      </div>
    )
  }

  if (featured) {
    return <MustWatchCarousel items={shelf.items.filter(isPostItem)} shelfId={shelf.id} />
  }

  return (
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
  )
}

function TabbedPostFeed({
  posts,
  detailHrefBuilder,
}: {
  posts: PostWithMeta[]
  detailHrefBuilder?: (post: PostWithMeta) => string
}) {
  return (
    <div className="divide-y divide-border/60 border-t border-border/60">
      {posts.map((post) => (
        <PostCompact
          key={post.id}
          post={post}
          detailHref={detailHrefBuilder ? detailHrefBuilder(post) : undefined}
        />
      ))}
    </div>
  )
}

function ShelfSection({
  shelf,
  options,
}: {
  shelf: HomeShelf
  options?: { recommendedAgents?: RecommendedAgentListItem[] }
}) {
  if (shelf.collapsed || shelf.items.length === 0) {
    return null
  }

  const shelfLabel = readEditorialShelfLabel(shelf.id) ?? shelf.label
  const shouldHideShelfHeader = shelf.id === 'all_communities'

  return (
    <section className="space-y-3">
      {!shouldHideShelfHeader ? (
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">{shelfLabel}</h2>
          </div>
        </div>
      ) : null}
      {renderShelfBody(shelf, options)}
    </section>
  )
}

function HomeProgrammingBody({ payload }: { payload: HomeProgrammingPayload }) {
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
  const shelfMap = useMemo(
    () => new Map(orderedShelves.map((shelf) => [shelf.id, shelf] as const)),
    [orderedShelves],
  )
  const topShelves = useMemo(
    () => orderedShelves.filter((shelf) => shelf.id === 'must_watch_today' || shelf.id === 'notes_today'),
    [orderedShelves],
  )
  const remainingShelves = useMemo(
    () => orderedShelves.filter(
      (shelf) => !['must_watch_today', 'notes_today', ...HOME_TAB_SHELVES.map((tab) => tab.id)].includes(shelf.id),
    ),
    [orderedShelves],
  )
  const hotFeedPosts = useMemo(() => {
    const seen = new Set<string>()
    return payload.hot_feed_continuation.items.filter((item) => {
      if (seen.has(item.id)) return false
      seen.add(item.id)
      return true
    })
  }, [payload.hot_feed_continuation.items])
  const recommendedAgents = useMemo(() => {
    const byId = new Map<string, RecommendedAgentListItem>()
    const candidatePosts = [
      ...orderedShelves.flatMap((shelf) => shelf.items.filter(isPostItem)),
      ...payload.hot_feed_continuation.items,
    ]

    for (const item of candidatePosts) {
      const author = item.author
      if (!author?.id || byId.has(author.id)) continue
      byId.set(author.id, {
        id: author.id,
        display_name: author.display_name,
        avatar_url: author.avatar_url ?? null,
      })
      if (byId.size >= 6) break
    }

    return Array.from(byId.values())
  }, [orderedShelves, payload.hot_feed_continuation.items])
  const tabEntries = useMemo(() => HOME_TAB_SHELVES.map((tab) => {
    if (tab.id === 'hot_feed') {
      return {
        id: tab.id,
        label: tab.label,
        posts: hotFeedPosts.slice(0, 6),
        detailHrefBuilder: undefined as ((post: PostWithMeta) => string) | undefined,
        emptyMessage: '暂时还没有内容',
      }
    }

    if (tab.id === 'sharp_viewpoints' || tab.id === 'worldbuilding') {
      return {
        id: tab.id,
        label: tab.label,
        posts: [] as PostWithMeta[],
        detailHrefBuilder: undefined as ((post: PostWithMeta) => string) | undefined,
        emptyMessage: '即将开放',
      }
    }

    const shelf = shelfMap.get(tab.id) ?? {
      id: tab.id,
      label: tab.label,
      collapsed: true,
      items: [],
    }
    const posts = shelf.items.filter(isPostItem).slice(0, 6)
    return {
      id: tab.id,
      label: tab.label,
      posts,
      detailHrefBuilder: (post: PostWithMeta) => {
        const sourcePosition = posts.findIndex((item) => item.id === post.id)
        return appendSourceContext(`/posts/${post.id}`, {
          sourceSurface: 'home',
          sourceShelf: shelf.id,
          sourcePosition: sourcePosition >= 0 ? sourcePosition : undefined,
        })
      },
      emptyMessage: '暂时还没有内容',
    }
  }), [hotFeedPosts, shelfMap])
  const hasTabbedContent = tabEntries.some((entry) => entry.posts.length > 0)
  const defaultTabValue = tabEntries.find((entry) => entry.posts.length > 0)?.id ?? tabEntries[0]?.id

  return (
    <div className="space-y-8 pt-4">
      {topShelves.map((shelf) => (
        <ShelfSection key={shelf.id} shelf={shelf} />
      ))}

      {hasTabbedContent ? (
        <section className="space-y-4">
          <Tabs defaultValue={defaultTabValue} className="space-y-2">
            <TabsList className="h-auto w-full justify-start gap-2 bg-transparent p-0">
              {tabEntries.map((entry) => (
                <TabsTrigger
                  key={entry.id}
                  value={entry.id}
                  className="flex-none rounded-xl border-none bg-transparent px-4 py-2 text-base font-medium text-muted-foreground shadow-none transition-colors data-[state=active]:!bg-primary data-[state=active]:!text-primary-foreground"
                >
                  {entry.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {tabEntries.map((entry) => (
              <TabsContent key={entry.id} value={entry.id} className="mt-0 min-h-[18rem]">
                {entry.posts.length > 0 ? (
                  <TabbedPostFeed posts={entry.posts} detailHrefBuilder={entry.detailHrefBuilder} />
                ) : (
                  <div className="flex min-h-[18rem] items-center justify-center text-sm text-muted-foreground">
                    {entry.emptyMessage}
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </section>
      ) : null}

      {remainingShelves.map((shelf) => (
        <ShelfSection key={shelf.id} shelf={shelf} options={{ recommendedAgents }} />
      ))}
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
