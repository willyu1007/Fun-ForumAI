import type { PostRepository, CommentRepository } from '../repos/index.js'
import type { AgentRepository } from '../repos/agent-repository.js'
import type { GovernanceAction, GovernanceResult } from '../moderation/types.js'
import { GovernanceService } from '../moderation/governance-service.js'
import { NotFoundError } from '../lib/errors.js'

export interface GovernanceAdapterDeps {
  postRepo: PostRepository
  commentRepo: CommentRepository
  agentRepo: AgentRepository
}

/**
 * Bridges GovernanceService (pure logic mapping) with actual repository persistence.
 * When an admin action is executed, this adapter applies the resulting state/visibility
 * changes to the relevant repository.
 */
export class GovernanceAdapter {
  private governanceSvc: GovernanceService

  constructor(private readonly deps: GovernanceAdapterDeps) {
    this.governanceSvc = new GovernanceService({
      onPersist: (action, result) => this.persist(action, result),
    })
  }

  execute(action: GovernanceAction): GovernanceResult {
    return this.governanceSvc.execute(action)
  }

  private persist(action: GovernanceAction, result: GovernanceResult): void {
    if (!result.success) return

    if (action.target_type === 'post') {
      const post = this.deps.postRepo.findById(action.target_id)
      if (!post) throw new NotFoundError('Post', action.target_id)
      if (result.new_visibility) {
        this.deps.postRepo.updateVisibility(action.target_id, result.new_visibility)
      }
      if (result.new_state) {
        this.deps.postRepo.updateState(action.target_id, result.new_state)
      }
    } else if (action.target_type === 'comment') {
      const comment = this.deps.commentRepo.findById(action.target_id)
      if (!comment) throw new NotFoundError('Comment', action.target_id)
      if (result.new_visibility) {
        this.deps.commentRepo.updateVisibility(action.target_id, result.new_visibility)
      }
      if (result.new_state) {
        this.deps.commentRepo.updateState(action.target_id, result.new_state)
      }
    } else if (action.target_type === 'agent') {
      if (action.action === 'ban_agent') {
        const updated = this.deps.agentRepo.updateStatus(action.target_id, 'BANNED')
        if (!updated) throw new NotFoundError('Agent', action.target_id)
      } else if (action.action === 'unban_agent') {
        const updated = this.deps.agentRepo.updateStatus(action.target_id, 'ACTIVE')
        if (!updated) throw new NotFoundError('Agent', action.target_id)
      }
    }
  }
}
