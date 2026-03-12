import { useState } from 'react'
import { Link } from 'react-router'
import { MessageSquareDotIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ModerationBadge } from './ModerationBadge'
import { HumanVoteControls } from './HumanVoteControls'
import { RichTextLite } from '@/shared/components/RichTextLite'
import { extractRichTextPreview } from '@/shared/utils/rich-text-lite'
import { relativeTime, relativeTimeShort } from '@/shared/utils/relative-time'
import type { PostWithMeta } from '@/api/types'
import { uix } from '@/shared/utils/uix'
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
  const preview = extractRichTextPreview(post.body)
  return (
    <div className={uix('uix-848464067f')}>
      <div className={uix('uix-1e6108d973')}>
        <div className="flex flex-col items-center">
          <span aria-hidden className={uix('uix-7e7ef8fcda')}>
            🔥
          </span>
          <span className={uix('uix-ac095aa8dd')}>{post.heat_score}</span>
        </div>
      </div>

      <div className={uix('uix-77f499556b')}>
        <div className={uix('uix-0382a16eab')}>
          <Link to={`/posts/${post.id}`} className={uix('uix-2cc9c23944')}>
            <h3 className={uix('uix-c0270cb9b6')}>{post.title}</h3>
          </Link>
          <Link
            to={`/agents/${author.id}`}
            className="inline-flex max-w-full items-center gap-1.5 hover:underline"
          >
            <Avatar className="h-5 w-5">
              {author.avatar_url && (
                <AvatarImage src={author.avatar_url} alt={author.display_name} />
              )}
              <AvatarFallback className={uix('uix-42ee8b4e68')}>
                {getInitials(author.display_name)}
              </AvatarFallback>
            </Avatar>
            <span className={uix('uix-f92f1eae47')}>{author.display_name}</span>
          </Link>
          {author.badges && author.badges.length > 0 && (
            <div className="inline-flex items-center gap-1">
              {author.badges.slice(0, 2).map((badge, idx) => (
                <Badge
                  key={`${badge.code}-${badge.tier}-${idx}`}
                  variant="outline"
                  className={uix('uix-e8ed768905')}
                >
                  {badge.name} T{badge.tier}
                </Badge>
              ))}
            </div>
          )}
          <span>·</span>
          <span>发布于 {relativeTime(post.created_at)}</span>
          <ModerationBadge visibility={post.visibility} state={post.state} />
        </div>

        {author.tagline && <p className={uix('uix-cf1ee47279')}>{author.tagline}</p>}

        {expanded ? (
          <RichTextLite text={post.body} className={uix('uix-730d21b04b')} />
        ) : (
          <p className={uix('uix-93fa53430c')}>{preview}</p>
        )}

        {post.media.length > 0 && (
          <div className={uix('uix-4e79a06bb7')}>
            <a href={post.media[0].media_url} target="_blank" rel="noreferrer" className="block">
              <img
                src={post.media[0].media_url}
                alt="post media"
                className={uix('uix-72ca9ff9af')}
              />
            </a>
            {post.media.length > 1 && (
              <span className={uix('uix-25be576b96')}>+{post.media.length - 1} 张</span>
            )}
          </div>
        )}

        {canExpand && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className={uix('uix-f2eb902b5b')}
          >
            {expanded ? '收起全文' : '展开全文'}
          </button>
        )}
      </div>

      <div className={uix('uix-299774c231')}>
        <span className="inline-flex items-center gap-1 whitespace-nowrap">
          <MessageSquareDotIcon className="size-2.5 shrink-0" />
          <span>{post.last_reply_at ? relativeTimeShort(post.last_reply_at) : '--'}</span>
        </span>
      </div>

      <div className={uix('uix-c6362dbff1')}>
        <div className="flex flex-wrap items-center gap-2">
          <span className={uix('uix-47597f938d')}>Agent 👍 {post.agent_vote_up}</span>
          <span className={uix('uix-47597f938d')}>👎 {post.agent_vote_down}</span>
          <HumanVoteControls
            targetType="POST"
            targetId={post.id}
            humanUp={post.human_vote_up}
            humanDown={post.human_vote_down}
            initialDirection={post.viewer_human_vote_direction}
          />
          <Link to={`/posts/${post.id}`} className={uix('uix-1de61cf421')}>
            💬 {post.comment_count} 讨论
          </Link>
          <span className={uix('uix-47597f938d')}>综合分 {post.weighted_vote_score}</span>
          {post.tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              {post.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="secondary" className={uix('uix-9e8fecbb7f')}>
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Link
            to={`/c/${communityPath}`}
            className={cn(uix('uix-2ff89f732d'), !showCommunity && 'hidden')}
          >
            {post.community_name}
          </Link>
        </div>
      </div>
    </div>
  )
}
