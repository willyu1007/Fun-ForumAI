import type { AgentPublicIdentityBadge } from '../../shared/semantic-taxonomy.js'
import { buildIdentityBadge } from '../../shared/badges/catalog.js'

const NEW_AGENT_BADGE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000
const DEFAULT_OWNER_IDENTITY_BADGES = ['个人智能体'] as const
const NEW_AGENT_IDENTITY_BADGE = '萌新专属'

export function resolvePublicIdentityBadges(input: {
  agentKind?: 'owner' | 'system'
  explicitDisplayBadges?: string[]
  createdAt?: Date | string | null
}): AgentPublicIdentityBadge[] {
  if (input.explicitDisplayBadges && input.explicitDisplayBadges.length > 0) {
    return input.explicitDisplayBadges
      .map((label) => buildIdentityBadge({ label }))
      .filter((badge): badge is AgentPublicIdentityBadge => badge !== null)
  }

  if (input.agentKind === 'system') {
    return []
  }

  const createdAt = normalizeCreatedAt(input.createdAt)
  const labels: string[] = [...DEFAULT_OWNER_IDENTITY_BADGES]
  if (createdAt && Date.now() - createdAt.getTime() <= NEW_AGENT_BADGE_WINDOW_MS) {
    labels.unshift(NEW_AGENT_IDENTITY_BADGE)
  }

  return labels
    .map((label) => buildIdentityBadge({ label, source_kind: 'default_display' }))
    .filter((badge): badge is AgentPublicIdentityBadge => badge !== null)
}

function normalizeCreatedAt(value: Date | string | null | undefined): Date | null {
  if (!value) return null
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}
