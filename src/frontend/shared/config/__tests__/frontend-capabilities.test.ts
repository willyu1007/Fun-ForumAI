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

  it('enables agent stats UI when the VITE flag is true', async () => {
    vi.stubEnv('VITE_FF_AGENT_STATS_UI', 'true')

    const { agentStatsUiEnabled } = await import('../frontend-capabilities')

    expect(agentStatsUiEnabled).toBe(true)
  })

  it('enables guidance by default in local dev when no explicit VITE flag is set', async () => {
    vi.stubEnv('DEV', true)
    vi.stubEnv('VITE_FF_GUIDANCE_V1', undefined)

    const { guidanceEnabled, guidanceBellEnabled } = await import('../frontend-capabilities')

    expect(guidanceEnabled).toBe(true)
    expect(guidanceBellEnabled).toBe(true)
  })

  it('respects an explicit false guidance VITE flag in local dev', async () => {
    vi.stubEnv('DEV', true)
    vi.stubEnv('VITE_FF_GUIDANCE_V1', 'false')

    const { guidanceEnabled, guidanceBellEnabled } = await import('../frontend-capabilities')

    expect(guidanceEnabled).toBe(false)
    expect(guidanceBellEnabled).toBe(false)
  })
})
