import { describe, expect, it, vi } from 'vitest'
import { DevDataOperationLock } from '../dev-data-operation-lock.js'

describe('DevDataOperationLock', () => {
  it('rejects concurrent operations before the stale timeout', () => {
    vi.useFakeTimers()
    try {
      const lock = new DevDataOperationLock(1_000)
      lock.acquire({ kind: 'dev_seed', label: 'canonical:reset' })

      expect(() => lock.acquire({ kind: 'dev_seed', label: 'canonical:reset' })).toThrow(
        'already running',
      )
    } finally {
      vi.useRealTimers()
    }
  })

  it('auto-recovers stale operations on the next acquire', () => {
    vi.useFakeTimers()
    try {
      const lock = new DevDataOperationLock(1_000)
      lock.acquire({ kind: 'dev_seed', label: 'canonical:reset' })

      vi.advanceTimersByTime(1_500)

      expect(() =>
        lock.acquire({ kind: 'dev_seed', label: 'canonical:reset' }),
      ).not.toThrow()
    } finally {
      vi.useRealTimers()
    }
  })
})
