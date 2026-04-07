import type { Agent, AgentConfig, HumanUser } from '../repos/types.js'
import { buildAgentSystemDisplayFields, type AgentSurfaceAccess, type AgentSystemIdentitySummary } from '../launch/system-roster.js'
import {
  resolvePublicDisplayBadges,
  resolvePublicIdentityBadges,
} from './public-display-badges.js'
import type {
  AgentPublicIdentity,
  AgentPublicProjection,
  AgentPublicProof,
} from '../../shared/semantic-taxonomy.js'

type BadgeLike = {
  code: string
  name: string
  tier?: 1 | 2 | 3
  level?: 1 | 2 | 3
}

export interface PublicAuthorPresentation {
  id: string
  actor_type: 'agent' | 'human'
  display_name: string
  avatar_url: string | null
  badges?: Array<{ code: string; name: string; tier: 1 | 2 | 3 }>
  agent_kind?: 'owner' | 'system'
  public_identity?: AgentPublicIdentity | null
  public_projection?: AgentPublicProjection | null
  public_proof?: AgentPublicProof | null
  system_identity?: AgentSystemIdentitySummary | null
  surface_access?: AgentSurfaceAccess | null
  display_badges?: string[]
  tagline?: string
  public_bio?: string | null
}

function normalizeProofBadges(badges: BadgeLike[] | null | undefined): AgentPublicProof['achievement_badges'] {
  return (badges ?? []).map((badge) => ({
    code: badge.code,
    name: badge.name,
    level: badge.level ?? badge.tier ?? 1,
  }))
}

export function buildAgentPublicAuthorPresentation(input: {
  agent: Pick<Agent, 'id' | 'display_name' | 'avatar_url' | 'created_at'>
  latest_config?: AgentConfig | null
  tagline?: string | null
  public_bio?: string | null
  public_projection_hint?: string | null
  badges?: BadgeLike[] | null
}): PublicAuthorPresentation {
  const displayFields = buildAgentSystemDisplayFields(input.latest_config?.config_json)
  const publicProof = normalizeProofBadges(input.badges)
  const proof = publicProof.length > 0
    ? { achievement_badges: publicProof } satisfies AgentPublicProof
    : null
  const publicIdentity = {
    ...(displayFields.public_identity ?? { agent_kind: displayFields.agent_kind }),
    identity_badges: resolvePublicIdentityBadges({
      agentKind: displayFields.agent_kind,
      explicitDisplayBadges: displayFields.display_badges,
      createdAt: input.agent.created_at ?? null,
    }),
  } satisfies AgentPublicIdentity
  const projection =
    input.tagline || input.public_bio || input.public_projection_hint
      ? {
          ...(input.tagline ? { tagline: input.tagline } : {}),
          ...(input.public_bio ? { public_bio: input.public_bio } : {}),
          ...(input.public_projection_hint ? { public_projection_hint: input.public_projection_hint } : {}),
        } satisfies AgentPublicProjection
      : null
  const resolvedDisplayBadges = resolvePublicDisplayBadges({
    agentKind: displayFields.agent_kind,
    identityBadges: publicIdentity.identity_badges,
    publicProof: proof,
  })

  return {
    id: input.agent.id,
    actor_type: 'agent',
    display_name: input.agent.display_name,
    avatar_url: input.agent.avatar_url,
    ...(input.badges && input.badges.length > 0
      ? {
          badges: input.badges.map((badge) => ({
            code: badge.code,
            name: badge.name,
            tier: badge.tier ?? badge.level ?? 1,
          })),
        }
      : {}),
    agent_kind: displayFields.agent_kind,
    public_identity: publicIdentity,
    public_projection: projection,
    public_proof: proof,
    system_identity: displayFields.system_identity,
    surface_access: displayFields.surface_access,
    ...(resolvedDisplayBadges && resolvedDisplayBadges.length > 0
      ? { display_badges: resolvedDisplayBadges }
      : {}),
    ...(projection?.tagline ? { tagline: projection.tagline } : {}),
    ...(projection?.public_bio ? { public_bio: projection.public_bio } : {}),
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
    display_badges: [],
    public_bio: null,
  }
}
