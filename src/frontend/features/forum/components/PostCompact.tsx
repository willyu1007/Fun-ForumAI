import { useState } from 'react'
import { Link } from 'react-router'
import { cn } from '@/lib/utils'
import { ModerationBadge } from './ModerationBadge'
import { HumanVoteControls } from './HumanVoteControls'
import { RichTextLite } from '@/shared/components/RichTextLite'
import { extractRichTextPreview } from '@/shared/utils/rich-text-lite'
import { relativeTime } from '@/shared/utils/relative-time'
import type { PostWithMeta } from '@/api/types'
interface PostCompactProps {
  post: PostWithMeta
  showCommunity?: boolean
}
export function PostCompact({ post, showCommunity = true }: PostCompactProps) {
  const [expanded, setExpanded] = useState(false)
  const author = post.author
  const communityPath = post.community_slug || post.community_id
  const canExpand = post.body.length > 80
  const preview = extractRichTextPreview(post.body, 96)
  return (
    <div className={"group grid grid-cols-[56px_minmax(0,1fr)] overflow-hidden rounded-md border bg-card/95 transition-colors hover:border-primary/40"}>
      <div className={"flex items-center justify-center border-r border-border/40 bg-muted/40"}>
        <div className={"flex flex-col items-center text-center"}>
          <span aria-hidden className={"text-[11px] leading-none"}>
            🔥
          </span>
          <span className={"text-[11px] font-bold tabular-nums text-foreground"}>{post.heat_score}</span>
        </div>
      </div>

      <div className={"min-w-0 px-2.5 py-1.5 sm:px-3"}>
        <div
          className={cn(
            'grid min-w-0 items-center gap-x-2 gap-y-1',
            showCommunity ? "grid-cols-[fit-content(58%)_max-content_max-content]" : "grid-cols-[fit-content(70%)_max-content]",
          )}
        >
          <div className="min-w-0 flex items-center gap-1.5 overflow-hidden">
            <Link to={`/posts/${post.id}`} className="min-w-0">
              <span className={"block truncate text-[13px] font-semibold text-foreground transition-colors group-hover:text-primary"}>{post.title}</span>
            </Link>
            <ModerationBadge visibility={post.visibility} state={post.state} />
          </div>

          <div className={"flex items-center gap-1 whitespace-nowrap text-[10px] text-muted-foreground"}>
            <span>发布 {relativeTime(post.created_at)}</span>
            <span>·</span>
            <span>A 👍 {post.agent_vote_up}</span>
            {post.media.length > 0 && (
              <>
                <span>·</span>
                <span>🖼 {post.media.length}</span>
              </>
            )}
            <span>·</span>
            <HumanVoteControls
              targetType="POST"
              targetId={post.id}
              humanUp={post.human_vote_up}
              humanDown={post.human_vote_down}
              initialDirection={post.viewer_human_vote_direction}
              compact
            />
            <span>·</span>
            <Link to={`/posts/${post.id}`} className={"inline-flex items-center gap-0.5 rounded px-1 py-0.5 hover:bg-accent"}>
              💬 {post.comment_count}
            </Link>
          </div>

          {showCommunity && (
            <Link to={`/c/${communityPath}`} className={"inline-flex whitespace-nowrap rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-foreground hover:bg-accent"}>
              {post.community_name}
            </Link>
          )}
        </div>

        <div className={"mt-0.5 grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-1 text-[10px] text-muted-foreground"}>
          <span className={"whitespace-nowrap font-medium text-foreground"}>{author.display_name}：</span>
          {expanded ? (
            <RichTextLite text={post.body} className={"min-w-0 space-y-1 text-[10px] text-muted-foreground"} />
          ) : (
            <span className={cn('min-w-0 truncate')}>{preview}</span>
          )}
          {canExpand && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className={"whitespace-nowrap text-[10px] font-medium text-primary/80 hover:text-primary"}
            >
              {expanded ? '收起' : '展开'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
