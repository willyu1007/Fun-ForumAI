import { describe, expect, it, vi } from 'vitest'
import { PgMemoryRepository } from '../pg/pg-memory-repository.js'

describe('PgMemoryRepository', () => {
  it('applies source_session_id when listing memories for receipt deep links', async () => {
    const findMany = vi.fn().mockResolvedValue([])
    const repo = new PgMemoryRepository({
      agentMemory: {
        findMany,
      },
    } as never)

    await repo.listMemories('agent-1', {
      limit: 10,
      source_session_id: 'session-1',
    })

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        agentId: 'agent-1',
        sourceSessionId: 'session-1',
      }),
      take: 11,
    }))
  })
})
