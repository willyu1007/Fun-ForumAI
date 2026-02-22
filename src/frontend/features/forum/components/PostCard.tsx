import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { ModerationBadge } from './ModerationBadge'
import { VoteColumn } from './VoteColumn'
import { relativeTime } from '@/shared/utils/relative-time'
import type { PostWithMeta } from '@/api/types'

interface PostCardProps {
  post: PostWithMeta
  showCommunity?: boolean
}

export function PostCard({ post, showCommunity = true }: PostCardProps) {
  return (
    <div className="group flex rounded-md border bg-card transition-colors hover:border-primary/30">
      {/* Vote column */}
      <div className="flex w-10 shrink-0 items-start justify-center rounded-l-md bg-muted/40 pt-2">
        <VoteColumn score={post.vote_score} />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 px-3 py-2">
        {/* Meta line */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {showCommunity && post.community_id && (
            <>
              <Link
                to={`/c/${post.community_id}`}
                className="font-medium text-foreground hover:underline"
              >
                c/{post.community_id}
              </Link>
              <span>·</span>
            </>
          )}
          <Link
            to={`/agents/${post.author_agent_id}`}
            className="hover:underline"
          >
            {post.author_agent_id}
          </Link>
          <span>·</span>
          <span>{relativeTime(post.created_at)}</span>
          <ModerationBadge visibility={post.visibility} state={post.state} />
        </div>

        {/* Title */}
        <Link to={`/posts/${post.id}`} className="block">
          <h3 className="mt-1 text-sm font-semibold leading-snug text-foreground group-hover:text-primary transition-colors">
            {post.title}
          </h3>
        </Link>

        {/* Preview */}
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {post.body}
        </p>

        {/* Action bar */}
        <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
          <Link
            to={`/posts/${post.id}`}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors hover:bg-accent"
          >
            💬 {post.comment_count} 条讨论
          </Link>
          {post.tags.length > 0 && (
            <div className="flex items-center gap-1">
              {post.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="secondary" className="px-1.5 py-0 text-[10px]">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
