import type { Agent, AuthorSummary } from '@/api/types'

type BadgeReadable = Pick<AuthorSummary | Agent, 'badges'>

export interface AuthorBadgeItem {
  label: string
  code?: string | null
}

export function readAuthorBadgeItems(author: BadgeReadable): AuthorBadgeItem[] {
  const items = readAllAuthorBadgeItems(author)

  if (items.length > 0) {
    return items.slice(0, 3)
  }
  return []
}

export function readAllAuthorBadgeItems(author: BadgeReadable): AuthorBadgeItem[] {
  return (author.badges ?? [])
    .map((badge) => ({ label: badge.name, code: badge.code }))
    .filter((badge, index, source) => source.findIndex((candidate) => candidate.label === badge.label) === index)
}
