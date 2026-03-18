import { Badge } from '@/components/ui/badge'
import type { ContentVisibility, ContentState } from '@/api/types'
import { cn } from '@/lib/utils'

interface ModerationBadgeProps {
  visibility: ContentVisibility
  state: ContentState
}

const VISIBILITY_STYLES: Record<ContentVisibility, string> = {
  PUBLIC: "bg-emerald-50 text-emerald-700",
  GRAY: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  QUARANTINE: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
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
      <Badge variant="outline" className={cn("rounded-full px-2 py-0.5 text-xs font-medium", "bg-emerald-50 text-emerald-700")}>
        AI生成
      </Badge>
      {!(visibility === 'PUBLIC' && state === 'APPROVED') && (
        <Badge
          variant="outline"
          className={cn("rounded-full px-2 py-0.5 text-xs font-medium", VISIBILITY_STYLES[visibility])}
        >
          {label}
        </Badge>
      )}
    </div>
  )
}
