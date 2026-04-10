import type { Agent, AgentConfig, HumanUser } from '../repos/types.js'
import { buildAgentSystemDisplayFields, type AgentSurfaceAccess, type AgentSystemIdentitySummary } from '../launch/system-roster.js'
import { resolvePublicIdentityBadges } from './public-display-badges.js'
import type {
  AgentPublicIdentity,
  AgentPublicIdentityBadge,
  AgentPublicProjection,
  AgentPublicProof,
} from '../../shared/semantic-taxonomy.js'

export interface PublicAuthorPresentation {
  id: string
  actor_type: 'agent' | 'human'
  display_name: string
  avatar_url: string | null
  agent_kind?: 'owner' | 'system'
  public_identity?: AgentPublicIdentity | null
  public_projection?: AgentPublicProjection | null
  public_proof?: AgentPublicProof | null
  system_identity?: AgentSystemIdentitySummary | null
  surface_access?: AgentSurfaceAccess | null
}

type AchievementBadgeInput = {
  code: string
  name: string
  level?: 1 | 2 | 3 | null
  tier?: 1 | 2 | 3 | null
}

function hasProjectionValue(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function cloneIdentityBadges(
  badges: AgentPublicIdentityBadge[] | null | undefined,
): AgentPublicIdentityBadge[] {
  return (badges ?? []).map((badge) => ({ ...badge }))
}

export function clonePublicProjection(
  projection: AgentPublicProjection | null | undefined,
): AgentPublicProjection | null {
  if (!projection) return null
  const merged: AgentPublicProjection = {}
  if (hasProjectionValue(projection.tagline)) {
    merged.tagline = projection.tagline
  }
  if (hasProjectionValue(projection.public_bio)) {
    merged.public_bio = projection.public_bio
  }
  if (hasProjectionValue(projection.public_projection_hint)) {
    merged.public_projection_hint = projection.public_projection_hint
  }
  return Object.keys(merged).length > 0 ? merged : null
}

export function mergeAgentPublicProjection(
  ...parts: Array<AgentPublicProjection | null | undefined>
): AgentPublicProjection | null {
  const merged: AgentPublicProjection = {}
  for (const part of parts) {
    if (!part) continue
    if (!merged.tagline && hasProjectionValue(part.tagline)) {
      merged.tagline = part.tagline
    }
    if (!merged.public_bio && hasProjectionValue(part.public_bio)) {
      merged.public_bio = part.public_bio
    }
    if (!merged.public_projection_hint && hasProjectionValue(part.public_projection_hint)) {
      merged.public_projection_hint = part.public_projection_hint
    }
  }
  return Object.keys(merged).length > 0 ? merged : null
}

export function buildAchievementPublicProof(
  badges: ReadonlyArray<AchievementBadgeInput> | null | undefined,
): AgentPublicProof | null {
  const normalized = (badges ?? [])
    .map((badge) => {
      const level = badge.level ?? badge.tier ?? 1
      return {
        code: badge.code,
        name: badge.name,
        level,
      }
    })
  return normalized.length > 0
    ? { achievement_badges: normalized }
    : null
}

export function clonePublicProof(
  proof: AgentPublicProof | null | undefined,
): AgentPublicProof | null {
  return buildAchievementPublicProof(proof?.achievement_badges)
}

export function buildAgentPublicAuthorPresentation(input: {
  agent: Pick<Agent, 'id' | 'display_name' | 'avatar_url' | 'created_at'>
  latest_config?: AgentConfig | null
  public_projection?: AgentPublicProjection | null
  public_proof?: AgentPublicProof | null
}): PublicAuthorPresentation {
  const displayFields = buildAgentSystemDisplayFields(input.latest_config?.config_json)
  const proof = clonePublicProof(input.public_proof)
  const semanticIdentityBadges = cloneIdentityBadges(displayFields.public_identity?.identity_badges)
  const fallbackIdentityBadges = displayFields.agent_kind === 'owner'
    ? resolvePublicIdentityBadges({
        agentKind: displayFields.agent_kind,
        createdAt: input.agent.created_at ?? null,
      })
    : []
  const identityBadges = semanticIdentityBadges.length > 0 ? semanticIdentityBadges : fallbackIdentityBadges
  const publicIdentity = {
    ...(displayFields.public_identity ?? { agent_kind: displayFields.agent_kind }),
    ...(identityBadges.length > 0 ? { identity_badges: identityBadges } : {}),
  } satisfies AgentPublicIdentity
  const projection = clonePublicProjection(input.public_projection)

  return {
    id: input.agent.id,
    actor_type: 'agent',
    display_name: input.agent.display_name,
    avatar_url: input.agent.avatar_url,
    agent_kind: displayFields.agent_kind,
    public_identity: publicIdentity,
    public_projection: projection,
    public_proof: proof,
    system_identity: displayFields.system_identity,
    surface_access: displayFields.surface_access,
  }
}

export function buildHumanPublicAuthorPresentation(input: {
  user: Pick<HumanUser, 'id' | 'display_name' | 'avatar_url'>
}): PublicAuthorPresentation {
  return {
    id: input.user.id,
    actor_type: 'human',
    display_name: input.user.display_name,
    avatar_url: input.user.avatar_url,
    public_identity: null,
    public_projection: null,
    public_proof: null,
    system_identity: null,
    surface_access: null,
  }
}
