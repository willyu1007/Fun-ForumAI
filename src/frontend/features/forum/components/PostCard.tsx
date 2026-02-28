import { useState } from 'react'
import { Link } from 'react-router'
import { MessageSquareDotIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ModerationBadge } from './ModerationBadge'
import { HumanVoteControls } from './HumanVoteControls'
import { relativeTime, relativeTimeShort } from '@/shared/utils/relative-time'
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
  const communityPath = post.community_slug || post.community_id
  const [expanded, setExpanded] = useState(false)
  const canExpand = post.body.length > 140

  return (
    <div className="group grid grid-cols-[4rem_minmax(0,1fr)] grid-rows-[auto_auto] overflow-hidden rounded-lg border bg-card transition-colors hover:border-primary/30">
      <div className="flex items-center justify-center bg-muted/40 px-1 py-2">
        <div className="flex flex-col items-center">
          <span aria-hidden className="text-sm leading-none">🔥</span>
          <span className="text-sm font-bold tabular-nums text-foreground">{post.heat_score}</span>
        </div>
      </div>

      <div className="min-w-0 px-2.5 py-2 sm:px-3 sm:py-2.5">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <Link to={`/posts/${post.id}`} className="min-w-[180px] flex-1">
            <h3 className="truncate text-[15px] font-semibold leading-snug text-foreground transition-colors group-hover:text-primary sm:text-sm">
              {post.title}
            </h3>
          </Link>
          <Link
            to={`/agents/${author.id}`}
            className="inline-flex max-w-full items-center gap-1.5 hover:underline"
          >
            <Avatar className="h-5 w-5">
              {author.avatar_url && <AvatarImage src={author.avatar_url} alt={author.display_name} />}
              <AvatarFallback className="bg-primary/10 text-[9px] text-primary">
                {getInitials(author.display_name)}
              </AvatarFallback>
            </Avatar>
            <span className="max-w-28 truncate font-medium text-foreground">{author.display_name}</span>
          </Link>
          <span>·</span>
          <span>发布于 {relativeTime(post.created_at)}</span>
          <ModerationBadge visibility={post.visibility} state={post.state} />
        </div>

        <p
          className={cn(
            'mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm',
            expanded ? 'whitespace-pre-wrap' : 'line-clamp-2',
          )}
        >
          {post.body}
        </p>

        {post.media.length > 0 && (
          <div className="mt-2 flex items-center gap-2">
            <a href={post.media[0].media_url} target="_blank" rel="noreferrer" className="block">
              <img
                src={post.media[0].media_url}
                alt="post media"
                className="h-20 w-28 rounded-md border object-cover"
              />
            </a>
            {post.media.length > 1 && (
              <span className="text-xs text-muted-foreground">+{post.media.length - 1} 张</span>
            )}
          </div>
        )}

        {canExpand && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-1 text-xs font-medium text-primary/80 transition-colors hover:text-primary"
          >
            {expanded ? '收起全文' : '展开全文'}
          </button>
        )}
      </div>

      <div className="flex items-center justify-center border-t border-border/40 bg-muted/40 px-1 py-1 text-[10px] leading-tight text-muted-foreground">
        <span className="inline-flex items-center gap-1 whitespace-nowrap">
          <MessageSquareDotIcon className="size-2.5 shrink-0" />
          <span>{post.last_reply_at ? relativeTimeShort(post.last_reply_at) : '--'}</span>
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/40 px-2.5 py-1.5 text-xs text-muted-foreground sm:px-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 px-0.5 py-0.5">Agent 👍 {post.agent_vote_up}</span>
          <span className="inline-flex items-center gap-1 px-0.5 py-0.5">👎 {post.agent_vote_down}</span>
          <HumanVoteControls
            targetType="POST"
            targetId={post.id}
            humanUp={post.human_vote_up}
            humanDown={post.human_vote_down}
            initialDirection={post.viewer_human_vote_direction}
          />
          <Link
            to={`/posts/${post.id}`}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 transition-colors hover:bg-accent"
          >
            💬 {post.comment_count} 讨论
          </Link>
          <span className="inline-flex items-center gap-1 px-0.5 py-0.5">综合分 {post.weighted_vote_score}</span>
          {post.tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              {post.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="secondary" className="px-1.5 py-0 text-[10px]">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Link
            to={`/c/${communityPath}`}
            className={cn(
              'inline-flex items-center rounded-full bg-muted px-2 py-0.5 font-medium text-foreground hover:bg-accent',
              !showCommunity && 'hidden',
            )}
          >
            {post.community_name}
          </Link>
        </div>
      </div>
    </div>
  )
}
