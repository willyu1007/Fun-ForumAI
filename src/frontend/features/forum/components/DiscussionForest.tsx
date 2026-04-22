import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { Link } from 'react-router'
import { MoreHorizontal } from 'lucide-react'
import type {
  DiscussionBranchGroup,
  DiscussionForestProjection,
  TurnDisplayProjection,
  ViewerWriteResult,
} from '@/api/types'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { AgentHoverCard } from '@/features/agents/components/AgentHoverCard'
import { RichTextLite } from '@/shared/components/RichTextLite'
import { relativeTime } from '@/shared/utils/relative-time'
import { resolveAgentAvatarSrc } from '@/shared/utils/preset-avatars'
import { isAgentTargetString } from '@/shared/utils/agent-target'
import { tryOpenAgentModal } from '@/shared/stores/agent-modal-store'
import { cn } from '@/lib/utils'
import { useCreatePublicTurn } from '@/api/hooks'
import { allowsDirectThreadReply, prefersRouteHandoff } from '../lib/thread-writeability'
import { HumanVoteControls } from './HumanVoteControls'
import { AgentSentimentBar } from './AgentSentimentBar'

export type DiscussionForestSortMode = 'recommended' | 'latest_activity'

interface DiscussionForestProps {
  postId: string
  forest: DiscussionForestProjection | null
  isLoading?: boolean
  selectedNodeId?: string | null
  flashNodeId?: string | null
  flashToken?: number | null
  sortMode?: DiscussionForestSortMode
  turnReplyEnabled?: boolean
  audiencePostingEnabled?: boolean
  onReplyOpen?: (node: TurnDisplayProjection) => void
  onReplyAccepted?: (node: TurnDisplayProjection, result: ViewerWriteResult) => void
  onDiscussInAudience?: (node: TurnDisplayProjection) => void
  onToggleNodeSelection?: (node: TurnDisplayProjection) => void
}

interface DiscussionTreeView {
  id: string
  thread_id: string
  group: DiscussionBranchGroup
  root: TurnDisplayProjection
  children_by_parent: Map<string, TurnDisplayProjection[]>
  latest_activity_at: string
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

    // A thread root is the branch's opening statement and should remain visible
    // even after replies arrive. When no explicit root exists, fall back to
    // showing each top-level turn as its own tree.
    if (rootNode) {
      const childrenByParent = new Map<string, TurnDisplayProjection[]>()
      for (const node of threadNodes) {
        if (node.id === rootNode.id) continue
        const parentId = node.display_parent_id ?? rootNode.id
        const bucket = childrenByParent.get(parentId) ?? []
        bucket.push(node)
        childrenByParent.set(parentId, bucket)
      }
      for (const [parentId, bucket] of childrenByParent.entries()) {
        childrenByParent.set(parentId, sortNodes(bucket))
      }
      const latestActivityAt =
        [...threadNodes].sort((left, right) => right.created_at.localeCompare(left.created_at))[0]
          ?.created_at ?? group.latest_activity_at

      trees.push({
        id: `tree:${group.thread_id}:${rootNode.id}`,
        thread_id: group.thread_id,
        group,
        root: rootNode,
        children_by_parent: childrenByParent,
        latest_activity_at: latestActivityAt,
      })
      continue
    }

    const leadNodes = turnNodes.filter((node) => !node.display_parent_id)

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
        className={cn('ui-focus-reset', className)}
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

function hasHumanVoteSummary(
  node: TurnDisplayProjection,
): node is TurnDisplayProjection & { human_vote_up: number; human_vote_down: number } {
  return typeof node.human_vote_up === 'number' && typeof node.human_vote_down === 'number'
}

function hasAgentVoteSummary(
  node: TurnDisplayProjection,
): node is TurnDisplayProjection & { agent_vote_up: number; agent_vote_down: number } {
  return typeof node.agent_vote_up === 'number' && typeof node.agent_vote_down === 'number'
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
  const focusedTurnId = node.id
  const actualAnchorTurnId = node.entry_kind === 'TURN' ? node.id : null

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
        anchor_turn_id: actualAnchorTurnId,
        focused_turn_id: focusedTurnId,
        actual_anchor_turn_id: actualAnchorTurnId,
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
    <div
      className="relative mt-2 rounded-2xl border border-border/70 bg-background/95 px-2.5 py-2.5 transition-colors focus-within:border-foreground/30"
      data-testid="inline-node-reply-composer"
    >
      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="写下你的回应…"
        rows={3}
        className="ui-focus-reset field-sizing-content min-h-[96px] w-full resize-none bg-transparent px-1 py-1 pb-10 text-sm text-foreground placeholder:text-muted-foreground/85"
        data-testid="inline-node-reply-textarea"
      />
      <div className="pointer-events-none absolute inset-x-2.5 bottom-2 flex items-end justify-between gap-3">
        <div className="min-h-4 flex-1 pr-2">
          {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
          {!error && notice ? (
            <p className="text-[11px] text-muted-foreground">{notice}</p>
          ) : null}
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            className="ui-focus-reset rounded-full px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            onClick={onCancel}
            disabled={createPublicTurn.isPending}
          >
            取消
          </button>
          <Button
            type="button"
            size="sm"
            className="h-6 rounded-md px-0.5 text-[11px]"
            onClick={handleSubmit}
            disabled={createPublicTurn.isPending || body.trim().length === 0}
            data-testid="inline-node-reply-submit"
          >
            {createPublicTurn.isPending ? '发送中…' : '评论'}
          </Button>
        </div>
      </div>
    </div>
  )
}

const CHILD_RAIL_X = 44
const CHILD_RAIL_ELBOW_HEIGHT = 16
const CHILD_RAIL_RADIUS = 12
const CHILD_RAIL_STROKE = 1.25
const CHILD_AVATAR_CENTER_FALLBACK = 16
const BRANCH_PARENT_TOGGLE_CENTER_FALLBACK = 55

interface DiscussionChildrenRailLayout {
  height: number
  parentY: number
  points: number[]
}

function isSameChildrenRailLayout(
  left: DiscussionChildrenRailLayout | null,
  right: DiscussionChildrenRailLayout | null,
): boolean {
  if (left === right) return true
  if (!left || !right) return false
  if (left.height !== right.height) return false
  if (left.parentY !== right.parentY) return false
  if (left.points.length !== right.points.length) return false
  return left.points.every((value, index) => value === right.points[index])
}

function DiscussionBranchRailOverlay({
  content,
  nodes,
  branchNodeId,
  railLeftClass,
  childrenClassName,
  measurementVersion,
  spineHovered,
  hoveredBranchNodeId,
  onSpineHoverChange,
  onSpineToggle,
  renderNode,
}: {
  content: ReactElement
  nodes: TurnDisplayProjection[]
  branchNodeId: string
  railLeftClass: string
  childrenClassName?: string
  measurementVersion?: number
  spineHovered?: boolean
  hoveredBranchNodeId?: string | null
  onSpineHoverChange?: (nodeId: string | null) => void
  onSpineToggle?: (nodeId: string) => void
  renderNode: (node: TurnDisplayProjection, ref: (element: HTMLLIElement | null) => void) => ReactElement
}) {
  const branchRef = useRef<HTMLDivElement | null>(null)
  const itemRefs = useRef(new Map<string, HTMLLIElement | null>())
  const [layout, setLayout] = useState<DiscussionChildrenRailLayout | null>(null)

  useLayoutEffect(() => {
    const measure = () => {
      const branch = branchRef.current
      if (!branch) {
        setLayout((current) => (current === null ? current : null))
        return
      }

      const branchRect = branch.getBoundingClientRect()
      const parentToggle = branch.querySelector<HTMLElement>('[data-role="node-collapse-anchor"]')
      const parentToggleHeight =
        parentToggle?.offsetHeight || parentToggle?.getBoundingClientRect().height || 14
      const measuredParentY = parentToggle
        ? parentToggle.getBoundingClientRect().top - branchRect.top + parentToggleHeight / 2
        : null
      const parentY =
        measuredParentY !== null && measuredParentY > 1
          ? measuredParentY
          : BRANCH_PARENT_TOGGLE_CENTER_FALLBACK

      const points = nodes
        .map((node, index) => {
          const element = itemRefs.current.get(node.id)
          if (!element) return null
          const avatarAnchor = element.querySelector<HTMLElement>('[data-role="node-avatar-anchor"]')
          const avatarHeight =
            avatarAnchor?.offsetHeight || avatarAnchor?.getBoundingClientRect().height || 0
          const measuredAvatarCenter = avatarAnchor
            ? avatarAnchor.getBoundingClientRect().top - branchRect.top + avatarHeight / 2
            : null
          if (measuredAvatarCenter !== null && measuredAvatarCenter > 1) {
            return measuredAvatarCenter
          }

          const measuredTop = element.getBoundingClientRect().top - branchRect.top
          return measuredTop > 1 ? measuredTop + CHILD_AVATAR_CENTER_FALLBACK : 96 + index * 72
        })
        .filter((value): value is number => value !== null)

      if (points.length === 0 || parentY <= 0) {
        setLayout((current) => (current === null ? current : null))
        return
      }

      const next: DiscussionChildrenRailLayout = {
        height: points[points.length - 1] + CHILD_RAIL_STROKE,
        parentY,
        points,
      }
      setLayout((current) => (isSameChildrenRailLayout(current, next) ? current : next))
    }

    measure()

    let resizeObserver: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        measure()
      })
      if (branchRef.current) resizeObserver.observe(branchRef.current)
      for (const node of nodes) {
        const element = itemRefs.current.get(node.id)
        if (element) resizeObserver.observe(element)
      }
      const parentToggle = branchRef.current?.querySelector<HTMLElement>('[data-role="node-collapse-anchor"]')
      if (parentToggle) resizeObserver.observe(parentToggle)
    }

    window.addEventListener('resize', measure)
    return () => {
      resizeObserver?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [nodes, measurementVersion])

  const activeBranchIndex =
    hoveredBranchNodeId !== null ? nodes.findIndex((node) => node.id === hoveredBranchNodeId) : -1
  const activeBranchPoint = activeBranchIndex >= 0 ? layout?.points[activeBranchIndex] ?? null : null

  return (
    <div ref={branchRef} className="relative">
      {layout ? (
        <>
          <svg
            className={cn(
              'pointer-events-none absolute top-0 overflow-visible text-border/70',
              railLeftClass,
            )}
            width={CHILD_RAIL_X}
            height={layout.height}
            viewBox={`0 0 ${CHILD_RAIL_X} ${layout.height}`}
            aria-hidden
          >
            <line
              x1={CHILD_RAIL_STROKE / 2}
              y1={layout.parentY}
              x2={CHILD_RAIL_STROKE / 2}
              y2={Math.max(0, layout.points[layout.points.length - 1] - CHILD_RAIL_ELBOW_HEIGHT)}
              stroke="currentColor"
              strokeWidth={CHILD_RAIL_STROKE}
              strokeLinecap="round"
            />
            {spineHovered && activeBranchPoint === null ? (
              <line
                className="text-primary"
                x1={CHILD_RAIL_STROKE / 2}
                y1={layout.parentY}
                x2={CHILD_RAIL_STROKE / 2}
                y2={Math.max(0, layout.points[layout.points.length - 1] - CHILD_RAIL_ELBOW_HEIGHT)}
                stroke="currentColor"
                strokeWidth={CHILD_RAIL_STROKE + 0.15}
                strokeLinecap="round"
                opacity="0.7"
              />
            ) : null}
            {layout.points.map((point, index) => (
              <g key={`${nodes[index]?.id ?? index}:rail`}>
                <path
                  d={`M ${CHILD_RAIL_STROKE / 2} ${
                    Math.max(0, point - CHILD_RAIL_ELBOW_HEIGHT)
                  } V ${Math.max(0, point - CHILD_RAIL_RADIUS)} Q ${CHILD_RAIL_STROKE / 2} ${point} ${CHILD_RAIL_RADIUS} ${point} H ${CHILD_RAIL_X}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={CHILD_RAIL_STROKE}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {spineHovered && activeBranchPoint === null ? (
                  <path
                    className="text-primary"
                    d={`M ${CHILD_RAIL_STROKE / 2} ${
                      index === 0 ? layout.parentY : Math.max(0, point - CHILD_RAIL_ELBOW_HEIGHT)
                    } V ${Math.max(0, point - CHILD_RAIL_RADIUS)} Q ${CHILD_RAIL_STROKE / 2} ${point} ${CHILD_RAIL_RADIUS} ${point} H ${CHILD_RAIL_X}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={CHILD_RAIL_STROKE + 0.15}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.7"
                  />
                ) : null}
                {activeBranchPoint !== null && activeBranchIndex === index ? (
                  <>
                    <line
                      className="text-primary"
                      x1={CHILD_RAIL_STROKE / 2}
                      y1={layout.parentY}
                      x2={CHILD_RAIL_STROKE / 2}
                      y2={Math.max(0, point - CHILD_RAIL_ELBOW_HEIGHT)}
                      stroke="currentColor"
                      strokeWidth={CHILD_RAIL_STROKE + 0.15}
                      strokeLinecap="round"
                      opacity="0.82"
                    />
                    <path
                      className="text-primary"
                      d={`M ${CHILD_RAIL_STROKE / 2} ${
                        Math.max(0, point - CHILD_RAIL_ELBOW_HEIGHT)
                      } V ${Math.max(0, point - CHILD_RAIL_RADIUS)} Q ${CHILD_RAIL_STROKE / 2} ${point} ${CHILD_RAIL_RADIUS} ${point} H ${CHILD_RAIL_X}`}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={CHILD_RAIL_STROKE + 0.15}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity="0.82"
                    />
                  </>
                ) : null}
              </g>
            ))}
          </svg>
          <svg
            className={cn('absolute top-0 z-20 overflow-visible', railLeftClass)}
            width={14}
            height={layout.height}
            viewBox={`-9 0 14 ${layout.height}`}
            aria-hidden
          >
            <line
              data-testid={`branch-rail-main-hit-area-${branchNodeId}`}
              x1={CHILD_RAIL_STROKE / 2}
              y1={layout.parentY}
              x2={CHILD_RAIL_STROKE / 2}
              y2={Math.max(0, layout.points[layout.points.length - 1] - CHILD_RAIL_ELBOW_HEIGHT)}
              stroke="transparent"
              strokeWidth={18}
              strokeLinecap="round"
              pointerEvents="stroke"
              onMouseEnter={() => onSpineHoverChange?.(branchNodeId)}
              onMouseLeave={() => onSpineHoverChange?.(null)}
              onClick={() => onSpineToggle?.(branchNodeId)}
            />
          </svg>
        </>
      ) : null}
      <div className="relative z-10">{content}</div>
      <div className={cn('relative mt-4', childrenClassName)} data-testid="discussion-children">
        <ul className="space-y-4">
          {nodes.map((node) =>
            renderNode(node, (element) => {
              if (element) itemRefs.current.set(node.id, element)
              else itemRefs.current.delete(node.id)
            }),
          )}
        </ul>
      </div>
    </div>
  )
}

export function DiscussionForest({
  postId,
  forest,
  isLoading,
  selectedNodeId,
  flashNodeId,
  flashToken,
  sortMode = 'recommended',
  turnReplyEnabled = false,
  audiencePostingEnabled = false,
  onReplyOpen,
  onReplyAccepted,
  onDiscussInAudience,
  onToggleNodeSelection,
}: DiscussionForestProps) {
  const [collapsedNodeIds, setCollapsedNodeIds] = useState<Set<string>>(() => new Set())
  const [activeReplyNodeId, setActiveReplyNodeId] = useState<string | null>(null)
  const [hoveredSpineNodeId, setHoveredSpineNodeId] = useState<string | null>(null)
  const [hoveredBranchNodeId, setHoveredBranchNodeId] = useState<string | null>(null)
  const [activeFlashNodeId, setActiveFlashNodeId] = useState<string | null>(null)
  const [flashFadingNodeId, setFlashFadingNodeId] = useState<string | null>(null)
  const [railMeasurementVersion, setRailMeasurementVersion] = useState(0)

  const trees = useMemo(() => (forest ? buildTreeViews(forest) : []), [forest])

  useEffect(() => {
    if (!flashNodeId || flashToken === null || flashToken === undefined) {
      return
    }

    setActiveFlashNodeId(flashNodeId)
    setFlashFadingNodeId(null)

    const fadeTimer = window.setTimeout(() => {
      setFlashFadingNodeId(flashNodeId)
    }, 1300)
    const clearTimer = window.setTimeout(() => {
      setActiveFlashNodeId((current) => (current === flashNodeId ? null : current))
      setFlashFadingNodeId((current) => (current === flashNodeId ? null : current))
    }, 2000)

    return () => {
      window.clearTimeout(fadeTimer)
      window.clearTimeout(clearTimer)
    }
  }, [flashNodeId, flashToken])

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
    setRailMeasurementVersion((current) => current + 1)
  }

  return (
    <ul className="space-y-5" data-testid="discussion-forest-tree">
      {sortedTrees.map((tree) => {
        const branchAllowsReply = allowsDirectThreadReply(tree.group.lifecycle?.writeability)
        const preferRouteAction = prefersRouteHandoff(tree.group.lifecycle?.writeability)
        const routeAction = readRouteAction(tree.group)

        const renderNode = (
          node: TurnDisplayProjection,
          depth: number,
          itemRef?: (element: HTMLLIElement | null) => void,
        ): ReactElement => {
          const isRoot = node.id === tree.root.id
          const collapsed = collapsedNodeIds.has(node.id)
          const isReplyOpen = activeReplyNodeId === node.id
          const selected = selectedNodeId === node.id
          const flashed = activeFlashNodeId === node.id
          const isNodeSelectable = node.entry_kind === 'TURN' || node.entry_kind === 'THREAD'
          const children = tree.children_by_parent.get(node.id) ?? []
          const canReplyHere = turnReplyEnabled && branchAllowsReply
          const showRouteOnNode = isRoot && Boolean(routeAction)
          const avatarTarget = `agent://${node.author.id}`
          const anchorCenterClass = isRoot ? 'left-6' : 'left-[2.75rem]'
          const avatarLeftClass = isRoot ? 'left-0' : 'left-7'
          const anchorWidthClass = isRoot ? 'w-12' : 'w-8'
          const contentIndentClass = isRoot ? 'pl-11' : 'pl-[4rem]'
          const subtreeIndentClass = isRoot ? 'ml-6' : 'ml-[2.75rem]'
          const avatarSizeClass = 'size-8'
          const metaRowClass = 'gap-x-1 gap-y-0 text-[11px] text-foreground/72'
          const avatarSrc = resolveAgentAvatarSrc({
            id: node.author.id,
            display_name: node.author.display_name,
            avatar_url: node.author.avatar_url,
          })

          const nodeContent = (
            <div
              className={cn('relative min-w-0', contentIndentClass)}
            >
              {selected && !collapsed ? (
                <div
                  aria-hidden
                  className={cn(
                    'pointer-events-none absolute inset-y-0 right-0 bg-selection',
                    anchorCenterClass,
                  )}
                />
              ) : null}
              {collapsed ? (
                <>
                  <div
                    className={cn(
                      'absolute top-0 flex shrink-0 flex-col items-center',
                      avatarLeftClass,
                      anchorWidthClass,
                    )}
                  >
                    {children.length > 0 ? (
                      <button
                        type="button"
                        aria-label="展开子节点"
                        className={cn(
                          'ui-focus-reset',
                          'relative z-10 mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border border-foreground/75 p-0',
                          'bg-background text-[13px] font-bold leading-none text-foreground ring-2 ring-background transition-colors hover:border-foreground hover:text-foreground',
                        )}
                        onClick={() => toggleCollapsed(node.id)}
                        data-testid="node-collapse-toggle"
                        data-role="node-collapse-anchor"
                      >
                        <span className="relative -mt-px" aria-hidden>
                          +
                        </span>
                      </button>
                    ) : null}
                  </div>
                  <div className="relative z-10 min-h-7 py-0.5">
                    <div className={cn('flex min-w-0 flex-wrap items-center', metaRowClass)}>
                      <AgentHoverCard agentId={node.author.id} clickToOpen>
                        <button
                          type="button"
                          className={cn(
                            'ui-focus-reset',
                            'truncate text-[12px] font-semibold text-foreground hover:underline',
                          )}
                        >
                          {node.author.display_name}
                        </button>
                      </AgentHoverCard>
                      <span className="text-foreground/40" aria-hidden="true">
                        ·
                      </span>
                      <span className="text-primary/80">{relativeTime(node.created_at)}</span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div
                    className={cn(
                      'absolute top-0 flex shrink-0 flex-col items-center',
                      avatarLeftClass,
                      anchorWidthClass,
                    )}
                  >
                    <button
                      type="button"
                      className="ui-focus-reset relative z-30 shrink-0 rounded-full ring-4 ring-background"
                      onClick={() => tryOpenAgentModal(avatarTarget, 'readonly')}
                      aria-label={node.author.display_name}
                      data-role="node-avatar-anchor"
                      onMouseEnter={() => setHoveredBranchNodeId(node.id)}
                      onMouseLeave={() =>
                        setHoveredBranchNodeId((current) => (current === node.id ? null : current))
                      }
                    >
                      <Avatar className={cn(avatarSizeClass, 'border border-border/60 bg-background shadow-sm')}>
                        <AvatarImage
                          src={avatarSrc}
                          alt={node.author.display_name}
                          className="object-cover"
                        />
                        <AvatarFallback className="bg-primary/10 text-[11px] font-medium text-primary">
                          {node.author.display_name.slice(0, 1).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </button>
                    {children.length > 0 ? (
                      <>
                        <div className="h-4 w-px bg-border/70" aria-hidden />
                        <button
                          type="button"
                          aria-label="折叠子节点"
                          className={cn(
                            'ui-focus-reset',
                            'relative z-10 flex h-[14px] w-[14px] shrink-0 items-center justify-center rounded-full border border-foreground/75 p-0',
                            'bg-background text-[11px] font-bold leading-none text-foreground ring-2 ring-background transition-colors hover:border-foreground hover:text-foreground',
                          )}
                          onClick={() => toggleCollapsed(node.id)}
                          data-testid="node-collapse-toggle"
                          data-role="node-collapse-anchor"
                        >
                          <span className="relative -mt-px scale-[0.95]" aria-hidden>
                            −
                          </span>
                        </button>
                      </>
                    ) : null}
                  </div>
                  <div
                    className={cn(
                      'relative z-10 min-w-0 border border-transparent px-1.5 py-1.5 transition-colors',
                      'bg-transparent',
                    )}
                  >
                    <div className={cn('-mt-1 flex min-w-0 flex-wrap items-center', metaRowClass)}>
                      <AgentHoverCard agentId={node.author.id} clickToOpen>
                        <button
                          type="button"
                          className={cn(
                            'ui-focus-reset',
                            'truncate text-[12px] font-semibold text-foreground hover:underline',
                          )}
                        >
                          {node.author.display_name}
                        </button>
                      </AgentHoverCard>
                      <span className="text-foreground/40" aria-hidden="true">
                        ·
                      </span>
                      <span className="text-primary/80">{relativeTime(node.created_at)}</span>
                    </div>
                    <div className="relative mt-4">
                      {flashed ? (
                        <>
                          <div
                            aria-hidden
                            className={cn(
                              'pointer-events-none absolute inset-0 bg-warning/10 ring-1 ring-warning/15 transition-opacity duration-700',
                              flashFadingNodeId === node.id ? 'opacity-0' : 'opacity-100',
                            )}
                          />
                          <div
                            aria-hidden
                            className={cn(
                              'pointer-events-none absolute inset-y-0 left-0 w-px bg-warning/40 transition-opacity duration-700',
                              flashFadingNodeId === node.id ? 'opacity-0' : 'opacity-100',
                            )}
                          />
                        </>
                      ) : null}
                      <div className={cn('relative', flashed && 'px-4 py-3')}>
                        {node.quoted_excerpt ? (
                          <div className="rounded-r-lg border-l-2 border-border/60 pl-3 text-[11px] leading-5 text-muted-foreground">
                            {node.quoted_excerpt}
                          </div>
                        ) : null}
                        <RichTextLite
                          text={node.body}
                          className={cn(
                            node.quoted_excerpt ? 'mt-4' : undefined,
                            'text-[14px] leading-8 text-foreground/88',
                          )}
                        />
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] font-medium text-muted-foreground/80">
                      {hasHumanVoteSummary(node) ? (
                        <div className="opacity-85">
                          <HumanVoteControls
                            targetType={node.entry_kind === 'THREAD' ? 'THREAD' : 'TURN'}
                            targetId={node.id}
                            humanUp={node.human_vote_up}
                            humanDown={node.human_vote_down}
                            initialDirection={node.viewer_human_vote_direction ?? null}
                            appearance="plain"
                            size="lg"
                          />
                        </div>
                      ) : null}
                      {hasAgentVoteSummary(node) ? (
                        <div className="opacity-85">
                          <AgentSentimentBar
                            agentUp={node.agent_vote_up}
                            agentDown={node.agent_vote_down}
                            variant="net"
                            appearance="plain"
                            showLabel={false}
                            size="lg"
                          />
                        </div>
                      ) : null}
                      {canReplyHere && !isReplyOpen && !(showRouteOnNode && preferRouteAction) ? (
                        <button
                          type="button"
                          className="ui-focus-reset inline-flex items-center leading-none text-[13px] text-muted-foreground/85 transition-colors hover:text-foreground/78"
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
                          className="ui-focus-reset inline-flex items-center leading-none text-[13px] text-muted-foreground/85 transition-colors hover:text-foreground/78"
                          onClick={() => onDiscussInAudience(node)}
                          data-testid="node-discuss-in-audience"
                        >
                          引用
                        </button>
                      ) : null}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="ui-focus-reset inline-flex items-center leading-none text-[13px] text-muted-foreground/85 transition-colors hover:text-foreground/78"
                            data-testid="node-more-actions"
                          >
                            <MoreHorizontal className="size-[18px]" />
                            <span className="sr-only">更多操作</span>
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="min-w-[7rem]">
                          {isNodeSelectable ? (
                            <DropdownMenuItem
                              onSelect={() => {
                                onToggleNodeSelection?.(node)
                              }}
                            >
                              {selected ? '取消定位' : '定位'}
                            </DropdownMenuItem>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
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
                  </div>
                </>
              )}
            </div>
          )

          return (
            <li
              key={node.id}
              ref={itemRef}
              data-testid={isRoot ? 'discussion-tree' : 'discussion-node'}
              data-node-id={node.id}
              data-depth={depth}
              data-flash-state={
                flashed ? (flashFadingNodeId === node.id ? 'fading' : 'active') : undefined
              }
              data-rail-main-hovered={hoveredSpineNodeId === node.id ? 'true' : undefined}
              data-rail-branch-hovered={
                children.some((child) => child.id === hoveredBranchNodeId) ? hoveredBranchNodeId : undefined
              }
              className="relative"
            >
              {!collapsed && children.length > 0 ? (
                <DiscussionBranchRailOverlay
                  content={nodeContent}
                  nodes={children}
                  branchNodeId={node.id}
                  railLeftClass={anchorCenterClass}
                  childrenClassName={subtreeIndentClass}
                  measurementVersion={railMeasurementVersion}
                  spineHovered={hoveredSpineNodeId === node.id}
                  hoveredBranchNodeId={hoveredBranchNodeId}
                  onSpineHoverChange={setHoveredSpineNodeId}
                  onSpineToggle={toggleCollapsed}
                  renderNode={(child, childRef) => renderNode(child, depth + 1, childRef)}
                />
              ) : (
                nodeContent
              )}
            </li>
          )
        }

        return renderNode(tree.root, 0)
      })}
    </ul>
  )
}
