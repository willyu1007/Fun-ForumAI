import { useMemo, useState, type ReactElement } from 'react'
import { Link } from 'react-router'
import type {
  DiscussionBranchGroup,
  DiscussionForestProjection,
  TurnDisplayProjection,
  ViewerWriteResult,
} from '@/api/types'
import { BadgeVisualChip } from '@/shared/components/BadgeVisualChip'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { RichTextLite } from '@/shared/components/RichTextLite'
import { relativeTime } from '@/shared/utils/relative-time'
import { isAgentTargetString } from '@/shared/utils/agent-target'
import { readAuthorBadgeChipItems } from '@/shared/utils/public-author'
import { tryOpenAgentModal } from '@/shared/stores/agent-modal-store'
import { cn } from '@/lib/utils'
import { useCreatePublicTurn } from '@/api/hooks'
import { allowsDirectThreadReply, prefersRouteHandoff } from '../lib/thread-writeability'

export type DiscussionForestSortMode = 'recommended' | 'latest_activity'

interface DiscussionForestProps {
  postId: string
  forest: DiscussionForestProjection | null
  isLoading?: boolean
  selectedNodeId?: string | null
  sortMode?: DiscussionForestSortMode
  turnReplyEnabled?: boolean
  audiencePostingEnabled?: boolean
  onReplyOpen?: (node: TurnDisplayProjection) => void
  onReplyAccepted?: (node: TurnDisplayProjection, result: ViewerWriteResult) => void
  onDiscussInAudience?: (node: TurnDisplayProjection) => void
}

interface DiscussionTreeView {
  id: string
  thread_id: string
  group: DiscussionBranchGroup
  root: TurnDisplayProjection
  children_by_parent: Map<string, TurnDisplayProjection[]>
  latest_activity_at: string
}

function buildNodeHref(postId: string, node: TurnDisplayProjection): string {
  if (node.entry_kind === 'THREAD') {
    return `/posts/${postId}?threadId=${node.thread_id}`
  }
  return `/posts/${postId}?threadId=${node.thread_id}&turnId=${node.id}`
}

function sortNodes(nodes: TurnDisplayProjection[]): TurnDisplayProjection[] {
  return [...nodes].sort((left, right) => {
    if (left.display_depth !== right.display_depth) {
      return left.display_depth - right.display_depth
    }
    if (left.sibling_order !== right.sibling_order) {
      return left.sibling_order - right.sibling_order
    }
    return left.created_at.localeCompare(right.created_at)
  })
}

function collectSubtreeNodes(
  rootId: string,
  pool: TurnDisplayProjection[],
): TurnDisplayProjection[] {
  const descendants = new Set<string>([rootId])
  let changed = true
  while (changed) {
    changed = false
    for (const node of pool) {
      if (!node.display_parent_id) continue
      if (!descendants.has(node.display_parent_id)) continue
      if (descendants.has(node.id)) continue
      descendants.add(node.id)
      changed = true
    }
  }
  return pool.filter((node) => descendants.has(node.id))
}

function buildTreeViews(forest: DiscussionForestProjection): DiscussionTreeView[] {
  const nodesByThreadId = new Map<string, TurnDisplayProjection[]>()
  for (const node of forest.nodes) {
    const bucket = nodesByThreadId.get(node.thread_id) ?? []
    bucket.push(node)
    nodesByThreadId.set(node.thread_id, bucket)
  }

  const trees: DiscussionTreeView[] = []
  for (const group of forest.branch_groups) {
    const threadNodes = sortNodes(nodesByThreadId.get(group.thread_id) ?? [])
    const rootNode = threadNodes.find((node) => node.entry_kind === 'THREAD') ?? null
    const turnNodes = threadNodes.filter((node) => node.entry_kind === 'TURN')

    // A "tree" is seeded at each top-level lead (root, or turn directly under root).
    // Without a root node we still surface each top-level turn as its own tree.
    const leadNodes = rootNode
      ? turnNodes.filter((node) => node.display_parent_id === rootNode.id)
      : turnNodes.filter((node) => !node.display_parent_id)

    if (leadNodes.length === 0 && rootNode) {
      trees.push({
        id: `tree:${group.thread_id}:${rootNode.id}`,
        thread_id: group.thread_id,
        group,
        root: rootNode,
        children_by_parent: new Map<string, TurnDisplayProjection[]>(),
        latest_activity_at: group.latest_activity_at,
      })
      continue
    }

    for (const leadNode of leadNodes) {
      const subtree = sortNodes(collectSubtreeNodes(leadNode.id, threadNodes))
      const childrenByParent = new Map<string, TurnDisplayProjection[]>()
      for (const node of subtree) {
        if (node.id === leadNode.id) continue
        const parentId = node.display_parent_id ?? leadNode.id
        const bucket = childrenByParent.get(parentId) ?? []
        bucket.push(node)
        childrenByParent.set(parentId, bucket)
      }
      for (const [parentId, bucket] of childrenByParent.entries()) {
        childrenByParent.set(parentId, sortNodes(bucket))
      }
      const latestActivityAt =
        [...subtree].sort((left, right) => right.created_at.localeCompare(left.created_at))[0]
          ?.created_at ?? group.latest_activity_at
      trees.push({
        id: `tree:${group.thread_id}:${leadNode.id}`,
        thread_id: group.thread_id,
        group,
        root: leadNode,
        children_by_parent: childrenByParent,
        latest_activity_at: latestActivityAt,
      })
    }
  }
  return trees
}

function readRouteAction(group: DiscussionBranchGroup): { label: string; target: string } | null {
  const label =
    typeof group.lifecycle?.active_route?.cta?.label === 'string'
      ? group.lifecycle.active_route.cta.label
      : null
  const target =
    typeof group.lifecycle?.active_route?.cta?.target === 'string'
      ? group.lifecycle.active_route.cta.target
      : null

  if (!label || !target) return null
  return { label, target }
}

function renderRouteActionLink(routeAction: { label: string; target: string }) {
  const className =
    'text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground'
  if (isAgentTargetString(routeAction.target)) {
    return (
      <button
        type="button"
        className={className}
        onClick={() => {
          tryOpenAgentModal(routeAction.target, 'readonly')
        }}
      >
        {routeAction.label}
      </button>
    )
  }
  if (routeAction.target.startsWith('/')) {
    return (
      <Link to={routeAction.target} className={className}>
        {routeAction.label}
      </Link>
    )
  }
  return (
    <a href={routeAction.target} target="_blank" rel="noreferrer" className={className}>
      {routeAction.label}
    </a>
  )
}

function InlineNodeReplyComposer({
  postId,
  node,
  onSuccess,
  onCancel,
}: {
  postId: string
  node: TurnDisplayProjection
  onSuccess: (result: ViewerWriteResult) => void
  onCancel: () => void
}) {
  const createPublicTurn = useCreatePublicTurn()
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const quotedExcerpt = (node.body ?? '').slice(0, 180)

  const handleSubmit = async () => {
    const trimmed = body.trim()
    if (!trimmed) {
      setError('请先输入内容再发送。')
      return
    }
    setError(null)
    setNotice(null)
    try {
      const response = await createPublicTurn.mutateAsync({
        threadId: node.thread_id,
        postId,
        body: trimmed,
        anchor_turn_id: node.id,
        focused_turn_id: node.id,
        actual_anchor_turn_id: node.id,
        quoted_excerpt: quotedExcerpt || null,
        idempotency_key: `viewer-stage:${postId}:${Date.now()}`,
        source_context: {
          discovered_via: 'discussion_forest',
          source_shelf: 'forest',
        },
      })
      const result = response.data
      if (result.result === 'ACCEPTED') {
        onSuccess(result)
        return
      }
      if (result.result === 'PENDING_MODERATION') {
        setNotice(result.message ?? '回应已提交，等待审核后公开显示。')
        return
      }
      setError(result.message ?? '暂时无法提交这条回应。')
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '提交失败，请稍后再试。')
    }
  }

  return (
    <div className="mt-2 space-y-2" data-testid="inline-node-reply-composer">
      <Textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="写下你的回应…"
        rows={3}
        className="min-h-[72px] text-sm"
        data-testid="inline-node-reply-textarea"
      />
      {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
      {notice ? <p className="text-[11px] text-muted-foreground">{notice}</p> : null}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          className="h-7 px-3 text-xs"
          onClick={handleSubmit}
          disabled={createPublicTurn.isPending || body.trim().length === 0}
          data-testid="inline-node-reply-submit"
        >
          {createPublicTurn.isPending ? '发送中…' : '发送回应'}
        </Button>
        <button
          type="button"
          className="text-[11px] text-muted-foreground hover:text-foreground"
          onClick={onCancel}
          disabled={createPublicTurn.isPending}
        >
          取消
        </button>
      </div>
    </div>
  )
}

export function DiscussionForest({
  postId,
  forest,
  isLoading,
  selectedNodeId,
  sortMode = 'recommended',
  turnReplyEnabled = false,
  audiencePostingEnabled = false,
  onReplyOpen,
  onReplyAccepted,
  onDiscussInAudience,
}: DiscussionForestProps) {
  const [collapsedNodeIds, setCollapsedNodeIds] = useState<Set<string>>(() => new Set())
  const [activeReplyNodeId, setActiveReplyNodeId] = useState<string | null>(null)

  const trees = useMemo(() => (forest ? buildTreeViews(forest) : []), [forest])

  // Sort is driven purely by the tree's own temporal attributes so that
  // interactive selection (opening a reply composer, highlighting a node) never
  // reorders the list. Deep-link focus is handled in PostDetailPage by scrolling
  // the target tree into view — it does not float to the top.
  const sortedTrees = useMemo(() => {
    if (sortMode === 'latest_activity') {
      // "最新" — latest thread activity first (追更视图).
      return [...trees].sort((left, right) =>
        right.latest_activity_at.localeCompare(left.latest_activity_at),
      )
    }
    // "综合" — earliest branch lead first (叙事顺序，保留因果顺序).
    return [...trees].sort((left, right) =>
      left.root.created_at.localeCompare(right.root.created_at),
    )
  }, [trees, sortMode])

  if (isLoading) {
    return (
      <div className="space-y-3 px-1 py-2">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-24 w-[90%]" />
        <Skeleton className="h-20 w-[80%]" />
      </div>
    )
  }

  if (!forest || sortedTrees.length === 0) {
    return (
      <div className="px-1 py-6 text-sm text-muted-foreground">还没有可展开的公开讨论。</div>
    )
  }

  const toggleCollapsed = (nodeId: string) => {
    setCollapsedNodeIds((current) => {
      const next = new Set(current)
      if (next.has(nodeId)) next.delete(nodeId)
      else next.add(nodeId)
      return next
    })
  }

  return (
    <ul className="space-y-5" data-testid="discussion-forest-tree">
      {sortedTrees.map((tree) => {
        const branchAllowsReply = allowsDirectThreadReply(tree.group.lifecycle?.writeability)
        const preferRouteAction = prefersRouteHandoff(tree.group.lifecycle?.writeability)
        const routeAction = readRouteAction(tree.group)

        const renderNode = (node: TurnDisplayProjection, depth: number): ReactElement => {
          const isRoot = node.id === tree.root.id
          const collapsed = collapsedNodeIds.has(node.id)
          const isReplyOpen = activeReplyNodeId === node.id
          const selected = selectedNodeId === node.id
          const children = tree.children_by_parent.get(node.id) ?? []
          const canReplyHere = turnReplyEnabled && branchAllowsReply
          const showRouteOnNode = isRoot && Boolean(routeAction)
          const avatarTarget = `agent://${node.author.id}`
          const { identityChip } = readAuthorBadgeChipItems(node.author, {
            maxProofChips: 0,
            policyId: 'public_author_compact',
          })

          return (
            <li
              key={node.id}
              data-testid={isRoot ? 'discussion-tree' : 'discussion-node'}
              data-node-id={node.id}
              data-depth={depth}
              className={cn(selected && 'rounded-sm bg-primary/[0.04]')}
            >
              <div className="flex gap-2">
                <button
                  type="button"
                  aria-label={collapsed ? '展开子节点' : '折叠子节点'}
                  className="mt-0.5 h-4 w-4 shrink-0 select-none text-[11px] font-mono leading-none text-muted-foreground/70 hover:text-foreground"
                  onClick={() => toggleCollapsed(node.id)}
                  data-testid="node-collapse-toggle"
                >
                  {collapsed ? '[+]' : '[−]'}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0 text-[11px] text-muted-foreground">
                    <button
                      type="button"
                      className="truncate font-medium text-foreground hover:underline"
                      onClick={() => tryOpenAgentModal(avatarTarget, 'readonly')}
                    >
                      {node.author.display_name}
                    </button>
                    {identityChip ? (
                      <BadgeVisualChip
                        label={identityChip.label}
                        code={identityChip.code}
                        variant="outline"
                        className="px-1 py-0 text-[9px]"
                        iconClassName="size-3"
                      />
                    ) : null}
                    <span>·</span>
                    <span>{relativeTime(node.created_at)}</span>
                  </div>
                  {!collapsed ? (
                    <>
                      {node.quoted_excerpt ? (
                        <div className="mt-1 border-l-2 border-border/60 pl-2 text-[11px] leading-5 text-muted-foreground">
                          {node.quoted_excerpt}
                        </div>
                      ) : null}
                      <RichTextLite
                        text={node.body}
                        className="mt-1 text-sm leading-6 text-foreground"
                      />
                      <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
                        {canReplyHere && !isReplyOpen && !(showRouteOnNode && preferRouteAction) ? (
                          <button
                            type="button"
                            className="hover:text-foreground"
                            onClick={() => {
                              setActiveReplyNodeId(node.id)
                              onReplyOpen?.(node)
                            }}
                            data-testid="node-reply-open"
                          >
                            回复
                          </button>
                        ) : null}
                        {showRouteOnNode && routeAction ? renderRouteActionLink(routeAction) : null}
                        {audiencePostingEnabled && onDiscussInAudience ? (
                          <button
                            type="button"
                            className="hover:text-foreground"
                            onClick={() => onDiscussInAudience(node)}
                            data-testid="node-discuss-in-audience"
                          >
                            观众席讨论
                          </button>
                        ) : null}
                        <Link
                          to={buildNodeHref(postId, node)}
                          className="hover:text-foreground"
                        >
                          定位
                        </Link>
                      </div>
                      {isReplyOpen ? (
                        <InlineNodeReplyComposer
                          postId={postId}
                          node={node}
                          onSuccess={(result) => {
                            setActiveReplyNodeId(null)
                            onReplyAccepted?.(node, result)
                          }}
                          onCancel={() => setActiveReplyNodeId(null)}
                        />
                      ) : null}
                      {children.length > 0 ? (
                        <ul
                          className="mt-2 space-y-3 border-l-2 border-border/50 pl-3"
                          data-testid="discussion-children"
                        >
                          {children.map((child) => renderNode(child, depth + 1))}
                        </ul>
                      ) : null}
                    </>
                  ) : (
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      已折叠 {collectSubtreeSize(node.id, tree.children_by_parent)} 条回应
                    </p>
                  )}
                </div>
              </div>
            </li>
          )
        }

        return renderNode(tree.root, 0)
      })}
    </ul>
  )
}

function collectSubtreeSize(
  rootId: string,
  childrenByParent: Map<string, TurnDisplayProjection[]>,
): number {
  let count = 0
  const stack = [rootId]
  while (stack.length > 0) {
    const current = stack.pop() as string
    const children = childrenByParent.get(current) ?? []
    count += children.length
    for (const child of children) stack.push(child.id)
  }
  return count
}
