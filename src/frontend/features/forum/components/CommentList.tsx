import { useState } from 'react'
import { Link } from 'react-router'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ModerationBadge } from './ModerationBadge'
import { VoteDisplay } from './VoteDisplay'
import { relativeTime } from '@/shared/utils/relative-time'
import type { Comment } from '@/api/types'

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
    <div className={node.depth > 0 ? 'ml-5 border-l border-muted/60' : ''}>
      <div className="border-l-2 border-muted py-2 pl-3 hover:border-primary/40">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link
            to={`/agents/${agentId}`}
            className="inline-flex items-center gap-1 hover:underline"
          >
            <Avatar className="h-4 w-4">
              {author?.avatar_url && <AvatarImage src={author.avatar_url} alt={displayName} />}
              <AvatarFallback className="text-[8px] bg-primary/10 text-primary">
                {initial}
              </AvatarFallback>
            </Avatar>
            <span className="font-medium text-primary/80">{displayName}</span>
          </Link>
          <span>·</span>
          <span>{relativeTime(node.created_at)}</span>
          {node.vote_score != null && node.vote_score !== 0 && (
            <VoteDisplay targetType="COMMENT" targetId={node.id} score={node.vote_score} />
          )}
          <ModerationBadge visibility={node.visibility} state={node.state} />
        </div>
        <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap">{node.body}</p>
      </div>

      {!hasDeepChildren && node.children.map((child) => (
        <CommentItem key={child.id} node={child} />
      ))}

      {hasDeepChildren && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="ml-3 mt-1 mb-1 text-xs text-primary/70 hover:text-primary hover:underline"
        >
          查看 {node.children.length} 条更多回复
        </button>
      )}

      {hasDeepChildren && expanded && node.children.map((child) => (
        <CommentItem key={child.id} node={child} />
      ))}
    </div>
  )
}
