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
import { resolveAgentAvatarSrc } from '@/shared/utils/preset-avatars'
import { readAuthorBadgeChips, readProjectionText } from '@/shared/utils/public-author'
import { cn } from '@/lib/utils'

interface DiscussionForestProps {
  postId: string
  forest: DiscussionForestProjection | null
  isLoading?: boolean
  selectedNodeId?: string | null
  replyActionLabel?: string | null
  onSelectNode?: (
    node: TurnDisplayProjection,
    source: 'guide' | 'node' | 'reply',
  ) => void
  onBranchExpand?: (group: DiscussionBranchGroup) => void
}

function buildNodeHref(postId: string, node: TurnDisplayProjection): string {
  if (node.entry_kind === 'THREAD') {
    return `/posts/${postId}?threadId=${node.thread_id}`
  }
  return `/posts/${postId}?threadId=${node.thread_id}&turnId=${node.id}`
}

function getGroupNodes(forest: DiscussionForestProjection, threadId: string): TurnDisplayProjection[] {
  return forest.nodes.filter((node) => node.thread_id === threadId)
}

function getCollapsedNodes(
  nodes: TurnDisplayProjection[],
  selectedNodeId: string | null | undefined,
): TurnDisplayProjection[] {
  if (nodes.length <= 2) return nodes
  const root = nodes[0]
  const latest = [...nodes].reverse().find((node) => node.entry_kind === 'TURN') ?? nodes[nodes.length - 1]
  const selected = selectedNodeId
    ? nodes.find((node) => node.id === selectedNodeId) ?? null
    : null
  const visible = [root, selected, latest].filter((node): node is TurnDisplayProjection => Boolean(node))
  const deduped: TurnDisplayProjection[] = []
  const seen = new Set<string>()
  for (const node of visible) {
    if (seen.has(node.id)) continue
    seen.add(node.id)
    deduped.push(node)
  }
  return deduped
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
  replyActionLabel,
  onSelectNode,
  onBranchExpand,
}: DiscussionForestProps) {
  const [expandedByThreadId, setExpandedByThreadId] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!forest) return
    const preferredThreadId =
      (selectedNodeId
        ? forest.nodes.find((node) => node.id === selectedNodeId)?.thread_id
        : null)
      ?? forest.focus_thread_id
      ?? forest.reading_guide.start_here_thread_ids[0]
      ?? forest.branch_groups[0]?.thread_id
      ?? null
    if (!preferredThreadId) return
    setExpandedByThreadId((current) => (
      Object.keys(current).length > 0
        ? current
        : { [preferredThreadId]: true }
    ))
  }, [forest, selectedNodeId])

  useEffect(() => {
    if (!forest || !selectedNodeId) return
    const selectedThreadId = forest.nodes.find((node) => node.id === selectedNodeId)?.thread_id
    if (!selectedThreadId) return
    setExpandedByThreadId((current) => ({
      ...current,
      [selectedThreadId]: true,
    }))
  }, [forest, selectedNodeId])

  const guideEntries = forest?.reading_guide.entries ?? []
  const groupNodesByThreadId = useMemo(() => {
    if (!forest) return new Map<string, TurnDisplayProjection[]>()
    return new Map(
      forest.branch_groups.map((group) => [group.thread_id, getGroupNodes(forest, group.thread_id)]),
    )
  }, [forest])

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    )
  }

  if (!forest || forest.branch_groups.length === 0) {
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
                  setExpandedByThreadId((current) => ({ ...current, [entry.thread_id]: true }))
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
        {forest.branch_groups.map((group) => {
          const nodes = groupNodesByThreadId.get(group.thread_id) ?? []
          const expanded = expandedByThreadId[group.thread_id] ?? false
          const displayedNodes = expanded ? nodes : getCollapsedNodes(nodes, selectedNodeId)
          const rootNode = nodes[0] ?? null

          return (
            <div key={group.id} className="rounded-2xl border border-border/60 bg-background/90 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/50 pb-3">
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-semibold text-foreground">
                    {group.display_title?.trim() || '公开讨论分支'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {group.participant_count} 位参与者 · {group.turn_count} 条后续发言 · 更新于 {relativeTime(group.latest_activity_at)}
                  </p>
                  {rootNode ? (
                    <div className="pt-1">
                      <AuthorLine node={rootNode} compact showProofChips />
                    </div>
                  ) : null}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => {
                    setExpandedByThreadId((current) => {
                      const nextExpanded = !expanded
                      if (nextExpanded) {
                        onBranchExpand?.(group)
                      }
                      return { ...current, [group.thread_id]: nextExpanded }
                    })
                  }}
                >
                  {expanded ? '收起分支' : `展开分支 (${Math.max(nodes.length - displayedNodes.length, 0)} 更多)`}
                </Button>
              </div>
              <div className="mt-4 space-y-3">
                {displayedNodes.map((node) => {
                  const selected = selectedNodeId === node.id
                  return (
                    <article
                      key={node.id}
                      className={cn(
                        'rounded-xl border border-border/50 bg-background/95 p-4',
                        node.display_depth === 1 && 'ml-4',
                        node.display_depth === 2 && 'ml-8',
                        selected && 'border-primary/40 bg-primary/5',
                      )}
                    >
                      <AuthorLine
                        node={node}
                        compact={!selected}
                        emphasizeBio={selected}
                        showProofChips={selected}
                      />
                      {node.quoted_excerpt ? (
                        <div className="mt-3 rounded-lg border border-dashed border-border/60 bg-muted/25 px-3 py-2 text-xs text-muted-foreground">
                          {node.quoted_excerpt}
                        </div>
                      ) : null}
                      <RichTextLite text={node.body} className="mt-3 text-sm leading-7 text-foreground/85" />
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="text-[11px] text-muted-foreground">
                          {node.entry_kind === 'THREAD' ? '分支开场' : '继续围绕这一点推进'}
                        </span>
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
                        {replyActionLabel ? (
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
                        <Button type="button" variant="ghost" size="sm" asChild className="h-7 px-2 text-xs">
                          <Link to={buildNodeHref(postId, node)}>定位</Link>
                        </Button>
                      </div>
                    </article>
                  )
                })}
              </div>
            </div>
          )
        })}
      </section>
    </div>
  )
}
