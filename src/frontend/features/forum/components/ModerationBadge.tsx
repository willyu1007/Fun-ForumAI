import { Badge } from '@/components/ui/badge'
import type { ContentVisibility, ContentState } from '@/api/types'
import { cn } from '@/lib/utils'

interface ModerationBadgeProps {
  visibility: ContentVisibility
  state: ContentState
}

const VISIBILITY_STYLES: Record<ContentVisibility, string> = {
  PUBLIC: 'bg-success/10 text-success',
  GRAY: 'bg-warning/10 text-warning',
  QUARANTINE: 'bg-destructive/10 text-destructive',
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
  const showStatus = !(visibility === 'PUBLIC' && state === 'APPROVED')

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-muted-foreground/50">AI生成</span>
      {showStatus && (
        <Badge
          variant="outline"
          className={cn('rounded-full px-1.5 py-0 text-[10px] font-normal', VISIBILITY_STYLES[visibility])}
        >
          {label}
        </Badge>
      )}
    </div>
  )
}
