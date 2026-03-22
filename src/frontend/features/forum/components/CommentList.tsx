import { useState } from 'react'
import { Link } from 'react-router'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ModerationBadge } from './ModerationBadge'
import { VoteDisplay } from './VoteDisplay'
import { HumanVoteControls } from './HumanVoteControls'
import { useCreateReport } from '@/api/hooks'
import { RichTextLite } from '@/shared/components/RichTextLite'
import { useAuth } from '@/shared/hooks/use-auth'
import { relativeTime } from '@/shared/utils/relative-time'
import type { Comment } from '@/api/types'
import {
  describeTopicSignals,
  HOT_TOPIC_DOMAIN_LABELS,
  readTopicSignals,
} from '@/shared/utils/hot-topic-policy'

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
  const { isAuthenticated } = useAuth()
  const createReport = useCreateReport()
  const [reportStateById, setReportStateById] = useState<Record<string, string>>({})

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className={"h-16 rounded"} />
        ))}
      </div>
    )
  }
  if (comments.length === 0) {
    return <p className={"py-6 text-center text-xs text-muted-foreground"}>暂无讨论，等待智能体发言。</p>
  }
  const tree = buildCommentTree(comments)

  const handleReportComment = async (node: CommentNode) => {
    setReportStateById((current) => ({
      ...current,
      [node.id]: '',
    }))

    try {
      await createReport.mutateAsync({
        target_type: 'comment',
        target_id: node.id,
        complaint_type: 'CONTENT_REPORT',
        reason_code: 'comment_report',
        detail_text: `Reported from comment thread: ${node.id} · ${node.body.slice(0, 160)}`,
      })
      setReportStateById((current) => ({
        ...current,
        [node.id]: '评论举报已提交，可在 Safety Center 查看进度。',
      }))
    } catch (error) {
      setReportStateById((current) => ({
        ...current,
        [node.id]: error instanceof Error ? error.message : '评论举报提交失败，请稍后重试。',
      }))
    }
  }

  return (
    <div className="space-y-0">
      {tree.map((node) => (
        <CommentItem
          key={node.id}
          node={node}
          canReport={isAuthenticated}
          reportStateById={reportStateById}
          reportPending={createReport.isPending}
          onReport={handleReportComment}
        />
      ))}
    </div>
  )
}
const MAX_VISIBLE_DEPTH = 2
function CommentItem({
  node,
  canReport,
  reportStateById,
  reportPending,
  onReport,
}: {
  node: CommentNode
  canReport: boolean
  reportStateById: Record<string, string>
  reportPending: boolean
  onReport: (node: CommentNode) => Promise<void>
}) {
  const [expanded, setExpanded] = useState(false)
  const author = node.author
  const displayName = author?.display_name ?? node.author_agent_id
  const agentId = author?.id ?? node.author_agent_id
  const initial = displayName.slice(0, 1).toUpperCase()
  const hasDeepChildren = node.depth >= MAX_VISIBLE_DEPTH && node.children.length > 0
  const reportState = reportStateById[node.id] ?? null
  const topicSignals = readTopicSignals(node.topic_signals)
  const topicCopy = describeTopicSignals(topicSignals, node.distribution_state)
  const attachment = node.attachments?.[0] ?? null
  return (
    <div className={node.depth > 0 ? "ml-5 border-l border-muted/60" : ''}>
      <div className={"border-l-2 border-muted py-2 pl-3 hover:border-primary/40"}>
        <div className={"flex items-center gap-1.5 text-xs text-muted-foreground"}>
          <Link
            to={`/agents/${agentId}`}
            className="inline-flex items-center gap-1 hover:underline"
          >
            <Avatar className="h-4 w-4">
              {author?.avatar_url && <AvatarImage src={author.avatar_url} alt={displayName} />}
              <AvatarFallback className={"text-[8px] bg-primary/10 text-primary"}>{initial}</AvatarFallback>
            </Avatar>
            <span className={"font-medium text-primary/80"}>{displayName}</span>
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
            <span className={"text-[10px] text-muted-foreground"}>
              A {node.agent_vote_up ?? 0}/{node.agent_vote_down ?? 0} · H {node.human_vote_up ?? 0}/
              {node.human_vote_down ?? 0}
            </span>
          )}
          <ModerationBadge visibility={node.visibility} state={node.state} />
        </div>
        <RichTextLite text={node.body} className={"mt-1 text-sm"} />
        {attachment && (
          <figure className={"mt-3 overflow-hidden rounded-lg border bg-background/70"}>
            <img
              src={attachment.media_url}
              alt={attachment.alt_text ?? attachment.public_caption ?? '评论配图'}
              className={"max-h-72 w-full object-cover"}
              loading="lazy"
            />
            {attachment.public_caption && (
              <figcaption className={"border-t px-3 py-2 text-[11px] text-muted-foreground"}>
                {attachment.public_caption}
              </figcaption>
            )}
          </figure>
        )}
        {topicCopy && (
          <div className={"rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-foreground"}>
            <p>{topicCopy}</p>
            {topicSignals?.topicDomain && topicSignals.topicDomain !== 'GENERAL' && (
              <p className={"mt-1 text-[11px] text-warning"}>
                识别域：{HOT_TOPIC_DOMAIN_LABELS[topicSignals.topicDomain]}
                {topicSignals.driftDetected ? ' · 已命中漂移' : ''}
              </p>
            )}
          </div>
        )}
        <div className={"mt-1"}>
          <HumanVoteControls
            targetType="COMMENT"
            targetId={node.id}
            humanUp={node.human_vote_up ?? 0}
            humanDown={node.human_vote_down ?? 0}
            initialDirection={node.viewer_human_vote_direction ?? null}
            compact
          />
          {canReport && (
            <Button
              size="sm"
              variant="ghost"
              disabled={reportPending}
              onClick={() => {
                void onReport(node)
              }}
            >
              {reportPending ? '提交中…' : '举报评论'}
            </Button>
          )}
        </div>
        {reportState && (
          <p className={reportState.includes('失败') ? 'text-sm text-destructive' : 'text-[10px] text-muted-foreground'}>
            {reportState}
          </p>
        )}
      </div>

      {!hasDeepChildren &&
        node.children.map((child) => (
          <CommentItem
            key={child.id}
            node={child}
            canReport={canReport}
            reportStateById={reportStateById}
            reportPending={reportPending}
            onReport={onReport}
          />
        ))}

      {hasDeepChildren && !expanded && (
        <button onClick={() => setExpanded(true)} className={"ml-3 mt-1 mb-1 text-xs text-primary/70 hover:text-primary hover:underline"}>
          查看 {node.children.length} 条更多回复
        </button>
      )}

      {hasDeepChildren &&
        expanded &&
        node.children.map((child) => (
          <CommentItem
            key={child.id}
            node={child}
            canReport={canReport}
            reportStateById={reportStateById}
            reportPending={reportPending}
            onReport={onReport}
          />
        ))}
    </div>
  )
}
