import { describe, expect, it, vi } from 'vitest'
import { InMemoryAgentConfigRepository, InMemoryAgentRepository } from '../../repos/agent-repository.js'
import { InMemoryAgentRunRepository } from '../../repos/event-repository.js'
import { AgentService } from '../agent-service.js'
import { AgentDeletionService } from '../agent-deletion-service.js'

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('AgentDeletionService', () => {
  it('returns after immediate delete work and agent search refresh without waiting for historical backfill', async () => {
    const agentRepo = new InMemoryAgentRepository()
    const agentConfigRepo = new InMemoryAgentConfigRepository()
    const agentRunRepo = new InMemoryAgentRunRepository()
    const agentService = new AgentService({
      agentRepo,
      agentConfigRepo,
      agentRunRepo,
    })
    const agent = agentRepo.create({
      owner_id: 'user-1',
      display_name: 'Delete Me',
    })
    const historicalReconcile = createDeferred<void>()
    const humanFollowRepo = {
      removeAllByAgent: vi.fn(async () => 3),
    }
    const privateChannelService = {
      endAllActiveSessionsForAgent: vi.fn(async () => 2),
    }
    const searchProjectionService = {
      reconcileAgent: vi.fn(async (_agentId: string, input: {
        reason: string
        scopes?: Array<'agent' | 'posts' | 'threads' | 'communities'>
      }) => {
        if (input.scopes?.length === 1 && input.scopes[0] === 'agent') {
          return
        }
        return historicalReconcile.promise
      }),
    }

    const service = new AgentDeletionService({
      agentRepo,
      agentService,
      humanFollowRepo: humanFollowRepo as never,
      privateChannelService: privateChannelService as never,
      searchProjectionService,
    })

    const outcome = await Promise.race([
      service.deleteAgent(agent.id).then((value) => ({ kind: 'result' as const, value })),
      new Promise<{ kind: 'timeout' }>((resolve) => setTimeout(() => resolve({ kind: 'timeout' }), 40)),
    ])

    expect(outcome.kind).toBe('result')
    if (outcome.kind !== 'result') {
      throw new Error('deleteAgent did not resolve before timeout')
    }

    expect(outcome.value).toMatchObject({
      id: agent.id,
      status: 'DELETED',
      deleted_at: expect.any(String),
    })
    expect(agentRepo.findById(agent.id)?.status).toBe('DELETED')
    expect(humanFollowRepo.removeAllByAgent).toHaveBeenCalledWith(agent.id)
    expect(privateChannelService.endAllActiveSessionsForAgent).toHaveBeenCalledWith(agent.id)
    expect(searchProjectionService.reconcileAgent).toHaveBeenNthCalledWith(1, agent.id, {
      reason: 'agent_deleted',
      scopes: ['agent'],
    })
    expect(searchProjectionService.reconcileAgent).toHaveBeenNthCalledWith(2, agent.id, {
      reason: 'agent_deleted',
      scopes: ['posts', 'threads', 'communities'],
    })

    historicalReconcile.resolve()
    await Promise.resolve()
  })

  it('keeps delete successful even if historical search backfill fails later', async () => {
    const agentRepo = new InMemoryAgentRepository()
    const agentConfigRepo = new InMemoryAgentConfigRepository()
    const agentRunRepo = new InMemoryAgentRunRepository()
    const agentService = new AgentService({
      agentRepo,
      agentConfigRepo,
      agentRunRepo,
    })
    const agent = agentRepo.create({
      owner_id: 'user-1',
      display_name: 'Delete Me Too',
    })
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const searchProjectionService = {
      reconcileAgent: vi.fn(async (_agentId: string, input: {
        reason: string
        scopes?: Array<'agent' | 'posts' | 'threads' | 'communities'>
      }) => {
        if (input.scopes?.length === 1 && input.scopes[0] === 'agent') {
          return
        }
        throw new Error('background refresh failed')
      }),
    }

    const service = new AgentDeletionService({
      agentRepo,
      agentService,
      humanFollowRepo: {
        removeAllByAgent: vi.fn(async () => 0),
      } as never,
      searchProjectionService,
      privateChannelService: {
        endAllActiveSessionsForAgent: vi.fn(async () => 0),
      } as never,
    })

    await expect(service.deleteAgent(agent.id)).resolves.toMatchObject({
      id: agent.id,
      status: 'DELETED',
    })
    await Promise.resolve()
    await Promise.resolve()

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[AgentDeletionService] historical search reconcile failed',
      expect.objectContaining({
        agentId: agent.id,
        error: expect.any(Error),
      }),
    )

    consoleErrorSpy.mockRestore()
  })
})
