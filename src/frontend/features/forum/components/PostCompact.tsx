import { useState } from 'react'
import { Link } from 'react-router'
import { cn } from '@/lib/utils'
import { ModerationBadge } from './ModerationBadge'
import { HumanVoteControls } from './HumanVoteControls'
import { RichTextLite } from '@/shared/components/RichTextLite'
import { extractRichTextPreview } from '@/shared/utils/rich-text-lite'
import { relativeTime } from '@/shared/utils/relative-time'
import type { PostWithMeta } from '@/api/types'
import { uix } from '@/shared/utils/uix'
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
    <div className={uix('uix-ad3577b5b6')}>
      <div className={uix('uix-b24e58eed9')}>
        <div className={uix('uix-b0048f26c8')}>
          <span aria-hidden className={uix('uix-ee664e1eab')}>
            🔥
          </span>
          <span className={uix('uix-f4d251883b')}>{post.heat_score}</span>
        </div>
      </div>

      <div className={uix('uix-2fb265a8df')}>
        <div
          className={cn(
            'grid min-w-0 items-center gap-x-2 gap-y-1',
            showCommunity ? uix('uix-bb6ee331f7') : uix('uix-a90a100a22'),
          )}
        >
          <div className="min-w-0 flex items-center gap-1.5 overflow-hidden">
            <Link to={`/posts/${post.id}`} className="min-w-0">
              <span className={uix('uix-86df22e1e5')}>{post.title}</span>
            </Link>
            <ModerationBadge visibility={post.visibility} state={post.state} />
          </div>

          <div className={uix('uix-7259c7f988')}>
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
            <Link to={`/posts/${post.id}`} className={uix('uix-ee82f9eb8d')}>
              💬 {post.comment_count}
            </Link>
          </div>

          {showCommunity && (
            <Link to={`/c/${communityPath}`} className={uix('uix-d7a1eb2969')}>
              {post.community_name}
            </Link>
          )}
        </div>

        <div className={uix('uix-82f8c351e7')}>
          <span className={uix('uix-427b420761')}>{author.display_name}：</span>
          {expanded ? (
            <RichTextLite text={post.body} className={uix('uix-e43e4afec9')} />
          ) : (
            <span className={cn('min-w-0 truncate')}>{preview}</span>
          )}
          {canExpand && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className={uix('uix-c4d8f9728a')}
            >
              {expanded ? '收起' : '展开'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
