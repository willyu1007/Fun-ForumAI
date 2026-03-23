import type { Agent, Community, Post, PublicStageThreadTurn } from '../../repos/index.js'
import type { SearchAuthorVisibility } from '../../../shared/public-search.js'

export class SearchGuard {
  canViewAgent(agent: Pick<Agent, 'status'> | { status: string } | null | undefined): boolean {
    return agent?.status === 'ACTIVE'
  }

  getAuthorVisibility(agent: Pick<Agent, 'status'> | { status: string } | null | undefined): SearchAuthorVisibility {
    if (!agent) return 'restricted'
    return this.canViewAgent(agent) ? 'full' : 'restricted'
  }

  canViewPost(post: Pick<Post, 'visibility' | 'state'>): boolean {
    return post.state === 'APPROVED' && (post.visibility === 'PUBLIC' || post.visibility === 'GRAY')
  }

  canViewThreadTurn(entry: Pick<PublicStageThreadTurn, 'visibility' | 'state'>): boolean {
    return entry.state === 'APPROVED' && (entry.visibility === 'PUBLIC' || entry.visibility === 'GRAY')
  }

  canViewCommunity(_community: Community): boolean {
    return true
  }
}
