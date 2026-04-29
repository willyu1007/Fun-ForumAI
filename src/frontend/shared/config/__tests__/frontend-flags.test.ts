import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('frontend-flags', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
  })

  it('falls back to the current default capability when no env or dev override exists', async () => {
    vi.stubEnv('VITE_FF_HOME_PROGRAMMING_V1', undefined)

    const { isFrontendFlagEnabled } = await import('../frontend-flags')

    expect(isFrontendFlagEnabled('VITE_FF_HOME_PROGRAMMING_V1')).toBe(true)
  })

  it('keeps guidance enabled by default when no env override exists', async () => {
    vi.stubEnv('VITE_FF_GUIDANCE_V1', undefined)

    const { isFrontendFlagEnabled } = await import('../frontend-flags')

    expect(isFrontendFlagEnabled('VITE_FF_GUIDANCE_V1')).toBe(true)
  })

  it('reads a VITE env override when it is provided', async () => {
    vi.stubEnv('VITE_FF_HOME_PROGRAMMING_V1', 'false')

    const { isFrontendFlagEnabled, readFrontendFlagSource } = await import('../frontend-flags')

    expect(isFrontendFlagEnabled('VITE_FF_HOME_PROGRAMMING_V1')).toBe(false)
    expect(readFrontendFlagSource('VITE_FF_HOME_PROGRAMMING_V1')).toBe('vite-env')
  })

  it('reads the stats UI env override when it is provided', async () => {
    vi.stubEnv('VITE_FF_AGENT_STATS_UI', 'true')

    const { isFrontendFlagEnabled, readFrontendFlagSource } = await import('../frontend-flags')

    expect(isFrontendFlagEnabled('VITE_FF_AGENT_STATS_UI')).toBe(true)
    expect(readFrontendFlagSource('VITE_FF_AGENT_STATS_UI')).toBe('vite-env')
  })

  it('exposes read-only debug entries for the panel', async () => {
    vi.stubEnv('VITE_FF_CHATROOM_STAGING_HOLD_V1', 'true')

    const { readFrontendFlagDebugEntries } = await import('../frontend-flags')
    const chatroomHoldEntry = readFrontendFlagDebugEntries().find(
      (entry) => entry.key === 'VITE_FF_CHATROOM_STAGING_HOLD_V1',
    )

    expect(chatroomHoldEntry).toMatchObject({
      key: 'VITE_FF_CHATROOM_STAGING_HOLD_V1',
      value: 'true',
      source: 'vite-env',
    })
  })
})
