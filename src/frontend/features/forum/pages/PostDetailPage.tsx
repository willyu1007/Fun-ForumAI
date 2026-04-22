import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AgentLink } from '@/features/agents/components/AgentLink'
import { AgentHoverCard } from '@/features/agents/components/AgentHoverCard'
import { useParams, Link, useSearchParams } from 'react-router'
import { ArrowLeft, MessageCircle, MoreHorizontal } from 'lucide-react'
import {
  usePost,
  useAgentProfile,
  useCreateAppeal,
  useCreateReport,
  useDiscussionForest,
  usePostParticipationContract,
  useRecordForumWatchTelemetry,
} from '@/api/hooks'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { BadgeVisualChip } from '@/shared/components/BadgeVisualChip'
import { cn } from '@/lib/utils'
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
import { DiscussionForest, type DiscussionForestSortMode } from '../components/DiscussionForest'
import { AudiencePanel } from '../components/AudiencePanel'
import { HumanDiscussionRail } from '../components/HumanDiscussionRail'
import { StageToolbar } from '../components/StageToolbar'
import { NewContentBanner } from '../components/NewContentBanner'
import { HumanVoteControls } from '../components/HumanVoteControls'
import { SharePopover } from '../components/SharePopover'
import { PostMediaGallery } from '../components/PostMediaGallery'
import { AgentSentimentBar } from '../components/AgentSentimentBar'
import { relativeTime } from '@/shared/utils/relative-time'
import { useSseNewCounts } from '@/api/use-sse'
import { useAuth } from '@/shared/hooks/use-auth'
import { SHOULD_RENDER_DEV_AUTH_TOOLBAR } from '@/shared/layout/dev-auth-toolbar'
import { RichTextLite } from '@/shared/components/RichTextLite'
import { resolveAgentAvatarSrc } from '@/shared/utils/preset-avatars'
import { audienceZoneEnabled } from '@/shared/config/frontend-capabilities'
import {
  describeTopicSignals,
  HOT_TOPIC_DISTRIBUTION_LABELS,
  readTopicSignals,
} from '@/shared/utils/hot-topic-policy'
import { readAuthorBadgeChipItems } from '@/shared/utils/public-author'
import { readKnownBadgeVisual, stripBadgeTooltipPrefix } from '../../../../shared/badges/catalog'

const DESKTOP_BREAKPOINT = 1024

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

export function PostDetailPage({
  overridePostId,
  hideDiscussionArea = false,
}: {
  overridePostId?: string
  hideDiscussionArea?: boolean
} = {}) {
  const { isAuthenticated, user } = useAuth()
  const params = useParams()
  const postId = overridePostId ?? params.postId
  const [searchParams, setSearchParams] = useSearchParams()
  const parsedSourcePosition = (() => {
    const raw = searchParams.get('source_position')
    if (!raw) return undefined
    const parsed = Number.parseInt(raw, 10)
    return Number.isFinite(parsed) ? parsed : undefined
  })()
  const viewSourceParams = useMemo(
    () => ({
      ...(searchParams.get('viewer_agent_id')
        ? { viewer_agent_id: searchParams.get('viewer_agent_id') ?? undefined }
        : {}),
      ...(searchParams.get('source_surface')
        ? { source_surface: searchParams.get('source_surface') ?? undefined }
        : {}),
      ...(searchParams.get('source_shelf')
        ? { source_shelf: searchParams.get('source_shelf') ?? undefined }
        : {}),
      ...(typeof parsedSourcePosition === 'number'
        ? { source_position: parsedSourcePosition }
        : {}),
    }),
    [parsedSourcePosition, searchParams],
  )
  const isDesktopLayout = useIsDesktopLayout()
  const [safetyActionMessage, setSafetyActionMessage] = useState<string | null>(null)
  const preferredSortMode: DiscussionForestSortMode =
    searchParams.get('sort') === 'latest_activity' ? 'latest_activity' : 'recommended'
  const [sortMode, setSortMode] = useState<DiscussionForestSortMode>(preferredSortMode)
  const [mobileTab, setMobileTab] = useState<'stage' | 'audience'>(() =>
    searchParams.get('audience_message_id') || searchParams.get('audience_compose_for')
      ? 'audience'
      : 'stage',
  )
  const {
    data: postData,
    isLoading: postLoading,
    error: postError,
  } = usePost(postId ?? '', viewSourceParams)
  const postPayload = postData?.data ?? null
  const authorAgentId = postPayload?.author.id ?? ''
  const authorProfile = useAgentProfile(authorAgentId)
  const { data: participationContractData } = usePostParticipationContract(postId ?? '', {
    enabled: postPayload !== null && !hideDiscussionArea,
  })
  const focusedThreadIdFromQuery = searchParams.get('threadId')
  const focusedTurnIdFromQuery = searchParams.get('turnId')
  useEffect(() => {
    setSortMode(preferredSortMode)
  }, [preferredSortMode])
  const { data: forestData, isLoading: forestLoading } = useDiscussionForest(
    postId ?? '',
    {
      focus_thread_id: focusedThreadIdFromQuery ?? null,
      focus_turn_id: focusedTurnIdFromQuery ?? null,
    },
    { enabled: !hideDiscussionArea },
  )
  const createReport = useCreateReport()
  const createAppeal = useCreateAppeal()
  const watchTelemetry = useRecordForumWatchTelemetry(postId ?? '')
  const { newThreadTurnCounts, clearNewThreadTurns } = useSseNewCounts()
  const newThreadTurnCount = (postId && newThreadTurnCounts[postId]) || 0
  const forest = useMemo(() => forestData?.data ?? null, [forestData?.data])
  const participationContract = participationContractData?.data ?? null
  const stageOpenReplyPolicy = participationContract?.stage_open_reply ?? null
  const audienceLanePolicy = participationContract?.audience_lane ?? null
  const stageTurnReplyEnabled = stageOpenReplyPolicy?.turn_reply_enabled ?? false
  const [selectedForestNodeId, setSelectedForestNodeId] = useState<string | null>(null)
  const [jumpTarget, setJumpTarget] = useState<{ nodeId: string; token: number } | null>(null)
  const jumpTokenRef = useRef(0)
  const queueJumpTarget = useCallback((nodeId: string) => {
    jumpTokenRef.current += 1
    setJumpTarget({ nodeId, token: jumpTokenRef.current })
  }, [])
  const recordWatchTelemetry = useCallback(
    (input: {
      event_type: 'reply_anchor_select'
      thread_id?: string
      turn_id?: string
      branch_group_id?: string
      source_surface?: string
      source_shelf?: string
    }) => {
      if (!postId) return
      watchTelemetry.mutate({
        ...input,
        source_surface: input.source_surface ?? 'post_detail',
        source_shelf: input.source_shelf ?? 'forest',
      })
    },
    [postId, watchTelemetry],
  )
  const focusedAudienceMessageId = searchParams.get('audience_message_id')
  const audienceComposePrefill = useMemo(() => {
    const turnId = searchParams.get('audience_compose_for')
    if (!turnId) return null
    const excerpt = searchParams.get('audience_compose_excerpt') ?? ''
    const authorDisplayName = searchParams.get('audience_compose_author') ?? null
    return {
      turn_id: turnId,
      excerpt,
      author_display_name: authorDisplayName,
    }
  }, [searchParams])

  const clearAudienceComposePrefill = useCallback(() => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current)
        next.delete('audience_compose_for')
        next.delete('audience_compose_excerpt')
        next.delete('audience_compose_author')
        return next
      },
      { replace: true },
    )
  }, [setSearchParams])

  const handleDiscussInAudience = useCallback(
    (input: { turnId: string; excerpt: string; authorDisplayName?: string | null }) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current)
          next.set('audience_compose_for', input.turnId)
          if (input.excerpt) {
            next.set('audience_compose_excerpt', input.excerpt.slice(0, 400))
          } else {
            next.delete('audience_compose_excerpt')
          }
          if (input.authorDisplayName) {
            next.set('audience_compose_author', input.authorDisplayName)
          } else {
            next.delete('audience_compose_author')
          }
          return next
        },
        { replace: true },
      )
      setMobileTab('audience')
    },
    [setSearchParams],
  )

  const handleNavigateToTurn = useCallback(
    (turnId: string) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current)
          next.delete('threadId')
          next.delete('audience_message_id')
          next.delete('audience_compose_for')
          next.delete('audience_compose_excerpt')
          next.delete('audience_compose_author')
          next.set('turnId', turnId)
          return next
        },
        { replace: true },
      )
      queueJumpTarget(turnId)
      setMobileTab('stage')
    },
    [queueJumpTarget, setSearchParams],
  )

  useEffect(() => {
    const nextFocusedId = focusedTurnIdFromQuery ?? focusedThreadIdFromQuery ?? null
    if (nextFocusedId) {
      queueJumpTarget(nextFocusedId)
    }
  }, [focusedThreadIdFromQuery, focusedTurnIdFromQuery, queueJumpTarget])

  useEffect(() => {
    if (!jumpTarget || !forest) {
      return
    }
    const element = document.querySelector<HTMLElement>(
      `[data-node-id="${jumpTarget.nodeId}"]`,
    )
    if (!element) {
      return
    }
    element.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [forest, jumpTarget])

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
  const audienceRailEnabled =
    audienceZoneEnabled && Boolean(audienceLanePolicy?.enabled)
  const canUseAudienceComposer =
    audienceZoneEnabled && Boolean(audienceLanePolicy?.posting_enabled)
  const { identityChip: authorIdentityChip, proofChips: authorProofChips } = readAuthorBadgeChipItems(
    author,
    {
      maxProofChips: 2,
      policyId: 'public_author_medium',
    },
  )
  const distributionNotice =
    post.distribution_state !== 'NORMAL' ||
    topicSignals?.driftDetected ||
    topicSignals?.hotTopicFlag
      ? (topicTransparencyCopy ??
        `当前帖子分发状态为 ${HOT_TOPIC_DISTRIBUTION_LABELS[post.distribution_state] ?? post.distribution_state}。`)
      : null
  const authorAvatarSrc = resolveAgentAvatarSrc({
    id: author.id,
    display_name: author.display_name,
    avatar_url: author.avatar_url,
  })

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
    <div className="relative min-w-0 space-y-8" data-testid="post-detail-stage-content">
      <div
        className="mb-3 lg:absolute lg:-left-[2.125rem] lg:top-0 lg:mb-0"
        data-testid="post-detail-back-link-wrap"
      >
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

      <article className="min-w-0 space-y-1 px-[25px]" data-testid="post-detail-stage-article">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="relative min-w-0 -ml-1">
            <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-1 gap-y-0.5">
              <div
                className="row-span-2 inline-flex self-start p-0.5"
                data-testid="post-detail-author-avatar-region"
              >
                <Avatar className="size-10 shrink-0">
                  <AvatarImage
                    src={authorAvatarSrc}
                    alt={author.display_name}
                    className="object-cover"
                  />
                  <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
                    {author.display_name.slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </div>
              <AgentHoverCard agentId={author.id}>
                <AgentLink
                  agentId={author.id}
                  aria-label={author.display_name}
                  className="col-start-2 row-start-1 mt-px min-w-0 self-start text-left hover:no-underline"
                >
                  <div
                    className="flex min-w-0 items-center gap-1.5 px-1 text-xs leading-none"
                    data-testid="post-detail-author-primary-line"
                  >
                    <span className="truncate font-semibold text-foreground">
                      {author.display_name}
                    </span>
                    <span className="text-foreground/45">·</span>
                    <span className="shrink-0 text-xs text-foreground/72">
                      {relativeTime(post.created_at)}
                    </span>
                  </div>
                </AgentLink>
              </AgentHoverCard>
              {authorIdentityChip || authorProofChips.length > 0 ? (
                <div
                  className="col-start-2 row-start-2 flex min-w-0 items-center gap-1 self-start px-[0.175rem] py-0.5"
                  data-testid="post-detail-author-secondary-line"
                >
                  {authorIdentityChip ? (
                    <BadgeVisualChip
                      label={authorIdentityChip.label}
                      code={authorIdentityChip.code}
                      variant="outline"
                      className="px-1.5 py-0 text-[10px]"
                      iconClassName="size-4"
                    />
                  ) : null}
                  {authorProofChips.map((badge) => (
                    <ExpandableBadgeIcon
                      key={`${badge.code ?? 'display'}:${badge.label}`}
                      label={badge.label}
                      code={badge.code}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1 pt-0.5">
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

        <div className="pb-2">
          <h1 className="text-xl font-semibold leading-snug sm:text-2xl">{post.title}</h1>
        </div>

        <RichTextLite text={post.body} className="text-sm leading-7 text-foreground/82" />

        {post.media.length > 0 && <PostMediaGallery media={post.media} className="mt-4 w-full" />}

        <div className="flex flex-wrap items-center gap-2 pt-4">
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
          <p className="text-xs leading-6 text-muted-foreground">
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
                ? 'text-xs text-destructive'
                : 'text-xs text-muted-foreground'
            }
          >
            {safetyActionMessage}
          </p>
        )}
      </article>

      {!hideDiscussionArea ? (
        <section className="space-y-4 px-[25px]" data-testid="post-detail-thread-section">
          <NewContentBanner
            count={newThreadTurnCount}
            onRefresh={() => {
              if (postId) clearNewThreadTurns(postId)
            }}
            queryKey={['discussionForest', postId]}
          />
          <StageToolbar
            participationContract={participationContract}
            sortMode={sortMode}
            onSortModeChange={(next) => {
              setSortMode(next)
              setSearchParams(
                (current) => {
                  const nextParams = new URLSearchParams(current)
                  if (next === 'recommended') {
                    nextParams.delete('sort')
                  } else {
                    nextParams.set('sort', next)
                  }
                  return nextParams
                },
                { replace: true },
              )
            }}
          />
          <DiscussionForest
            postId={post.id}
            forest={forest}
            isLoading={forestLoading}
            selectedNodeId={selectedForestNodeId}
            flashNodeId={jumpTarget?.nodeId ?? null}
            flashToken={jumpTarget?.token ?? null}
            sortMode={sortMode}
            turnReplyEnabled={stageTurnReplyEnabled}
            audiencePostingEnabled={canUseAudienceComposer}
            onReplyOpen={(node) => {
              recordWatchTelemetry({
                event_type: 'reply_anchor_select',
                thread_id: node.thread_id,
                turn_id: node.entry_kind === 'TURN' ? node.id : undefined,
                source_shelf: 'forest',
              })
            }}
            onDiscussInAudience={(node) => {
              handleDiscussInAudience({
                turnId: node.id,
                excerpt: (node.body ?? '').slice(0, 200),
                authorDisplayName: node.author?.display_name ?? null,
              })
            }}
            onToggleNodeSelection={(node) => {
              setSelectedForestNodeId((current) => (current === node.id ? null : node.id))
            }}
          />
        </section>
      ) : null}
    </div>
  )

  const audiencePanel = postId ? (
    <AudiencePanel
      postId={postId}
      isAuthenticated={isAuthenticated}
      canPost={canUseAudienceComposer}
      viewerUserId={user?.id ?? null}
      composePrefill={audienceComposePrefill}
      onConsumePrefill={clearAudienceComposePrefill}
      onNavigateToTurn={handleNavigateToTurn}
      focusedMessageId={focusedAudienceMessageId}
    />
  ) : null

  return (
    <div className="space-y-4 pt-2 lg:pt-0">
      {isDesktopLayout ? (
        hideDiscussionArea ? (
          <div className="mx-auto min-w-0 w-full max-w-[52rem]">{stageContent}</div>
        ) : (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,2.1fr)_minmax(18rem,1fr)] lg:gap-10">
          <div className="min-w-0 lg:pt-4" data-testid="post-detail-stage-frame">{stageContent}</div>
          <aside className="hidden min-h-0 lg:block lg:self-stretch" data-testid="post-detail-rail">
            <div
              className={
                SHOULD_RENDER_DEV_AUTH_TOOLBAR
                  ? 'sticky top-[68px] h-[calc(100vh-68px-4rem)] overflow-hidden bg-muted/70'
                  : 'sticky top-[68px] h-[calc(100vh-68px)] overflow-hidden bg-muted/70'
              }
              data-testid="post-detail-rail-shell"
            >
              <div className="h-full overflow-y-auto border-l border-border/45">
                <HumanDiscussionRail enabled={audienceRailEnabled}>
                  {audiencePanel}
                </HumanDiscussionRail>
              </div>
            </div>
          </aside>
        </div>
        )
      ) : !hideDiscussionArea ? (
        <Tabs
          value={mobileTab}
          onValueChange={(value) => setMobileTab(value as 'stage' | 'audience')}
        >
          <TabsList variant="line" className="w-full">
            <TabsTrigger value="stage">主线程</TabsTrigger>
            <TabsTrigger value="audience">观众席</TabsTrigger>
          </TabsList>
          <TabsContent value="stage" className="pt-4">
            {stageContent}
          </TabsContent>
          <TabsContent value="audience" className="pt-4">
            <HumanDiscussionRail enabled={audienceRailEnabled}>
              {audiencePanel}
            </HumanDiscussionRail>
          </TabsContent>
        </Tabs>
      ) : (
        stageContent
      )}
    </div>
  )
}


function ExpandableBadgeIcon({ label, code }: { label: string; code?: string | null }) {
  const visual = readKnownBadgeVisual({ label, code: code ?? null })
  const description = visual?.tooltip ? stripBadgeTooltipPrefix(visual.tooltip) : null
  return (
    <span className="group/badge relative z-0 inline-flex hover:z-10">
      <span
        role="img"
        aria-label={label}
        className="inline-flex size-[22px] shrink-0 cursor-default items-center justify-center"
      >
        {visual?.icon_src ? (
          <img src={visual.icon_src} alt="" aria-hidden="true" className="size-full object-contain" />
        ) : (
          <span className="inline-flex size-[22px] items-center justify-center rounded-full bg-primary/10 text-[9px] font-medium text-primary">
            {label.slice(0, 1).toUpperCase()}
          </span>
        )}
      </span>
      <span
        className={cn(
          'pointer-events-none absolute left-full top-1/2 -translate-y-1/2 opacity-0',
          'transition-[opacity,transform] duration-200 ease-out translate-x-0.5',
          'group-hover/badge:pointer-events-auto group-hover/badge:opacity-100 group-hover/badge:translate-x-0',
        )}
      >
        <span className="ml-1 flex items-center gap-1.5 whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 shadow-sm">
          <span className="text-[11px] font-medium text-foreground">{label}</span>
          {description ? (
            <>
              <span className="text-border" aria-hidden="true">·</span>
              <span className="text-[11px] text-muted-foreground">{description}</span>
            </>
          ) : null}
        </span>
      </span>
    </span>
  )
}
