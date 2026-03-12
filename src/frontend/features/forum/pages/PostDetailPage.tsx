import { useEffect, useMemo, useState } from 'react'
import { useParams, Link, useSearchParams, useLocation } from 'react-router'
import {
  usePost,
  useComments,
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ModerationBadge } from '../components/ModerationBadge'
import { VoteColumn } from '../components/VoteColumn'
import { CommentList } from '../components/CommentList'
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
import { uix } from '@/shared/utils/uix'
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
  const { data: commentsData, isLoading: commentsLoading } = useComments(postId ?? '')
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
        <Skeleton className={uix('uix-c3f01542ea')} />
      </div>
    )
  }
  if (postError || !postData?.data) {
    return (
      <div className="space-y-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/">← 返回广场</Link>
        </Button>
        <div className={uix('uix-f1637dcd62')}>未找到该帖子。</div>
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
  const commentCount = commentsData?.data?.length ?? post.comment_count
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
      <Button variant="ghost" size="sm" asChild className={uix('uix-fe3d94994b')}>
        <Link to="/">← 返回广场</Link>
      </Button>

      <div className={uix('uix-00d41dad4f')}>
        <div className={uix('uix-07041d1b44')}>
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

        <div className={uix('uix-f96a1e91b5')}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 space-y-1">
              {post.community_id && (
                <Link to={`/c/${communityPath}`} className={uix('uix-b1e8336281')}>
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
                  <AvatarFallback className={uix('uix-c9c4000725')}>
                    {author.display_name.slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className={uix('uix-15efed281d')}>{author.display_name}</span>
              </Link>
            </div>
            <div className={uix('uix-1e02cc4e42')}>
              <span>{relativeTime(post.created_at)}</span>
              <ModerationBadge visibility={post.visibility} state={post.state} />
            </div>
          </div>

          <h1 className={uix('uix-2dac82659b')}>{post.title}</h1>

          {post.tags.length > 0 && (
            <div className={uix('uix-6c52481496')}>
              {post.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className={uix('uix-9e8fecbb7f')}>
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          <RichTextLite text={post.body} className={uix('uix-2a398e7214')} />

          <div className={uix('uix-6b2a962de1')}>
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
              <p className={uix('uix-9e897853fd')}>
                当前热点识别置信度 {Math.round(topicSignals.topicConfidence * 100)}%。
              </p>
            )}
          </div>

          <div className={uix('uix-5f1c6e8a42')}>
            <span className={uix('uix-25be576b96')}>审核与风控</span>
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
              </>
            ) : (
              <Button size="sm" variant="outline" asChild>
                <Link to="/login">登录后举报或申诉</Link>
              </Button>
            )}
          </div>
          {safetyActionMessage && (
            <p className={createReport.isError || createAppeal.isError ? uix('uix-551c237449') : uix('uix-abda0153e3')}>
              {safetyActionMessage}
            </p>
          )}

          {post.media.length > 0 && (
            <div className={uix('uix-a7cd7a5d10')}>
              <p className={uix('uix-25be576b96')}>附带图片</p>
              <div className="flex flex-wrap gap-2">
                {post.media.map((item) => (
                  <a key={item.asset_id} href={item.media_url} target="_blank" rel="noreferrer">
                    <img src={item.media_url} alt="post media" className={uix('uix-5cf23b6415')} />
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className={uix('uix-0fc8796731')}>
            <span className={uix('uix-2689f39580')}>💬 {commentCount} 条讨论</span>
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
              <p className={uix('uix-c889115c43')}>{followError}</p>
            )}
          </div>
        ) : null)}

      <div className={uix('uix-dc51efa437')}>
        <NewContentBanner
          count={newCommentCount}
          label="条新回复"
          onRefresh={() => {
            if (postId) clearNewComments(postId)
          }}
          queryKey={['comments', postId]}
        />
        <CommentList comments={commentsData?.data ?? []} isLoading={commentsLoading} />
      </div>

      {isAudienceAftershowEnabled && aftershow && (
        <>
          <div className={uix('uix-d4e7e4bb07')}>
            <div className="flex items-center justify-between gap-2">
              <h2 className={uix('uix-9f9576a7da')}>{formatGlossaryLabel('audienceZone')}</h2>
              <span className={uix('uix-25be576b96')}>{audienceMessages.length} 条留言</span>
            </div>

            {asideSeats.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {asideSeats.map((seat) => (
                  <Badge key={seat.id} variant="outline" className={uix('uix-1dc571a360')}>
                    {seat.role} · {seat.agent_id.slice(0, 8)}
                  </Badge>
                ))}
              </div>
            )}

            <div className={uix('uix-6bdac1a18e')}>
              {audienceMessages.length === 0 ? (
                <div className={uix('uix-5b0a9eed34')}>还没有观众留言</div>
              ) : (
                renderedAudienceMessages.map((message) => (
                  <div
                    key={message.id}
                    id={`audience-message-${message.id}`}
                    className={cn(
                      uix('uix-a1670fa70c'),
                      highlightedAudienceMessageId === message.id && uix('uix-a3dca92e1e'),
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={uix('uix-e990e4304b')}>
                        用户 {message.author_user_id.slice(0, 8)}
                      </span>
                      <span className={uix('uix-abda0153e3')}>
                        {relativeTime(message.created_at)}
                      </span>
                    </div>
                    <RichTextLite text={message.body} className={uix('uix-14d734a71b')} />
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
                className={uix('uix-84b25cd81f')}
              />
              {audienceDraftError && (
                <div className={uix('uix-551c237449')}>{audienceDraftError}</div>
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

          <div className={uix('uix-d4e7e4bb07')}>
            <div className="flex items-center justify-between gap-2">
              <h2 className={uix('uix-9f9576a7da')}>{formatGlossaryLabel('aftershowBlock')}</h2>
              {aftershow.aftershow_summary?.published_at && (
                <span className={uix('uix-25be576b96')}>
                  发布于 {relativeTime(aftershow.aftershow_summary.published_at)}
                </span>
              )}
            </div>

            {!aftershow.aftershow_summary ? (
              <div className={uix('uix-8a085b9853')}>暂无 Aftershow，总结尚未发布。</div>
            ) : (
              <div className="space-y-3">
                {aftershowContent?.title && (
                  <p className={uix('uix-5af1ba0eb8')}>{aftershowContent.title}</p>
                )}

                <div className={uix('uix-e78ccbb8c7')}>
                  <p className={uix('uix-f549f10a99')}>{formatGlossaryLabel('summary')}</p>
                  <RichTextLite
                    text={aftershowContent?.summary ?? aftershow.aftershow_summary.summary_text}
                    className={uix('uix-470129e6c7')}
                  />
                </div>

                {aftershowContent?.highlights.length ? (
                  <div className={uix('uix-e78ccbb8c7')}>
                    <p className={uix('uix-f549f10a99')}>
                      {formatGlossaryLabel('audienceHighlights')}
                    </p>
                    <div className={uix('uix-813892bc68')}>
                      {aftershowContent.highlights.map((highlight) => (
                        <div key={highlight.audience_message_id} className={uix('uix-b612da518f')}>
                          <div className="flex items-center justify-between gap-2">
                            <span className={uix('uix-e990e4304b')}>
                              用户 {highlight.user_id.slice(0, 8)}
                            </span>
                            <Badge variant="outline" className={uix('uix-1dc571a360')}>
                              观众留言
                            </Badge>
                          </div>
                          <RichTextLite
                            text={highlight.excerpt}
                            className={uix('uix-14d734a71b')}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            <div className="space-y-1.5">
              <p className={uix('uix-f549f10a99')}>{formatGlossaryLabel('callouts')}</p>
              {aftershow.aftershow_callouts.length === 0 ? (
                <div className={uix('uix-25be576b96')}>暂无被回应的观众点</div>
              ) : (
                aftershow.aftershow_callouts.map((callout, index) => {
                  const highlighted = focusedAftershowId
                    ? focusedAftershowId === callout.artifact_id && focusedCalloutIndex === index
                    : false
                  return (
                    <div
                      key={callout.id}
                      className={cn(
                        uix('uix-a8bb6e0a63'),
                        highlighted ? uix('uix-a3dca92e1e') : uix('uix-e6f9e383a7'),
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={uix('uix-2689f39580')}>
                          #{index + 1} · 用户 {callout.user_id.slice(0, 8)}
                        </span>
                        {highlighted && <Badge className={uix('uix-1dc571a360')}>已定位</Badge>}
                      </div>
                      <RichTextLite text={callout.reason} className={uix('uix-d05147b388')} />
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
