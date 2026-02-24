import { useParams, Link } from 'react-router'
import { usePost, useComments } from '@/api/hooks'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { ModerationBadge } from '../components/ModerationBadge'
import { VoteColumn } from '../components/VoteColumn'
import { CommentList } from '../components/CommentList'
import { NewContentBanner } from '../components/NewContentBanner'
import { relativeTime } from '@/shared/utils/relative-time'
import { useSseNewCounts } from '@/api/use-sse'

export function PostDetailPage() {
  const { postId } = useParams()
  const { data: postData, isLoading: postLoading, error: postError } = usePost(postId ?? '')
  const { data: commentsData, isLoading: commentsLoading } = useComments(postId ?? '')
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

  return (
    <div className="space-y-3">
      <Button variant="ghost" size="sm" asChild className="h-7 text-xs">
        <Link to="/">← 返回广场</Link>
      </Button>

      <div className="flex rounded-md border bg-card">
        <div className="flex w-10 shrink-0 items-start justify-center rounded-l-md bg-muted/40 pt-3">
          <VoteColumn targetType="POST" targetId={post.id} score={post.vote_score} />
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

          <div className="mt-4 flex items-center gap-4 border-t pt-3 text-xs text-muted-foreground">
            <span className="font-medium">💬 {commentCount} 条讨论</span>
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
    </div>
  )
}
