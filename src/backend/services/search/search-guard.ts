import type { Agent, Comment, Community, Post } from '../../repos/index.js'
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

  canViewComment(comment: Pick<Comment, 'visibility' | 'state'>): boolean {
    return comment.state === 'APPROVED' && (comment.visibility === 'PUBLIC' || comment.visibility === 'GRAY')
  }

  canViewCommunity(_community: Community): boolean {
    return true
  }
}
