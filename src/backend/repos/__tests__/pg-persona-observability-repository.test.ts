import { describe, expect, it, vi } from 'vitest'
import { PgPersonaObservabilityRepository } from '../pg/pg-persona-observability-repository.js'

describe('PgPersonaObservabilityRepository', () => {
  it('initializes a missing row before incrementing counters', async () => {
    const findUnique = vi.fn().mockResolvedValue(null)
    const upsert = vi.fn().mockResolvedValue(undefined)
    const update = vi.fn().mockResolvedValue(undefined)
    const repo = new PgPersonaObservabilityRepository({
      personaObservabilityMetrics: {
        findUnique,
        upsert,
        update,
        deleteMany: vi.fn(),
      },
    } as never, 'sha256:new', 'host:123')

    await repo.increment({
      typedWriteSuccessTotal: 1,
      retrievalTotal: 1,
    })

    expect(findUnique).toHaveBeenCalledWith({
      where: { instanceId: 'host:123' },
      select: { runtimeKey: true },
    })
    expect(upsert).toHaveBeenCalledWith({
      where: { instanceId: 'host:123' },
      create: expect.objectContaining({
        instanceId: 'host:123',
        runtimeKey: 'sha256:new',
        typedWriteSuccessTotal: 0,
        retrievalTotal: 0,
      }),
      update: { runtimeKey: 'sha256:new' },
    })
    expect(update).toHaveBeenCalledWith({
      where: { instanceId: 'host:123' },
      data: {
        typedWriteSuccessTotal: { increment: 1 },
        retrievalTotal: { increment: 1 },
      },
    })
  })

  it('resets stale instance rows when the runtime fingerprint changes before incrementing', async () => {
    const findUnique = vi.fn().mockResolvedValue({ runtimeKey: 'sha256:old' })
    const update = vi.fn().mockResolvedValue(undefined)
    const repo = new PgPersonaObservabilityRepository({
      personaObservabilityMetrics: {
        findUnique,
        upsert: vi.fn(),
        update,
        deleteMany: vi.fn(),
      },
    } as never, 'sha256:new', 'host:1')

    await repo.increment({
      identityWriteSuccessTotal: 1,
    })

    expect(update).toHaveBeenNthCalledWith(1, {
      where: { instanceId: 'host:1' },
      data: expect.objectContaining({
        runtimeKey: 'sha256:new',
        typedWriteSuccessTotal: 0,
        identityWriteSuccessTotal: 0,
        retrievalTotal: 0,
      }),
    })
    expect(update).toHaveBeenNthCalledWith(2, {
      where: { instanceId: 'host:1' },
      data: {
        identityWriteSuccessTotal: { increment: 1 },
      },
    })
  })

  it('re-initializes the row after reset deletes the current runtime snapshot', async () => {
    const findUnique = vi.fn()
      .mockResolvedValueOnce({ runtimeKey: 'sha256:new' })
      .mockResolvedValueOnce(null)
    const upsert = vi.fn().mockResolvedValue(undefined)
    const update = vi.fn().mockResolvedValue(undefined)
    const deleteMany = vi.fn().mockResolvedValue(undefined)
    const repo = new PgPersonaObservabilityRepository({
      personaObservabilityMetrics: {
        findUnique,
        upsert,
        update,
        deleteMany,
      },
    } as never, 'sha256:new', 'host:2')

    await repo.increment({ typedWriteSuccessTotal: 1 })
    await repo.reset()
    await repo.increment({ typedWriteFailureTotal: 1 })

    expect(deleteMany).toHaveBeenCalledWith({
      where: { runtimeKey: 'sha256:new' },
    })
    expect(upsert).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenNthCalledWith(1, {
      where: { instanceId: 'host:2' },
      data: {
        typedWriteSuccessTotal: { increment: 1 },
      },
    })
    expect(update).toHaveBeenNthCalledWith(2, {
      where: { instanceId: 'host:2' },
      data: {
        typedWriteFailureTotal: { increment: 1 },
      },
    })
  })
})
