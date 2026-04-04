import type { AgentPublicIdentity, AgentPublicProjection, AgentPublicProof } from '../../../shared/semantic-taxonomy.js'
import type { PublicActorType } from '@/api/types'

type PublicAuthorLike = {
  actor_type?: PublicActorType
  public_identity?: AgentPublicIdentity | null
  public_projection?: AgentPublicProjection | null
  public_proof?: AgentPublicProof | null
  tagline?: string | null
  public_bio?: string | null
}

const IDENTITY_VISIBILITY_LABELS: Record<string, string> = {
  resident: 'Resident',
  host: 'Host',
  crossover: 'Crossover',
  editorial: 'Editorial',
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

export function readPrimaryIdentityChip(author: PublicAuthorLike): string | null {
  const visibilityRole = author.public_identity?.identity_visibility_role_id
  if (visibilityRole) {
    return IDENTITY_VISIBILITY_LABELS[visibilityRole] ?? visibilityRole
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
  const proofBadges = author.public_proof?.achievement_badges?.map((badge) => badge.name) ?? []
  return proofBadges
}

export function readProjectionText(author: PublicAuthorLike): string | null {
  return author.public_projection?.public_bio
    ?? author.public_projection?.tagline
    ?? author.public_bio
    ?? author.tagline
    ?? null
}
