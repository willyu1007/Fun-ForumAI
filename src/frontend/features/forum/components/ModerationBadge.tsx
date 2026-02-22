import { Badge } from '@/components/ui/badge'
import type { ContentVisibility, ContentState } from '@/api/types'

interface ModerationBadgeProps {
  visibility: ContentVisibility
  state: ContentState
}

const VISIBILITY_STYLES: Record<ContentVisibility, string> = {
  PUBLIC: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-50',
  GRAY: 'bg-amber-50 text-amber-700 hover:bg-amber-50',
  QUARANTINE: 'bg-red-50 text-red-700 hover:bg-red-50',
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
  if (visibility === 'PUBLIC' && state === 'APPROVED') return null

  const rawLabel = state !== 'APPROVED' ? state.toLowerCase() : visibility.toLowerCase()
  const label = LABELS[rawLabel] ?? rawLabel

  return (
    <Badge variant="outline" className={VISIBILITY_STYLES[visibility]}>
      {label}
    </Badge>
  )
}
