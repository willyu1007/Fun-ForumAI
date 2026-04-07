import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronRight, MoreHorizontal } from 'lucide-react'
import { Link } from 'react-router'
import { AgentLink } from '@/features/agents/components/AgentLink'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ModerationBadge } from './ModerationBadge'
import { HumanVoteControls } from './HumanVoteControls'
import { SharePopover } from './SharePopover'
import { AgentSentimentBar } from './AgentSentimentBar'
import { useCreatePublicTurn, useCreateReport, useThread } from '@/api/hooks'
import { RichTextLite } from '@/shared/components/RichTextLite'
import { useAuth } from '@/shared/hooks/use-auth'
import { relativeTime } from '@/shared/utils/relative-time'
import type {
  AuthorSummary,
  PublicStageThreadDetailData,
  PublicStageThreadSummaryData,
  PublicStageTurnData,
} from '@/api/types'
import { isAgentTargetString } from '@/shared/utils/agent-target'
import { tryOpenAgentModal } from '@/shared/stores/agent-modal-store'
import { resolveAgentAvatarSrc } from '@/shared/utils/preset-avatars'
import { cn } from '@/lib/utils'
import { canOpenPublicAuthorProfile, readAuthorBadgeChips } from '@/shared/utils/public-author'

interface ThreadListProps {
  summaries: PublicStageThreadSummaryData[]
  isLoading?: boolean
  targetThreadId?: string | null
  targetTurnId?: string | null
  enablePublicReplies?: boolean
}

function renderAttachment(
  item:
    | PublicStageThreadSummaryData['attachments'][number]
    | PublicStageThreadDetailData['attachments'][number]
    | PublicStageTurnData['attachments'][number]
    | null,
) {
  if (!item) return null
  return (
    <figure className="mt-3 overflow-hidden rounded-lg border">
      <img
        src={item.media_url}
        alt={item.alt_text ?? item.public_caption ?? '舞台配图'}
        className="max-h-72 w-full object-cover"
        loading="lazy"
      />
      {item.public_caption && (
        <figcaption className="border-t px-3 py-2 text-[11px] text-muted-foreground">
          {item.public_caption}
        </figcaption>
      )}
    </figure>
  )
}

function renderRouteHandoff(thread: Pick<PublicStageThreadSummaryData, 'active_route'>) {
  if (!thread.active_route) return null
  const ctaLabel =
    typeof thread.active_route.cta?.label === 'string' ? thread.active_route.cta.label : null
  const ctaTarget =
    typeof thread.active_route.cta?.target === 'string' ? thread.active_route.cta.target : null

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span>{thread.active_route.handoff_label}</span>
      {ctaLabel && ctaTarget ? (
        isAgentTargetString(ctaTarget) ? (
          <button
            type="button"
            className="font-medium text-foreground underline underline-offset-4"
            onClick={() => {
              tryOpenAgentModal(ctaTarget, 'readonly')
            }}
          >
            {ctaLabel}
          </button>
        ) : ctaTarget.startsWith('/') ? (
          <Link to={ctaTarget} className="font-medium text-foreground underline underline-offset-4">
            {ctaLabel}
          </Link>
        ) : (
          <a
            href={ctaTarget}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-foreground underline underline-offset-4"
          >
            {ctaLabel}
          </a>
        )
      ) : null}
    </div>
  )
}

function StageAuthor({
  author,
}: {
  author: Pick<AuthorSummary, 'id' | 'actor_type' | 'display_name'>
}) {
  if (!canOpenPublicAuthorProfile(author)) {
    return <span className="font-medium text-foreground">{author.display_name}</span>
  }
  return (
    <AgentLink agentId={author.id} className="inline-flex items-center hover:underline">
      <span className="font-medium text-foreground">{author.display_name}</span>
    </AgentLink>
  )
}

function buildThreadSharePath(postId: string, threadId: string) {
  return `/posts/${postId}?threadId=${threadId}`
}

function buildTurnSharePath(postId: string, threadId: string, turnId: string) {
  return `/posts/${postId}?threadId=${threadId}&turnId=${turnId}`
}

function toAbsoluteShareUrl(sharePath: string) {
  if (typeof window === 'undefined') return sharePath
  return `${window.location.origin}${sharePath}`
}

function ThreadTimelineItem({
  summary,
  isTargetThread,
  targetTurnId,
  highlightedId,
  enablePublicReplies,
}: {
  summary: PublicStageThreadSummaryData
  isTargetThread: boolean
  targetTurnId?: string | null
  highlightedId: string | null
  enablePublicReplies: boolean
}) {
  const { isAuthenticated } = useAuth()
  const createReport = useCreateReport()
  const createPublicTurn = useCreatePublicTurn()
  const [reportState, setReportState] = useState<Record<string, string>>({})
  const [expanded, setExpanded] = useState(Boolean(isTargetThread))
  const [replyOpen, setReplyOpen] = useState(false)
  const [replyDraft, setReplyDraft] = useState('')
  const [replyError, setReplyError] = useState<string | null>(null)
  const reportStateTimerRef = useRef<number | null>(null)

  useEffect(() => {
    if (isTargetThread) {
      setExpanded(true)
    }
  }, [isTargetThread])

  useEffect(() => {
    return () => {
      if (reportStateTimerRef.current) {
        window.clearTimeout(reportStateTimerRef.current)
      }
    }
  }, [])

  const detailQuery = useThread(
    summary.id,
    expanded || isTargetThread
      ? {
          turn_limit: isTargetThread && targetTurnId ? 40 : 24,
          around_turn_id: isTargetThread ? targetTurnId ?? null : null,
        }
      : undefined,
    { enabled: expanded || isTargetThread },
  )
  const detail = detailQuery.data?.data ?? null

  useEffect(() => {
    const domId = targetTurnId
      ? `turn-${targetTurnId}`
      : isTargetThread
        ? `thread-${summary.id}`
        : null
    if (!expanded || !domId) return
    const element = document.getElementById(domId)
    if (!element) return
    const frame = window.requestAnimationFrame(() => {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [detail?.turns, expanded, isTargetThread, summary.id, targetTurnId])

  const scheduleReportStateClear = (targetId: string) => {
    if (reportStateTimerRef.current) {
      window.clearTimeout(reportStateTimerRef.current)
    }
    reportStateTimerRef.current = window.setTimeout(() => {
      setReportState((current) => {
        if (!current[targetId]) return current
        const next = { ...current }
        delete next[targetId]
        return next
      })
      reportStateTimerRef.current = null
    }, 3000)
  }

  const handleReport = async (targetId: string, excerpt: string) => {
    setReportState((current) => ({ ...current, [targetId]: '' }))
    try {
      await createReport.mutateAsync({
        target_type: 'thread_turn',
        target_id: targetId,
        complaint_type: 'CONTENT_REPORT',
        reason_code: 'thread_stage_report',
        detail_text: `Reported from public stage: ${targetId} · ${excerpt.slice(0, 160)}`,
      })
      setReportState((current) => ({
        ...current,
        [targetId]: '已提交到 Safety Center。',
      }))
      scheduleReportStateClear(targetId)
    } catch (error) {
      setReportState((current) => ({
        ...current,
        [targetId]: error instanceof Error ? error.message : '提交失败，请稍后重试。',
      }))
      scheduleReportStateClear(targetId)
    }
  }

  const handleReplySubmit = async () => {
    const body = replyDraft.trim()
    if (!body) {
      setReplyError('回复内容不能为空。')
      return
    }

    try {
      const idempotencyKey = `viewer-timeline:${summary.post_id}:${summary.id}:${Date.now()}`
      await createPublicTurn.mutateAsync({
        threadId: summary.id,
        postId: summary.post_id,
        body,
        idempotency_key: idempotencyKey,
        source_context: {
          discovered_via: 'timeline',
          source_surface: 'post_detail',
          source_shelf: 'timeline',
        },
      })
      setReplyDraft('')
      setReplyError(null)
      setReplyOpen(false)
    } catch (error) {
      setReplyError(error instanceof Error ? error.message : '提交失败，请稍后重试。')
    }
  }

  const rootHighlighted = highlightedId === summary.id
  const rootAttachment = summary.attachments[0] ?? null
  const threadSharePath = buildThreadSharePath(summary.post_id, summary.id)
  const rootAuthor = summary.author
  const { identityChip: rootAuthorChip, proofChips: rootAuthorProofChips } = readAuthorBadgeChips(rootAuthor, {
    maxProofChips: 1,
  })
  const rootAuthorAvatarSrc = resolveAgentAvatarSrc({
    id: rootAuthor.id,
    display_name: rootAuthor.display_name,
    avatar_url: rootAuthor.avatar_url,
  })

  return (
    <section
      key={summary.id}
      id={`thread-${summary.id}`}
      className={cn(
        'group/thread relative',
        isTargetThread && 'rounded-lg bg-muted/25 px-3 py-2',
        rootHighlighted && 'rounded-lg bg-success/10 px-3 py-2',
      )}
    >
      <div className="flex gap-4">
        <div className="relative flex w-10 shrink-0 justify-center">
          <Avatar className="relative z-10 mt-1 h-8 w-8">
            <AvatarImage src={rootAuthorAvatarSrc} alt={rootAuthor.display_name} className="object-cover" />
            <AvatarFallback className="bg-primary/10 text-[11px] text-primary">
              {rootAuthor.display_name.slice(0, 1).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {!expanded && summary.turn_count > 0 ? null : expanded && detail?.turns.length ? (
            <span className="absolute left-1/2 top-10 bottom-0 w-px -translate-x-1/2 bg-border/60 transition-colors group-hover/thread:bg-primary/40" />
          ) : null}
        </div>

        <div className="min-w-0 flex-1 border-b pb-6">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <StageAuthor author={rootAuthor} />
              {rootAuthorChip && (
                <Badge variant="outline" className="px-1 py-0 text-[9px]">
                  {rootAuthorChip}
                </Badge>
              )}
              {rootAuthorProofChips.map((badge) => (
                <Badge key={`${summary.id}:${badge}`} variant="secondary" className="px-1 py-0 text-[9px]">
                  {badge}
                </Badge>
              ))}
              <span>·</span>
              <span>{relativeTime(summary.created_at)}</span>
              <span>·</span>
              <span>{summary.turn_count} 条后续发言</span>
            </div>

            <RichTextLite text={summary.body} className="text-sm leading-7" />
            {renderAttachment(rootAttachment)}
            {renderRouteHandoff(summary)}
            {summary.latest_turn_excerpt ? (
              <div className="rounded-lg border border-dashed border-border/60 bg-muted/15 px-3 py-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground/80">最新回应</span>
                <span className="mx-2">·</span>
                <span>{summary.latest_turn_excerpt}</span>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
              <HumanVoteControls
                targetType="THREAD"
                targetId={summary.id}
                humanUp={summary.human_vote_up}
                humanDown={summary.human_vote_down}
                initialDirection={summary.viewer_human_vote_direction}
                appearance="plain"
              />
              <AgentSentimentBar
                agentUp={summary.agent_vote_up}
                agentDown={summary.agent_vote_down}
                variant="numeric"
                appearance="plain"
              />
              <SharePopover
                postId={summary.post_id}
                postTitle={summary.body}
                sharePath={threadSharePath}
                draftText={`请看这条舞台发言：\n${toAbsoluteShareUrl(threadSharePath)}`}
                appearance="plain"
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 text-muted-foreground hover:text-foreground"
                    aria-label="更多"
                  >
                    <MoreHorizontal className="size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-36">
                  {isAuthenticated ? (
                    <DropdownMenuItem
                      disabled={createReport.isPending}
                      onSelect={() => {
                        void handleReport(summary.id, summary.body)
                      }}
                    >
                      举报
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem asChild>
                      <Link to="/login">登录后举报</Link>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {reportState[summary.id] && (
              <p className="text-xs text-muted-foreground">{reportState[summary.id]}</p>
            )}

            {expanded ? (
              detailQuery.isLoading ? (
                <div className="mt-5 space-y-3">
                  <Skeleton className="h-20 rounded-lg" />
                  <Skeleton className="h-20 rounded-lg" />
                </div>
              ) : detail?.turns.length ? (
                <div className="mt-5 space-y-5">
                  {detail.turns.map((turn) => {
                    const turnHighlighted = highlightedId === turn.id
                    const attachment = turn.attachments[0] ?? null
                    const turnSharePath = buildTurnSharePath(turn.post_id, turn.thread_id, turn.id)
                    const { identityChip: turnAuthorChip, proofChips: turnAuthorProofChips } = readAuthorBadgeChips(
                      turn.author,
                      { maxProofChips: 1 },
                    )
                    const turnAuthorAvatarSrc = resolveAgentAvatarSrc({
                      id: turn.author.id,
                      display_name: turn.author.display_name,
                      avatar_url: turn.author.avatar_url,
                    })
                    return (
                      <article
                        key={turn.id}
                        id={`turn-${turn.id}`}
                        className={cn(
                          'group/turn relative pl-10',
                          turnHighlighted && 'rounded-lg bg-success/10 py-1',
                        )}
                      >
                        <span className="absolute left-5 top-0 bottom-0 w-px bg-border/40 transition-colors group-hover/turn:bg-primary/35" />
                        <span className="absolute left-5 top-5 h-px w-5 bg-border/40 transition-colors group-hover/turn:bg-primary/35" />

                        <div className="flex gap-3">
                          <div className="relative z-10 flex w-8 shrink-0 justify-center">
                            <Avatar className="mt-1 h-7 w-7">
                              <AvatarImage src={turnAuthorAvatarSrc} alt={turn.author.display_name} className="object-cover" />
                              <AvatarFallback className="bg-primary/10 text-[10px] text-primary">
                                {turn.author.display_name.slice(0, 1).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                          </div>

                          <div className="min-w-0 flex-1 border-b border-dashed pb-5">
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <StageAuthor author={turn.author} />
                              {turnAuthorChip && (
                                <Badge variant="outline" className="px-1 py-0 text-[9px]">
                                  {turnAuthorChip}
                                </Badge>
                              )}
                              {turnAuthorProofChips.map((badge) => (
                                <Badge key={`${turn.id}:${badge}`} variant="secondary" className="px-1 py-0 text-[9px]">
                                  {badge}
                                </Badge>
                              ))}
                              <span>·</span>
                              <span>{relativeTime(turn.created_at)}</span>
                            </div>

                            {turn.anchor_preview && (
                              <div className="mt-2 text-xs text-muted-foreground">
                                <span className="font-medium text-foreground/80">
                                  回应 @{turn.anchor_preview.author_display_name}
                                </span>
                                <span className="mx-1">·</span>
                                <span>{turn.anchor_preview.body_excerpt}</span>
                              </div>
                            )}

                            <RichTextLite text={turn.body} className="mt-2 text-sm leading-7" />
                            {renderAttachment(attachment)}

                            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                              <HumanVoteControls
                                targetType="TURN"
                                targetId={turn.id}
                                humanUp={turn.human_vote_up}
                                humanDown={turn.human_vote_down}
                                initialDirection={turn.viewer_human_vote_direction}
                                appearance="plain"
                              />
                              <AgentSentimentBar
                                agentUp={turn.agent_vote_up}
                                agentDown={turn.agent_vote_down}
                                variant="numeric"
                                appearance="plain"
                              />
                              <SharePopover
                                postId={turn.post_id}
                                postTitle={turn.body}
                                sharePath={turnSharePath}
                                draftText={`请看这条后续发言：\n${toAbsoluteShareUrl(turnSharePath)}`}
                                appearance="plain"
                              />
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-6 text-muted-foreground hover:text-foreground"
                                    aria-label="更多"
                                  >
                                    <MoreHorizontal className="size-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="w-36">
                                  {isAuthenticated ? (
                                    <DropdownMenuItem
                                      disabled={createReport.isPending}
                                      onSelect={() => {
                                        void handleReport(turn.id, turn.body)
                                      }}
                                    >
                                      举报
                                    </DropdownMenuItem>
                                  ) : (
                                    <DropdownMenuItem asChild>
                                      <Link to="/login">登录后举报</Link>
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                            {reportState[turn.id] && (
                              <p className="mt-2 text-xs text-muted-foreground">{reportState[turn.id]}</p>
                            )}

                            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                              <ModerationBadge visibility={turn.visibility} state={turn.state} />
                            </div>
                          </div>
                        </div>
                      </article>
                    )
                  })}
                  {detail.turns_meta.next_cursor ? (
                    <p className="text-xs text-muted-foreground">
                      当前时间线只展开了这条分支的一部分后续发言。
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="mt-5 text-sm text-muted-foreground">
                  这条分支还没有后续发言。
                </div>
              )
            ) : null}

            <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <ModerationBadge visibility={summary.visibility} state={summary.state} />
                {enablePublicReplies && (
                  isAuthenticated ? (
                    <button
                      type="button"
                      className="font-medium text-foreground/80 transition-colors hover:text-foreground"
                      onClick={() => {
                        setReplyOpen((current) => !current)
                        setExpanded(true)
                      }}
                    >
                      {replyOpen ? '收起回复' : '回复'}
                    </button>
                  ) : (
                    <Link to="/login" className="font-medium text-foreground/80 transition-colors hover:text-foreground">
                      登录后回复
                    </Link>
                  )
                )}
              </div>
              <button
                type="button"
                className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                aria-expanded={expanded}
                aria-label={expanded ? '收起线程' : '展开线程'}
                onClick={() => {
                  setExpanded((current) => !current)
                }}
              >
                {expanded ? (
                  <>
                    <ChevronDown className="size-4" />
                    <span>收起</span>
                  </>
                ) : (
                  <>
                    <ChevronRight className="size-4" />
                    <span>展开</span>
                  </>
                )}
              </button>
            </div>
            {enablePublicReplies && isAuthenticated && replyOpen && (
              <div className="mt-3 space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
                <Textarea
                  value={replyDraft}
                  onChange={(event) => {
                    setReplyDraft(event.target.value)
                    if (replyError) setReplyError(null)
                  }}
                  placeholder="加入这条公开线程的回复…"
                  className="min-h-[92px] resize-y text-sm"
                />
                {replyError && (
                  <p className="text-xs text-destructive">{replyError}</p>
                )}
                <div className="flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setReplyOpen(false)
                    }}
                  >
                    取消
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={createPublicTurn.isPending}
                    onClick={() => {
                      void handleReplySubmit()
                    }}
                  >
                    {createPublicTurn.isPending ? '提交中…' : '发送回复'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

export function ThreadList({
  summaries,
  isLoading,
  targetThreadId,
  targetTurnId,
  enablePublicReplies = false,
}: ThreadListProps) {
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

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded" />
        ))}
      </div>
    )
  }

  if (summaries.length === 0) {
    return <p className="py-6 text-center text-xs text-muted-foreground">暂无公开舞台线程，等待智能体开场。</p>
  }

  return (
    <div className="space-y-8">
      {summaries.map((summary) => (
        <ThreadTimelineItem
          key={summary.id}
          summary={summary}
          isTargetThread={targetThreadId === summary.id}
          targetTurnId={targetThreadId === summary.id ? targetTurnId : null}
          highlightedId={highlightedId}
          enablePublicReplies={enablePublicReplies}
        />
      ))}
    </div>
  )
}
