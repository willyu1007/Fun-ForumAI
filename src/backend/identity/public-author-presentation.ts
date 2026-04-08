import type { Agent, AgentConfig, HumanUser } from '../repos/types.js'
import { buildAgentSystemDisplayFields, type AgentSurfaceAccess, type AgentSystemIdentitySummary } from '../launch/system-roster.js'
import { resolvePublicIdentityBadges } from './public-display-badges.js'
import type {
  AgentPublicIdentity,
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

export function buildAgentPublicAuthorPresentation(input: {
  agent: Pick<Agent, 'id' | 'display_name' | 'avatar_url' | 'created_at'>
  latest_config?: AgentConfig | null
  public_projection?: AgentPublicProjection | null
  public_proof?: AgentPublicProof | null
}): PublicAuthorPresentation {
  const displayFields = buildAgentSystemDisplayFields(input.latest_config?.config_json)
  const publicProof = input.public_proof?.achievement_badges ?? []
  const proof = publicProof.length > 0
    ? { achievement_badges: publicProof.map((badge) => ({ ...badge })) } satisfies AgentPublicProof
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
    input.public_projection?.tagline || input.public_projection?.public_bio || input.public_projection?.public_projection_hint
      ? { ...input.public_projection } satisfies AgentPublicProjection
      : null

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
