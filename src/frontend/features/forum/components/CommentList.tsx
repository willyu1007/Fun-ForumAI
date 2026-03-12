import { useState } from 'react'
import { Link } from 'react-router'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ModerationBadge } from './ModerationBadge'
import { VoteDisplay } from './VoteDisplay'
import { HumanVoteControls } from './HumanVoteControls'
import { RichTextLite } from '@/shared/components/RichTextLite'
import { relativeTime } from '@/shared/utils/relative-time'
import type { Comment } from '@/api/types'
import { uix } from '@/shared/utils/uix'
interface CommentNode extends Comment {
  children: CommentNode[]
  depth: number
}
function buildCommentTree(comments: Comment[]): CommentNode[] {
  const map = new Map<string, CommentNode>()
  const roots: CommentNode[] = []
  for (const c of comments) {
    map.set(c.id, { ...c, children: [], depth: 0 })
  }
  for (const node of map.values()) {
    if (node.parent_comment_id && map.has(node.parent_comment_id)) {
      const parent = map.get(node.parent_comment_id)!
      node.depth = parent.depth + 1
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  }
  return roots
}
interface CommentListProps {
  comments: Comment[]
  isLoading?: boolean
}
export function CommentList({ comments, isLoading }: CommentListProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className={uix('uix-a628cac5b3')} />
        ))}
      </div>
    )
  }
  if (comments.length === 0) {
    return <p className={uix('uix-00b6f415fe')}>暂无讨论，等待智能体发言。</p>
  }
  const tree = buildCommentTree(comments)
  return (
    <div className="space-y-0">
      {tree.map((node) => (
        <CommentItem key={node.id} node={node} />
      ))}
    </div>
  )
}
const MAX_VISIBLE_DEPTH = 2
function CommentItem({ node }: { node: CommentNode }) {
  const [expanded, setExpanded] = useState(false)
  const author = node.author
  const displayName = author?.display_name ?? node.author_agent_id
  const agentId = author?.id ?? node.author_agent_id
  const initial = displayName.slice(0, 1).toUpperCase()
  const hasDeepChildren = node.depth >= MAX_VISIBLE_DEPTH && node.children.length > 0
  return (
    <div className={node.depth > 0 ? uix('uix-7781cfa876') : ''}>
      <div className={uix('uix-f62385ae88')}>
        <div className={uix('uix-71c77e3569')}>
          <Link
            to={`/agents/${agentId}`}
            className="inline-flex items-center gap-1 hover:underline"
          >
            <Avatar className="h-4 w-4">
              {author?.avatar_url && <AvatarImage src={author.avatar_url} alt={displayName} />}
              <AvatarFallback className={uix('uix-5e40ce1799')}>{initial}</AvatarFallback>
            </Avatar>
            <span className={uix('uix-cf838eef5b')}>{displayName}</span>
          </Link>
          <span>·</span>
          <span>{relativeTime(node.created_at)}</span>
          {node.vote_score != null && node.vote_score !== 0 && (
            <VoteDisplay
              targetType="COMMENT"
              targetId={node.id}
              score={node.weighted_vote_score ?? node.vote_score}
            />
          )}
          {(node.agent_vote_up != null || node.human_vote_up != null) && (
            <span className={uix('uix-abda0153e3')}>
              A {node.agent_vote_up ?? 0}/{node.agent_vote_down ?? 0} · H {node.human_vote_up ?? 0}/
              {node.human_vote_down ?? 0}
            </span>
          )}
          <ModerationBadge visibility={node.visibility} state={node.state} />
        </div>
        <RichTextLite text={node.body} className={uix('uix-43728c6ebf')} />
        <div className={uix('uix-b6b02c0ebe')}>
          <HumanVoteControls
            targetType="COMMENT"
            targetId={node.id}
            humanUp={node.human_vote_up ?? 0}
            humanDown={node.human_vote_down ?? 0}
            initialDirection={node.viewer_human_vote_direction ?? null}
            compact
          />
        </div>
      </div>

      {!hasDeepChildren &&
        node.children.map((child) => <CommentItem key={child.id} node={child} />)}

      {hasDeepChildren && !expanded && (
        <button onClick={() => setExpanded(true)} className={uix('uix-1167e0b1a6')}>
          查看 {node.children.length} 条更多回复
        </button>
      )}

      {hasDeepChildren &&
        expanded &&
        node.children.map((child) => <CommentItem key={child.id} node={child} />)}
    </div>
  )
}
