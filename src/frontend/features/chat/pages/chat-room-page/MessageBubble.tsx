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
import { uix } from '@/shared/utils/uix'
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
      <div className={uix('uix-28704040a4')}>
        <RichTextLite text={message.body} mode="chat" className="space-y-1" />
      </div>
    )
  }

  return (
    <div
      className={cn(
        uix('uix-a7e4d5f5da'),
        isSkip && 'opacity-60',
        highlighted && uix('uix-a2df0c7de4'),
      )}
    >
      <Avatar className={uix('uix-fcb8352ee0')}>
        <AvatarFallback className={uix('uix-091d6a3521')}>
          {displayName.slice(0, 2)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={uix('uix-e43bc2769b')}>{displayName}</span>
          {isGreeting && (
            <Badge variant="outline" className={uix('uix-e8ed768905')}>
              入场
            </Badge>
          )}
          {isSkip && (
            <Badge variant="secondary" className={uix('uix-e8ed768905')}>
              反馈
            </Badge>
          )}
          {message.speaker_role && (
            <Badge variant="outline" className={uix('uix-e8ed768905')}>
              {ROLE_LABEL[message.speaker_role]}
            </Badge>
          )}
          {message.cue_type && (
            <Badge variant="secondary" className={uix('uix-e8ed768905')}>
              {CUE_LABEL[message.cue_type]}
            </Badge>
          )}
          {highlighted && <Badge className={uix('uix-e8ed768905')}>高光</Badge>}
          {isGray && (
            <Badge variant="secondary" className={uix('uix-e8ed768905')}>
              灰度折叠
            </Badge>
          )}
          {isPending && (
            <Badge variant="outline" className={uix('uix-e8ed768905')}>
              待复核
            </Badge>
          )}
          <span className={uix('uix-25be576b96')}>{relativeTime(message.created_at)}</span>
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
          <div className={uix('uix-d7e2c0fd1c')}>
            <p>这条发言因热点或审核策略默认折叠，展开后仍可直达查看原文。</p>
            <Button
              size="sm"
              variant="ghost"
              className={uix('uix-4d2deea2bf')}
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
            className={cn(uix('uix-dbcbe995b4'), isSkip && uix('uix-80518375ad'))}
          />
        )}
        {topicCopy && (
          <div className={cn(uix('uix-d7e2c0fd1c'), uix('uix-4d2deea2bf'))}>
            <p>{topicCopy}</p>
            <p className={uix('uix-276aec863c')}>
              房间分发状态：{HOT_TOPIC_DISTRIBUTION_LABELS[distributionState] ?? distributionState}
            </p>
          </div>
        )}
        {reportState && (
          <p
            className={
              reportState.includes('失败')
                ? uix('uix-17ad2d4d55')
                : cn(uix('uix-abda0153e3'), uix('uix-4d2deea2bf'))
            }
          >
            {reportState}
          </p>
        )}
      </div>
    </div>
  )
}
