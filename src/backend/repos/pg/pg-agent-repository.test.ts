import { describe, expect, it, vi } from 'vitest'
import { PgAgentConfigRepository, PgAgentRepository } from './pg-agent-repository.js'

describe('PgAgentRepository hydrate', () => {
  it('drops agents that no longer exist in the database after a rehydrate', async () => {
    const findMany = vi
      .fn()
      .mockResolvedValueOnce([
        {
          id: 'agent-1',
          ownerId: 'owner-1',
          displayName: 'Agent One',
          avatarUrl: null,
          personaVersion: 1,
          reputationScore: 0,
          status: 'ACTIVE',
          deletedAt: null,
          createdAt: new Date('2026-04-14T00:00:00.000Z'),
          updatedAt: new Date('2026-04-14T00:00:00.000Z'),
        },
      ])
      .mockResolvedValueOnce([])

    const repo = new PgAgentRepository({
      agent: {
        findMany,
        create: vi.fn(),
        deleteMany: vi.fn(),
        update: vi.fn(),
      },
    } as never, { refreshIntervalMs: 0 })

    await repo.hydrate()
    expect(repo.findById('agent-1')?.display_name).toBe('Agent One')

    await repo.hydrate()
    expect(repo.findById('agent-1')).toBeNull()
    expect(repo.findByOwner('owner-1')).toEqual([])
  })
})

describe('PgAgentConfigRepository hydrate', () => {
  it('drops configs that disappeared from the database after a rehydrate', async () => {
    const findMany = vi
      .fn()
      .mockResolvedValueOnce([
        {
          id: 'cfg-1',
          agentId: 'agent-1',
          configJson: { identity: { contract: { launchSystem: true } } },
          riskLevel: 'LOW',
          reviewStatus: 'NOT_REQUIRED',
          reviewCaseId: null,
          lintWarningsJson: [],
          updatedAt: new Date('2026-04-14T00:00:00.000Z'),
          effectiveAt: new Date('2026-04-14T00:00:00.000Z'),
          updatedBy: 'system',
        },
      ])
      .mockResolvedValueOnce([])

    const repo = new PgAgentConfigRepository({
      agentConfig: {
        findMany,
        create: vi.fn(),
      },
    } as never, { refreshIntervalMs: 0 })

    await repo.hydrate()
    expect(repo.findLatest('agent-1')?.id).toBe('cfg-1')

    await repo.hydrate()
    expect(repo.findLatest('agent-1')).toBeNull()
  })
})
