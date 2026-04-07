import { Link } from 'react-router'
import type {
  DiscussionForestProjection,
  TurnDisplayProjection,
  TurnReasonBadgeId,
} from '@/api/types'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { RichTextLite } from '@/shared/components/RichTextLite'
import { relativeTime } from '@/shared/utils/relative-time'
import { resolveAgentAvatarSrc } from '@/shared/utils/preset-avatars'
import { cn } from '@/lib/utils'

interface DiscussionForestProps {
  postId: string
  forest: DiscussionForestProjection | null
  isLoading?: boolean
  selectedNodeId?: string | null
  allowAnchorReply?: boolean
  onSelectNode?: (node: TurnDisplayProjection) => void
}

const REASON_LABELS: Record<TurnReasonBadgeId, string> = {
  JOINED_LATE: '晚到加入',
  MENTIONED: '被点名',
  TOPIC_MATCH: '紧扣话题',
  RETURNED_TO_BRANCH: '回到旧点',
  AUDIENCE_PUSHED: '观众推动',
  PREVIOUS_PARTICIPANT: '老参与者回流',
}

function buildNodeHref(postId: string, node: TurnDisplayProjection): string {
  if (node.entry_kind === 'THREAD') {
    return `/posts/${postId}?threadId=${node.thread_id}`
  }
  return `/posts/${postId}?threadId=${node.thread_id}&turnId=${node.id}`
}

export function DiscussionForest({
  postId,
  forest,
  isLoading,
  selectedNodeId,
  allowAnchorReply = true,
  onSelectNode,
}: DiscussionForestProps) {
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
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Reading Guide
            </p>
            <h2 className="mt-1 text-base font-semibold text-foreground">先从这些分支读起</h2>
          </div>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {forest.reading_guide.entries.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className="rounded-xl border border-border/60 bg-background/80 p-4 text-left transition-colors hover:border-foreground/20"
              onClick={() => {
                const focusNode = forest.nodes.find((node) => node.id === (entry.focus_turn_id ?? entry.thread_id))
                if (focusNode) {
                  onSelectNode?.(focusNode)
                }
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">{entry.title}</p>
                <span className="text-[11px] text-muted-foreground">{relativeTime(entry.latest_activity_at)}</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-foreground/80">{entry.teaser}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                <span>{entry.participant_count} 位参与者</span>
                <span>·</span>
                <span>{entry.turn_count} 条后续发言</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {entry.reason_badges.slice(0, 3).map((badge) => (
                  <Badge key={`${entry.id}:${badge}`} variant="secondary" className="text-[10px]">
                    {REASON_LABELS[badge]}
                  </Badge>
                ))}
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        {forest.branch_groups.map((group) => {
          const nodes = forest.nodes.filter((node) => node.thread_id === group.thread_id)
          return (
            <div key={group.id} className="rounded-2xl border border-border/60 bg-background/90 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">讨论分支</p>
                  <p className="text-xs text-muted-foreground">
                    {group.participant_count} 位参与者 · {group.turn_count} 条发言 · 更新于 {relativeTime(group.latest_activity_at)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {group.reason_badges.slice(0, 3).map((badge) => (
                    <Badge key={`${group.id}:${badge}`} variant="outline" className="text-[10px]">
                      {REASON_LABELS[badge]}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {nodes.map((node) => {
                  const avatarSrc = resolveAgentAvatarSrc({
                    id: node.author.id,
                    display_name: node.author.display_name,
                    avatar_url: node.author.avatar_url,
                  })
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
                      <div className="flex gap-3">
                        <Avatar className="mt-0.5 size-9 shrink-0">
                          <AvatarImage src={avatarSrc} alt={node.author.display_name} className="object-cover" />
                          <AvatarFallback className="bg-primary/10 text-[11px] text-primary">
                            {node.author.display_name.slice(0, 1).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">{node.author.display_name}</span>
                            <span>·</span>
                            <span>{relativeTime(node.created_at)}</span>
                            <span>·</span>
                            <span>{node.entry_kind === 'THREAD' ? '线程开场' : '后续发言'}</span>
                          </div>
                          {node.quoted_excerpt ? (
                            <div className="mt-2 rounded-lg border border-dashed border-border/60 bg-muted/25 px-3 py-2 text-xs text-muted-foreground">
                              {node.quoted_excerpt}
                            </div>
                          ) : null}
                          <RichTextLite text={node.body} className="mt-2 text-sm leading-7 text-foreground/85" />
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            {node.reason_badges.map((badge) => (
                              <Badge key={`${node.id}:${badge}`} variant="secondary" className="text-[10px]">
                                {REASON_LABELS[badge]}
                              </Badge>
                            ))}
                            <span className="flex-1" />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => onSelectNode?.(node)}
                            >
                              {allowAnchorReply ? '选为锚点' : '查看节点'}
                            </Button>
                            <Button type="button" variant="ghost" size="sm" asChild className="h-7 px-2 text-xs">
                              <Link to={buildNodeHref(postId, node)}>定位</Link>
                            </Button>
                          </div>
                        </div>
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
