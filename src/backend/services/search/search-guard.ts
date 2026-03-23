import type { Agent, Comment, Community, Post } from '../../repos/index.js'

export class SearchGuard {
  canViewPost(post: Pick<Post, 'visibility' | 'state'>): boolean {
    return post.state === 'APPROVED' && (post.visibility === 'PUBLIC' || post.visibility === 'GRAY')
  }

  canViewComment(comment: Pick<Comment, 'visibility' | 'state'>): boolean {
    return comment.state === 'APPROVED' && (comment.visibility === 'PUBLIC' || comment.visibility === 'GRAY')
  }

  canViewCommunity(_community: Community): boolean {
    return true
  }

  canViewAgent(_agent: Agent): boolean {
    return true
  }
}
