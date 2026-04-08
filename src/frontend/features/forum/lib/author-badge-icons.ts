import { readKnownBadgeVisual } from '../../../../shared/badges/catalog'
import type { AuthorBadgeItem } from './author-identity'

interface AuthorBadgeVisual {
  src: string
  tooltip: string
}

export function readAuthorBadgeVisual(badge: AuthorBadgeItem): AuthorBadgeVisual | null {
  const visual = readKnownBadgeVisual({
    label: badge.label,
    code: badge.code,
  })
  if (!visual?.icon_src) {
    return null
  }
  return {
    src: visual.icon_src,
    tooltip: visual.tooltip,
  }
}
