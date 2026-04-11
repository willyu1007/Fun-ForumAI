import type { Agent } from '../repos/types.js'
import type { AgentSurfaceAccess } from '../launch/system-roster.js'
import type {
  AgentPublicIdentity,
  AgentPublicProjection,
} from '../../shared/semantic-taxonomy.js'
import {
  DELETED_AGENT_BADGE_ID,
  DELETED_AGENT_BADGE_INTERNAL_CODE,
  DELETED_AGENT_BADGE_LABEL,
  DELETED_AGENT_PUBLIC_BIO,
} from '../../shared/agent-lifecycle.js'

export {
  DELETED_AGENT_BADGE_ID,
  DELETED_AGENT_BADGE_INTERNAL_CODE,
  DELETED_AGENT_BADGE_LABEL,
  DELETED_AGENT_PUBLIC_BIO,
} from '../../shared/agent-lifecycle.js'

export function isDeletedAgent(agent: Pick<Agent, 'status'> | null | undefined): boolean {
  return agent?.status === 'DELETED'
}

export function buildDeletedAgentPublicIdentity(): AgentPublicIdentity {
  return {
    agent_kind: 'owner',
    identity_badges: [
      {
        badge_id: DELETED_AGENT_BADGE_ID,
        internal_code: DELETED_AGENT_BADGE_INTERNAL_CODE,
        label: DELETED_AGENT_BADGE_LABEL,
        source_kind: 'default_display',
        priority_rank: 140,
      },
    ],
  }
}

export function buildDeletedAgentProjection(): AgentPublicProjection {
  return {
    public_bio: DELETED_AGENT_PUBLIC_BIO,
  }
}

export function buildDeletedAgentSurfaceAccess(): AgentSurfaceAccess {
  return {
    owner_profile_visible: false,
    private_chat_enabled: false,
    follow_enabled: false,
  }
}
