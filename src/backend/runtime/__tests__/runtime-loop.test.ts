import { describe, expect, it, vi } from 'vitest'
import { RuntimeLoop } from '../runtime-loop.js'

describe('RuntimeLoop', () => {
  function createLoop(queueSize: number) {
    const postScheduler = { createPost: vi.fn().mockResolvedValue({ triggered: false }) }
    const queue = {
      dequeue: vi.fn().mockResolvedValue(null),
      size: vi.fn().mockResolvedValue(queueSize),
      oldestTimestampMs: vi.fn().mockResolvedValue(null),
    }

    const loop = new RuntimeLoop(
      {
        queue: queue as never,
        allocator: { allocate: vi.fn() } as never,
        degradation: { reportLag: vi.fn() } as never,
        quotaCalc: { recordThreadAllocation: vi.fn() } as never,
        executor: { execute: vi.fn() } as never,
        postScheduler: postScheduler as never,
      },
      {
        intervalMs: 100,
        batchSize: 1,
      },
    )

    return { loop, postScheduler, queue }
  }

  it('skips autonomous post scheduling when queue backlog exists', async () => {
    const { loop, postScheduler } = createLoop(3)
    await loop.tick()
    expect(postScheduler.createPost).not.toHaveBeenCalled()
  })

  it('allows autonomous post scheduling when queue is empty', async () => {
    const { loop, postScheduler } = createLoop(0)
    await loop.tick()
    expect(postScheduler.createPost).toHaveBeenCalledTimes(1)
  })
})
