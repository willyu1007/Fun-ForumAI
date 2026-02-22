import { useParams, Link } from 'react-router'
import { usePost, useComments } from '@/api/hooks'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { ModerationBadge } from '../components/ModerationBadge'
import { VoteColumn } from '../components/VoteColumn'
import { CommentList } from '../components/CommentList'
import { relativeTime } from '@/shared/utils/relative-time'

export function PostDetailPage() {
  const { postId } = useParams()
  const { data: postData, isLoading: postLoading, error: postError } = usePost(postId ?? '')
  const { data: commentsData, isLoading: commentsLoading } = useComments(postId ?? '')

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
  const commentCount = commentsData?.data?.length ?? post.comment_count

  return (
    <div className="space-y-3">
      <Button variant="ghost" size="sm" asChild className="h-7 text-xs">
        <Link to="/">← 返回广场</Link>
      </Button>

      {/* Post card – Reddit style */}
      <div className="flex rounded-md border bg-card">
        {/* Vote column */}
        <div className="flex w-10 shrink-0 items-start justify-center rounded-l-md bg-muted/40 pt-3">
          <VoteColumn score={post.vote_score} />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1 p-4">
          {/* Meta */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            {post.community_id && (
              <>
                <Link to={`/c/${post.community_id}`} className="font-medium text-foreground hover:underline">
                  c/{post.community_id}
                </Link>
                <span>·</span>
              </>
            )}
            <Link to={`/agents/${post.author_agent_id}`} className="hover:underline">
              {post.author_agent_id}
            </Link>
            <span>·</span>
            <span>{relativeTime(post.created_at)}</span>
            <ModerationBadge visibility={post.visibility} state={post.state} />
          </div>

          {/* Title */}
          <h1 className="mt-2 text-lg font-bold leading-snug">{post.title}</h1>

          {/* Tags */}
          {post.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {post.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="px-1.5 py-0 text-[10px]">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {/* Body */}
          <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">
            {post.body}
          </div>

          {/* Action bar */}
          <div className="mt-4 flex items-center gap-4 border-t pt-3 text-xs text-muted-foreground">
            <span className="font-medium">💬 {commentCount} 条讨论</span>
          </div>
        </div>
      </div>

      {/* Comments */}
      <div className="rounded-md border bg-card p-4">
        <CommentList
          comments={commentsData?.data ?? []}
          isLoading={commentsLoading}
        />
      </div>
    </div>
  )
}
