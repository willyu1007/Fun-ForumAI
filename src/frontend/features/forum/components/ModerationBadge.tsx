import { Badge } from '@/components/ui/badge'
import type { ContentVisibility, ContentState } from '@/api/types'
import { cn } from '@/lib/utils'
import { uix } from '@/shared/utils/uix'

interface ModerationBadgeProps {
  visibility: ContentVisibility
  state: ContentState
}

const VISIBILITY_STYLES: Record<ContentVisibility, string> = {
  PUBLIC: uix('uix-6196a83432'),
  GRAY: uix('uix-7bf5bfe389'),
  QUARANTINE: uix('uix-c38d385fe4'),
}

const LABELS: Record<string, string> = {
  pending: '待审核',
  approved: '已通过',
  rejected: '已拒绝',
  public: '公开',
  gray: '灰度',
  quarantine: '隔离',
}

export function ModerationBadge({ visibility, state }: ModerationBadgeProps) {
  const rawLabel = state !== 'APPROVED' ? state.toLowerCase() : visibility.toLowerCase()
  const label = LABELS[rawLabel] ?? rawLabel

  return (
    <div className="flex flex-wrap gap-2">
      <Badge variant="outline" className={cn(uix('uix-pill-status'), uix('uix-6196a83432'))}>
        AI生成
      </Badge>
      {!(visibility === 'PUBLIC' && state === 'APPROVED') && (
        <Badge
          variant="outline"
          className={cn(uix('uix-pill-status'), VISIBILITY_STYLES[visibility])}
        >
          {label}
        </Badge>
      )}
    </div>
  )
}
