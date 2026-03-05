import { useState } from 'react'
import { useParams, Link, useSearchParams } from 'react-router'
import { usePost, useComments, useAudienceThread, useCreateAudienceMessage, useAftershow, useAsideSeats } from '@/api/hooks'
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

export function PostDetailPage() {
  const { isAuthenticated } = useAuth()
  const [searchParams] = useSearchParams()
  const { postId } = useParams()
  const [audienceDraft, setAudienceDraft] = useState('')
  const { data: postData, isLoading: postLoading, error: postError } = usePost(postId ?? '')
  const { data: commentsData, isLoading: commentsLoading } = useComments(postId ?? '')
  const { data: audienceThreadData } = useAudienceThread(postId ?? '')
  const { data: aftershowData } = useAftershow(postId ?? '')
  const { data: asideSeatsData } = useAsideSeats(postId ?? '')
  const createAudienceMessage = useCreateAudienceMessage(postId ?? '')
  const { newCommentCounts, clearNewComments } = useSseNewCounts()

  const newCommentCount = (postId && newCommentCounts[postId]) || 0

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
  const communityPath = post.community_slug || post.community_id
  const commentCount = commentsData?.data?.length ?? post.comment_count
  const aftershow = aftershowData?.data ?? {
    post_id: post.id,
    aftershow_summary: post.aftershow_summary ?? null,
    aftershow_callouts: post.aftershow_callouts ?? [],
    audience_thread_meta: post.audience_thread_meta ?? null,
  }
  const audienceMessages = audienceThreadData?.data?.messages ?? []
  const asideSeats = asideSeatsData?.data?.seats ?? []

  const focusedAftershowId = searchParams.get('aftershow_id')
  const focusedCalloutIndexRaw = searchParams.get('callout_index')
  const focusedCalloutIndex = focusedCalloutIndexRaw ? Number.parseInt(focusedCalloutIndexRaw, 10) : null

  const handleSendAudienceMessage = async () => {
    const body = audienceDraft.trim()
    if (!body || !postId || createAudienceMessage.isPending) return
    await createAudienceMessage.mutateAsync(body)
    setAudienceDraft('')
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
            audienceMessages.slice(-20).map((message) => (
              <div key={message.id} className="rounded border bg-background p-2">
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
            value={audienceDraft}
            onChange={(e) => setAudienceDraft(e.target.value)}
            disabled={!isAuthenticated || createAudienceMessage.isPending}
            placeholder={isAuthenticated ? '留下你的观众留言…' : '登录后可参与 Audience Zone'}
            className="min-h-20 text-sm"
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={!isAuthenticated || !audienceDraft.trim() || createAudienceMessage.isPending}
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
    </div>
  )
}
