import type {
  AgentPublicIdentity,
  AgentPublicProjection,
  AgentPublicProof,
} from '../../../shared/semantic-taxonomy.js'
import type { BadgeSurfacePolicyId } from '../../../shared/badges/surface-policy.js'
import { BADGE_SURFACE_POLICIES } from '../../../shared/badges/surface-policy.js'
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

export interface PublicAuthorIdentityBadgeSlot {
  label: string
  badge_id?: string
  internal_code?: string
  source_kind?: string
  priority_rank?: number
  source: 'semantic_identity' | 'compat_display'
}

export interface PublicAuthorProofBadgeSlot {
  label: string
  code?: string
  level?: 1 | 2 | 3
  source: 'semantic_proof' | 'compat_badges'
}

export interface PublicAuthorBadgeSlots {
  identityBadges: PublicAuthorIdentityBadgeSlot[]
  proofBadges: PublicAuthorProofBadgeSlot[]
  projectionText: string | null
  surfaceTags: string[]
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

function readCompatIdentityBadges(author: PublicAuthorLike): PublicAuthorIdentityBadgeSlot[] {
  const displayBadges = readDisplayBadgeLabels(author).map((label) => ({
    label,
    source: 'compat_display' as const,
  }))
  if (displayBadges.length > 0) {
    return displayBadges
  }

  const visibilityRole = author.public_identity?.identity_visibility_role_id
  if (visibilityRole) {
    const normalized = normalizeSystemDisplayBadgeLabel(visibilityRole) ?? visibilityRole
    return [{ label: normalized, source: 'compat_display' }]
  }

  const identityRole = author.public_identity?.identity_role_id
  if (identityRole) {
    return [{ label: IDENTITY_ROLE_LABELS[identityRole] ?? identityRole, source: 'compat_display' }]
  }

  if (author.public_identity?.agent_kind === 'system') {
    return [{ label: 'System', source: 'compat_display' }]
  }

  return []
}

function readCompatProofBadges(author: PublicAuthorLike): PublicAuthorProofBadgeSlot[] {
  const identityLabels = new Set(readCompatIdentityBadges(author).map((badge) => badge.label))
  const displayBadges = new Set(readDisplayBadgeLabels(author))
  return uniqueLabels([
    ...(author.public_proof?.achievement_badges?.map((badge) => badge.name) ?? []),
    ...(author.badges?.map((badge) => badge.name) ?? []),
  ])
    .filter((label) => !identityLabels.has(label) && !displayBadges.has(label))
    .map((label) => ({
      label,
      source: 'compat_badges' as const,
    }))
}

export function selectSemanticAuthorBadgeSlots(author: PublicAuthorLike): PublicAuthorBadgeSlots {
  return {
    identityBadges: (author.public_identity?.identity_badges ?? []).map((badge) => ({
      label: badge.label,
      badge_id: badge.badge_id,
      internal_code: badge.internal_code,
      source_kind: badge.source_kind,
      priority_rank: badge.priority_rank,
      source: 'semantic_identity' as const,
    })),
    proofBadges: (author.public_proof?.achievement_badges ?? []).map((badge) => ({
      label: badge.name,
      code: badge.code,
      level: badge.level,
      source: 'semantic_proof' as const,
    })),
    projectionText: author.public_projection?.public_bio
      ?? author.public_projection?.tagline
      ?? author.public_projection?.public_projection_hint
      ?? null,
    surfaceTags: [],
  }
}

/**
 * Deprecated compatibility adapter for legacy surfaces that still consume
 * flat display/proof fields. New UI work must read semantic fields first.
 */
export function selectCompatAuthorBadgeSlots(author: PublicAuthorLike): PublicAuthorBadgeSlots {
  return {
    identityBadges: readCompatIdentityBadges(author),
    proofBadges: readCompatProofBadges(author),
    projectionText: author.public_bio ?? author.tagline ?? null,
    surfaceTags: [],
  }
}

export function selectAuthorBadgeSlotsByPolicy(
  author: PublicAuthorLike,
  policyId: BadgeSurfacePolicyId,
): PublicAuthorBadgeSlots {
  const policy = BADGE_SURFACE_POLICIES[policyId]
  const semantic = selectSemanticAuthorBadgeSlots(author)
  return {
    identityBadges: policy.allows_identity_badges
      ? semantic.identityBadges.slice(0, policy.max_identity_badges ?? semantic.identityBadges.length)
      : [],
    proofBadges: policy.allows_proof_badges
      ? semantic.proofBadges.slice(0, policy.max_proof_badges ?? semantic.proofBadges.length)
      : [],
    projectionText: semantic.projectionText,
    surfaceTags: semantic.surfaceTags,
  }
}

/**
 * Deprecated compat wrapper for existing surfaces. New badge UI work should use
 * `selectSemanticAuthorBadgeSlots` or `selectAuthorBadgeSlotsByPolicy`.
 */
export function readPrimaryIdentityChip(author: PublicAuthorLike): string | null {
  const compatIdentity = selectCompatAuthorBadgeSlots(author).identityBadges[0]?.label ?? null
  if (compatIdentity && compatIdentity !== 'System') {
    return compatIdentity
  }
  if (author.public_identity?.agent_kind === 'system') {
    return selectSemanticAuthorBadgeSlots(author).identityBadges[0]?.label ?? compatIdentity
  }
  return compatIdentity
}

/**
 * Deprecated compat wrapper for existing surfaces. New badge UI work should use
 * `selectSemanticAuthorBadgeSlots` or `selectAuthorBadgeSlotsByPolicy`.
 */
export function readProofBadgeLabels(author: PublicAuthorLike): string[] {
  return selectCompatAuthorBadgeSlots(author).proofBadges.map((badge) => badge.label)
}

/**
 * Deprecated compat wrapper for existing surfaces. New badge UI work should use
 * `selectSemanticAuthorBadgeSlots` or `selectAuthorBadgeSlotsByPolicy`.
 */
export function readAuthorBadgeChips(
  author: PublicAuthorLike,
  options: { maxProofChips?: number; policyId?: BadgeSurfacePolicyId } = {},
): {
  identityChip: string | null
  proofChips: string[]
} {
  const maxProofChips = Math.max(0, options.maxProofChips ?? 2)
  if (!options.policyId) {
    const compatSlots = selectCompatAuthorBadgeSlots(author)
    return {
      identityChip: readPrimaryIdentityChip(author),
      proofChips: compatSlots.proofBadges.slice(0, maxProofChips).map((badge) => badge.label),
    }
  }
  const slots = selectAuthorBadgeSlotsByPolicy(author, options.policyId)
  return {
    identityChip: slots.identityBadges[0]?.label ?? null,
    proofChips: slots.proofBadges.slice(0, maxProofChips).map((badge) => badge.label),
  }
}

/**
 * Deprecated compat wrapper for existing surfaces. New badge UI work should use
 * semantic projection fields directly.
 */
export function readProjectionText(author: PublicAuthorLike): string | null {
  return selectSemanticAuthorBadgeSlots(author).projectionText
    ?? selectCompatAuthorBadgeSlots(author).projectionText
    ?? null
}
