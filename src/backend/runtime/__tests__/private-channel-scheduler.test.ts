import { describe, expect, it, vi } from 'vitest'
import { PrivateChannelScheduler } from '../private-channel-scheduler.js'

describe('PrivateChannelScheduler', () => {
  it('triggers digest generation for timed-out sessions', async () => {
    const generateDigest = vi.fn().mockResolvedValue(null)
    const scheduler = new PrivateChannelScheduler({
      channelService: {
        checkTimeouts: vi.fn().mockResolvedValue([
          { id: 'session-1' },
          { id: 'session-2' },
        ]),
      } as never,
      memoryService: { generateDigest } as never,
      agentRepo: { findActive: vi.fn(() => ({ items: [], next_cursor: null })) } as never,
      leaderElector: { ensureLeadership: vi.fn().mockResolvedValue(true) } as never,
    })

    await (scheduler as never).checkSessionTimeouts()

    expect(generateDigest).toHaveBeenCalledTimes(2)
    expect(generateDigest).toHaveBeenNthCalledWith(1, 'session-1')
    expect(generateDigest).toHaveBeenNthCalledWith(2, 'session-2')
  })
})
