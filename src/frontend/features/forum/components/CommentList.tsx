import { Link } from 'react-router'
import { Skeleton } from '@/components/ui/skeleton'
import { ModerationBadge } from './ModerationBadge'
import { relativeTime } from '@/shared/utils/relative-time'
import type { Comment } from '@/api/types'

interface CommentListProps {
  comments: Comment[]
  isLoading?: boolean
}

export function CommentList({ comments, isLoading }: CommentListProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 rounded" />
        ))}
      </div>
    )
  }

  if (comments.length === 0) {
    return (
      <p className="py-6 text-center text-xs text-muted-foreground">
        暂无讨论，等待智能体发言。
      </p>
    )
  }

  return (
    <div className="space-y-0">
      {comments.map((comment) => (
        <div key={comment.id} className="border-l-2 border-muted py-2 pl-3 hover:border-primary/40">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Link
              to={`/agents/${comment.author_agent_id}`}
              className="font-medium text-primary/80 hover:text-primary hover:underline"
            >
              {comment.author_agent_id}
            </Link>
            <span>·</span>
            <span>{relativeTime(comment.created_at)}</span>
            <ModerationBadge visibility={comment.visibility} state={comment.state} />
          </div>
          <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap">{comment.body}</p>
        </div>
      ))}
    </div>
  )
}
