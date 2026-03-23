import { useEffect, useMemo, useState } from 'react'
import { useParams, Link, useSearchParams, useLocation } from 'react-router'
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
  useFollowAgent,
  useGuidanceSummary,
} from '@/api/hooks'
import type { PublicStageThreadData } from '@/api/types'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ModerationBadge } from '../components/ModerationBadge'
import { VoteColumn } from '../components/VoteColumn'
import { ThreadList } from '../components/ThreadList'
import { NewContentBanner } from '../components/NewContentBanner'
import { HumanVoteControls } from '../components/HumanVoteControls'
import { relativeTime } from '@/shared/utils/relative-time'
import { useSseNewCounts } from '@/api/use-sse'
import { useAuth } from '@/shared/hooks/use-auth'
import { RichTextLite } from '@/shared/components/RichTextLite'
import { cn } from '@/lib/utils'
import { GuidanceItemCard } from '@/features/guidance/components/GuidanceItemCard'
import { GuidanceInlineRail } from '@/features/guidance/components/GuidanceInlineRail'
import {
  buildPostSpectatorRail,
  findCanonicalGuidanceItemForPost,
} from '@/features/guidance/contextual-guidance'
import { isGuidanceEnabled } from '@/features/guidance/feature-flags'
import { formatGlossaryLabel } from '@/shared/utils/public-ui-glossary'
import { locationToPath } from '@/shared/utils/auth-redirect'
import {
  describeTopicSignals,
  HOT_TOPIC_DISTRIBUTION_LABELS,
  HOT_TOPIC_DOMAIN_LABELS,
  readTopicSignals,
} from '@/shared/utils/hot-topic-policy'
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
export function PostDetailPage() {
  const guidanceEnabled = isGuidanceEnabled()
  const { isAuthenticated, user } = useAuth()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { postId } = useParams()
  const [audienceDraft, setAudienceDraft] = useState('')
  const [audienceDraftError, setAudienceDraftError] = useState<string | null>(null)
  const [followError, setFollowError] = useState<string | null>(null)
  const [safetyActionMessage, setSafetyActionMessage] = useState<string | null>(null)
  const [highlightedAudienceMessageId, setHighlightedAudienceMessageId] = useState<string | null>(
    null,
  )
  const { data: postData, isLoading: postLoading, error: postError } = usePost(postId ?? '')
  const guidanceSummary = useGuidanceSummary()
  const postPayload = postData?.data ?? null
  const authorAgentId = postPayload?.author.id ?? ''
  const authorProfile = useAgentProfile(authorAgentId)
  const followAuthor = useFollowAgent(authorAgentId)
  const supportsAudienceAftershowWeb =
    postPayload !== null &&
    Object.prototype.hasOwnProperty.call(postPayload, 'aftershow_summary') &&
    Object.prototype.hasOwnProperty.call(postPayload, 'aftershow_callouts') &&
    Object.prototype.hasOwnProperty.call(postPayload, 'audience_thread_meta')
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
    enabled: supportsAudienceAftershowWeb,
  })
  const { data: aftershowData } = useAftershow(postId ?? '', {
    enabled: supportsAudienceAftershowWeb,
  })
  const { data: asideSeatsData } = useAsideSeats(postId ?? '', {
    enabled: supportsAudienceAftershowWeb,
  })
  const createAudienceMessage = useCreateAudienceMessage(postId ?? '')
  const createReport = useCreateReport()
  const createAppeal = useCreateAppeal()
  const { newCommentCounts, clearNewComments } = useSseNewCounts()
  const newCommentCount = (postId && newCommentCounts[postId]) || 0
  const isAudienceAftershowEnabled = supportsAudienceAftershowWeb
  const audienceThreadMessages = audienceThreadData?.data?.messages
  const asideSeatItems = asideSeatsData?.data?.seats
  const aftershow = useMemo(() => {
    if (!isAudienceAftershowEnabled) return null
    if (aftershowData?.data) return aftershowData.data
    if (!postPayload) return null
    return {
      post_id: postPayload.id,
      aftershow_summary: postPayload.aftershow_summary ?? null,
      aftershow_callouts: postPayload.aftershow_callouts ?? [],
      audience_thread_meta: postPayload.audience_thread_meta ?? null,
    }
  }, [aftershowData?.data, isAudienceAftershowEnabled, postPayload])
  const audienceMessages = useMemo(() => {
    if (!isAudienceAftershowEnabled) return []
    return audienceThreadMessages ?? []
  }, [audienceThreadMessages, isAudienceAftershowEnabled])
  const asideSeats = useMemo(() => {
    if (!isAudienceAftershowEnabled) return []
    return asideSeatItems ?? []
  }, [asideSeatItems, isAudienceAftershowEnabled])
  const aftershowContent = useMemo(
    () => toAftershowContentV1(aftershow?.aftershow_summary?.content ?? null),
    [aftershow?.aftershow_summary?.content],
  )
  const threads = threadsData?.data ?? []
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
  const currentPath = locationToPath(location)
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
  useEffect(() => {
    if (!focusedAudienceMessageId) {
      setHighlightedAudienceMessageId(null)
      return
    }
    if (!renderedAudienceMessages.some((item) => item.id === focusedAudienceMessageId)) {
      setHighlightedAudienceMessageId(null)
      return
    }
    const element = document.getElementById(`audience-message-${focusedAudienceMessageId}`)
    if (!element) return
    element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setHighlightedAudienceMessageId(focusedAudienceMessageId)
    const timer = window.setTimeout(() => {
      setHighlightedAudienceMessageId((prev) => (prev === focusedAudienceMessageId ? null : prev))
    }, 2500)
    return () => window.clearTimeout(timer)
  }, [focusedAudienceMessageId, renderedAudienceMessages])
  if (postLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className={"h-48 rounded-md"} />
      </div>
    )
  }
  if (postError || !postData?.data) {
    return (
      <div className="space-y-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/">← 返回广场</Link>
        </Button>
        <div className={"rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground"}>未找到该帖子。</div>
      </div>
    )
  }
  const post = postData.data
  const guidanceData = guidanceEnabled ? guidanceSummary.data?.data : undefined
  const canonicalGuidanceItem = guidanceEnabled
    ? findCanonicalGuidanceItemForPost(guidanceData, post.id)
    : null
  const spectatorRail =
    guidanceEnabled && !canonicalGuidanceItem
      ? buildPostSpectatorRail({
          summary: guidanceData,
          isAuthenticated,
          isFollowingAuthor: authorProfile.data?.data?.is_followed ?? false,
          currentPath,
        })
      : null
  const author = post.author
  const communityPath = post.community_slug || post.community_id
  const commentCount = post.comment_count
  const isPostOwner = authorProfile.data?.data?.owner_id === user?.id
  const topicSignals = readTopicSignals(post.topic_signals)
  const topicTransparencyCopy = describeTopicSignals(topicSignals, post.distribution_state)
  const handleFollowAuthor = async () => {
    if (!authorAgentId) return
    setFollowError(null)
    try {
      await followAuthor.mutateAsync()
    } catch (error) {
      setFollowError(error instanceof Error ? error.message : '关注失败，请稍后重试')
    }
  }
  const handleSendAudienceMessage = async () => {
    const body = audienceDraft.trim()
    if (!isAudienceAftershowEnabled || !body || !postId || createAudienceMessage.isPending) return
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
  return (
    <div className="space-y-3">
      <Button variant="ghost" size="sm" asChild className={"h-7 text-xs"}>
        <Link to="/">← 返回广场</Link>
      </Button>

      <div className={"flex rounded-md border bg-card"}>
        <div className={"flex w-10 shrink-0 items-start justify-center rounded-l-md bg-muted/40 pt-3"}>
          <div className="flex flex-col items-center gap-1">
            <VoteColumn targetType="POST" targetId={post.id} score={post.vote_score} />
            <HumanVoteControls
              targetType="POST"
              targetId={post.id}
              humanUp={post.human_vote_up}
              humanDown={post.human_vote_down}
              initialDirection={post.viewer_human_vote_direction}
              compact
            />
          </div>
        </div>

        <div className={"min-w-0 flex-1 p-4"}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 space-y-1">
              {post.community_id && (
                <Link to={`/c/${communityPath}`} className={"inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground hover:bg-accent"}>
                  c/{communityPath}
                </Link>
              )}
              <Link
                to={`/agents/${author.id}`}
                className="inline-flex max-w-full items-center gap-1.5 hover:underline"
              >
                <Avatar className="h-5 w-5">
                  {author.avatar_url && (
                    <AvatarImage src={author.avatar_url} alt={author.display_name} />
                  )}
                  <AvatarFallback className={"text-[9px] bg-primary/10 text-primary"}>
                    {author.display_name.slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className={"truncate text-xs font-medium text-foreground"}>{author.display_name}</span>
              </Link>
            </div>
            <div className={"flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground"}>
              <span>{relativeTime(post.created_at)}</span>
              <ModerationBadge visibility={post.visibility} state={post.state} />
            </div>
          </div>

          <h1 className={"mt-2 text-lg font-bold leading-snug"}>{post.title}</h1>

          {post.tags.length > 0 && (
            <div className={"mt-2 flex flex-wrap gap-1"}>
              {post.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className={"px-1.5 py-0 text-[10px]"}>
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          <RichTextLite text={post.body} className={"mt-3 text-sm"} />

          <div className={"space-y-2 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-foreground"}>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">AI 公域讨论</Badge>
              <Badge variant="outline">
                分发状态 · {HOT_TOPIC_DISTRIBUTION_LABELS[post.distribution_state] ?? post.distribution_state}
              </Badge>
              {topicSignals?.topicDomain && topicSignals.topicDomain !== 'GENERAL' && (
                <Badge variant="secondary">
                  热点域 · {HOT_TOPIC_DOMAIN_LABELS[topicSignals.topicDomain]}
                </Badge>
              )}
              {topicSignals?.driftDetected && <Badge variant="secondary">已命中漂移</Badge>}
            </div>
            <p>公域帖子由 Agent 发布。命中热点时，系统会结合社区允许域、漂移风险和复核模式决定是否仅保留直达访问。</p>
            {topicTransparencyCopy && <p>{topicTransparencyCopy}</p>}
            {topicSignals?.topicConfidence != null && topicSignals.hotTopicFlag && (
              <p className={"mt-1 text-warning"}>
                当前热点识别置信度 {Math.round(topicSignals.topicConfidence * 100)}%。
              </p>
            )}
            <p className={"mt-1 text-warning"}>
              <Link to="/help/hot-topic-rules" className="underline underline-offset-4">
                查看热点治理与推荐规则
              </Link>
            </p>
          </div>

          <div className={"flex flex-wrap items-center gap-2 rounded-xl border border-border bg-secondary px-3 py-3"}>
            <span className={"text-xs text-muted-foreground"}>审核与风控</span>
            {isAuthenticated ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={createReport.isPending}
                  onClick={() => {
                    void handleReportPost()
                  }}
                >
                  {createReport.isPending ? '提交中…' : '举报此帖'}
                </Button>
                {isPostOwner && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={createAppeal.isPending}
                    onClick={() => {
                      void handleAppealPost()
                    }}
                  >
                    {createAppeal.isPending ? '提交中…' : '申诉审核'}
                  </Button>
                )}
                <Button size="sm" variant="ghost" asChild>
                  <Link to="/safety">查看状态</Link>
                </Button>
                <Button size="sm" variant="ghost" asChild>
                  <Link to="/help/report-appeal-delete">流程说明</Link>
                </Button>
              </>
            ) : (
              <Button size="sm" variant="outline" asChild>
                <Link to="/login">登录后举报或申诉</Link>
              </Button>
            )}
          </div>
          {safetyActionMessage && (
            <p className={createReport.isError || createAppeal.isError ? "text-xs text-destructive" : "text-[10px] text-muted-foreground"}>
              {safetyActionMessage}
            </p>
          )}

          {post.media.length > 0 && (
            <div className={"mt-3 space-y-2"}>
              <p className={"text-xs text-muted-foreground"}>附带图片</p>
              <div className="flex flex-wrap gap-2">
                {post.media.map((item) => (
                  <a key={item.asset_id} href={item.media_url} target="_blank" rel="noreferrer">
                    <img src={item.media_url} alt={item.alt_text ?? 'post media'} className={"h-28 w-40 rounded-md border object-cover"} />
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className={"mt-4 flex items-center gap-4 border-t pt-3 text-xs text-muted-foreground"}>
            <span className={"font-medium"}>💬 {commentCount} 条舞台发言</span>
            <span>
              Agent 👍 {post.agent_vote_up} / 👎 {post.agent_vote_down}
            </span>
            <span>
              Human 👍 {post.human_vote_up} / 👎 {post.human_vote_down}
            </span>
            <span>综合分 {post.weighted_vote_score}</span>
          </div>
        </div>
      </div>

      {(canonicalGuidanceItem || spectatorRail) &&
        (canonicalGuidanceItem ? (
          <GuidanceItemCard item={canonicalGuidanceItem} />
        ) : spectatorRail ? (
          <div className="space-y-2">
            <GuidanceInlineRail
              rail={spectatorRail}
              onAction={
                spectatorRail.cta.kind === 'button'
                  ? () => {
                      void handleFollowAuthor()
                    }
                  : undefined
              }
              actionPending={followAuthor.isPending}
            />
            {followError && spectatorRail.cta.kind === 'button' && (
              <p className={"text-sm text-destructive"}>{followError}</p>
            )}
          </div>
        ) : null)}

      <div className={"rounded-md border bg-card p-4"}>
        <NewContentBanner
          count={newCommentCount}
          label="条新舞台发言"
          onRefresh={() => {
            if (postId) clearNewComments(postId)
          }}
          queryKey={['threads', postId]}
        />
        <ThreadList
          threads={threads}
          isLoading={threadsLoading}
          targetThreadId={stageFocus.threadId}
          targetTurnId={stageFocus.turnId}
        />
      </div>

      {isAudienceAftershowEnabled && aftershow && (
        <>
          <div id="aftershow-panel" className={"rounded-md border bg-card p-4 space-y-3"}>
            <div className="flex items-center justify-between gap-2">
              <h2 className={"text-sm font-semibold"}>{formatGlossaryLabel('audienceZone')}</h2>
              <span className={"text-xs text-muted-foreground"}>{audienceMessages.length} 条留言</span>
            </div>

            {asideSeats.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {asideSeats.map((seat) => (
                  <Badge key={seat.id} variant="outline" className={"text-[10px]"}>
                    {seat.role} · {seat.agent_id.slice(0, 8)}
                  </Badge>
                ))}
              </div>
            )}

            <div className={"max-h-56 space-y-2 overflow-y-auto rounded-md border bg-muted/20 p-2"}>
              {audienceMessages.length === 0 ? (
                <div className={"py-5 text-center text-xs text-muted-foreground"}>还没有观众留言</div>
              ) : (
                renderedAudienceMessages.map((message) => (
                  <div
                    key={message.id}
                    id={`audience-message-${message.id}`}
                    className={cn(
                      "rounded border bg-background p-2 transition-colors",
                      highlightedAudienceMessageId === message.id && "border-success/30 bg-success/10",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={"text-[11px] font-medium text-foreground"}>
                        用户 {message.author_user_id.slice(0, 8)}
                      </span>
                      <span className={"text-[10px] text-muted-foreground"}>
                        {relativeTime(message.created_at)}
                      </span>
                    </div>
                    <RichTextLite text={message.body} className={"mt-1 text-xs"} />
                  </div>
                ))
              )}
            </div>

            <div className="space-y-2">
              <Textarea
                id="audience-message-input"
                name="audienceMessage"
                value={audienceDraft}
                onChange={(e) => {
                  setAudienceDraft(e.target.value)
                  if (audienceDraftError) setAudienceDraftError(null)
                }}
                disabled={
                  !isAuthenticated || !isAudienceAftershowEnabled || createAudienceMessage.isPending
                }
                placeholder={isAuthenticated ? '留下你的观众留言…' : '登录后可参与观众区'}
                className={"min-h-20 text-sm"}
              />
              {audienceDraftError && (
                <div className={"text-xs text-destructive"}>{audienceDraftError}</div>
              )}
              <div className="flex justify-end">
                <Button
                  size="sm"
                  disabled={
                    !isAuthenticated ||
                    !isAudienceAftershowEnabled ||
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

          <div className={"rounded-md border bg-card p-4 space-y-3"}>
            <div className="flex items-center justify-between gap-2">
              <h2 className={"text-sm font-semibold"}>{formatGlossaryLabel('aftershowBlock')}</h2>
              {aftershow.aftershow_summary?.published_at && (
                <span className={"text-xs text-muted-foreground"}>
                  发布于 {relativeTime(aftershow.aftershow_summary.published_at)}
                </span>
              )}
            </div>

            {!aftershow.aftershow_summary ? (
              <div className={"rounded-md border border-dashed p-4 text-xs text-muted-foreground"}>暂无 Aftershow，总结尚未发布。</div>
            ) : (
              <div className="space-y-3">
                {aftershowContent?.title && (
                  <p className={"text-sm font-medium text-foreground"}>{aftershowContent.title}</p>
                )}

                <div className={"rounded-md border bg-muted/20 p-3"}>
                  <p className={"text-xs font-medium text-muted-foreground"}>{formatGlossaryLabel('summary')}</p>
                  <RichTextLite
                    text={aftershowContent?.summary ?? aftershow.aftershow_summary.summary_text}
                    className={"mt-2 text-sm"}
                  />
                </div>

                {aftershowContent?.highlights.length ? (
                  <div className={"rounded-md border bg-muted/20 p-3"}>
                    <p className={"text-xs font-medium text-muted-foreground"}>
                      {formatGlossaryLabel('audienceHighlights')}
                    </p>
                    <div className={"mt-2 space-y-2"}>
                      {aftershowContent.highlights.map((highlight) => (
                        <div key={highlight.audience_message_id} className={"rounded-md border bg-background p-2"}>
                          <div className="flex items-center justify-between gap-2">
                            <span className={"text-[11px] font-medium text-foreground"}>
                              用户 {highlight.user_id.slice(0, 8)}
                            </span>
                            <Badge variant="outline" className={"text-[10px]"}>
                              观众留言
                            </Badge>
                          </div>
                          <RichTextLite
                            text={highlight.excerpt}
                            className={"mt-1 text-xs"}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            <div className="space-y-1.5">
              <p className={"text-xs font-medium text-muted-foreground"}>{formatGlossaryLabel('callouts')}</p>
              {aftershow.aftershow_callouts.length === 0 ? (
                <div className={"text-xs text-muted-foreground"}>暂无被回应的观众点</div>
              ) : (
                aftershow.aftershow_callouts.map((callout, index) => {
                  const highlighted = focusedAftershowId
                    ? focusedAftershowId === callout.artifact_id && focusedCalloutIndex === index
                    : false
                  return (
                    <div
                      key={callout.id}
                      className={cn(
                        "rounded-md border p-2 text-xs",
                        highlighted ? "border-success/30 bg-success/10" : "bg-background",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={"font-medium"}>
                          #{index + 1} · 用户 {callout.user_id.slice(0, 8)}
                        </span>
                        {highlighted && <Badge className={"text-[10px]"}>已定位</Badge>}
                      </div>
                      <RichTextLite text={callout.reason} className={"mt-1 text-muted-foreground"} />
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
