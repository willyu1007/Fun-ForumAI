import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CommunityConfigScheduler } from '../community-config-scheduler.js'

describe('CommunityConfigScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('start() is idempotent and runs startup + interval scans', async () => {
    const processDueScheduled = vi.fn().mockResolvedValue({ processed: 0, failed: 0, exhausted: 0 })
    const scheduler = new CommunityConfigScheduler(
      {
        service: { processDueScheduled } as never,
      },
      {
        startupDelayMs: 1000,
        intervalMs: 2000,
      },
    )

    scheduler.start()
    scheduler.start()

    await vi.advanceTimersByTimeAsync(1000)
    expect(processDueScheduled).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(2000)
    expect(processDueScheduled).toHaveBeenCalledTimes(2)

    scheduler.stop()
  })

  it('does not scan when leadership is not granted', async () => {
    const processDueScheduled = vi.fn().mockResolvedValue({ processed: 0, failed: 0, exhausted: 0 })
    const ensureLeadership = vi.fn().mockResolvedValue(false)
    const scheduler = new CommunityConfigScheduler(
      {
        service: { processDueScheduled } as never,
        leaderElector: {
          ensureLeadership,
          isLeader: false,
          releaseLeadership: vi.fn().mockResolvedValue(undefined),
        },
      },
      {
        startupDelayMs: 1000,
        intervalMs: 2000,
      },
    )

    scheduler.start()
    await vi.advanceTimersByTimeAsync(1000)

    expect(ensureLeadership).toHaveBeenCalled()
    expect(processDueScheduled).not.toHaveBeenCalled()

    scheduler.stop()
  })

  it('stop() releases leadership', () => {
    const releaseLeadership = vi.fn().mockResolvedValue(undefined)
    const scheduler = new CommunityConfigScheduler({
      service: {
        processDueScheduled: vi.fn().mockResolvedValue({ processed: 0, failed: 0, exhausted: 0 }),
      } as never,
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
