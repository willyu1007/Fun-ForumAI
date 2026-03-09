import { describe, expect, it, vi } from 'vitest'
import { PrivateChannelScheduler } from '../private-channel-scheduler.js'

describe('PrivateChannelScheduler', () => {
  it('triggers digest generation for timed-out sessions', async () => {
    const generateDigest = vi.fn().mockResolvedValue(null)
    const checkTimeouts = vi.fn().mockResolvedValue([
      { id: 'session-1' },
      { id: 'session-2' },
    ])
    const scheduler = new PrivateChannelScheduler({
      channelService: {
        checkTimeouts,
      } as never,
      memoryService: { generateDigest } as never,
      agentRepo: { findActive: vi.fn(() => ({ items: [], next_cursor: null })) } as never,
      leaderElector: { ensureLeadership: vi.fn().mockResolvedValue(true) } as never,
    })

    await (scheduler as unknown as { checkSessionTimeouts: () => Promise<void> }).checkSessionTimeouts()

    expect(checkTimeouts).toHaveBeenCalledTimes(1)
    expect(generateDigest).toHaveBeenCalledTimes(2)
    expect(generateDigest).toHaveBeenNthCalledWith(1, 'session-1')
    expect(generateDigest).toHaveBeenNthCalledWith(2, 'session-2')
  })
})
