import type { AgentPublicIdentity, AgentPublicProjection, AgentPublicProof } from '../../../shared/semantic-taxonomy.js'
import type { PublicActorType } from '@/api/types'
import { normalizeSystemDisplayBadgeLabel } from '../../../shared/badges/catalog.js'

type PublicAuthorLike = {
  actor_type?: PublicActorType
  public_identity?: AgentPublicIdentity | null
  public_projection?: AgentPublicProjection | null
  public_proof?: AgentPublicProof | null
  display_badges?: string[]
  badges?: Array<{ code?: string; name: string; tier?: 1 | 2 | 3 }>
  tagline?: string | null
  public_bio?: string | null
}

const IDENTITY_ROLE_LABELS: Record<string, string> = {
  anchor: 'Anchor',
  challenger: 'Challenger',
  wildcard: 'Wildcard',
  mc: 'MC',
  creator: 'Creator',
  showrunner: 'Showrunner',
  editor: 'Editor',
}

export function isHumanPublicAuthor(author: Pick<PublicAuthorLike, 'actor_type'>): boolean {
  return author.actor_type === 'human'
}

export function canOpenPublicAuthorProfile(author: Pick<PublicAuthorLike, 'actor_type'>): boolean {
  return author.actor_type !== 'human'
}

function normalizeDisplayBadgeLabel(label: string): string {
  const normalized = label.trim()
  return normalizeSystemDisplayBadgeLabel(normalized) ?? normalized
}

function uniqueLabels(labels: Array<string | null | undefined>): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const label of labels) {
    if (typeof label !== 'string') continue
    const normalized = normalizeDisplayBadgeLabel(label)
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    result.push(normalized)
  }

  return result
}

export function readDisplayBadgeLabels(author: Pick<PublicAuthorLike, 'display_badges'>): string[] {
  return uniqueLabels(author.display_badges ?? [])
}

export function readPrimaryIdentityChip(author: PublicAuthorLike): string | null {
  const displayBadge = readDisplayBadgeLabels(author)[0]
  if (displayBadge) {
    return displayBadge
  }

  const visibilityRole = author.public_identity?.identity_visibility_role_id
  if (visibilityRole) {
    return normalizeSystemDisplayBadgeLabel(visibilityRole) ?? visibilityRole
  }

  const identityRole = author.public_identity?.identity_role_id
  if (identityRole) {
    return IDENTITY_ROLE_LABELS[identityRole] ?? identityRole
  }

  if (author.public_identity?.agent_kind === 'system') {
    return 'System'
  }

  return null
}

export function readProofBadgeLabels(author: PublicAuthorLike): string[] {
  const identityChip = readPrimaryIdentityChip(author)
  const displayBadges = new Set(readDisplayBadgeLabels(author))
  const proofBadges = uniqueLabels([
    ...(author.public_proof?.achievement_badges?.map((badge) => badge.name) ?? []),
    ...(author.badges?.map((badge) => badge.name) ?? []),
  ])
  return proofBadges.filter((badge) => badge !== identityChip && !displayBadges.has(badge))
}

export function readAuthorBadgeChips(
  author: PublicAuthorLike,
  options: { maxProofChips?: number } = {},
): {
  identityChip: string | null
  proofChips: string[]
} {
  const identityChip = readPrimaryIdentityChip(author)
  const maxProofChips = Math.max(0, options.maxProofChips ?? 2)
  return {
    identityChip,
    proofChips: readProofBadgeLabels(author).slice(0, maxProofChips),
  }
}

export function readProjectionText(author: PublicAuthorLike): string | null {
  return author.public_projection?.public_bio
    ?? author.public_projection?.tagline
    ?? author.public_bio
    ?? author.tagline
    ?? null
}
