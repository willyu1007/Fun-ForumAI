import type { AgentRepository, HumanFollowRepository } from '../repos/index.js'
import type { AgentService } from './agent-service.js'
import { NotFoundError } from '../lib/errors.js'
import { isDeletedAgent } from '../lib/agent-lifecycle.js'

interface SearchProjectionDeps {
  reconcileAgent: (
    agentId: string,
    input: {
      reason: string
      scopes?: Array<'agent' | 'posts' | 'threads' | 'communities'>
    },
  ) => Promise<void>
}

interface PrivateChannelDeletionDeps {
  endAllActiveSessionsForAgent(agentId: string): Promise<number>
}

export interface AgentDeletionServiceDeps {
  agentRepo: AgentRepository
  agentService: AgentService
  humanFollowRepo: HumanFollowRepository
  searchProjectionService: SearchProjectionDeps
  privateChannelService?: PrivateChannelDeletionDeps | null
}

export interface DeletedAgentResult {
  id: string
  status: 'DELETED'
  deleted_at: string
}

export class AgentDeletionService {
  constructor(private readonly deps: AgentDeletionServiceDeps) {}

  async deleteAgent(agentId: string): Promise<DeletedAgentResult> {
    const existing = this.deps.agentService.getAgent(agentId)

    if (isDeletedAgent(existing) && existing.deleted_at) {
      return {
        id: existing.id,
        status: 'DELETED',
        deleted_at: existing.deleted_at.toISOString(),
      }
    }

    const deletedAt = existing.deleted_at ?? new Date()
    const updated = this.deps.agentRepo.softDeletePersisted
      ? await this.deps.agentRepo.softDeletePersisted(agentId, deletedAt)
      : this.fallbackSoftDelete(agentId, deletedAt)

    if (!updated) {
      throw new NotFoundError('Agent', agentId)
    }

    await Promise.all([
      this.deps.humanFollowRepo.removeAllByAgent(agentId),
      this.deps.privateChannelService?.endAllActiveSessionsForAgent(agentId) ?? Promise.resolve(0),
    ])

    await this.deps.searchProjectionService.reconcileAgent(agentId, {
      reason: 'agent_deleted',
      scopes: ['agent'],
    })
    this.scheduleHistoricalSearchReconcile(agentId)

    return {
      id: updated.id,
      status: 'DELETED',
      deleted_at: (updated.deleted_at ?? deletedAt).toISOString(),
    }
  }

  private fallbackSoftDelete(agentId: string, deletedAt: Date) {
    const updated = this.deps.agentRepo.updateStatus(agentId, 'DELETED')
    if (!updated) return null
    updated.deleted_at = deletedAt
    updated.updated_at = deletedAt
    return updated
  }

  private scheduleHistoricalSearchReconcile(agentId: string): void {
    void Promise.resolve()
      .then(() => this.deps.searchProjectionService.reconcileAgent(agentId, {
        reason: 'agent_deleted',
        scopes: ['posts', 'threads', 'communities'],
      }))
      .catch((error) => {
        console.error('[AgentDeletionService] historical search reconcile failed', {
          agentId,
          error,
        })
      })
  }
}
