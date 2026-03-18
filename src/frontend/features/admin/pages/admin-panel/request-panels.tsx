import { Badge } from '@/components/ui/badge'
import type { AppealRequest, ComplaintTicket } from '@/api/types'
import {
  APPEAL_TYPE_LABELS,
  COMPLAINT_TYPE_LABELS,
  REQUEST_STATUS_LABELS,
} from './constants'

function RequestPanel({
  title,
  subtitle,
  status,
  lines,
}: {
  title: string
  subtitle: string
  status: string
  lines: string[]
}) {
  return (
    <div className={"rounded-md border p-3"}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className={"text-xs font-medium"}>{title}</p>
          <p className={"text-[10px] text-muted-foreground"}>{subtitle}</p>
        </div>
        <Badge variant="outline">{REQUEST_STATUS_LABELS[status] ?? status}</Badge>
      </div>
      <div className={"mt-2 space-y-1 text-sm"}>
        {lines.map((line) => (
          <p key={line} className={"text-[10px] text-muted-foreground"}>
            {line}
          </p>
        ))}
      </div>
    </div>
  )
}

export function ComplaintPanel({ item }: { item: ComplaintTicket | null }) {
  if (!item) return null
  return (
    <RequestPanel
      title={COMPLAINT_TYPE_LABELS[item.complaint_type] ?? item.complaint_type}
      subtitle={`${item.target_type}:${item.target_id}`}
      status={item.status}
      lines={[
        `reason_code: ${item.reason_code}`,
        item.detail_text ? `detail: ${item.detail_text}` : 'detail: 无',
        `attachments: ${item.attachments.length}`,
      ]}
    />
  )
}

export function AppealPanel({ item }: { item: AppealRequest | null }) {
  if (!item) return null
  return (
    <RequestPanel
      title={APPEAL_TYPE_LABELS[item.appeal_type] ?? item.appeal_type}
      subtitle={`${item.target_type}:${item.target_id}`}
      status={item.status}
      lines={[
        `requester: ${item.requester_type}`,
        `reason: ${item.reason}`,
        item.linked_complaint_ticket_id
          ? `linked complaint: ${item.linked_complaint_ticket_id}`
          : 'linked complaint: 无',
      ]}
    />
  )
}
