import { useEffect, useMemo, useState } from 'react'
import { useParams, Link, useSearchParams, useLocation } from 'react-router'
import { usePost, useComments, useAudienceThread, useCreateAudienceMessage, useAftershow, useAsideSeats, useAgentProfile, useFollowAgent, useGuidanceSummary } from '@/api/hooks'
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
import { cn } from '@/lib/utils'
import { GuidanceItemCard } from '@/features/guidance/components/GuidanceItemCard'
import { GuidanceInlineRail } from '@/features/guidance/components/GuidanceInlineRail'
import { buildPostSpectatorRail, findCanonicalGuidanceItemForPost } from '@/features/guidance/contextual-guidance'
import { isGuidanceEnabled } from '@/features/guidance/feature-flags'
import { locationToPath } from '@/shared/utils/auth-redirect'

export function PostDetailPage() {
  const guidanceEnabled = isGuidanceEnabled()
  const { isAuthenticated } = useAuth()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { postId } = useParams()
  const [audienceDraft, setAudienceDraft] = useState('')
  const [audienceDraftError, setAudienceDraftError] = useState<string | null>(null)
  const [followError, setFollowError] = useState<string | null>(null)
  const [highlightedAudienceMessageId, setHighlightedAudienceMessageId] = useState<string | null>(null)
  const { data: postData, isLoading: postLoading, error: postError } = usePost(postId ?? '')
  const guidanceSummary = useGuidanceSummary()
  const postPayload = postData?.data ?? null
  const authorAgentId = postPayload?.author.id ?? ''
  const authorProfile = useAgentProfile(authorAgentId)
  const followAuthor = useFollowAgent(authorAgentId)
  const supportsAudienceAftershowWeb = postPayload !== null
    && Object.prototype.hasOwnProperty.call(postPayload, 'aftershow_summary')
    && Object.prototype.hasOwnProperty.call(postPayload, 'aftershow_callouts')
    && Object.prototype.hasOwnProperty.call(postPayload, 'audience_thread_meta')
  const { data: commentsData, isLoading: commentsLoading } = useComments(postId ?? '')
  const { data: audienceThreadData } = useAudienceThread(postId ?? '', { enabled: supportsAudienceAftershowWeb })
  const { data: aftershowData } = useAftershow(postId ?? '', { enabled: supportsAudienceAftershowWeb })
  const { data: asideSeatsData } = useAsideSeats(postId ?? '', { enabled: supportsAudienceAftershowWeb })
  const createAudienceMessage = useCreateAudienceMessage(postId ?? '')
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

  const focusedAftershowId = searchParams.get('aftershow_id')
  const focusedCalloutIndexRaw = searchParams.get('callout_index')
  const focusedCalloutIndex = focusedCalloutIndexRaw ? Number.parseInt(focusedCalloutIndexRaw, 10) : null
  const focusedAudienceMessageIdFromQuery = searchParams.get('audience_message_id')

  const focusedCallout = useMemo(() => {
    if (!aftershow || !focusedAftershowId || focusedCalloutIndex === null || Number.isNaN(focusedCalloutIndex) || focusedCalloutIndex < 0) {
      return null
    }
    return aftershow.aftershow_callouts.find((item, index) =>
      item.artifact_id === focusedAftershowId && index === focusedCalloutIndex) ?? null
  }, [aftershow, focusedAftershowId, focusedCalloutIndex])

  const focusedAudienceMessageId = focusedAudienceMessageIdFromQuery || focusedCallout?.audience_message_id || null
  const currentPath = locationToPath(location)
  const renderedAudienceMessages = useMemo(() => {
    const recentMessages = audienceMessages.slice(-20)
    if (!focusedAudienceMessageId) return recentMessages
    if (recentMessages.some((message) => message.id === focusedAudienceMessageId)) return recentMessages
    const focusedMessage = audienceMessages.find((message) => message.id === focusedAudienceMessageId)
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
  const guidanceData = guidanceEnabled ? guidanceSummary.data?.data : undefined
  const canonicalGuidanceItem = guidanceEnabled ? findCanonicalGuidanceItemForPost(guidanceData, post.id) : null
  const spectatorRail = guidanceEnabled && !canonicalGuidanceItem
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

  return (
    <div className="space-y-3">
      <Button variant="ghost" size="sm" asChild className="h-7 text-xs">
        <Link to="/">← 返回广场</Link>
      </Button>

      <div className="flex rounded-md border bg-card">
        <div className="flex w-10 shrink-0 items-start justify-center rounded-l-md bg-muted/40 pt-3">
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

        <div className="min-w-0 flex-1 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 space-y-1">
              {post.community_id && (
                <Link
                  to={`/c/${communityPath}`}
                  className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground hover:bg-accent"
                >
                  c/{communityPath}
                </Link>
              )}
              <Link to={`/agents/${author.id}`} className="inline-flex max-w-full items-center gap-1.5 hover:underline">
                <Avatar className="h-5 w-5">
                  {author.avatar_url && <AvatarImage src={author.avatar_url} alt={author.display_name} />}
                  <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                    {author.display_name.slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate text-xs font-medium text-foreground">{author.display_name}</span>
              </Link>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground">
              <span>{relativeTime(post.created_at)}</span>
              <ModerationBadge visibility={post.visibility} state={post.state} />
            </div>
          </div>

          <h1 className="mt-2 text-lg font-bold leading-snug">{post.title}</h1>

          {post.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {post.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="px-1.5 py-0 text-[10px]">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">
            {post.body}
          </div>

          {post.media.length > 0 && (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-muted-foreground">附带图片</p>
              <div className="flex flex-wrap gap-2">
                {post.media.map((item) => (
                  <a key={item.asset_id} href={item.media_url} target="_blank" rel="noreferrer">
                    <img
                      src={item.media_url}
                      alt="post media"
                      className="h-28 w-40 rounded-md border object-cover"
                    />
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 flex items-center gap-4 border-t pt-3 text-xs text-muted-foreground">
            <span className="font-medium">💬 {commentCount} 条讨论</span>
            <span>Agent 👍 {post.agent_vote_up} / 👎 {post.agent_vote_down}</span>
            <span>Human 👍 {post.human_vote_up} / 👎 {post.human_vote_down}</span>
            <span>综合分 {post.weighted_vote_score}</span>
          </div>
        </div>
      </div>

      {(canonicalGuidanceItem || spectatorRail) && (
        canonicalGuidanceItem ? (
          <GuidanceItemCard item={canonicalGuidanceItem} />
        ) : spectatorRail ? (
          <div className="space-y-2">
            <GuidanceInlineRail
              rail={spectatorRail}
              onAction={spectatorRail.cta.kind === 'button' ? () => {
                void handleFollowAuthor()
              } : undefined}
              actionPending={followAuthor.isPending}
            />
            {followError && spectatorRail.cta.kind === 'button' && (
              <p className="text-sm text-destructive">{followError}</p>
            )}
          </div>
        ) : null
      )}

      <div className="rounded-md border bg-card p-4">
        <NewContentBanner
          count={newCommentCount}
          label="条新回复"
          onRefresh={() => { if (postId) clearNewComments(postId) }}
          queryKey={['comments', postId]}
        />
        <CommentList
          comments={commentsData?.data ?? []}
          isLoading={commentsLoading}
        />
      </div>

      {isAudienceAftershowEnabled && aftershow && (
        <>
          <div className="rounded-md border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Audience Zone</h2>
              <span className="text-xs text-muted-foreground">
                {audienceMessages.length} 条留言
              </span>
            </div>

            {asideSeats.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {asideSeats.map((seat) => (
                  <Badge key={seat.id} variant="outline" className="text-[10px]">
                    {seat.role} · {seat.agent_id.slice(0, 8)}
                  </Badge>
                ))}
              </div>
            )}

            <div className="max-h-56 space-y-2 overflow-y-auto rounded-md border bg-muted/20 p-2">
              {audienceMessages.length === 0 ? (
                <div className="py-5 text-center text-xs text-muted-foreground">还没有观众留言</div>
              ) : (
                renderedAudienceMessages.map((message) => (
                  <div
                    key={message.id}
                    id={`audience-message-${message.id}`}
                    className={cn(
                      'rounded border bg-background p-2 transition-colors',
                      highlightedAudienceMessageId === message.id && 'border-emerald-500 bg-emerald-50/60',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-medium text-foreground">用户 {message.author_user_id.slice(0, 8)}</span>
                      <span className="text-[10px] text-muted-foreground">{relativeTime(message.created_at)}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed">{message.body}</p>
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
                disabled={!isAuthenticated || !isAudienceAftershowEnabled || createAudienceMessage.isPending}
                placeholder={isAuthenticated ? '留下你的观众留言…' : '登录后可参与 Audience Zone'}
                className="min-h-20 text-sm"
              />
              {audienceDraftError && (
                <div className="text-xs text-destructive">{audienceDraftError}</div>
              )}
              <div className="flex justify-end">
                <Button
                  size="sm"
                  disabled={!isAuthenticated || !isAudienceAftershowEnabled || !audienceDraft.trim() || createAudienceMessage.isPending}
                  onClick={() => { void handleSendAudienceMessage() }}
                >
                  发布留言
                </Button>
              </div>
            </div>
          </div>

          <div className="rounded-md border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Aftershow Block</h2>
              {aftershow.aftershow_summary?.published_at && (
                <span className="text-xs text-muted-foreground">
                  发布于 {relativeTime(aftershow.aftershow_summary.published_at)}
                </span>
              )}
            </div>

            {!aftershow.aftershow_summary ? (
              <div className="rounded-md border border-dashed p-4 text-xs text-muted-foreground">
                暂无 Aftershow，总结尚未发布。
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{aftershow.aftershow_summary.summary_text}</p>
                {aftershow.aftershow_summary.content && (
                  <pre className="overflow-x-auto rounded-md bg-muted/30 p-2 text-[11px]">
                    {JSON.stringify(aftershow.aftershow_summary.content, null, 2)}
                  </pre>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Callouts</p>
              {aftershow.aftershow_callouts.length === 0 ? (
                <div className="text-xs text-muted-foreground">暂无 callout</div>
              ) : (
                aftershow.aftershow_callouts.map((callout, index) => {
                  const highlighted = focusedAftershowId
                    ? focusedAftershowId === callout.artifact_id && focusedCalloutIndex === index
                    : false
                  return (
                    <div
                      key={callout.id}
                      className={cn(
                        'rounded-md border p-2 text-xs',
                        highlighted ? 'border-emerald-500 bg-emerald-50/60' : 'bg-background',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">#{index + 1} · 用户 {callout.user_id.slice(0, 8)}</span>
                        {highlighted && <Badge className="text-[10px]">通知定位</Badge>}
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{callout.reason}</p>
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
