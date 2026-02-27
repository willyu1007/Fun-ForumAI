import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NurtureScheduler } from '../nurture-scheduler.js'

describe('NurtureScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('start() is idempotent and does not register duplicate loops', async () => {
    const reconcileActiveAgents = vi.fn().mockResolvedValue({ scanned: 1, reconciled: 1 })
    const scheduler = new NurtureScheduler({
      orchestrator: { reconcileActiveAgents } as never,
      leaderElector: {
        isLeader: true,
        ensureLeadership: vi.fn().mockResolvedValue(true),
        releaseLeadership: vi.fn().mockResolvedValue(undefined),
      },
    })

    scheduler.start()
    scheduler.start()

    await vi.advanceTimersByTimeAsync(60_000)
    expect(reconcileActiveAgents).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(6 * 60 * 60 * 1000)
    expect(reconcileActiveAgents).toHaveBeenCalledTimes(2)

    scheduler.stop()
  })

  it('does not reconcile when leader lock is not held', async () => {
    const reconcileActiveAgents = vi.fn().mockResolvedValue({ scanned: 1, reconciled: 1 })
    const ensureLeadership = vi.fn().mockResolvedValue(false)
    const scheduler = new NurtureScheduler({
      orchestrator: { reconcileActiveAgents } as never,
      leaderElector: {
        isLeader: false,
        ensureLeadership,
        releaseLeadership: vi.fn().mockResolvedValue(undefined),
      },
    })

    scheduler.start()
    await vi.advanceTimersByTimeAsync(60_000)
    await vi.advanceTimersByTimeAsync(6 * 60 * 60 * 1000)

    expect(ensureLeadership).toHaveBeenCalledTimes(2)
    expect(reconcileActiveAgents).not.toHaveBeenCalled()

    scheduler.stop()
  })

  it('reconciles when leadership is acquired', async () => {
    const reconcileActiveAgents = vi.fn().mockResolvedValue({ scanned: 2, reconciled: 2 })
    const scheduler = new NurtureScheduler({
      orchestrator: { reconcileActiveAgents } as never,
      leaderElector: {
        isLeader: true,
        ensureLeadership: vi.fn().mockResolvedValue(true),
        releaseLeadership: vi.fn().mockResolvedValue(undefined),
      },
    })

    scheduler.start()
    await vi.advanceTimersByTimeAsync(60_000)

    expect(reconcileActiveAgents).toHaveBeenCalledTimes(1)
    expect(reconcileActiveAgents).toHaveBeenCalledWith(1000)

    scheduler.stop()
  })

  it('stop() releases leadership and prevents future reconcile runs', async () => {
    const reconcileActiveAgents = vi.fn().mockResolvedValue({ scanned: 1, reconciled: 1 })
    const releaseLeadership = vi.fn().mockResolvedValue(undefined)
    const scheduler = new NurtureScheduler({
      orchestrator: { reconcileActiveAgents } as never,
      leaderElector: {
        isLeader: true,
        ensureLeadership: vi.fn().mockResolvedValue(true),
        releaseLeadership,
      },
    })

    scheduler.start()
    scheduler.stop()

    await vi.advanceTimersByTimeAsync(7 * 60 * 60 * 1000)

    expect(releaseLeadership).toHaveBeenCalledTimes(1)
    expect(reconcileActiveAgents).not.toHaveBeenCalled()
  })
})
