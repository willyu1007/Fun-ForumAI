import type {
  AgentPublicIdentity,
  AgentPublicProjection,
  AgentPublicProof,
} from '../../../shared/semantic-taxonomy.js'
import type { BadgeSurfacePolicyId } from '../../../shared/badges/surface-policy.js'
import { BADGE_SURFACE_POLICIES } from '../../../shared/badges/surface-policy.js'
import type { PublicActorType } from '@/api/types'

type PublicAuthorLike = {
  actor_type?: PublicActorType
  public_identity?: AgentPublicIdentity | null
  public_projection?: AgentPublicProjection | null
  public_proof?: AgentPublicProof | null
}

export interface PublicAuthorIdentityBadgeSlot {
  label: string
  badge_id?: string
  internal_code?: string
  source_kind?: string
  priority_rank?: number
  source: 'semantic_identity'
}

export interface PublicAuthorProofBadgeSlot {
  label: string
  code?: string
  level?: 1 | 2 | 3
  source: 'semantic_proof'
}

export interface PublicAuthorBadgeSlots {
  identityBadges: PublicAuthorIdentityBadgeSlot[]
  proofBadges: PublicAuthorProofBadgeSlot[]
  projectionText: string | null
  surfaceTags: string[]
}

export interface PublicAuthorBadgeListItem {
  label: string
  code?: string | null
}

export function isHumanPublicAuthor(author: Pick<PublicAuthorLike, 'actor_type'>): boolean {
  return author.actor_type === 'human'
}

export function canOpenPublicAuthorProfile(author: Pick<PublicAuthorLike, 'actor_type'>): boolean {
  return author.actor_type !== 'human'
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

export function readSemanticBadgeItems(
  author: PublicAuthorLike,
  options: { maxIdentityBadges?: number; maxProofBadges?: number } = {},
): PublicAuthorBadgeListItem[] {
  const semantic = selectSemanticAuthorBadgeSlots(author)
  const identityLimit = Math.max(0, options.maxIdentityBadges ?? semantic.identityBadges.length)
  const proofLimit = Math.max(0, options.maxProofBadges ?? semantic.proofBadges.length)
  const combined = [
    ...semantic.identityBadges.slice(0, identityLimit).map((badge) => ({
      label: badge.label,
      code: null,
    })),
    ...semantic.proofBadges.slice(0, proofLimit).map((badge) => ({
      label: badge.label,
      code: badge.code ?? null,
    })),
  ]
  const seen = new Set<string>()
  const items: PublicAuthorBadgeListItem[] = []

  for (const badge of combined) {
    const normalized = badge.label.trim()
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    items.push({
      label: normalized,
      code: badge.code ?? null,
    })
  }

  return items
}

export function readSemanticProofBadgeLabels(author: PublicAuthorLike): string[] {
  return selectSemanticAuthorBadgeSlots(author).proofBadges.map((badge) => badge.label)
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

export function readAuthorBadgeChips(
  author: PublicAuthorLike,
  options: { maxProofChips?: number; policyId: BadgeSurfacePolicyId },
): {
  identityChip: string | null
  proofChips: string[]
} {
  const { identityChip, proofChips } = readAuthorBadgeChipItems(author, options)
  return {
    identityChip: identityChip?.label ?? null,
    proofChips: proofChips.map((badge) => badge.label),
  }
}

export function readAuthorBadgeChipItems(
  author: PublicAuthorLike,
  options: { maxProofChips?: number; policyId: BadgeSurfacePolicyId },
): {
  identityChip: PublicAuthorBadgeListItem | null
  proofChips: PublicAuthorBadgeListItem[]
} {
  const maxProofChips = Math.max(0, options.maxProofChips ?? 2)
  const slots = selectAuthorBadgeSlotsByPolicy(author, options.policyId)
  return {
    identityChip: slots.identityBadges[0]
      ? {
          label: slots.identityBadges[0].label,
          code: null,
        }
      : null,
    proofChips: slots.proofBadges.slice(0, maxProofChips).map((badge) => ({
      label: badge.label,
      code: badge.code ?? null,
    })),
  }
}

export function readProjectionText(author: PublicAuthorLike): string | null {
  return selectSemanticAuthorBadgeSlots(author).projectionText ?? null
}
