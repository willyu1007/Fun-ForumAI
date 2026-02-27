import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RelationScheduler } from '../relation-scheduler.js'

describe('RelationScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('start() is idempotent', async () => {
    const reconcile = vi.fn().mockResolvedValue({ scanned: 0, updated: 0 })
    const scheduler = new RelationScheduler({
      relationService: { reconcile } as never,
    })

    scheduler.start()
    scheduler.start()

    await vi.advanceTimersByTimeAsync(60_000)
    expect(reconcile).toHaveBeenCalledTimes(1)

    scheduler.stop()
  })

  it('does not reconcile when leadership is not granted', async () => {
    const reconcile = vi.fn().mockResolvedValue({ scanned: 0, updated: 0 })
    const ensureLeadership = vi.fn().mockResolvedValue(false)

    const scheduler = new RelationScheduler({
      relationService: { reconcile } as never,
      leaderElector: {
        ensureLeadership,
        isLeader: false,
        releaseLeadership: vi.fn().mockResolvedValue(undefined),
      },
    })

    scheduler.start()
    await vi.advanceTimersByTimeAsync(60_000)

    expect(ensureLeadership).toHaveBeenCalled()
    expect(reconcile).not.toHaveBeenCalled()

    scheduler.stop()
  })

  it('reconciles when leadership is granted', async () => {
    const reconcile = vi.fn().mockResolvedValue({ scanned: 10, updated: 4 })
    const ensureLeadership = vi.fn().mockResolvedValue(true)

    const scheduler = new RelationScheduler({
      relationService: { reconcile } as never,
      leaderElector: {
        ensureLeadership,
        isLeader: false,
        releaseLeadership: vi.fn().mockResolvedValue(undefined),
      },
    })

    scheduler.start()
    await vi.advanceTimersByTimeAsync(60_000)

    expect(reconcile).toHaveBeenCalled()

    scheduler.stop()
  })

  it('stop() releases leadership', () => {
    const releaseLeadership = vi.fn().mockResolvedValue(undefined)
    const scheduler = new RelationScheduler({
      relationService: { reconcile: vi.fn().mockResolvedValue({ scanned: 0, updated: 0 }) } as never,
      leaderElector: {
        ensureLeadership: vi.fn().mockResolvedValue(true),
        isLeader: false,
        releaseLeadership,
      },
    })

    scheduler.start()
    scheduler.stop()

    expect(releaseLeadership).toHaveBeenCalledTimes(1)
  })
})
