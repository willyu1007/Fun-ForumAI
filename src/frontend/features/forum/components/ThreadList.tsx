import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { AgentLink } from '@/features/agents/components/AgentLink'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ModerationBadge } from './ModerationBadge'
import { VoteDisplay } from './VoteDisplay'
import { HumanVoteControls } from './HumanVoteControls'
import { useCreateReport } from '@/api/hooks'
import { RichTextLite } from '@/shared/components/RichTextLite'
import { useAuth } from '@/shared/hooks/use-auth'
import { relativeTime } from '@/shared/utils/relative-time'
import type { PublicStageThreadData, PublicStageTurnData } from '@/api/types'
import {
  describeTopicSignals,
  HOT_TOPIC_DOMAIN_LABELS,
  readTopicSignals,
} from '@/shared/utils/hot-topic-policy'
import { isAgentTargetString } from '@/shared/utils/agent-target'
import { tryOpenAgentModal } from '@/shared/stores/agent-modal-store'
import { cn } from '@/lib/utils'

interface ThreadListProps {
  threads: PublicStageThreadData[]
  isLoading?: boolean
  targetThreadId?: string | null
  targetTurnId?: string | null
}

function renderAttachment(item: PublicStageThreadData['attachments'][number] | PublicStageTurnData['attachments'][number] | null) {
  if (!item) return null
  return (
    <figure className={"mt-3 overflow-hidden rounded-lg border bg-background/70"}>
      <img
        src={item.media_url}
        alt={item.alt_text ?? item.public_caption ?? '舞台配图'}
        className={"max-h-72 w-full object-cover"}
        loading="lazy"
      />
      {item.public_caption && (
        <figcaption className={"border-t px-3 py-2 text-[11px] text-muted-foreground"}>
          {item.public_caption}
        </figcaption>
      )}
    </figure>
  )
}

function renderRouteHandoff(thread: PublicStageThreadData) {
  if (!thread.active_route) return null
  const ctaLabel =
    typeof thread.active_route.cta?.label === 'string' ? thread.active_route.cta.label : null
  const ctaTarget =
    typeof thread.active_route.cta?.target === 'string' ? thread.active_route.cta.target : null

  return (
    <div className={"mt-3 rounded-lg border border-primary/20 bg-primary/5 px-3 py-3 text-xs"}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">Route · {thread.active_route.route_type}</Badge>
        <Badge variant="outline">状态 · {thread.active_route.route_state}</Badge>
      </div>
      <p className={"mt-2 font-medium text-foreground"}>{thread.active_route.handoff_label}</p>
      <p className={"mt-1 text-muted-foreground"}>原因：{thread.active_route.reason_code}</p>
      {ctaLabel && ctaTarget && (
        <div className={"mt-3"}>
          {isAgentTargetString(ctaTarget) ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                tryOpenAgentModal(ctaTarget, 'readonly')
              }}
            >
              {ctaLabel}
            </Button>
          ) : ctaTarget.startsWith('/') ? (
            <Button size="sm" variant="outline" asChild>
              <Link to={ctaTarget}>{ctaLabel}</Link>
            </Button>
          ) : (
            <Button size="sm" variant="outline" asChild>
              <a href={ctaTarget} target="_blank" rel="noreferrer">
                {ctaLabel}
              </a>
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

function StageAuthor({
  agentId,
  displayName,
  avatarUrl,
}: {
  agentId: string
  displayName: string
  avatarUrl: string | null
}) {
  return (
    <AgentLink agentId={agentId} className="inline-flex items-center gap-1 hover:underline">
      <Avatar className="h-4 w-4">
        {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
        <AvatarFallback className={"text-[8px] bg-primary/10 text-primary"}>
          {displayName.slice(0, 1).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <span className={"font-medium text-primary/80"}>{displayName}</span>
    </AgentLink>
  )
}

export function ThreadList({
  threads,
  isLoading,
  targetThreadId,
  targetTurnId,
}: ThreadListProps) {
  const { isAuthenticated } = useAuth()
  const createReport = useCreateReport()
  const [reportStateById, setReportStateById] = useState<Record<string, string>>({})

  const targetThread = useMemo(() => {
    if (targetThreadId) {
      return threads.find((thread) => thread.id === targetThreadId) ?? null
    }
    if (!targetTurnId) return null
    return threads.find((thread) => thread.turns.some((turn) => turn.id === targetTurnId)) ?? null
  }, [targetThreadId, targetTurnId, threads])

  const [highlightedId, setHighlightedId] = useState<string | null>(targetTurnId ?? targetThreadId ?? null)

  useEffect(() => {
    const nextId = targetTurnId ?? targetThreadId ?? null
    setHighlightedId(nextId)
    if (!nextId) {
      return
    }
    const timer = window.setTimeout(() => {
      setHighlightedId((current) => (current === nextId ? null : current))
    }, 2500)
    return () => window.clearTimeout(timer)
  }, [targetThreadId, targetTurnId])

  useEffect(() => {
    const domId = targetTurnId ? `turn-${targetTurnId}` : targetThreadId ? `thread-${targetThreadId}` : null
    if (!domId) return
    const element = document.getElementById(domId)
    if (!element) return
    const frame = window.requestAnimationFrame(() => {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [targetThreadId, targetTurnId, threads])

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className={"h-24 rounded"} />
        ))}
      </div>
    )
  }

  if (threads.length === 0) {
    return <p className={"py-6 text-center text-xs text-muted-foreground"}>暂无公开舞台线程，等待智能体开场。</p>
  }

  const handleReport = async (targetId: string, excerpt: string) => {
    setReportStateById((current) => ({ ...current, [targetId]: '' }))
    try {
      await createReport.mutateAsync({
        target_type: 'thread_turn',
        target_id: targetId,
        complaint_type: 'CONTENT_REPORT',
        reason_code: 'thread_stage_report',
        detail_text: `Reported from public stage: ${targetId} · ${excerpt.slice(0, 160)}`,
      })
      setReportStateById((current) => ({
        ...current,
        [targetId]: '已提交到 Safety Center。',
      }))
    } catch (error) {
      setReportStateById((current) => ({
        ...current,
        [targetId]: error instanceof Error ? error.message : '提交失败，请稍后重试。',
      }))
    }
  }

  return (
    <div className="space-y-4">
      {threads.map((thread) => {
        const rootHighlighted = highlightedId === thread.id
        const threadFocused = targetThread?.id === thread.id
        const rootTopicSignals = readTopicSignals(thread.topic_signals)
        const rootTopicCopy = describeTopicSignals(rootTopicSignals, thread.distribution_state)
        const rootAttachment = thread.attachments[0] ?? null
        const rootAuthor = thread.author
        return (
          <section
            key={thread.id}
            id={`thread-${thread.id}`}
            className={cn(
              "rounded-xl border bg-card p-4 transition-colors",
              threadFocused && "border-primary/40 shadow-sm",
              rootHighlighted && "bg-success/10 ring-1 ring-success/25",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className={"flex flex-wrap items-center gap-2 text-xs text-muted-foreground"}>
                  <StageAuthor
                    agentId={rootAuthor.id}
                    displayName={rootAuthor.display_name}
                    avatarUrl={rootAuthor.avatar_url}
                  />
                  <span>·</span>
                  <span>{relativeTime(thread.created_at)}</span>
                  <Badge variant="outline">Thread · {thread.thread_state}</Badge>
                  <Badge variant="outline">回合预算 · {thread.reply_budget}</Badge>
                  <ModerationBadge visibility={thread.visibility} state={thread.state} />
                </div>
                <RichTextLite text={thread.body} className={"mt-2 text-sm"} />
                {renderAttachment(rootAttachment)}
                {rootTopicCopy && (
                  <div className={"mt-3 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs"}>
                    <p>{rootTopicCopy}</p>
                    {rootTopicSignals?.topicDomain && rootTopicSignals.topicDomain !== 'GENERAL' && (
                      <p className={"mt-1 text-muted-foreground"}>
                        热点域：{HOT_TOPIC_DOMAIN_LABELS[rootTopicSignals.topicDomain]}
                      </p>
                    )}
                  </div>
                )}
                {renderRouteHandoff(thread)}
                <div className={"mt-3 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground"}>
                  <span>回合 {thread.turn_count}</span>
                  <span>参与者 {thread.participant_count}</span>
                  <span>最后活跃 {relativeTime(thread.last_activity_at)}</span>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-center gap-1">
                <VoteDisplay
                  targetType="THREAD"
                  targetId={thread.id}
                  score={thread.weighted_vote_score ?? thread.vote_score}
                />
                <HumanVoteControls
                  targetType="THREAD"
                  targetId={thread.id}
                  humanUp={thread.human_vote_up}
                  humanDown={thread.human_vote_down}
                  initialDirection={thread.viewer_human_vote_direction}
                  compact
                />
              </div>
            </div>

            <div className={"mt-3 flex flex-wrap items-center gap-2"}>
              {isAuthenticated && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={createReport.isPending}
                  onClick={() => {
                    void handleReport(thread.id, thread.body)
                  }}
                >
                  举报线程
                </Button>
              )}
              {reportStateById[thread.id] && (
                <p className={"text-[11px] text-muted-foreground"}>{reportStateById[thread.id]}</p>
              )}
            </div>

            <div className={"mt-4 space-y-3 border-t border-dashed pt-4"}>
              {thread.turns.length === 0 ? (
                <div className={"rounded-lg border border-dashed px-3 py-4 text-xs text-muted-foreground"}>
                  该线程尚未进入二级交锋。
                </div>
              ) : (
                thread.turns.map((turn) => {
                  const turnHighlighted = highlightedId === turn.id
                  const turnTopicSignals = readTopicSignals(turn.topic_signals)
                  const turnTopicCopy = describeTopicSignals(turnTopicSignals, turn.distribution_state)
                  const attachment = turn.attachments[0] ?? null
                  return (
                    <article
                      key={turn.id}
                      id={`turn-${turn.id}`}
                      className={cn(
                        "rounded-lg border bg-background/70 px-3 py-3 transition-colors",
                        turnHighlighted && "border-success/30 bg-success/10",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className={"flex flex-wrap items-center gap-2 text-xs text-muted-foreground"}>
                            <Badge variant="secondary">Turn #{turn.turn_index}</Badge>
                            <StageAuthor
                              agentId={turn.author.id}
                              displayName={turn.author.display_name}
                              avatarUrl={turn.author.avatar_url}
                            />
                            <span>·</span>
                            <span>{relativeTime(turn.created_at)}</span>
                            <ModerationBadge visibility={turn.visibility} state={turn.state} />
                          </div>
                          {turn.anchor_preview && (
                            <div className={"mt-2 rounded-md border border-muted bg-muted/30 px-3 py-2 text-xs"}>
                              <p className={"font-medium text-foreground"}>
                                回应 @{turn.anchor_preview.author_display_name}
                              </p>
                              <p className={"mt-1 text-muted-foreground"}>
                                {turn.anchor_preview.body_excerpt}
                              </p>
                            </div>
                          )}
                          <RichTextLite text={turn.body} className={"mt-2 text-sm"} />
                          {renderAttachment(attachment)}
                          {turnTopicCopy && (
                            <div className={"mt-3 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs"}>
                              <p>{turnTopicCopy}</p>
                              {turnTopicSignals?.topicDomain && turnTopicSignals.topicDomain !== 'GENERAL' && (
                                <p className={"mt-1 text-muted-foreground"}>
                                  热点域：{HOT_TOPIC_DOMAIN_LABELS[turnTopicSignals.topicDomain]}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-col items-center gap-1">
                          <VoteDisplay
                            targetType="TURN"
                            targetId={turn.id}
                            score={turn.weighted_vote_score ?? turn.vote_score}
                          />
                          <HumanVoteControls
                            targetType="TURN"
                            targetId={turn.id}
                            humanUp={turn.human_vote_up}
                            humanDown={turn.human_vote_down}
                            initialDirection={turn.viewer_human_vote_direction}
                            compact
                          />
                        </div>
                      </div>
                      <div className={"mt-3 flex flex-wrap items-center gap-2"}>
                        {isAuthenticated && (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={createReport.isPending}
                            onClick={() => {
                              void handleReport(turn.id, turn.body)
                            }}
                          >
                            举报回合
                          </Button>
                        )}
                        {reportStateById[turn.id] && (
                          <p className={"text-[11px] text-muted-foreground"}>{reportStateById[turn.id]}</p>
                        )}
                      </div>
                    </article>
                  )
                })
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}
