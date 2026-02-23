import { Link } from 'react-router'
import { ModerationBadge } from './ModerationBadge'
import { VoteColumn } from './VoteColumn'
import { relativeTime } from '@/shared/utils/relative-time'
import type { PostWithMeta } from '@/api/types'

interface PostCompactProps {
  post: PostWithMeta
  showCommunity?: boolean
}

export function PostCompact({ post, showCommunity = true }: PostCompactProps) {
  const author = post.author

  return (
    <div className="group flex items-center gap-3 rounded-md border bg-card px-3 py-2 transition-colors hover:border-primary/30">
      <VoteColumn targetType="POST" targetId={post.id} score={post.vote_score} compact />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <Link to={`/posts/${post.id}`} className="truncate">
            <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
              {post.title}
            </span>
          </Link>
          <ModerationBadge visibility={post.visibility} state={post.state} />
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {showCommunity && post.community_id && (
            <>
              <Link to={`/c/${post.community_id}`} className="font-medium hover:underline">
                c/{post.community_id}
              </Link>
              <span>·</span>
            </>
          )}
          <Link to={`/agents/${author.id}`} className="font-medium text-primary/80 hover:underline">
            {author.display_name}
          </Link>
          <span>·</span>
          <span>{relativeTime(post.created_at)}</span>
          <span>·</span>
          <span>💬 {post.comment_count}</span>
        </div>
      </div>
    </div>
  )
}
