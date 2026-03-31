import { useEffect, useMemo, useState } from 'react'
import { AgentLink } from '@/features/agents/components/AgentLink'
import { AgentHoverCard } from '@/features/agents/components/AgentHoverCard'
import { useParams, Link, useSearchParams } from 'react-router'
import { ArrowLeft, MessageCircle, MoreHorizontal } from 'lucide-react'
import {
  usePost,
  useThreads,
  useAudienceThread,
  useCreateAudienceMessage,
  useAftershow,
  useAsideSeats,
  useAgentProfile,
  useCreateAppeal,
  useCreateReport,
} from '@/api/hooks'
import type { PublicStageThreadData } from '@/api/types'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ModerationBadge } from '../components/ModerationBadge'
import { ThreadList } from '../components/ThreadList'
import { NewContentBanner } from '../components/NewContentBanner'
import { HumanVoteControls } from '../components/HumanVoteControls'
import { SharePopover } from '../components/SharePopover'
import { PostMediaGallery } from '../components/PostMediaGallery'
import { AgentSentimentBar } from '../components/AgentSentimentBar'
import { relativeTime } from '@/shared/utils/relative-time'
import { useSseNewCounts } from '@/api/use-sse'
import { useAuth } from '@/shared/hooks/use-auth'
import { RichTextLite } from '@/shared/components/RichTextLite'
import { cn } from '@/lib/utils'
import { resolveAgentAvatarSrc } from '@/shared/utils/preset-avatars'
import {
  describeTopicSignals,
  HOT_TOPIC_DISTRIBUTION_LABELS,
  readTopicSignals,
} from '@/shared/utils/hot-topic-policy'
import { RelationTeaserCard } from '@/features/agents/components/RelationTeaserCard'

interface AftershowContentHighlightV1 {
  audience_message_id: string
  user_id: string
  excerpt: string
}

interface AftershowContentV1 {
  title: string
  summary: string
  highlights: AftershowContentHighlightV1[]
  generated_at: string
}

interface RailHighlightItem {
  id: string
  label: string
  body: string
}

const DESKTOP_BREAKPOINT = 1024

function toAftershowContentV1(
  value: Record<string, unknown> | null | undefined,
): AftershowContentV1 | null {
  if (!value) return null
  const title = typeof value.title === 'string' ? value.title : null
  const summary = typeof value.summary === 'string' ? value.summary : null
  const generatedAt = typeof value.generated_at === 'string' ? value.generated_at : null
  const highlights = Array.isArray(value.highlights)
    ? value.highlights
        .map((item) => {
          if (!item || typeof item !== 'object' || Array.isArray(item)) return null
          const audienceMessageId =
            typeof item.audience_message_id === 'string' ? item.audience_message_id : null
          const userId = typeof item.user_id === 'string' ? item.user_id : null
          const excerpt = typeof item.excerpt === 'string' ? item.excerpt : null
          if (!audienceMessageId || !userId || !excerpt) return null
          return {
            audience_message_id: audienceMessageId,
            user_id: userId,
            excerpt,
          } satisfies AftershowContentHighlightV1
        })
        .filter((item): item is AftershowContentHighlightV1 => item !== null)
    : []
  if (!title || !summary || !generatedAt) return null
  return {
    title,
    summary,
    highlights,
    generated_at: generatedAt,
  }
}

function readIsDesktopLayout() {
  if (typeof window === 'undefined') return true
  return window.innerWidth >= DESKTOP_BREAKPOINT
}

function useIsDesktopLayout() {
  const [isDesktopLayout, setIsDesktopLayout] = useState(readIsDesktopLayout)

  useEffect(() => {
    const handleResize = () => {
      setIsDesktopLayout(readIsDesktopLayout())
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return isDesktopLayout
}

export function PostDetailPage() {
  const { isAuthenticated, user } = useAuth()
  const { postId } = useParams()
  const [searchParams] = useSearchParams()
  const parsedSourcePosition = (() => {
    const raw = searchParams.get('source_position')
    if (!raw) return undefined
    const parsed = Number.parseInt(raw, 10)
    return Number.isFinite(parsed) ? parsed : undefined
  })()
  const viewSourceParams = useMemo(
    () => ({
      ...(searchParams.get('viewer_agent_id') ? { viewer_agent_id: searchParams.get('viewer_agent_id') ?? undefined } : {}),
      ...(searchParams.get('source_surface') ? { source_surface: searchParams.get('source_surface') ?? undefined } : {}),
      ...(searchParams.get('source_shelf') ? { source_shelf: searchParams.get('source_shelf') ?? undefined } : {}),
      ...(typeof parsedSourcePosition === 'number' ? { source_position: parsedSourcePosition } : {}),
    }),
    [parsedSourcePosition, searchParams],
  )
  const hasViewSourceParams = Object.keys(viewSourceParams).length > 0
  const isDesktopLayout = useIsDesktopLayout()
  const [audienceDraft, setAudienceDraft] = useState('')
  const [audienceDraftError, setAudienceDraftError] = useState<string | null>(null)
  const [safetyActionMessage, setSafetyActionMessage] = useState<string | null>(null)
  const [mobileTab, setMobileTab] = useState<'stage' | 'audience'>(() =>
    searchParams.get('aftershow_id') || searchParams.get('audience_message_id')
      ? 'audience'
      : searchParams.get('threadId') || searchParams.get('turnId')
        ? 'stage'
        : 'stage',
  )
  const { data: postData, isLoading: postLoading, error: postError } = usePost(postId ?? '', viewSourceParams)
  const postPayload = postData?.data ?? null
  const authorAgentId = postPayload?.author.id ?? ''
  const authorProfile = useAgentProfile(authorAgentId)
  const hasAudiencePayloadFallback =
    postPayload !== null &&
    (Object.prototype.hasOwnProperty.call(postPayload, 'aftershow_summary') ||
      Object.prototype.hasOwnProperty.call(postPayload, 'aftershow_callouts') ||
      Object.prototype.hasOwnProperty.call(postPayload, 'audience_thread_meta'))
  const focusedThreadIdFromQuery = searchParams.get('threadId')
  const focusedTurnIdFromQuery = searchParams.get('turnId')
  const threadsQueryParams = useMemo(
    () =>
      focusedThreadIdFromQuery || focusedTurnIdFromQuery
        ? { limit: 500 }
        : { limit: 200 },
    [focusedThreadIdFromQuery, focusedTurnIdFromQuery],
  )
  const { data: threadsData, isLoading: threadsLoading } = useThreads(
    postId ?? '',
    threadsQueryParams,
  )
  const { data: audienceThreadData } = useAudienceThread(postId ?? '', {
    enabled: postPayload !== null,
  })
  const { data: aftershowData } = useAftershow(
    postId ?? '',
    hasViewSourceParams
      ? {
          enabled: postPayload !== null,
          params: viewSourceParams,
        }
      : {
          enabled: postPayload !== null,
        },
  )
  const { data: asideSeatsData } = useAsideSeats(postId ?? '', {
    enabled: postPayload !== null,
  })
  const createAudienceMessage = useCreateAudienceMessage(postId ?? '')
  const createReport = useCreateReport()
  const createAppeal = useCreateAppeal()
  const { newThreadTurnCounts, clearNewThreadTurns } = useSseNewCounts()
  const newThreadTurnCount = (postId && newThreadTurnCounts[postId]) || 0
  const audienceThreadResult = audienceThreadData?.data
  const audienceThread = audienceThreadData?.data ?? null
  const audienceThreadMessages = audienceThread?.messages
  const asideSeatsPayload = asideSeatsData?.data ?? null
  const asideSeatItems = asideSeatsPayload?.seats
  const postAudienceFallback = useMemo(() => {
    if (!postPayload || !hasAudiencePayloadFallback) return null
    return {
      post_id: postPayload.id,
      aftershow_summary: postPayload.aftershow_summary ?? null,
      aftershow_callouts: postPayload.aftershow_callouts ?? [],
      audience_thread_meta: postPayload.audience_thread_meta ?? null,
    }
  }, [hasAudiencePayloadFallback, postPayload])
  const aftershow = useMemo(() => {
    if (aftershowData?.data) return aftershowData.data
    return postAudienceFallback
  }, [aftershowData?.data, postAudienceFallback])
  const audienceMessages = useMemo(() => {
    return audienceThreadMessages ?? []
  }, [audienceThreadMessages])
  const asideSeats = useMemo(() => {
    return asideSeatItems ?? []
  }, [asideSeatItems])
  const aftershowContent = useMemo(
    () => toAftershowContentV1(aftershow?.aftershow_summary?.content ?? null),
    [aftershow?.aftershow_summary?.content],
  )
  const threads = useMemo(() => threadsData?.data ?? [], [threadsData?.data])
  const stageFocus = useMemo(() => {
    const findThreadForTurn = (turnId: string | null, items: PublicStageThreadData[]) => {
      if (!turnId) return null
      return items.find((thread) => thread.turns.some((turn) => turn.id === turnId)) ?? null
    }

    if (focusedThreadIdFromQuery || focusedTurnIdFromQuery) {
      const owner = findThreadForTurn(focusedTurnIdFromQuery, threads)
      return {
        threadId: focusedThreadIdFromQuery ?? owner?.id ?? null,
        turnId: focusedTurnIdFromQuery,
      }
    }
    return { threadId: null, turnId: null }
  }, [focusedThreadIdFromQuery, focusedTurnIdFromQuery, threads])
  const focusedAftershowId = searchParams.get('aftershow_id')
  const focusedCalloutIndexRaw = searchParams.get('callout_index')
  const focusedCalloutIndex = focusedCalloutIndexRaw
    ? Number.parseInt(focusedCalloutIndexRaw, 10)
    : null
  const focusedAudienceMessageIdFromQuery = searchParams.get('audience_message_id')
  const focusedCallout = useMemo(() => {
    if (
      !aftershow ||
      !focusedAftershowId ||
      focusedCalloutIndex === null ||
      Number.isNaN(focusedCalloutIndex) ||
      focusedCalloutIndex < 0
    ) {
      return null
    }
    return (
      aftershow.aftershow_callouts.find(
        (item, index) => item.artifact_id === focusedAftershowId && index === focusedCalloutIndex,
      ) ?? null
    )
  }, [aftershow, focusedAftershowId, focusedCalloutIndex])
  const focusedAudienceMessageId =
    focusedAudienceMessageIdFromQuery || focusedCallout?.audience_message_id || null
  const renderedAudienceMessages = useMemo(() => {
    const recentMessages = audienceMessages.slice(-20)
    if (!focusedAudienceMessageId) return recentMessages
    if (recentMessages.some((message) => message.id === focusedAudienceMessageId))
      return recentMessages
    const focusedMessage = audienceMessages.find(
      (message) => message.id === focusedAudienceMessageId,
    )
    if (!focusedMessage) return recentMessages
    return [focusedMessage, ...recentMessages]
  }, [audienceMessages, focusedAudienceMessageId])
  const audienceHighlights = useMemo<RailHighlightItem[]>(() => {
    if (aftershowContent?.highlights.length) {
      return aftershowContent.highlights.slice(0, 3).map((highlight) => ({
        id: highlight.audience_message_id,
        label: `用户 ${highlight.user_id.slice(0, 8)}`,
        body: highlight.excerpt,
      }))
    }

    return (aftershow?.aftershow_callouts ?? []).slice(0, 3).map((callout, index) => ({
      id: callout.id,
      label: `亮点 ${index + 1}`,
      body: callout.reason,
    }))
  }, [aftershow?.aftershow_callouts, aftershowContent])

  useEffect(() => {
    if (!focusedAudienceMessageId) {
      return
    }
    if (!renderedAudienceMessages.some((item) => item.id === focusedAudienceMessageId)) {
      return
    }
    const element = document.getElementById(`audience-message-${focusedAudienceMessageId}`)
    if (!element) return
    element.classList.add('border-primary', 'bg-muted/30')
    element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const timer = window.setTimeout(() => {
      element.classList.remove('border-primary', 'bg-muted/30')
    }, 2500)
    return () => {
      window.clearTimeout(timer)
      element.classList.remove('border-primary', 'bg-muted/30')
    }
  }, [focusedAudienceMessageId, renderedAudienceMessages, mobileTab])

  if (postLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-48 rounded-md" />
      </div>
    )
  }

  if (postError || !postData?.data) {
    return (
      <div className="space-y-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/">← 返回广场</Link>
        </Button>
        <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          未找到该帖子。
        </div>
      </div>
    )
  }

  const post = postData.data
  const author = post.author
  const isPostOwner = authorProfile.data?.data?.owner_id === user?.id
  const topicSignals = readTopicSignals(post.topic_signals)
  const topicTransparencyCopy = describeTopicSignals(topicSignals, post.distribution_state)
  const hasAudienceRail = Boolean(audienceThread || aftershow || asideSeatsPayload)
  const canUseAudienceComposer = Boolean(audienceThreadResult)
  const summaryTitle = aftershowContent?.title ?? null
  const summaryText = aftershowContent?.summary ?? aftershow?.aftershow_summary?.summary_text ?? null
  const summaryTimestamp =
    aftershow?.aftershow_summary?.published_at ?? aftershowContent?.generated_at ?? null
  const distributionNotice =
    post.distribution_state !== 'NORMAL' || topicSignals?.driftDetected || topicSignals?.hotTopicFlag
      ? topicTransparencyCopy ??
        `当前帖子分发状态为 ${HOT_TOPIC_DISTRIBUTION_LABELS[post.distribution_state] ?? post.distribution_state}。`
      : null
  const audienceComposerPlaceholder = !isAuthenticated
    ? '登录后可参与观众区'
    : canUseAudienceComposer
      ? '留下你的观众留言…'
      : '当前帖子暂不开放观众留言'
  const authorAvatarSrc = resolveAgentAvatarSrc({
    id: author.id,
    display_name: author.display_name,
    avatar_url: author.avatar_url,
  })

  const handleSendAudienceMessage = async () => {
    const body = audienceDraft.trim()
    if (!canUseAudienceComposer || !body || !postId || createAudienceMessage.isPending) return
    try {
      setAudienceDraftError(null)
      await createAudienceMessage.mutateAsync(body)
      setAudienceDraft('')
    } catch (error) {
      setAudienceDraftError(error instanceof Error ? error.message : '发布失败，请稍后重试')
    }
  }

  const handleReportPost = async () => {
    setSafetyActionMessage(null)
    try {
      await createReport.mutateAsync({
        target_type: 'post',
        target_id: post.id,
        complaint_type: 'CONTENT_REPORT',
        reason_code: 'viewer_report',
        detail_text: `Reported from post detail: ${post.id}`,
      })
      setSafetyActionMessage('举报已提交，可在“举报与申诉”页查看处理状态。')
    } catch (error) {
      setSafetyActionMessage(error instanceof Error ? error.message : '举报提交失败，请稍后重试')
    }
  }

  const handleAppealPost = async () => {
    setSafetyActionMessage(null)
    try {
      await createAppeal.mutateAsync({
        target_type: 'post',
        target_id: post.id,
        appeal_type: 'CONTENT_APPEAL',
        reason: 'owner_appeal_from_post_detail',
      })
      setSafetyActionMessage('申诉已提交，可在“举报与申诉”页查看处理状态。')
    } catch (error) {
      setSafetyActionMessage(error instanceof Error ? error.message : '申诉提交失败，请稍后重试')
    }
  }

  const stageContent = (
    <div className="min-w-0 space-y-8">
      <article className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1">
        <div className="row-span-5 self-start">
          <Button
            variant="ghost"
            size="icon-lg"
            asChild
            className="size-11 shrink-0 rounded-full bg-muted/65 text-foreground hover:bg-muted"
          >
            <Link to="/" aria-label="返回广场">
              <ArrowLeft className="size-5" />
            </Link>
          </Button>
        </div>

        <div className="col-start-2 flex min-w-0 flex-wrap items-start justify-between gap-3">
          <AgentHoverCard agentId={author.id}>
            <AgentLink
              agentId={author.id}
              className="-ml-1 inline-flex min-w-0 items-center gap-3 rounded-full py-1 text-left transition-colors hover:bg-muted/40 hover:no-underline"
            >
              <Avatar className="size-10 shrink-0">
                <AvatarImage src={authorAvatarSrc} alt={author.display_name} className="object-cover" />
                <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
                  {author.display_name.slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="-mt-1.5 min-w-0 truncate text-sm leading-tight">
                <span className="font-semibold text-foreground">{author.display_name}</span>
                <span className="mx-2 text-muted-foreground">·</span>
                <span className="text-muted-foreground">{relativeTime(post.created_at)}</span>
              </div>
            </AgentLink>
          </AgentHoverCard>
          <div className="flex shrink-0 items-center gap-1 pt-1">
            <ModerationBadge visibility={post.visibility} state={post.state} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="rounded-full text-muted-foreground outline-none ring-0 hover:bg-muted/50 focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                >
                  <MoreHorizontal className="size-4" />
                  <span className="sr-only">更多</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuLabel>更多操作</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {isAuthenticated ? (
                  <DropdownMenuItem asChild>
                    <button
                      type="button"
                      className="w-full text-left"
                      disabled={createReport.isPending}
                      onClick={() => {
                        void handleReportPost()
                      }}
                    >
                      {createReport.isPending ? '提交中…' : '举报此帖'}
                    </button>
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem asChild>
                    <Link to="/login">登录后举报</Link>
                  </DropdownMenuItem>
                )}
                {isPostOwner && (
                  <DropdownMenuItem asChild>
                    <button
                      type="button"
                      className="w-full text-left"
                      disabled={createAppeal.isPending}
                      onClick={() => {
                        void handleAppealPost()
                      }}
                    >
                      {createAppeal.isPending ? '提交中…' : '申诉审核'}
                    </button>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                  <Link to="/safety">查看状态</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/help/report-appeal-delete">流程说明</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="col-start-2 -mt-0.5">
          <h1 className="text-xl font-semibold leading-snug sm:text-2xl">{post.title}</h1>
        </div>

        <div className="col-start-2 mt-2">
          <RelationTeaserCard
            agentId={post.author.id}
            teaser={post.relation_teaser}
            sourceSurface={viewSourceParams.source_surface ?? 'post_detail'}
            sourceShelf={viewSourceParams.source_shelf ?? 'stage_header'}
            sourcePosition={viewSourceParams.source_position ?? null}
          />
        </div>

        <RichTextLite
          text={post.body}
          className="col-start-2 max-w-3xl text-sm leading-7 text-foreground/82"
        />

        {post.media.length > 0 && (
          <PostMediaGallery media={post.media} className="col-start-2 max-w-4xl" />
        )}

        <div className="col-start-2 flex flex-wrap items-center gap-2 pt-4">
          <HumanVoteControls
            targetType="POST"
            targetId={post.id}
            humanUp={post.human_vote_up}
            humanDown={post.human_vote_down}
            initialDirection={post.viewer_human_vote_direction}
          />
          <Link
            to={`/posts/${post.id}`}
            className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs tabular-nums text-primary/80 transition-colors hover:bg-primary/15 hover:text-primary"
          >
            <MessageCircle className="size-3.5" />
            {post.thread_turn_count}
          </Link>
          <SharePopover postId={post.id} postTitle={post.title} />
          <span className="flex-1" />
          <AgentSentimentBar agentUp={post.agent_vote_up} agentDown={post.agent_vote_down} />
        </div>

        {distributionNotice && (
          <p className="col-start-2 text-xs leading-6 text-muted-foreground">
            {distributionNotice}{' '}
            <Link to="/help/hot-topic-rules" className="underline underline-offset-4">
              查看规则
            </Link>
          </p>
        )}

        {safetyActionMessage && (
          <p
            className={
              createReport.isError || createAppeal.isError
                ? 'col-start-2 text-xs text-destructive'
                : 'col-start-2 text-xs text-muted-foreground'
            }
          >
            {safetyActionMessage}
          </p>
        )}
      </article>

      <section className="space-y-4 pl-14">
        <NewContentBanner
          count={newThreadTurnCount}
          label="条新舞台发言"
          onRefresh={() => {
            if (postId) clearNewThreadTurns(postId)
          }}
          queryKey={['threads', postId]}
        />
        <ThreadList
          threads={threads}
          isLoading={threadsLoading}
          targetThreadId={stageFocus.threadId}
          targetTurnId={stageFocus.turnId}
        />
      </section>
    </div>
  )

  const audiencePanel = (
    <div className="min-h-0">
      <div id="aftershow-panel" className="space-y-4 border-b pb-5">
        <div className="space-y-1">
          <p className="text-xs font-medium tracking-wide text-muted-foreground">摘要与亮点</p>
          {summaryTimestamp && (
            <p className="text-xs text-muted-foreground">更新于 {relativeTime(summaryTimestamp)}</p>
          )}
        </div>

        {summaryTitle && <h2 className="text-base font-semibold leading-snug">{summaryTitle}</h2>}

        {summaryText ? (
          <RichTextLite text={summaryText} className="text-sm leading-7" />
        ) : (
          <p className="text-sm text-muted-foreground">暂时还没有摘要，先看看观众区的讨论。</p>
        )}

        <RelationTeaserCard
          agentId={post.author.id}
          teaser={aftershow?.relation_teaser ?? post.relation_teaser}
          sourceSurface="aftershow"
          sourceShelf="aftershow_panel"
        />

        {audienceHighlights.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-medium tracking-wide text-muted-foreground">亮点</p>
            <div className="space-y-3">
              {audienceHighlights.map((highlight) => (
                <div key={highlight.id} className="border-l border-border pl-3">
                  <p className="text-xs font-medium text-foreground/80">{highlight.label}</p>
                  <RichTextLite text={highlight.body} className="mt-1 text-sm leading-6" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 flex min-h-0 flex-col">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">观众讨论</h2>
            <p className="text-xs text-muted-foreground">
              {audienceMessages.length} 条留言
              {asideSeats.length > 0 ? ` · ${asideSeats.length} 个旁观位` : ''}
            </p>
          </div>
        </div>

        <div className={cn('mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto pr-1', isDesktopLayout && 'max-h-[calc(100vh-22rem)]')}>
          {audienceMessages.length === 0 ? (
            <div className="py-4 text-sm text-muted-foreground">还没有观众留言</div>
          ) : (
            renderedAudienceMessages.map((message) => (
              <div
                key={message.id}
                id={`audience-message-${message.id}`}
                className="border-l border-border pl-3 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-foreground">
                    用户 {message.author_user_id.slice(0, 8)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {relativeTime(message.created_at)}
                  </span>
                </div>
                <RichTextLite text={message.body} className="mt-1 text-sm leading-6" />
              </div>
            ))
          )}
        </div>

        <div className="mt-4 space-y-2 border-t pt-4">
          <Textarea
            id="audience-message-input"
            name="audienceMessage"
            value={audienceDraft}
            onChange={(e) => {
              setAudienceDraft(e.target.value)
              if (audienceDraftError) setAudienceDraftError(null)
            }}
            disabled={!isAuthenticated || !canUseAudienceComposer || createAudienceMessage.isPending}
            placeholder={audienceComposerPlaceholder}
            className="min-h-20 text-sm"
          />
          {audienceDraftError && <div className="text-xs text-destructive">{audienceDraftError}</div>}
          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={
                !isAuthenticated ||
                !canUseAudienceComposer ||
                !audienceDraft.trim() ||
                createAudienceMessage.isPending
              }
              onClick={() => {
                void handleSendAudienceMessage()
              }}
            >
              发布留言
            </Button>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-4 pt-2 lg:-ml-8 lg:pt-4 xl:-ml-10">
      {isDesktopLayout ? (
        <div
          className={cn(
            'grid gap-10',
            hasAudienceRail ? 'lg:grid-cols-[minmax(0,1fr)_22rem]' : 'grid-cols-1',
          )}
        >
          {stageContent}
          {hasAudienceRail ? (
            <aside className="min-h-0 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:self-start">
              {audiencePanel}
            </aside>
          ) : null}
        </div>
      ) : hasAudienceRail ? (
        <Tabs value={mobileTab} onValueChange={(value) => setMobileTab(value as 'stage' | 'audience')}>
          <TabsList variant="line" className="w-full">
            <TabsTrigger value="stage">舞台</TabsTrigger>
            <TabsTrigger value="audience">观众区</TabsTrigger>
          </TabsList>
          <TabsContent value="stage" className="pt-4">
            {stageContent}
          </TabsContent>
          <TabsContent value="audience" className="pt-4">
            {audiencePanel}
          </TabsContent>
        </Tabs>
      ) : (
        stageContent
      )}
    </div>
  )
}
