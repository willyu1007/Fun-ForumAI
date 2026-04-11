import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import type {
  DiscussionBranchGroup,
  DiscussionForestProjection,
  TurnDisplayProjection,
} from '@/api/types'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { RichTextLite } from '@/shared/components/RichTextLite'
import { relativeTime } from '@/shared/utils/relative-time'
import { isAgentTargetString } from '@/shared/utils/agent-target'
import { resolveAgentAvatarSrc } from '@/shared/utils/preset-avatars'
import { readAuthorBadgeChips, readProjectionText } from '@/shared/utils/public-author'
import { tryOpenAgentModal } from '@/shared/stores/agent-modal-store'
import { cn } from '@/lib/utils'
import { allowsDirectThreadReply, prefersRouteHandoff } from '../lib/thread-writeability'

interface DiscussionForestProps {
  postId: string
  forest: DiscussionForestProjection | null
  isLoading?: boolean
  selectedNodeId?: string | null
  composerAnchorNodeId?: string | null
  replyActionLabel?: string | null
  onSelectNode?: (
    node: TurnDisplayProjection,
    source: 'guide' | 'node' | 'reply',
  ) => void
  onBranchExpand?: (group: DiscussionBranchGroup) => void
}

interface DiscussionClusterView {
  id: string
  thread_id: string
  group: DiscussionBranchGroup
  root_node: TurnDisplayProjection | null
  lead_node: TurnDisplayProjection
  nodes: TurnDisplayProjection[]
  participant_count: number
  turn_count: number
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
  leadNodeId: string,
  threadNodes: TurnDisplayProjection[],
): TurnDisplayProjection[] {
  const descendants = new Set<string>([leadNodeId])
  let changed = true
  while (changed) {
    changed = false
    for (const node of threadNodes) {
      if (!node.display_parent_id) continue
      if (!descendants.has(node.display_parent_id)) continue
      if (descendants.has(node.id)) continue
      descendants.add(node.id)
      changed = true
    }
  }
  return threadNodes.filter((node) => descendants.has(node.id))
}

function buildClusterViews(forest: DiscussionForestProjection): {
  clusters: DiscussionClusterView[]
  clusterIdByNodeId: Map<string, string>
} {
  const clusterIdByNodeId = new Map<string, string>()
  const clusters: DiscussionClusterView[] = []
  const nodesByThreadId = new Map<string, TurnDisplayProjection[]>()

  for (const node of forest.nodes) {
    const existing = nodesByThreadId.get(node.thread_id) ?? []
    existing.push(node)
    nodesByThreadId.set(node.thread_id, existing)
  }

  for (const group of forest.branch_groups) {
    const threadNodes = sortNodes(nodesByThreadId.get(group.thread_id) ?? [])
    const rootNode = threadNodes.find((node) => node.entry_kind === 'THREAD') ?? null
    const turnNodes = threadNodes.filter((node) => node.entry_kind === 'TURN')
    const leadNodes = rootNode
      ? turnNodes.filter((node) => node.display_parent_id === rootNode.id)
      : turnNodes

    if (leadNodes.length === 0 && rootNode) {
      const clusterId = `cluster:${group.thread_id}:root`
      clusterIdByNodeId.set(rootNode.id, clusterId)
      clusters.push({
        id: clusterId,
        thread_id: group.thread_id,
        group,
        root_node: rootNode,
        lead_node: rootNode,
        nodes: [rootNode],
        participant_count: 1,
        turn_count: 0,
        latest_activity_at: group.latest_activity_at,
      })
      continue
    }

    for (const [index, leadNode] of leadNodes.entries()) {
      const clusterNodes = sortNodes(collectSubtreeNodes(leadNode.id, threadNodes))
      const clusterId = `cluster:${group.thread_id}:${leadNode.id}`
      clusterIdByNodeId.set(leadNode.id, clusterId)
      if (index === 0 && rootNode) {
        clusterIdByNodeId.set(rootNode.id, clusterId)
      }
      for (const node of clusterNodes) {
        clusterIdByNodeId.set(node.id, clusterId)
      }
      const latestActivityAt =
        [...clusterNodes]
          .sort((left, right) => right.created_at.localeCompare(left.created_at))[0]?.created_at
        ?? group.latest_activity_at
      clusters.push({
        id: clusterId,
        thread_id: group.thread_id,
        group,
        root_node: rootNode,
        lead_node: leadNode,
        nodes: clusterNodes,
        participant_count: new Set(clusterNodes.map((node) => node.author.id)).size,
        turn_count: clusterNodes.filter((node) => node.entry_kind === 'TURN').length,
        latest_activity_at: latestActivityAt,
      })
    }
  }

  return { clusters, clusterIdByNodeId }
}

function getCollapsedNodes(
  nodes: TurnDisplayProjection[],
  selectedNodeId: string | null | undefined,
): TurnDisplayProjection[] {
  if (nodes.length <= 2) return nodes
  const lead = nodes[0]
  const latest = [...nodes].reverse().find((node) => node.entry_kind === 'TURN') ?? nodes[nodes.length - 1]
  const selected = selectedNodeId
    ? nodes.find((node) => node.id === selectedNodeId) ?? null
    : null
  const visible = [lead, selected, latest].filter((node): node is TurnDisplayProjection => Boolean(node))
  const deduped: TurnDisplayProjection[] = []
  const seen = new Set<string>()
  for (const node of visible) {
    if (seen.has(node.id)) continue
    seen.add(node.id)
    deduped.push(node)
  }
  return deduped
}

function buildChildrenByParent(nodes: TurnDisplayProjection[]): Map<string, TurnDisplayProjection[]> {
  const map = new Map<string, TurnDisplayProjection[]>()
  for (const node of nodes) {
    const parentId = node.display_parent_id ?? '__root__'
    const bucket = map.get(parentId) ?? []
    bucket.push(node)
    map.set(parentId, bucket)
  }
  for (const [parentId, bucket] of map.entries()) {
    map.set(parentId, sortNodes(bucket))
  }
  return map
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

  if (!label || !target) {
    return null
  }

  return { label, target }
}

function readPlacementBadge(node: TurnDisplayProjection): string | null {
  if (node.is_late_entry || node.placement_reason === 'LATE_ENTRY_REATTACH') {
    return '稍后接回'
  }
  if (node.placement_reason === 'DEPTH_CLAMP') {
    return '承接上文'
  }
  return null
}

function renderRouteActionButton(routeAction: { label: string; target: string }) {
  if (isAgentTargetString(routeAction.target)) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs"
        onClick={() => {
          tryOpenAgentModal(routeAction.target, 'readonly')
        }}
      >
        {routeAction.label}
      </Button>
    )
  }
  if (routeAction.target.startsWith('/')) {
    return (
      <Button type="button" variant="ghost" size="sm" asChild className="h-7 px-2 text-xs">
        <Link to={routeAction.target}>{routeAction.label}</Link>
      </Button>
    )
  }
  return (
    <Button type="button" variant="ghost" size="sm" asChild className="h-7 px-2 text-xs">
      <a href={routeAction.target} target="_blank" rel="noreferrer">
        {routeAction.label}
      </a>
    </Button>
  )
}

function AuthorLine({
  node,
  compact = false,
  emphasizeBio = false,
  showProofChips = false,
}: {
  node: TurnDisplayProjection
  compact?: boolean
  emphasizeBio?: boolean
  showProofChips?: boolean
}) {
  const avatarSrc = resolveAgentAvatarSrc({
    id: node.author.id,
    display_name: node.author.display_name,
    avatar_url: node.author.avatar_url,
  })
  const { identityChip, proofChips } = readAuthorBadgeChips(node.author, {
    maxProofChips: showProofChips ? (compact ? 1 : 2) : 0,
    policyId: 'public_author_compact',
  })

  return (
    <div className="flex gap-3">
      <Avatar className={cn('mt-0.5 shrink-0', compact ? 'size-8' : 'size-9')}>
        <AvatarImage src={avatarSrc} alt={node.author.display_name} className="object-cover" />
        <AvatarFallback className="bg-primary/10 text-[11px] text-primary">
          {node.author.display_name.slice(0, 1).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{node.author.display_name}</span>
          {identityChip ? (
            <Badge variant="outline" className="px-1 py-0 text-[9px]">
              {identityChip}
            </Badge>
          ) : null}
          {showProofChips
            ? proofChips.map((badge) => (
                <Badge key={`${node.id}:${badge}`} variant="secondary" className="px-1 py-0 text-[9px]">
                  {badge}
                </Badge>
              ))
            : null}
          <span>·</span>
          <span>{relativeTime(node.created_at)}</span>
          <span>·</span>
          <span>{node.entry_kind === 'THREAD' ? '分支开场' : '后续发言'}</span>
        </div>
        {emphasizeBio && readProjectionText(node.author) ? (
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{readProjectionText(node.author)}</p>
        ) : null}
      </div>
    </div>
  )
}

export function DiscussionForest({
  postId,
  forest,
  isLoading,
  selectedNodeId,
  composerAnchorNodeId,
  replyActionLabel,
  onSelectNode,
  onBranchExpand,
}: DiscussionForestProps) {
  const [expandedByClusterId, setExpandedByClusterId] = useState<Record<string, boolean>>({})
  const guideEntries = forest?.reading_guide.entries ?? []

  const { clusters, clusterIdByNodeId } = useMemo(() => {
    if (!forest) {
      return {
        clusters: [] as DiscussionClusterView[],
        clusterIdByNodeId: new Map<string, string>(),
      }
    }
    return buildClusterViews(forest)
  }, [forest])

  useEffect(() => {
    if (!forest || clusters.length === 0) return
    const preferredClusterId =
      (selectedNodeId ? clusterIdByNodeId.get(selectedNodeId) : null)
      ?? (forest.focus_turn_id ? clusterIdByNodeId.get(forest.focus_turn_id) : null)
      ?? (forest.focus_thread_id ? clusterIdByNodeId.get(forest.focus_thread_id) : null)
      ?? (forest.reading_guide.start_here_thread_ids[0]
        ? clusterIdByNodeId.get(forest.reading_guide.start_here_thread_ids[0])
        : null)
      ?? clusters[0]?.id
      ?? null
    if (!preferredClusterId) return
    setExpandedByClusterId((current) => (
      Object.keys(current).length > 0
        ? current
        : { [preferredClusterId]: true }
    ))
  }, [clusterIdByNodeId, clusters, forest, selectedNodeId])

  useEffect(() => {
    if (!selectedNodeId) return
    const clusterId = clusterIdByNodeId.get(selectedNodeId)
    if (!clusterId) return
    setExpandedByClusterId((current) => ({
      ...current,
      [clusterId]: true,
    }))
  }, [clusterIdByNodeId, selectedNodeId])

  const sortedClusters = useMemo(() => {
    const selectedClusterId = selectedNodeId ? clusterIdByNodeId.get(selectedNodeId) ?? null : null
    const composerClusterId = composerAnchorNodeId ? clusterIdByNodeId.get(composerAnchorNodeId) ?? null : null
    return [...clusters].sort((left, right) => {
      const leftPriority =
        left.id === composerClusterId ? 0
          : left.id === selectedClusterId ? 1
            : left.thread_id === forest?.focus_thread_id ? 2
              : 3
      const rightPriority =
        right.id === composerClusterId ? 0
          : right.id === selectedClusterId ? 1
            : right.thread_id === forest?.focus_thread_id ? 2
              : 3
      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority
      }
      return right.latest_activity_at.localeCompare(left.latest_activity_at)
    })
  }, [clusterIdByNodeId, clusters, composerAnchorNodeId, forest?.focus_thread_id, selectedNodeId])

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    )
  }

  if (!forest || sortedClusters.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 bg-muted/15 p-5 text-sm text-muted-foreground">
        还没有可展开的公开讨论分支。
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-border/60 bg-muted/15 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground">
              公共观看摘要
            </p>
            <h2 className="mt-1 text-base font-semibold text-foreground">先看这些公开支线</h2>
            {forest.reading_guide.summary_line ? (
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {forest.reading_guide.summary_line}
              </p>
            ) : null}
          </div>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {guideEntries.map((entry, index) => {
            const focusNode = forest.nodes.find((node) => node.id === (entry.focus_turn_id ?? entry.thread_id)) ?? null
            const { identityChip, proofChips } = focusNode
              ? readAuthorBadgeChips(focusNode.author, { maxProofChips: 1, policyId: 'public_author_compact' })
              : { identityChip: null, proofChips: [] }
            return (
              <button
                key={entry.id}
                type="button"
                className="rounded-xl border border-border/60 bg-background/80 p-4 text-left transition-colors hover:border-foreground/20"
                onClick={() => {
                  const node = focusNode ?? forest.nodes.find((item) => item.id === entry.thread_id) ?? null
                  if (!node) return
                  const clusterId = clusterIdByNodeId.get(node.id)
                  if (clusterId) {
                    setExpandedByClusterId((current) => ({ ...current, [clusterId]: true }))
                  }
                  onSelectNode?.(node, 'guide')
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">{entry.title || `观看入口 ${index + 1}`}</p>
                  <span className="text-[11px] text-muted-foreground">{relativeTime(entry.latest_activity_at)}</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-foreground/80">{entry.teaser}</p>
                {focusNode ? (
                  <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className="font-medium text-foreground">{focusNode.author.display_name}</span>
                    {identityChip ? (
                      <Badge variant="outline" className="px-1 py-0 text-[9px]">
                        {identityChip}
                      </Badge>
                    ) : null}
                    {proofChips.map((badge) => (
                      <Badge key={`${entry.id}:${badge}`} variant="secondary" className="px-1 py-0 text-[9px]">
                        {badge}
                      </Badge>
                    ))}
                  </div>
                ) : null}
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <span>{entry.participant_count} 位参与者</span>
                  <span>·</span>
                  <span>{entry.turn_count} 条后续发言</span>
                </div>
              </button>
            )
          })}
        </div>
      </section>

      <section className="space-y-4">
        {sortedClusters.map((cluster) => {
          const expanded = expandedByClusterId[cluster.id] ?? false
          const displayedNodes = expanded ? cluster.nodes : getCollapsedNodes(cluster.nodes, selectedNodeId)
          const childrenByParent = buildChildrenByParent(displayedNodes)
          const routeAction = readRouteAction(cluster.group)
          const canReplyInThread =
            Boolean(replyActionLabel) && allowsDirectThreadReply(cluster.group.lifecycle?.writeability)
          const preferRouteAction = prefersRouteHandoff(cluster.group.lifecycle?.writeability)
          const rootNodes = displayedNodes.filter((node) =>
            node.id === cluster.lead_node.id
            || !displayedNodes.some((candidate) => candidate.id === node.display_parent_id))

          const renderNode = (node: TurnDisplayProjection, depth: number) => {
            const selected = selectedNodeId === node.id
            const isComposerAnchor = composerAnchorNodeId === node.id
            const showRouteAction = Boolean(routeAction) && node.id === cluster.lead_node.id
            const placementBadge = readPlacementBadge(node)
            const anchorChainCount = node.collapsed_anchor_chain.length

            return (
              <div key={node.id} className="space-y-3">
                <article
                  className={cn(
                    'rounded-xl border border-border/50 bg-background/95 p-4',
                    depth === 1 && 'ml-4',
                    depth >= 2 && 'ml-8',
                    selected && 'border-primary/40 bg-primary/5',
                    isComposerAnchor && 'border-success/40 bg-success/10',
                  )}
                >
                  <AuthorLine
                    node={node}
                    compact={!selected}
                    emphasizeBio={selected}
                    showProofChips={selected}
                  />
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="text-[11px] text-muted-foreground">
                      {node.entry_kind === 'THREAD' ? '分支开场' : '沿着这个点继续'}
                    </span>
                    {selected ? (
                      <Badge variant="outline" className="px-1 py-0 text-[9px]">
                        当前聚焦
                      </Badge>
                    ) : null}
                    {isComposerAnchor ? (
                      <Badge variant="secondary" className="px-1 py-0 text-[9px]">
                        准备回应
                      </Badge>
                    ) : null}
                    {placementBadge ? (
                      <Badge variant="outline" className="px-1 py-0 text-[9px]">
                        {placementBadge}
                      </Badge>
                    ) : null}
                  </div>
                  {node.quoted_excerpt ? (
                    <div className="mt-3 rounded-lg border border-dashed border-border/60 bg-muted/25 px-3 py-2 text-xs text-muted-foreground">
                      {node.quoted_excerpt}
                    </div>
                  ) : null}
                  <RichTextLite text={node.body} className="mt-3 text-sm leading-7 text-foreground/85" />
                  {anchorChainCount > 0 ? (
                    <p className="mt-3 text-[11px] text-muted-foreground">
                      承接更早的 {anchorChainCount} 处上下文
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="flex-1" />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => onSelectNode?.(node, 'node')}
                    >
                      聚焦
                    </Button>
                    {preferRouteAction && routeAction && showRouteAction ? renderRouteActionButton(routeAction) : null}
                    {canReplyInThread ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => onSelectNode?.(node, 'reply')}
                      >
                        {replyActionLabel}
                      </Button>
                    ) : null}
                    {!preferRouteAction && routeAction && showRouteAction ? renderRouteActionButton(routeAction) : null}
                    <Button type="button" variant="ghost" size="sm" asChild className="h-7 px-2 text-xs">
                      <Link to={buildNodeHref(postId, node)}>定位</Link>
                    </Button>
                  </div>
                </article>
                {(childrenByParent.get(node.id) ?? []).map((child) => renderNode(child, depth + 1))}
              </div>
            )
          }

          return (
            <div
              key={cluster.id}
              data-testid="discussion-cluster"
              className="rounded-xl border border-border/60 bg-background/90 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/50 pb-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                      支线簇
                    </Badge>
                    {cluster.group.display_title?.trim() ? (
                      <p className="text-sm font-semibold text-foreground">{cluster.group.display_title}</p>
                    ) : (
                      <p className="text-sm font-semibold text-foreground">公开讨论分支</p>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {cluster.participant_count} 位参与者 · {cluster.turn_count} 条节点发言 · 更新于 {relativeTime(cluster.latest_activity_at)}
                  </p>
                  {cluster.root_node && cluster.root_node.id !== cluster.lead_node.id ? (
                    <p className="text-xs leading-5 text-muted-foreground">
                      同一条讨论会按不同支线靠近原点展开，方便沿点继续阅读。
                    </p>
                  ) : null}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => {
                    setExpandedByClusterId((current) => {
                      const nextExpanded = !expanded
                      if (nextExpanded) {
                        onBranchExpand?.(cluster.group)
                      }
                      return { ...current, [cluster.id]: nextExpanded }
                    })
                  }}
                >
                  {expanded ? '收起支线' : `展开支线 (${Math.max(cluster.nodes.length - displayedNodes.length, 0)} 更多)`}
                </Button>
              </div>
              <div className="mt-4 space-y-3">
                {rootNodes.map((node) => renderNode(node, node.id === cluster.lead_node.id ? 0 : 1))}
              </div>
            </div>
          )
        })}
      </section>
    </div>
  )
}
