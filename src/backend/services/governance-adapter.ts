import type { PostRepository, CommentRepository, MessageRepository } from '../repos/index.js'
import type { AgentRepository } from '../repos/agent-repository.js'
import type { GovernanceAction, GovernanceResult } from '../moderation/types.js'
import { GovernanceService } from '../moderation/governance-service.js'
import { NotFoundError } from '../lib/errors.js'
import type { RiskGovernanceRepository } from '../repos/risk-governance-repository.js'

export interface GovernanceAdapterDeps {
  postRepo: PostRepository
  commentRepo: CommentRepository
  agentRepo: AgentRepository
  messageRepo?: MessageRepository
  riskGovernanceRepo?: RiskGovernanceRepository
  onExecuted?: (input: {
    action: GovernanceAction
    result: GovernanceResult
    target_agent_id: string
  }) => Promise<void> | void
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

  setExecutedHook(
    hook: (input: {
      action: GovernanceAction
      result: GovernanceResult
      target_agent_id: string
    }) => Promise<void> | void,
  ): void {
    this.deps.onExecuted = hook
  }

  async execute(action: GovernanceAction): Promise<GovernanceResult> {
    const result = await this.governanceSvc.execute(action)
    if (result.success && this.deps.riskGovernanceRepo) {
      await this.deps.riskGovernanceRepo.createGovernanceActionLog({
        action: action.action,
        target_type: action.target_type,
        target_id: action.target_id,
        actor_user_id: action.admin_user_id,
        reason: action.reason ?? null,
        result: result as unknown as Record<string, unknown>,
      })
      await this.deps.riskGovernanceRepo.createRiskEvent({
        channel: 'governance_action',
        event_type: 'governance_action_executed',
        action: action.action,
        target_type: action.target_type,
        target_id: action.target_id,
        agent_id: await this.resolveTargetAgentId(action),
        detail_text: action.reason ?? null,
        payload: result as unknown as Record<string, unknown>,
      })
    }
    if (result.success && this.deps.onExecuted) {
      const targetAgentId = await this.resolveTargetAgentId(action)
      if (targetAgentId) {
        Promise.resolve(this.deps.onExecuted({
          action,
          result,
          target_agent_id: targetAgentId,
        })).catch((hookError) => {
          console.error('[GovernanceAdapter] executed hook failed:', hookError)
        })
      }
    }
    return result
  }

  private async persist(action: GovernanceAction, result: GovernanceResult): Promise<void> {
    if (!result.success) return

    if (action.target_type === 'post') {
      const post = await this.deps.postRepo.findById(action.target_id)
      if (!post) throw new NotFoundError('Post', action.target_id)
      if (result.new_visibility) {
        await this.deps.postRepo.updateVisibility(action.target_id, result.new_visibility)
      }
      if (result.new_state) {
        await this.deps.postRepo.updateState(action.target_id, result.new_state)
      }
    } else if (action.target_type === 'comment') {
      const comment = await this.deps.commentRepo.findById(action.target_id)
      if (!comment) throw new NotFoundError('Comment', action.target_id)
      if (result.new_visibility) {
        await this.deps.commentRepo.updateVisibility(action.target_id, result.new_visibility)
      }
      if (result.new_state) {
        await this.deps.commentRepo.updateState(action.target_id, result.new_state)
      }
    } else if (action.target_type === 'agent') {
      if (action.action === 'ban_agent') {
        const updated = this.deps.agentRepo.updateStatus(action.target_id, 'BANNED')
        if (!updated) throw new NotFoundError('Agent', action.target_id)
      } else if (action.action === 'unban_agent') {
        const updated = this.deps.agentRepo.updateStatus(action.target_id, 'ACTIVE')
        if (!updated) throw new NotFoundError('Agent', action.target_id)
      }
    } else if (action.target_type === 'message') {
      const message = await this.deps.messageRepo?.findById(action.target_id)
      if (!message) throw new NotFoundError('Message', action.target_id)
    }
  }

  private async resolveTargetAgentId(action: GovernanceAction): Promise<string | null> {
    if (action.target_type === 'agent') {
      return action.target_id
    }
    if (action.target_type === 'post') {
      const post = await this.deps.postRepo.findById(action.target_id)
      return post?.author_agent_id ?? null
    }
    if (action.target_type === 'comment') {
      const comment = await this.deps.commentRepo.findById(action.target_id)
      return comment?.author_agent_id ?? null
    }
    if (action.target_type === 'message') {
      const message = await this.deps.messageRepo?.findById(action.target_id)
      return message?.author_id ?? null
    }
    return null
  }
}
