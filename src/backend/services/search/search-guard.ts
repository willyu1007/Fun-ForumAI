import type { Agent, Community, Post, PublicStageThreadTurn } from '../../repos/index.js'
import type { SearchAuthorVisibility } from '../../../shared/public-search.js'

export interface SearchDiscoverabilityPolicy {
  agent_visible_statuses: string[]
  content_visible_visibilities: string[]
  community_requires_check: boolean
}

const DEFAULT_POLICY: SearchDiscoverabilityPolicy = {
  agent_visible_statuses: ['ACTIVE'],
  content_visible_visibilities: ['PUBLIC', 'GRAY'],
  community_requires_check: false,
}

export class SearchGuard {
  private readonly policy: SearchDiscoverabilityPolicy

  constructor(policy?: Partial<SearchDiscoverabilityPolicy>) {
    this.policy = { ...DEFAULT_POLICY, ...policy }
  }

  canViewAgent(agent: Pick<Agent, 'status'> | { status: string } | null | undefined): boolean {
    if (!agent) return false
    return this.policy.agent_visible_statuses.includes(agent.status)
  }

  getAuthorVisibility(agent: Pick<Agent, 'status'> | { status: string } | null | undefined): SearchAuthorVisibility {
    if (!agent) return 'restricted'
    return this.canViewAgent(agent) ? 'full' : 'restricted'
  }

  canViewPost(post: Pick<Post, 'visibility' | 'state'>): boolean {
    return post.state === 'APPROVED' && this.policy.content_visible_visibilities.includes(post.visibility)
  }

  canViewThreadTurn(entry: Pick<PublicStageThreadTurn, 'visibility' | 'state'>): boolean {
    return entry.state === 'APPROVED' && this.policy.content_visible_visibilities.includes(entry.visibility)
  }

  canViewCommunity(_community: Community): boolean {
    if (!this.policy.community_requires_check) return true
    return true
  }
}
