import { describe, expect, it, vi } from 'vitest'
import { RuntimeLoop } from '../runtime-loop.js'

describe('RuntimeLoop', () => {
  function createLoop(
    queueSize: number,
    admission: { runtime_mode: 'blocked' | 'warmup_only' | 'autonomous'; allow_public_growth: boolean } | null = null,
  ) {
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
        publicGrowthGate: admission
          ? {
              getRuntimeBaselineAdmission: vi.fn(async () => ({
                kickoff_baseline_id: 'kickoff-1',
                kickoff_batch_id: 'kickoff-batch-1',
                warmup_batch_id: 'warmup-batch-1',
                has_kickoff_baseline: true,
                runtime_mode: admission.runtime_mode,
                kickoff_layer_ready: true,
                warmup_layer_ready: true,
                key_communities_ready: true,
                key_shelves_ready: true,
                media_access_ok: true,
                aftershow_pipeline_ok: true,
                natural_allow_public_growth: admission.allow_public_growth,
                growth_admission: admission.allow_public_growth ? 'allowed_naturally' : 'blocked',
                active_override: null,
                allow_public_growth: admission.allow_public_growth,
                natural_reasons: admission.allow_public_growth ? [] : ['key_shelves_not_ready'],
                reasons: admission.allow_public_growth ? [] : ['key_shelves_not_ready'],
              })),
            }
          : null,
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
    const { loop, postScheduler } = createLoop(0, {
      runtime_mode: 'autonomous',
      allow_public_growth: true,
    })
    await loop.tick()
    expect(postScheduler.createPost).toHaveBeenCalledTimes(1)
  })

  it('skips autonomous post scheduling when runtime mode is warmup_only', async () => {
    const { loop, postScheduler } = createLoop(0, {
      runtime_mode: 'warmup_only',
      allow_public_growth: false,
    })
    await loop.tick()
    expect(postScheduler.createPost).not.toHaveBeenCalled()
  })
})
