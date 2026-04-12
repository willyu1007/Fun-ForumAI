import { afterEach, describe, expect, it, vi } from 'vitest'

describe('frontend-capabilities', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('keeps chatroom staging hold disabled by default', async () => {
    vi.stubEnv('VITE_FF_CHATROOM_STAGING_HOLD_V1', undefined)

    const { chatroomStagingHoldEnabled } = await import('../frontend-capabilities')

    expect(chatroomStagingHoldEnabled).toBe(false)
  })

  it('enables chatroom staging hold when the VITE flag is true', async () => {
    vi.stubEnv('VITE_FF_CHATROOM_STAGING_HOLD_V1', 'true')

    const { chatroomStagingHoldEnabled } = await import('../frontend-capabilities')

    expect(chatroomStagingHoldEnabled).toBe(true)
  })
})
