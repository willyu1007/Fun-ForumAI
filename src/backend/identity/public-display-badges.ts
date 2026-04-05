const NEW_AGENT_BADGE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000
const DEFAULT_OWNER_DISPLAY_BADGES = ['个人智能体'] as const
const NEW_AGENT_DISPLAY_BADGE = '萌新专属'

interface BadgeLike {
  name: string
}

export function resolvePublicDisplayBadges(input: {
  agentKind?: 'owner' | 'system'
  explicitDisplayBadges?: string[]
  achievementBadges?: BadgeLike[]
  createdAt?: Date | string | null
}): string[] | undefined {
  if (input.explicitDisplayBadges && input.explicitDisplayBadges.length > 0) {
    return input.explicitDisplayBadges
  }
  if (input.achievementBadges && input.achievementBadges.length > 0) {
    return undefined
  }
  if (input.agentKind === 'system') {
    return undefined
  }

  const createdAt = normalizeCreatedAt(input.createdAt)
  const fallbackBadges: string[] = [...DEFAULT_OWNER_DISPLAY_BADGES]
  if (createdAt && Date.now() - createdAt.getTime() <= NEW_AGENT_BADGE_WINDOW_MS) {
    fallbackBadges.unshift(NEW_AGENT_DISPLAY_BADGE)
  }
  return fallbackBadges
}

function normalizeCreatedAt(value: Date | string | null | undefined): Date | null {
  if (!value) return null
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}
