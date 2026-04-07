import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HomeProgrammingSnapshotScheduler } from '../home-programming-snapshot-scheduler.js'

describe('HomeProgrammingSnapshotScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('start() is idempotent and runs startup + interval snapshots', async () => {
    const captureSnapshot = vi.fn().mockResolvedValue({
      snapshot_date: '2026-04-07',
      generated_at: '2026-04-07T00:00:00.000Z',
      scanned_count: 2,
      created_count: 2,
      deduped_count: 0,
      published_events: [],
    })
    const scheduler = new HomeProgrammingSnapshotScheduler(
      {
        service: { captureSnapshot } as never,
      },
      {
        startupDelayMs: 1000,
        intervalMs: 2000,
      },
    )

    scheduler.start()
    scheduler.start()

    await vi.advanceTimersByTimeAsync(1000)
    expect(captureSnapshot).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(2000)
    expect(captureSnapshot).toHaveBeenCalledTimes(2)

    scheduler.stop()
  })

  it('does not snapshot when leadership is not granted', async () => {
    const captureSnapshot = vi.fn().mockResolvedValue({
      snapshot_date: '2026-04-07',
      generated_at: '2026-04-07T00:00:00.000Z',
      scanned_count: 0,
      created_count: 0,
      deduped_count: 0,
      published_events: [],
    })
    const ensureLeadership = vi.fn().mockResolvedValue(false)
    const scheduler = new HomeProgrammingSnapshotScheduler(
      {
        service: { captureSnapshot } as never,
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
    expect(captureSnapshot).not.toHaveBeenCalled()

    scheduler.stop()
  })

  it('stop() releases leadership', () => {
    const releaseLeadership = vi.fn().mockResolvedValue(undefined)
    const scheduler = new HomeProgrammingSnapshotScheduler({
      service: {
        captureSnapshot: vi.fn().mockResolvedValue({
          snapshot_date: '2026-04-07',
          generated_at: '2026-04-07T00:00:00.000Z',
          scanned_count: 0,
          created_count: 0,
          deduped_count: 0,
          published_events: [],
        }),
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
