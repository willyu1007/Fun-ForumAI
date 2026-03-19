import { useEffect, useState } from 'react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { RichTextLite } from '@/shared/components/RichTextLite'
import { relativeTime } from '@/shared/utils/relative-time'
import type { ChatMessage } from '@/api/types'
import {
  describeTopicSignals,
  HOT_TOPIC_DISTRIBUTION_LABELS,
  readTopicSignals,
} from '@/shared/utils/hot-topic-policy'
import { CUE_LABEL, ROLE_LABEL, toRecord } from './constants'

export function MessageBubble({
  message,
  highlighted,
  authorName,
  canReport,
  reportPending,
  reportState,
  onReport,
}: {
  message: ChatMessage
  highlighted: boolean
  authorName?: string
  canReport: boolean
  reportPending: boolean
  reportState: string | null
  onReport: (message: ChatMessage) => Promise<void>
}) {
  const isSkip = message.message_kind === 'skip_feedback'
  const isAmbient = message.message_kind === 'ambient'
  const isGreeting = message.message_kind === 'greeting'
  const isGray = message.visibility === 'GRAY'
  const isPending = message.state === 'PENDING'
  const [expanded, setExpanded] = useState(!(isGray || isPending))
  const displayName = authorName ?? message.author_display_name ?? message.author_id.slice(0, 8)
  const moderationMetadata = toRecord(message.moderation_metadata)
  const topicSignals = readTopicSignals(toRecord(moderationMetadata?.topic_signals))
  const distributionState =
    typeof moderationMetadata?.distribution_state === 'string'
      ? moderationMetadata.distribution_state
      : topicSignals?.distributionState ?? 'NORMAL'
  const topicCopy = describeTopicSignals(topicSignals, distributionState)

  useEffect(() => {
    setExpanded(!(isGray || isPending))
  }, [isGray, isPending, message.id])

  if (isAmbient) {
    return (
      <div className={"py-1 text-center text-xs text-muted-foreground"}>
        <RichTextLite text={message.body} mode="chat" className="space-y-1" />
      </div>
    )
  }

  return (
    <div
      className={cn(
        "flex gap-3 rounded-xl px-2 py-2 transition-colors",
        isSkip && 'opacity-60',
        highlighted && "bg-warning/10 ring-1 ring-warning/30",
      )}
    >
      <Avatar className={"mt-0.5 h-8 w-8 shrink-0"}>
        <AvatarFallback className={"bg-primary/10 text-xs"}>
          {displayName.slice(0, 2)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={"truncate text-sm font-medium"}>{displayName}</span>
          {isGreeting && (
            <Badge variant="outline" className={"px-1 py-0 text-[10px]"}>
              入场
            </Badge>
          )}
          {isSkip && (
            <Badge variant="secondary" className={"px-1 py-0 text-[10px]"}>
              反馈
            </Badge>
          )}
          {message.speaker_role && (
            <Badge variant="outline" className={"px-1 py-0 text-[10px]"}>
              {ROLE_LABEL[message.speaker_role]}
            </Badge>
          )}
          {message.cue_type && (
            <Badge variant="secondary" className={"px-1 py-0 text-[10px]"}>
              {CUE_LABEL[message.cue_type]}
            </Badge>
          )}
          {highlighted && <Badge className={"px-1 py-0 text-[10px]"}>高光</Badge>}
          {isGray && (
            <Badge variant="secondary" className={"px-1 py-0 text-[10px]"}>
              灰度折叠
            </Badge>
          )}
          {isPending && (
            <Badge variant="outline" className={"px-1 py-0 text-[10px]"}>
              待复核
            </Badge>
          )}
          <span className={"text-xs text-muted-foreground"}>{relativeTime(message.created_at)}</span>
          {canReport && !isAmbient && (
            <Button
              size="sm"
              variant="ghost"
              disabled={reportPending}
              onClick={() => {
                void onReport(message)
              }}
            >
              {reportPending ? '提交中…' : '举报发言'}
            </Button>
          )}
        </div>
        {(isGray || isPending) && (
          <div className={"rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-foreground"}>
            <p>这条发言因热点或审核策略默认折叠，展开后仍可直达查看原文。</p>
            <Button
              size="sm"
              variant="ghost"
              className={"mt-2"}
              onClick={() => setExpanded((current) => !current)}
            >
              {expanded ? '收起原文' : '展开原文'}
            </Button>
          </div>
        )}
        {expanded && (
          <RichTextLite
            text={message.body}
            mode="chat"
            className={cn("mt-0.5 text-sm", isSkip && "italic text-muted-foreground")}
          />
        )}
        {topicCopy && (
          <div className={cn("rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-foreground", "mt-2")}>
            <p>{topicCopy}</p>
            <p className={"mt-1 text-[11px] text-warning"}>
              房间分发状态：{HOT_TOPIC_DISTRIBUTION_LABELS[distributionState] ?? distributionState}
            </p>
          </div>
        )}
        {reportState && (
          <p
            className={
              reportState.includes('失败')
                ? "mt-2 text-sm text-destructive"
                : cn("text-[10px] text-muted-foreground", "mt-2")
            }
          >
            {reportState}
          </p>
        )}
      </div>
    </div>
  )
}
