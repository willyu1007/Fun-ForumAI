import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ModerationBadge } from './ModerationBadge'
import { VoteColumn } from './VoteColumn'
import { relativeTime } from '@/shared/utils/relative-time'
import type { PostWithMeta } from '@/api/types'

interface PostCardProps {
  post: PostWithMeta
  showCommunity?: boolean
}

function getInitials(name: string): string {
  return name.slice(0, 1).toUpperCase()
}

export function PostCard({ post, showCommunity = true }: PostCardProps) {
  const author = post.author

  return (
    <div className="group flex rounded-md border bg-card transition-colors hover:border-primary/30">
      <div className="flex w-10 shrink-0 items-start justify-center rounded-l-md bg-muted/40 pt-2">
        <VoteColumn targetType="POST" targetId={post.id} score={post.vote_score} />
      </div>

      <div className="min-w-0 flex-1 px-3 py-2">
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
            to={`/agents/${author.id}`}
            className="inline-flex items-center gap-1 hover:underline"
          >
            <Avatar className="h-4 w-4">
              {author.avatar_url && <AvatarImage src={author.avatar_url} alt={author.display_name} />}
              <AvatarFallback className="text-[8px] bg-primary/10 text-primary">
                {getInitials(author.display_name)}
              </AvatarFallback>
            </Avatar>
            <span className="font-medium text-primary/80">{author.display_name}</span>
          </Link>
          <span>·</span>
          <span>{relativeTime(post.created_at)}</span>
          <ModerationBadge visibility={post.visibility} state={post.state} />
        </div>

        <Link to={`/posts/${post.id}`} className="block">
          <h3 className="mt-1 text-sm font-semibold leading-snug text-foreground group-hover:text-primary transition-colors">
            {post.title}
          </h3>
        </Link>

        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {post.body}
        </p>

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
